import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Subscription, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CoachService } from './coach.service';
import { PcmVadStreamService } from './pcm-vad-stream.service';

export type UxState =
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

export type InteractionMode = 'continuous' | 'push_to_talk';

export interface SuggestedReplyItem {
  text: string;
  translation: string;
}

export interface LiveTranscriptItem {
  id: string;
  speaker: 'USER' | 'AI';
  text: string;
  seq: number;
  startMs?: number;
  endMs?: number;
  time?: string;
  confidence?: number | null;
  isPartial: boolean;
  translation?: string | null;
  audioUrl?: string;
}

/**
 * Dual-mode WebSocket voice engine:
 * - continuous (AI Coach): hands-free 16kHz PCM16 streaming, adaptive VAD, and instant barge-in.
 * - push_to_talk (Scenario Roleplay): manual tap-to-speak MediaRecorder turn capture.
 */
@Injectable({ providedIn: 'root' })
export class CoachVoiceService {
  private readonly coachService = inject(CoachService);
  private readonly vad = inject(PcmVadStreamService);
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.apiUrl;

  readonly uxState = signal<UxState>('ready');
  readonly interactionMode = signal<InteractionMode>('push_to_talk');
  readonly liveTranscripts = signal<LiveTranscriptItem[]>([]);
  readonly currentSuggestions = signal<SuggestedReplyItem[]>([]);
  readonly errorMessage = signal<string | null>(null);
  readonly isRecordingTurn = signal<boolean>(false);
  readonly playingSegmentId = signal<string | null>(null);
  readonly audioUnlockNeeded = signal<boolean>(false);

  // Hands-free telemetry & controls
  readonly micLevel = this.vad.micLevel;
  readonly isMuted = this.vad.isMuted;
  readonly isPaused = this.vad.isPaused;

  private ws: WebSocket | null = null;
  private activeSessionId: string | null = null;
  private lastSeq = 0;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private vadStarted = false;

  // Push-to-talk (Roleplay) recorder state
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private turnAudioUrls = new Map<string, string>();
  private currentTurnSegmentId = '';

  // AI audio playback & barge-in tracking
  private lastAiSegmentId: string | null = null;
  private openingSpokenForSession: string | null = null;
  private activeAiReveal: { segmentId: string; fullText: string } | null = null;
  private aiRevealTimer: ReturnType<typeof setInterval> | null = null;
  private pendingBlockedSpeech: { text: string; segmentId?: string; audioB64?: string } | null =
    null;
  private unlockListener: (() => void) | null = null;
  private ttsFetchSub: Subscription | null = null;
  private currentAudioEl: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;

  async startVoiceSession(sessionId: string, mode: InteractionMode = 'push_to_talk'): Promise<void> {
    this.cleanup();
    this.activeSessionId = sessionId;
    this.interactionMode.set(mode);
    this.errorMessage.set(null);
    this.uxState.set('connecting');

    try {
      const ticketRes = await firstValueFrom(this.coachService.getWsTicket());
      if (!ticketRes?.ticket) {
        this.errorMessage.set('Không thể lấy vé kết nối WebSocket.');
        this.uxState.set('ai_error');
        return;
      }
      this.connectWebSocket(sessionId, ticketRes.ticket, 0);
    } catch {
      this.errorMessage.set('Lỗi khởi tạo kết nối âm thanh. Vui lòng thử lại.');
      this.uxState.set('ai_error');
    }
  }

  private buildWsUrl(sessionId: string, ticket: string, lastSeq: number): string {
    const seqQuery = lastSeq > 0 ? `&lastSeq=${lastSeq}` : '';
    const apiBase = this.apiBase.replace(/\/$/, '');
    let wsBase: string;
    if (/^https?:\/\//i.test(apiBase)) {
      wsBase = apiBase.replace(/^http/i, 'ws');
    } else if (typeof window !== 'undefined') {
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const prefix = apiBase.startsWith('/') ? apiBase : `/${apiBase}`;
      wsBase = `${wsProto}//${window.location.host}${prefix}`;
    } else {
      wsBase = `ws://localhost:8000${apiBase}`;
    }
    return `${wsBase}/ws/sessions/${sessionId}?ticket=${encodeURIComponent(ticket)}${seqQuery}`;
  }

  private connectWebSocket(sessionId: string, ticket: string, lastSeq: number): void {
    const url = this.buildWsUrl(sessionId, ticket, lastSeq);

    try {
      this.ws = new WebSocket(url);
      this.ws.binaryType = 'arraybuffer';
    } catch {
      this.errorMessage.set('Trình duyệt không thể mở kết nối WebSocket.');
      this.uxState.set('ai_error');
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.errorMessage.set(null);
      if (this.uxState() === 'connecting' || this.uxState() === 'reconnecting') {
        this.uxState.set('ready');
      }
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 20000);
    };

    this.ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      try {
        const msg = JSON.parse(event.data) as Record<string, unknown>;
        this.handleControlMessage(msg);
      } catch {
        // Ignore malformed frame
      }
    };

    this.ws.onerror = () => {
      if (this.uxState() !== 'ai_error') {
        this.errorMessage.set('Mất ổn định kết nối thời gian thực...');
      }
    };

    this.ws.onclose = (event) => {
      if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      if (event.code === 1000 || !this.activeSessionId) return;
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        this.uxState.set('reconnecting');
        this.reconnectTimer = setTimeout(() => {
          void this.attemptReconnect();
        }, 1500 * this.reconnectAttempts);
      } else {
        this.errorMessage.set('Mất kết nối với AI Coach. Vui lòng tải lại trang.');
        this.uxState.set('ai_error');
      }
    };
  }

  private async attemptReconnect(): Promise<void> {
    if (!this.activeSessionId) return;
    try {
      const ticketRes = await firstValueFrom(this.coachService.getWsTicket());
      if (ticketRes?.ticket) {
        this.connectWebSocket(this.activeSessionId, ticketRes.ticket, this.lastSeq);
      }
    } catch {
      this.errorMessage.set('Không thể kết nối lại phiên hội thoại.');
      this.uxState.set('ai_error');
    }
  }

  private handleControlMessage(msg: Record<string, unknown>): void {
    const type = String(msg['type'] ?? '');

    switch (type) {
      case 'session.state': {
        if (msg['interactionMode'] === 'continuous' || msg['interactionMode'] === 'push_to_talk') {
          this.interactionMode.set(msg['interactionMode'] as InteractionMode);
        }
        const history = msg['transcripts'];
        if (Array.isArray(history) && history.length > 0 && this.liveTranscripts().length === 0) {
          const items: LiveTranscriptItem[] = history.map((raw: Record<string, unknown>) => {
            const startMs = Number(raw['startMs'] ?? 0);
            return {
              id: String(raw['segmentId'] ?? ''),
              speaker: raw['speaker'] === 'USER' ? 'USER' : 'AI',
              text: String(raw['text'] ?? ''),
              seq: Number(raw['seq'] ?? 0),
              startMs,
              endMs: Number(raw['endMs'] ?? 0),
              time: this.formatTimestamp(startMs),
              confidence: (raw['confidence'] as number | null | undefined) ?? null,
              isPartial: false,
              translation: (raw['translation'] as string | null | undefined) ?? null,
            };
          });
          this.liveTranscripts.set(items);
          this.lastSeq = Math.max(...items.map((i) => i.seq), 0);
        }
        if (this.uxState() === 'connecting' || this.uxState() === 'reconnecting') {
          this.uxState.set('ready');
        }
        if (this.interactionMode() === 'continuous' && !this.vadStarted) {
          void this.startHandsFreeStream();
        }
        const currentItems = this.liveTranscripts();
        if (
          this.interactionMode() === 'continuous' &&
          currentItems.length === 1 &&
          currentItems[0].speaker === 'AI' &&
          this.openingSpokenForSession !== this.activeSessionId
        ) {
          this.openingSpokenForSession = this.activeSessionId;
          this.lastAiSegmentId = currentItems[0].id;
          void this.speakAiResponse(currentItems[0].text, currentItems[0].id);
        }
        break;
      }

      case 'transcript.partial': {
        const segmentId = String(msg['segmentId'] ?? '');
        const text = String(msg['text'] ?? '');
        const speaker = msg['speaker'] === 'AI' ? 'AI' : 'USER';
        if (!segmentId || !text) return;
        const startMs = Number(msg['startMs'] ?? 0);
        this.liveTranscripts.update((list) => {
          const idx = list.findIndex((item) => item.id === segmentId);
          if (idx >= 0 && !list[idx].isPartial) {
            return list;
          }
          const nextItem: LiveTranscriptItem = {
            id: segmentId,
            speaker,
            text,
            seq: Number(msg['seq'] ?? 999999),
            startMs,
            endMs: Number(msg['endMs'] ?? 0),
            time: this.formatTimestamp(startMs),
            confidence: (msg['confidence'] as number | null | undefined) ?? null,
            isPartial: true,
          };
          if (idx >= 0) {
            const copy = [...list];
            copy[idx] = { ...copy[idx], ...nextItem };
            return copy;
          }
          return [...list, nextItem];
        });
        break;
      }

      case 'transcript.final': {
        const segmentId = String(msg['segmentId'] ?? '');
        const seq = Number(msg['seq'] ?? 0);
        const speaker = msg['speaker'] === 'USER' ? 'USER' : 'AI';
        const continuesTurn = Boolean(msg['continuesTurn']);
        const startMs = Number(msg['startMs'] ?? 0);
        if (seq > this.lastSeq) this.lastSeq = seq;

        const audioUrl = speaker === 'USER' ? this.turnAudioUrls.get(segmentId) : undefined;
        const finalItem: LiveTranscriptItem = {
          id: segmentId,
          speaker,
          text: String(msg['text'] ?? ''),
          seq,
          startMs,
          endMs: Number(msg['endMs'] ?? 0),
          time: this.formatTimestamp(startMs),
          confidence: (msg['confidence'] as number | null | undefined) ?? null,
          isPartial: false,
          audioUrl,
        };

        this.liveTranscripts.update((list) => {
          const idx = list.findIndex((item) => item.id === segmentId);
          if (idx >= 0) {
            const copy = [...list];
            copy[idx] = { ...copy[idx], ...finalItem };
            return copy;
          }
          return [...list, finalItem];
        });

        const updatedItems = this.liveTranscripts();
        if (
          this.interactionMode() === 'continuous' &&
          speaker === 'AI' &&
          updatedItems.length === 1 &&
          this.openingSpokenForSession !== this.activeSessionId
        ) {
          this.openingSpokenForSession = this.activeSessionId;
          this.lastAiSegmentId = segmentId;
          const openingAudioB64 =
            typeof msg['audioB64'] === 'string' ? (msg['audioB64'] as string) : undefined;
          void this.speakAiResponse(finalItem.text, segmentId, openingAudioB64);
        } else if (this.interactionMode() === 'continuous' && continuesTurn) {
          this.vad.extendSilenceWindow(2200);
          this.uxState.set('user_speaking');
        }
        break;
      }

      case 'transcript.translations': {
        const items = msg['items'];
        if (!Array.isArray(items)) return;
        const map = new Map<string, string>();
        for (const raw of items as Record<string, unknown>[]) {
          const segId = String(raw['segmentId'] ?? '');
          const translation = String(raw['translation'] ?? '');
          if (segId && translation) map.set(segId, translation);
        }
        if (map.size > 0) {
          this.liveTranscripts.update((list) =>
            list.map((it) => (map.has(it.id) ? { ...it, translation: map.get(it.id)! } : it))
          );
        }
        break;
      }

      case 'ai.speaking': {
        if (msg['isSpeaking']) {
          this.uxState.set('processing');
        }
        break;
      }

      case 'ai.interrupted': {
        this.stopAiAudioOnly();
        this.vad.setAiSpeaking(false);
        this.playingSegmentId.set(null);
        break;
      }

      case 'ai.message': {
        const segmentId = String(msg['segmentId'] ?? this.generateUuid());
        const text = String(msg['text'] ?? '');
        const seq = Number(msg['seq'] ?? 0);
        const startMs = Number(msg['startMs'] ?? 0);
        const endMs = Number(msg['endMs'] ?? 0);
        const audioB64 =
          typeof msg['audioB64'] === 'string' ? (msg['audioB64'] as string) : undefined;
        if (seq > this.lastSeq) this.lastSeq = seq;
        this.lastAiSegmentId = segmentId;

        this.liveTranscripts.update((list) => {
          if (list.some((i) => i.id === segmentId)) return list;
          return [
            ...list,
            {
              id: segmentId,
              speaker: 'AI',
              text,
              seq,
              startMs,
              endMs,
              time: this.formatTimestamp(startMs),
              isPartial: false,
            },
          ];
        });

        void this.speakAiResponse(text, segmentId, audioB64);
        break;
      }

      case 'ai.suggestions': {
        const suggs = msg['suggestions'];
        if (Array.isArray(suggs)) {
          this.currentSuggestions.set(
            suggs.map((s) =>
              typeof s === 'string'
                ? { text: s, translation: '' }
                : {
                    text: String((s as Record<string, unknown>)['text'] ?? ''),
                    translation: String((s as Record<string, unknown>)['translation'] ?? ''),
                  }
            )
          );
        }
        break;
      }

      case 'error': {
        this.errorMessage.set(String(msg['message'] ?? 'Có lỗi xảy ra từ máy chủ.'));
        this.uxState.set('ai_error');
        this.isRecordingTurn.set(false);
        break;
      }

      case 'pong':
      default:
        break;
    }
  }

  // ── Hands-Free Continuous Mode (AI Coach) ──────────────────────────────────

  private async startHandsFreeStream(): Promise<void> {
    if (this.vadStarted) return;
    this.vadStarted = true;
    this.uxState.set('requesting_mic');
    await this.vad.start({
      onSpeechStart: (isBargeIn: boolean) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        this.currentTurnSegmentId = this.generateUuid();
        this.errorMessage.set(null);

        if (isBargeIn) {
          const stats = this.interruptAiPlayback();
          this.ws.send(
            JSON.stringify({
              type: 'user.barge_in',
              segmentId: this.currentTurnSegmentId,
              mimeType: 'audio/pcm;rate=16000',
              interruptedAiSegmentId: this.lastAiSegmentId,
              spokenRatio: stats.spokenRatio,
              interruptedAtMs: stats.interruptedAtMs,
            })
          );
        } else {
          this.ws.send(
            JSON.stringify({
              type: 'user.speech_start',
              segmentId: this.currentTurnSegmentId,
              mimeType: 'audio/pcm;rate=16000',
            })
          );
        }
        this.isRecordingTurn.set(true);
        this.uxState.set('user_speaking');
      },
      onAudioChunk: (pcm16: ArrayBuffer) => {
        if (this.ws?.readyState === WebSocket.OPEN && this.isRecordingTurn()) {
          this.ws.send(pcm16);
        }
      },
      onSpeechEnd: () => {
        this.isRecordingTurn.set(false);
        this.uxState.set('processing');
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: 'user.speech_end',
              segmentId: this.currentTurnSegmentId,
              mimeType: 'audio/pcm;rate=16000',
            })
          );
        }
      },
      onError: () => {
        this.vadStarted = false;
        this.errorMessage.set('Không thể truy cập micro. Vui lòng cho phép quyền sử dụng micro.');
        this.uxState.set('mic_error');
      },
    });
    if (this.vadStarted && this.uxState() === 'requesting_mic') {
      this.uxState.set('ready');
    }
  }

  toggleMute(): boolean {
    const muted = this.vad.toggleMute();
    if (muted && this.isRecordingTurn()) {
      this.isRecordingTurn.set(false);
      this.uxState.set('processing');
    }
    return muted;
  }

  togglePause(): boolean {
    const paused = !this.vad.isPaused();
    this.vad.setPaused(paused);
    if (paused) {
      this.stopAiAudioOnly();
      this.vad.setAiSpeaking(false);
      this.isRecordingTurn.set(false);
      this.uxState.set('ready');
    }
    return paused;
  }

  // ── Push-to-Talk Mode (Scenario Roleplay) ──────────────────────────────────

  async toggleSpeakingTurn(): Promise<void> {
    if (this.interactionMode() === 'continuous') {
      this.toggleMute();
      return;
    }
    if (this.isRecordingTurn()) {
      this.stopSpeakingTurn();
    } else {
      await this.startSpeakingTurn();
    }
  }

  private async startSpeakingTurn(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.errorMessage.set('Kết nối chưa sẵn sàng.');
      return;
    }

    this.stopAiAudioOnly();
    this.errorMessage.set(null);
    this.uxState.set('requesting_mic');

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = this.pickAudioMimeType();
      this.mediaRecorder = new MediaRecorder(
        this.mediaStream,
        mimeType ? { mimeType } : undefined
      );
      this.recordedChunks = [];
      this.currentTurnSegmentId = this.generateUuid();

      this.ws.send(
        JSON.stringify({
          type: 'user.speech_start',
          segmentId: this.currentTurnSegmentId,
          mimeType: this.mediaRecorder.mimeType || 'audio/webm',
        })
      );

      this.mediaRecorder.ondataavailable = (evt) => {
        if (evt.data.size > 0) {
          this.recordedChunks.push(evt.data);
          if (this.ws?.readyState === WebSocket.OPEN) {
            void evt.data.arrayBuffer().then((buf) => {
              if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(buf);
              }
            });
          }
        }
      };

      this.mediaRecorder.onstop = () => {
        if (this.recordedChunks.length > 0) {
          const blob = new Blob(this.recordedChunks, {
            type: this.mediaRecorder?.mimeType || 'audio/webm',
          });
          this.turnAudioUrls.set(this.currentTurnSegmentId, URL.createObjectURL(blob));
        }
        this.mediaStream?.getTracks().forEach((t) => t.stop());
        this.mediaStream = null;
        this.uxState.set('processing');

        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: 'user.speech_end',
              segmentId: this.currentTurnSegmentId,
              mimeType: this.mediaRecorder?.mimeType || 'audio/webm',
            })
          );
        }
      };

      this.mediaRecorder.start(250);
      this.isRecordingTurn.set(true);
      this.uxState.set('user_speaking');
    } catch {
      this.errorMessage.set('Không thể truy cập micro. Vui lòng cấp quyền micro.');
      this.isRecordingTurn.set(false);
      this.uxState.set('mic_error');
    }
  }

  private stopSpeakingTurn(): void {
    this.isRecordingTurn.set(false);
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  sendTextTurn(text: string): void {
    const clean = text.trim();
    if (!clean || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.vad.isSpeechActive()) return;
    const stats = this.interruptAiPlayback();
    if (stats.interruptedAtMs > 0) {
      this.ws.send(
        JSON.stringify({
          type: 'user.barge_in',
          interruptedAiSegmentId: this.lastAiSegmentId,
          spokenRatio: stats.spokenRatio,
          interruptedAtMs: stats.interruptedAtMs,
        })
      );
    }
    this.uxState.set('processing');
    this.ws.send(
      JSON.stringify({
        type: 'user.text',
        segmentId: this.generateUuid(),
        text: clean,
      })
    );
  }

  // ── AI Audio Playback & Instant Barge-In Cancellation ──────────────────────

  private interruptAiPlayback(): { spokenRatio: number; interruptedAtMs: number } {
    let spokenRatio = 0.5;
    let interruptedAtMs = 0;
    if (this.currentAudioEl) {
      const cur = this.currentAudioEl.currentTime || 0;
      const dur = this.currentAudioEl.duration;
      interruptedAtMs = Math.round(cur * 1000);
      if (Number.isFinite(dur) && dur > 0) {
        spokenRatio = Math.min(1, Math.max(0.05, cur / dur));
      }
    }
    this.stopAiAudioOnly();
    this.vad.setAiSpeaking(false);
    this.playingSegmentId.set(null);
    return { spokenRatio, interruptedAtMs };
  }

  private async speakAiResponse(
    text: string,
    segmentId?: string,
    preloadedAudioB64?: string
  ): Promise<void> {
    if (!text || this.isPaused()) return;
    this.stopAiAudioOnly();

    if (segmentId) this.playingSegmentId.set(segmentId);
    this.uxState.set('ai_speaking');
    this.vad.setAiSpeaking(true);

    try {
      const blob = preloadedAudioB64
        ? this.base64ToBlob(preloadedAudioB64, 'audio/mpeg')
        : await new Promise<Blob>((resolve, reject) => {
            this.ttsFetchSub = this.http
              .post(
                `${this.apiBase}/voice/tts/stream`,
                { text, voice: 'en-US-JennyNeural' },
                { responseType: 'blob' }
              )
              .subscribe({ next: resolve, error: reject });
          });
      this.ttsFetchSub = null;

      if (this.isPaused() || !this.activeSessionId) {
        this.finishAiSpeaking(segmentId);
        return;
      }

      const audioUrl = URL.createObjectURL(blob);
      this.currentAudioUrl = audioUrl;
      const audio = new Audio(audioUrl);
      this.currentAudioEl = audio;

      audio.onended = () => this.finishAiSpeaking(segmentId);
      audio.onerror = () => this.fallbackSpeechSynthesis(text, segmentId);

      try {
        if (segmentId && this.interactionMode() === 'continuous') {
          this.startAiLiveReveal(segmentId, text, audio);
        }
        await audio.play();
        this.audioUnlockNeeded.set(false);
        this.pendingBlockedSpeech = null;
      } catch (playErr: unknown) {
        this.commitAiLiveTranscript();
        if (this.isAutoplayBlockedError(playErr)) {
          this.stopAiAudioOnly();
          this.vad.setAiSpeaking(false);
          this.playingSegmentId.set(null);
          if (this.uxState() === 'ai_speaking') {
            this.uxState.set('ready');
          }
          this.queueAudioUnlock({ text, segmentId, audioB64: preloadedAudioB64 });
          return;
        }
        this.fallbackSpeechSynthesis(text, segmentId);
      }
    } catch {
      this.ttsFetchSub = null;
      this.fallbackSpeechSynthesis(text, segmentId);
    }
  }

  private startAiLiveReveal(segmentId: string, fullText: string, audio: HTMLAudioElement): void {
    this.clearAiRevealTimer();
    const words = fullText.trim().split(/\s+/);
    if (words.length <= 2) return;

    this.activeAiReveal = { segmentId, fullText };
    const startedAt = performance.now();
    const estimatedDurationMs = Math.max(1200, words.length * 360);

    const updateProgress = () => {
      const reveal = this.activeAiReveal;
      if (!reveal || reveal.segmentId !== segmentId) return;
      const ratio =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? Math.min(1, (audio.currentTime + 0.15) / audio.duration)
          : Math.min(1, (performance.now() - startedAt) / estimatedDurationMs);
      const count = Math.max(2, Math.min(words.length, Math.ceil(words.length * ratio)));
      const partial = words.slice(0, count).join(' ');
      this.liveTranscripts.update((list) =>
        list.map((it) =>
          it.id === segmentId
            ? { ...it, text: partial, isPartial: count < words.length }
            : it
        )
      );
    };

    updateProgress();
    audio.ontimeupdate = updateProgress;
    this.aiRevealTimer = setInterval(updateProgress, 90);
  }

  private commitAiLiveTranscript(): void {
    this.clearAiRevealTimer();
    const reveal = this.activeAiReveal;
    this.activeAiReveal = null;
    if (!reveal) return;
    this.liveTranscripts.update((list) =>
      list.map((it) =>
        it.id === reveal.segmentId ? { ...it, text: reveal.fullText, isPartial: false } : it
      )
    );
  }

  private clearAiRevealTimer(): void {
    if (this.aiRevealTimer) {
      clearInterval(this.aiRevealTimer);
      this.aiRevealTimer = null;
    }
  }

  resumeBlockedAudio(): void {
    const pending = this.pendingBlockedSpeech;
    this.clearAudioUnlock();
    if (pending) {
      void this.speakAiResponse(pending.text, pending.segmentId, pending.audioB64);
    }
  }

  private queueAudioUnlock(pending: { text: string; segmentId?: string; audioB64?: string }): void {
    this.pendingBlockedSpeech = pending;
    this.audioUnlockNeeded.set(true);
    if (typeof document === 'undefined' || this.unlockListener) return;
    this.unlockListener = () => {
      this.resumeBlockedAudio();
    };
    document.addEventListener('pointerdown', this.unlockListener, { once: true });
    document.addEventListener('keydown', this.unlockListener, { once: true });
  }

  private clearAudioUnlock(): void {
    this.audioUnlockNeeded.set(false);
    this.pendingBlockedSpeech = null;
    if (typeof document !== 'undefined' && this.unlockListener) {
      document.removeEventListener('pointerdown', this.unlockListener);
      document.removeEventListener('keydown', this.unlockListener);
      this.unlockListener = null;
    }
  }

  private isAutoplayBlockedError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const name = String((err as { name?: unknown }).name ?? '');
    const msg = String((err as { message?: unknown }).message ?? '');
    return name === 'NotAllowedError' || msg.toLowerCase().includes('user didn\'t interact');
  }

  private base64ToBlob(b64: string, mimeType: string): Blob {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }

  private finishAiSpeaking(segmentId?: string): void {
    this.stopAiAudioOnly();
    this.vad.setAiSpeaking(false);
    this.vad.setPlaybackLock(false);
    this.playingSegmentId.set(null);
    if (!this.isRecordingTurn() && this.uxState() === 'ai_speaking') {
      this.uxState.set('ready');
    }
    if (segmentId && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ai.playback_end', segmentId }));
    }
  }

  private fallbackSpeechSynthesis(text: string, segmentId?: string): void {
    this.stopAiAudioOnly();
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.finishAiSpeaking(segmentId);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.onend = () => this.finishAiSpeaking(segmentId);
    utterance.onerror = () => this.finishAiSpeaking(segmentId);
    window.speechSynthesis.speak(utterance);
  }

  speakText(text: string, onEnd?: () => void): void {
    if (!text) return;
    void this.speakAiResponse(text).then(() => onEnd?.());
  }

  playSegmentAudio(item: LiveTranscriptItem): void {
    this.vad.setPlaybackLock(true);
    if (item.audioUrl) {
      this.stopAiAudioOnly();
      const audio = new Audio(item.audioUrl);
      this.currentAudioEl = audio;
      this.playingSegmentId.set(item.id);
      audio.onended = () => {
        this.currentAudioEl = null;
        this.playingSegmentId.set(null);
        this.vad.setPlaybackLock(false);
      };
      audio.onerror = () => {
        this.currentAudioEl = null;
        this.playingSegmentId.set(null);
        this.vad.setPlaybackLock(false);
      };
      void audio.play().catch(() => {
        this.playingSegmentId.set(null);
        this.vad.setPlaybackLock(false);
      });
      return;
    }
    void this.speakAiResponse(item.text, item.id);
  }

  private stopAiAudioOnly(): void {
    this.commitAiLiveTranscript();
    if (this.ttsFetchSub) {
      this.ttsFetchSub.unsubscribe();
      this.ttsFetchSub = null;
    }
    if (this.currentAudioEl) {
      this.currentAudioEl.ontimeupdate = null;
      this.currentAudioEl.onended = null;
      this.currentAudioEl.onerror = null;
      this.currentAudioEl.pause();
      this.currentAudioEl = null;
    }
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  formatTimestamp(ms: number): string {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  private pickAudioMimeType(): string {
    if (typeof MediaRecorder === 'undefined') return '';
    for (const candidate of [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ]) {
      if (MediaRecorder.isTypeSupported(candidate)) return candidate;
    }
    return '';
  }

  private generateUuid(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  cleanup(): void {
    this.activeSessionId = null;
    this.vadStarted = false;
    this.lastAiSegmentId = null;
    this.openingSpokenForSession = null;
    this.clearAudioUnlock();
    this.vad.setPlaybackLock(false);
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close(1000, 'cleanup');
      this.ws = null;
    }
    this.vad.stop();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    this.stopAiAudioOnly();
    this.turnAudioUrls.forEach((url) => URL.revokeObjectURL(url));
    this.turnAudioUrls.clear();

    this.isRecordingTurn.set(false);
    this.playingSegmentId.set(null);
    this.uxState.set('ready');
    this.liveTranscripts.set([]);
    this.currentSuggestions.set([]);
    this.errorMessage.set(null);
  }
}
