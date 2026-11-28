import { Injectable, signal } from '@angular/core';
import { float32ToPcm16Bytes } from './audio-capture.service';

export interface VadCallbacks {
  onSpeechStart: (isBargeIn: boolean) => void;
  onAudioChunk: (pcm16: ArrayBuffer) => void;
  onSpeechEnd: () => void;
  onError?: (err: unknown) => void;
}

/**
 * Hands-free PCM16 16kHz continuous audio stream with adaptive RMS VAD and barge-in detection.
 * Keeps a 300ms pre-roll ring buffer so initial syllables are never clipped when interrupting AI.
 */
@Injectable({ providedIn: 'root' })
export class PcmVadStreamService {
  readonly micLevel = signal<number>(0);
  readonly isMuted = signal<boolean>(false);
  readonly isPaused = signal<boolean>(false);
  readonly isSpeechActive = signal<boolean>(false);

  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private callbacks: VadCallbacks | null = null;

  private aiSpeaking = false;
  private playbackLocked = false;
  private echoCooldownUntilMs = 0;
  private noiseFloor = 0.008;
  private speechStartFrames = 0;
  private silenceStartMs: number | null = null;
  private silenceThresholdMs = 750;
  private preRollBuffers: ArrayBuffer[] = [];
  private readonly maxPreRollFrames = 4;

  async start(callbacks: VadCallbacks): Promise<void> {
    this.stop();
    this.callbacks = callbacks;
    this.isMuted.set(false);
    this.isPaused.set(false);
    this.isSpeechActive.set(false);
    this.noiseFloor = 0.008;
    this.speechStartFrames = 0;
    this.silenceStartMs = null;
    this.preRollBuffers = [];

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtx({ sampleRate: 16000 });
      const sourceRate = this.audioCtx.sampleRate;
      const source = this.audioCtx.createMediaStreamSource(this.stream);
      this.processor = this.audioCtx.createScriptProcessor(2048, 1, 1);

      this.processor.onaudioprocess = (evt) => {
        if (!this.callbacks || this.isMuted() || this.isPaused() || this.playbackLocked) {
          this.micLevel.set(0);
          return;
        }
        const samples = evt.inputBuffer.getChannelData(0);
        const rms = this.computeRms(samples);
        this.micLevel.set(Math.min(100, Math.round(rms * 650)));

        const pcm = float32ToPcm16Bytes(samples, sourceRate, 16000);
        const now = performance.now();

        if (!this.isSpeechActive() && now < this.echoCooldownUntilMs) {
          this.speechStartFrames = 0;
          return;
        }

        // Adapt noise floor slowly when idle
        if (!this.isSpeechActive() && !this.aiSpeaking && rms < this.noiseFloor * 2.2) {
          this.noiseFloor = 0.96 * this.noiseFloor + 0.04 * Math.max(0.004, rms);
        }

        // Higher threshold during AI playback to avoid speaker echo triggering false barge-in
        const triggerThreshold = this.aiSpeaking
          ? Math.max(0.085, this.noiseFloor * 4.5)
          : Math.max(0.015, this.noiseFloor * 2.1);
        const sustainFramesNeeded = this.aiSpeaking ? 5 : 2;

        if (!this.isSpeechActive()) {
          this.preRollBuffers.push(pcm);
          if (this.preRollBuffers.length > this.maxPreRollFrames) {
            this.preRollBuffers.shift();
          }
          if (rms >= triggerThreshold) {
            this.speechStartFrames++;
            if (this.speechStartFrames >= sustainFramesNeeded) {
              const bargeIn = this.aiSpeaking;
              this.isSpeechActive.set(true);
              this.silenceStartMs = null;
              this.speechStartFrames = 0;
              this.silenceThresholdMs = 750;
              this.callbacks.onSpeechStart(bargeIn);
              for (const pre of this.preRollBuffers) {
                this.callbacks.onAudioChunk(pre);
              }
              this.preRollBuffers = [];
            }
          } else {
            this.speechStartFrames = 0;
          }
          return;
        }

        // Speech active: stream PCM16 chunk and monitor end-of-utterance silence
        this.callbacks.onAudioChunk(pcm);
        const continueThreshold = Math.max(0.011, this.noiseFloor * 1.6);
        if (rms >= continueThreshold) {
          this.silenceStartMs = null;
        } else if (this.silenceStartMs === null) {
          this.silenceStartMs = now;
        } else if (now - this.silenceStartMs >= this.silenceThresholdMs) {
          this.isSpeechActive.set(false);
          this.silenceStartMs = null;
          this.silenceThresholdMs = 750;
          this.callbacks.onSpeechEnd();
        }
      };

      source.connect(this.processor);
      this.processor.connect(this.audioCtx.destination);
    } catch (err) {
      this.callbacks?.onError?.(err);
    }
  }

  setAiSpeaking(speaking: boolean): void {
    const wasSpeaking = this.aiSpeaking;
    this.aiSpeaking = speaking;
    if (!speaking) {
      this.speechStartFrames = 0;
      if (wasSpeaking) {
        this.echoCooldownUntilMs = performance.now() + 450;
      }
    }
  }

  /** Lock VAD triggers while explicitly replaying an archived audio bubble. */
  setPlaybackLock(locked: boolean): void {
    this.playbackLocked = locked;
    this.speechStartFrames = 0;
    if (!locked) {
      this.echoCooldownUntilMs = performance.now() + 450;
    }
  }

  /** Extend EOU wait when Communication-First policy detects filler words (um/uh/like). */
  extendSilenceWindow(ms = 2400): void {
    this.silenceThresholdMs = ms;
  }

  toggleMute(): boolean {
    const next = !this.isMuted();
    this.isMuted.set(next);
    if (next && this.isSpeechActive()) {
      this.isSpeechActive.set(false);
      this.silenceStartMs = null;
      this.callbacks?.onSpeechEnd();
    }
    return next;
  }

  setPaused(paused: boolean): void {
    this.isPaused.set(paused);
    if (paused && this.isSpeechActive()) {
      this.isSpeechActive.set(false);
      this.silenceStartMs = null;
      this.callbacks?.onSpeechEnd();
    }
  }

  stop(): void {
    this.aiSpeaking = false;
    this.isSpeechActive.set(false);
    this.micLevel.set(0);
    this.callbacks = null;
    this.preRollBuffers = [];

    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch {
        // ignore
      }
      this.processor = null;
    }
    if (this.audioCtx) {
      void this.audioCtx.close().catch(() => undefined);
      this.audioCtx = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  private computeRms(samples: Float32Array): number {
    let sum = 0;
    for (const sample of samples) {
      sum += sample * sample;
    }
    return Math.sqrt(sum / Math.max(1, samples.length));
  }
}
