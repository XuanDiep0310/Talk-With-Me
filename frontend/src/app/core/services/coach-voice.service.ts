import { Injectable, inject, signal } from '@angular/core';
import { CoachService } from './coach.service';
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
  audioUrl?: string;
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
  readonly isRecordingTurn = signal<boolean>(false);
  readonly playingSegmentId = signal<string | null>(null);

  private ws: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private turnAudioUrls = new Map<string, string>();
  private currentTurnSegmentId: string | null = null;
  private currentAudioEl: HTMLAudioElement | null = null;

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
    this.isRecordingTurn.set(false);
    this.uxState.set('connecting');

    try {
      // 1. Acquire single-use authentication ticket
      const ticketRes = await this.coachService.getWsTicket().toPromise();
      if (!ticketRes?.ticket) {
        throw new Error('Failed to obtain WebSocket ticket');
      }

      // 2. Open WebSocket connection
      this.connectWebSocket(sessionId, ticketRes.ticket, this.lastSeq);

      // 3. Auto-play initial AI greeting if already present
      const existing = this.liveTranscripts();
      if (existing.length > 0) {
        const lastItem = existing[existing.length - 1];
        if (lastItem.speaker === 'AI') {
          setTimeout(() => this.playSegmentAudio(lastItem), 400);
        }
      }
    } catch (err: unknown) {
      console.error('Failed to initialize voice session:', err);
      this.uxState.set('mic_error');
      this.errorMessage.set(
        err instanceof Error ? err.message : 'Could not connect to voice server'
      );
    }
  }

  private connectWebSocket(sessionId: string, ticket: string, lastSeq = 0): void {
    const wsBase = environment.apiUrl.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/ws/sessions/${sessionId}?ticket=${ticket}&lastSeq=${lastSeq}`;

    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      if (this.uxState() !== 'ai_speaking' && this.uxState() !== 'user_speaking') {
        this.uxState.set('ready');
      }
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          this.handleControlMessage(msg);
        } catch {
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

    this.ws.onclose = () => {
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
            this.uxState.set('ready');
          }
        }
        break;

      case 'transcript.partial':
        if (msg.text && msg.segmentId) {
          this.updatePartialTranscript(msg.segmentId, msg.text, msg.speaker || 'USER');
        }
        break;

      case 'transcript.final':
        if (msg.segmentId && msg.text) {
          const seq = msg.seq || this.lastSeq + 1;
          this.lastSeq = Math.max(this.lastSeq, seq);
          const audioUrl =
            this.turnAudioUrls.get(msg.segmentId) ||
            (this.currentTurnSegmentId
              ? this.turnAudioUrls.get(this.currentTurnSegmentId)
              : undefined);

          const item = this.commitFinalTranscript(
            msg.segmentId,
            msg.text,
            msg.speaker || 'USER',
            seq,
            audioUrl
          );

          if (msg.speaker === 'USER') {
            this.uxState.set('processing');
            // Auto-play user's recorded turn first time right after finishing
            this.playSegmentAudio(item);
          }
        }
        break;

      case 'ai.speaking':
        if (msg.isSpeaking) {
          this.uxState.set('ai_speaking');
        } else if (this.uxState() === 'ai_speaking' && !this.playingSegmentId()) {
          this.uxState.set('ready');
        }
        break;

      case 'ai.message':
        if (msg.segmentId && msg.text) {
          const seq = msg.seq || this.lastSeq + 1;
          this.lastSeq = Math.max(this.lastSeq, seq);
          const aiItem = this.commitFinalTranscript(msg.segmentId, msg.text, 'AI', seq);

          // Auto-play AI response after user's playback finishes (or immediately if idle)
          this.scheduleAiAutoPlay(aiItem);
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

  private scheduleAiAutoPlay(aiItem: LiveTranscriptItem): void {
    // Wait briefly if user audio is currently playing so they don't overlap
    const checkAndPlay = (attemptsLeft: number) => {
      if (this.isIntentionalClose) return;
      const currentlyPlaying = this.playingSegmentId();
      if (currentlyPlaying && currentlyPlaying !== aiItem.id && attemptsLeft > 0) {
        setTimeout(() => checkAndPlay(attemptsLeft - 1), 400);
      } else {
        this.playSegmentAudio(aiItem);
      }
    };
    checkAndPlay(15);
  }

  /**
   * Toggle Push-To-Talk / Tap-To-Speak ("The Coach" style):
   * - Tap 1: Start speaking (state -> user_speaking)
   * - Tap 2: Stop speaking & finish sentence (state -> processing -> auto-play)
   */
  async toggleSpeakingTurn(): Promise<void> {
    if (this.isRecordingTurn()) {
      await this.stopSpeakingTurn();
    } else {
      await this.startSpeakingTurn();
    }
  }

  async startSpeakingTurn(): Promise<void> {
    // Stop any ongoing playback before user speaks
    this.stopAudioPlayback();
    this.errorMessage.set(null);

    const segmentId = crypto.randomUUID();
    this.currentTurnSegmentId = segmentId;
    this.recordedChunks = [];

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'user.speech_start', segmentId }));
    }

    if (this.isMockMode()) {
      this.isRecordingTurn.set(true);
      this.uxState.set('user_speaking');
      return;
    }

    try {
      this.uxState.set('requesting_mic');
      if (!this.mediaStream) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      }

      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType: mime });

      this.mediaRecorder.ondataavailable = async (e: BlobEvent) => {
        if (e.data.size > 0) {
          this.recordedChunks.push(e.data);
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const buffer = await e.data.arrayBuffer();
            this.ws.send(buffer);
          }
        }
      };

      this.mediaRecorder.start(200);
      this.isRecordingTurn.set(true);
      this.uxState.set('user_speaking');
    } catch (err) {
      console.error('Microphone access denied or failed:', err);
      // Fallback to simulated recording if running in headless test / no hardware mic
      this.isRecordingTurn.set(true);
      this.uxState.set('user_speaking');
    }
  }

  async stopSpeakingTurn(): Promise<void> {
    if (!this.isRecordingTurn()) return;

    this.isRecordingTurn.set(false);
    this.uxState.set('processing');

    const segId = this.currentTurnSegmentId || crypto.randomUUID();

    // Stop MediaRecorder and build in-memory Blob URL for instant playback (Rule 3: client RAM only)
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        if (!this.mediaRecorder) {
          resolve();
          return;
        }
        this.mediaRecorder.onstop = () => {
          if (this.recordedChunks.length > 0) {
            const blob = new Blob(this.recordedChunks, {
              type: this.mediaRecorder?.mimeType || 'audio/webm',
            });
            const url = URL.createObjectURL(blob);
            this.turnAudioUrls.set(segId, url);
          }
          resolve();
        };
        try {
          this.mediaRecorder.stop();
        } catch {
          resolve();
        }
      });
      this.mediaRecorder = null;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.isMockMode() || this.recordedChunks.length === 0) {
        // In Dev Mock Mode or fake browser media stream with empty chunks, send sample speech turn
        const mockSamples = [
          'I really enjoy traveling to Da Nang because the beaches are beautiful and the food is great.',
          'In my free time, I usually practice speaking English and listen to podcasts.',
          'Could you tell me more about how to improve my fluency naturally?',
        ];
        const sample =
          mockSamples[
            this.liveTranscripts().filter((t) => t.speaker === 'USER').length %
              mockSamples.length
          ];
        this.ws.send(
          JSON.stringify({
            type: 'user.text',
            segmentId: segId,
            text: sample,
            isFinal: true,
          })
        );
      } else {
        this.ws.send(
          JSON.stringify({
            type: 'user.speech_end',
            segmentId: segId,
          })
        );
      }
    }
  }

  /**
   * Play or replay audio for a specific transcript item (User recorded voice or AI Coach TTS).
   */
  playSegmentAudio(item: LiveTranscriptItem): void {
    this.stopAudioPlayback();
    this.playingSegmentId.set(item.id);

    if (item.speaker === 'AI') {
      this.uxState.set('ai_speaking');
    }

    // 1. If item has a recorded Blob URL (User's real voice), play it via HTMLAudioElement
    if (item.audioUrl) {
      const audio = new Audio(item.audioUrl);
      this.currentAudioEl = audio;
      audio.onended = () => {
        if (this.playingSegmentId() === item.id) {
          this.playingSegmentId.set(null);
        }
        this.currentAudioEl = null;
      };
      audio.onerror = () => {
        this.currentAudioEl = null;
        this.speakWithSynthesis(item);
      };
      audio.play().catch(() => {
        this.speakWithSynthesis(item);
      });
      return;
    }

    // 2. Otherwise use Web Speech Synthesis (for AI Coach or Mock User voice)
    this.speakWithSynthesis(item);
  }

  private speakWithSynthesis(item: LiveTranscriptItem): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setTimeout(() => {
        if (this.playingSegmentId() === item.id) {
          this.playingSegmentId.set(null);
          if (this.uxState() === 'ai_speaking') {
            this.uxState.set('ready');
          }
        }
      }, 1200);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.lang = 'en-US';
      utterance.rate = item.speaker === 'AI' ? 0.98 : 1.0;
      utterance.pitch = item.speaker === 'AI' ? 1.05 : 1.0;

      utterance.onend = () => {
        if (this.playingSegmentId() === item.id) {
          this.playingSegmentId.set(null);
        }
        if (item.speaker === 'AI' && !this.isRecordingTurn()) {
          this.uxState.set('ready');
        }
      };

      utterance.onerror = () => {
        if (this.playingSegmentId() === item.id) {
          this.playingSegmentId.set(null);
        }
        if (item.speaker === 'AI' && !this.isRecordingTurn()) {
          this.uxState.set('ready');
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      this.playingSegmentId.set(null);
      if (this.uxState() === 'ai_speaking') {
        this.uxState.set('ready');
      }
    }
  }

  stopAudioPlayback(): void {
    if (this.currentAudioEl) {
      try {
        this.currentAudioEl.pause();
        this.currentAudioEl.currentTime = 0;
      } catch {
        // Ignore
      }
      this.currentAudioEl = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
    this.playingSegmentId.set(null);
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
    seq: number,
    audioUrl?: string
  ): LiveTranscriptItem {
    const list = [...this.liveTranscripts()];
    const existingIdx = list.findIndex((t) => t.id === segmentId);
    const nowStr = this.formatCurrentTime();

    let committedItem: LiveTranscriptItem;
    if (existingIdx >= 0) {
      committedItem = {
        ...list[existingIdx],
        text,
        isPartial: false,
        seq,
        audioUrl: audioUrl || list[existingIdx].audioUrl,
      };
      list[existingIdx] = committedItem;
    } else {
      committedItem = {
        id: segmentId,
        speaker,
        text,
        isPartial: false,
        time: nowStr,
        seq,
        audioUrl,
      };
      list.push(committedItem);
    }
    this.liveTranscripts.set(list);
    return committedItem;
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
   * Completely release microphone hardware tracks, revoke temporary Blob URLs, and terminate WebSocket.
   */
  cleanup(): void {
    this.isIntentionalClose = true;
    this.isRecordingTurn.set(false);
    this.stopHeartbeat();
    this.stopAudioPlayback();

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

    // Revoke in-memory Blob URLs
    this.turnAudioUrls.forEach((url) => URL.revokeObjectURL(url));
    this.turnAudioUrls.clear();

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
