import { Injectable, inject, signal } from '@angular/core';
import { CoachService, TranscriptSegment } from './coach.service';
import { environment } from '../../../environments/environment';

export type CoachUxState =
  | 'ready'
  | 'requesting_mic'
  | 'connecting'
  | 'ai_speaking'
  | 'user_speaking'
  | 'processing'
  | 'reconnecting'
  | 'mic_error'
  | 'ai_error'
  | 'ending';

export interface LiveTranscriptItem {
  id: string;
  speaker: 'USER' | 'AI';
  text: string;
  isPartial?: boolean;
  time: string;
  seq: number;
}

@Injectable({
  providedIn: 'root',
})
export class CoachVoiceService {
  private readonly coachService = inject(CoachService);

  // Reactive state signals
  readonly uxState = signal<CoachUxState>('ready');
  readonly liveTranscripts = signal<LiveTranscriptItem[]>([]);
  readonly isMockMode = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isMicMuted = signal<boolean>(false);

  private ws: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private activeSessionId: string | null = null;
  private lastSeq = 0;
  private isIntentionalClose = false;

  get formattedLastSeq(): number {
    return this.lastSeq;
  }

  /**
   * Start a real-time voice conversation session over WebSocket.
   */
  async startVoiceSession(sessionId: string): Promise<void> {
    this.activeSessionId = sessionId;
    this.isIntentionalClose = false;
    this.errorMessage.set(null);
    this.uxState.set('connecting');

    try {
      // 1. Acquire single-use authentication ticket
      const ticketRes = await this.coachService.getWsTicket().toPromise();
      if (!ticketRes?.ticket) {
        throw new Error('Failed to obtain WebSocket ticket');
      }

      // 2. Open WebSocket connection
      this.connectWebSocket(sessionId, ticketRes.ticket, this.lastSeq);

      // 3. Request microphone unless in Dev Mock Mode
      if (!this.isMockMode()) {
        await this.initMicrophone();
      } else {
        this.uxState.set('user_speaking');
      }
    } catch (err: unknown) {
      console.error('Failed to initialize voice session:', err);
      this.uxState.set('mic_error');
      this.errorMessage.set(
        err instanceof Error ? err.message : 'Could not access microphone'
      );
    }
  }

  private connectWebSocket(sessionId: string, ticket: string, lastSeq = 0): void {
    const wsBase = environment.apiUrl.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/ws/sessions/${sessionId}?ticket=${ticket}&lastSeq=${lastSeq}`;

    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.uxState.set('ready');
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          this.handleControlMessage(msg);
        } catch (e) {
          console.warn('Non-JSON WebSocket text message:', event.data);
        }
      }
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      if (!this.isIntentionalClose) {
        this.uxState.set('reconnecting');
      }
    };

    this.ws.onclose = (event) => {
      this.stopHeartbeat();
      if (!this.isIntentionalClose && this.uxState() !== 'ending') {
        this.uxState.set('reconnecting');
        this.scheduleReconnect();
      }
    };
  }

  private handleControlMessage(msg: {
    type: string;
    state?: string;
    speaker?: 'USER' | 'AI';
    segmentId?: string;
    text?: string;
    seq?: number;
    isSpeaking?: boolean;
    code?: string;
    message?: string;
  }): void {
    switch (msg.type) {
      case 'session.state':
        if (msg.state === 'ACTIVE') {
          if (this.uxState() === 'connecting' || this.uxState() === 'reconnecting') {
            this.uxState.set('user_speaking');
          }
        }
        break;

      case 'transcript.partial':
        if (msg.text && msg.segmentId) {
          this.updatePartialTranscript(msg.segmentId, msg.text, msg.speaker || 'USER');
          this.uxState.set('processing');
        }
        break;

      case 'transcript.final':
        if (msg.segmentId && msg.text) {
          const seq = msg.seq || this.lastSeq + 1;
          this.lastSeq = Math.max(this.lastSeq, seq);
          this.commitFinalTranscript(msg.segmentId, msg.text, msg.speaker || 'USER', seq);
          if (msg.speaker === 'USER') {
            this.uxState.set('processing');
          }
        }
        break;

      case 'ai.speaking':
        if (msg.isSpeaking) {
          this.uxState.set('ai_speaking');
        } else {
          this.uxState.set('user_speaking');
        }
        break;

      case 'ai.message':
        if (msg.segmentId && msg.text) {
          const seq = msg.seq || this.lastSeq + 1;
          this.lastSeq = Math.max(this.lastSeq, seq);
          this.commitFinalTranscript(msg.segmentId, msg.text, 'AI', seq);
        }
        break;

      case 'error':
        this.errorMessage.set(msg.message || 'Voice error occurred');
        if (msg.code === 'STT_TIMEOUT' || msg.code === 'AI_SERVICE_UNAVAILABLE') {
          this.uxState.set('ai_error');
        } else {
          this.uxState.set('reconnecting');
        }
        break;

      case 'pong':
        break;
    }
  }

  private updatePartialTranscript(segmentId: string, text: string, speaker: 'USER' | 'AI'): void {
    const list = [...this.liveTranscripts()];
    const existingIdx = list.findIndex((t) => t.id === segmentId);

    const nowStr = this.formatCurrentTime();
    if (existingIdx >= 0) {
      list[existingIdx] = {
        ...list[existingIdx],
        text,
        isPartial: true,
      };
    } else {
      list.push({
        id: segmentId,
        speaker,
        text,
        isPartial: true,
        time: nowStr,
        seq: this.lastSeq + 1,
      });
    }
    this.liveTranscripts.set(list);
  }

  private commitFinalTranscript(
    segmentId: string,
    text: string,
    speaker: 'USER' | 'AI',
    seq: number
  ): void {
    const list = [...this.liveTranscripts()];
    const existingIdx = list.findIndex((t) => t.id === segmentId);
    const nowStr = this.formatCurrentTime();

    if (existingIdx >= 0) {
      list[existingIdx] = {
        ...list[existingIdx],
        text,
        isPartial: false,
        seq,
      };
    } else {
      list.push({
        id: segmentId,
        speaker,
        text,
        isPartial: false,
        time: nowStr,
        seq,
      });
    }
    this.liveTranscripts.set(list);
  }

  private async initMicrophone(): Promise<void> {
    this.uxState.set('requesting_mic');
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType: mime });

    this.mediaRecorder.ondataavailable = async (e: BlobEvent) => {
      if (
        e.data.size > 0 &&
        this.ws &&
        this.ws.readyState === WebSocket.OPEN &&
        !this.isMicMuted()
      ) {
        const buffer = await e.data.arrayBuffer();
        this.ws.send(buffer);
      }
    };

    // Send chunks every 250ms for low latency streaming
    this.mediaRecorder.start(250);
    this.uxState.set('user_speaking');
  }

  /**
   * Fallback for text input when mic is unavailable or user chooses to type.
   */
  sendTextMessage(text: string): void {
    if (!text.trim() || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    const segmentId = crypto.randomUUID();
    this.ws.send(
      JSON.stringify({
        type: 'user.text',
        segmentId,
        text: text.trim(),
        isFinal: true,
      })
    );
  }

  toggleMute(): void {
    this.isMicMuted.update((muted) => !muted);
  }

  toggleMockMode(): void {
    this.isMockMode.update((mock) => !mock);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout || this.isIntentionalClose) return;

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;
      if (this.activeSessionId && !this.isIntentionalClose) {
        try {
          const ticketRes = await this.coachService.getWsTicket().toPromise();
          if (ticketRes?.ticket) {
            this.connectWebSocket(this.activeSessionId, ticketRes.ticket, this.lastSeq);
          }
        } catch {
          this.scheduleReconnect();
        }
      }
    }, 2000);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private formatCurrentTime(): string {
    const d = new Date();
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  /**
   * Completely release microphone hardware tracks and terminate WebSocket.
   */
  cleanup(): void {
    this.isIntentionalClose = true;
    this.stopHeartbeat();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (e) {
        console.warn('Error stopping MediaRecorder:', e);
      }
      this.mediaRecorder = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.mediaStream = null;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        console.warn('Error closing WebSocket:', e);
      }
      this.ws = null;
    }

    this.uxState.set('ready');
    this.activeSessionId = null;
  }
}
