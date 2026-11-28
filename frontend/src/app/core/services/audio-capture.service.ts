import { Injectable } from '@angular/core';

export interface CapturedWavResult {
  wavBlob: Blob;
  audioUrl: string;
  durationSeconds: number;
}

/** Encode Float32 PCM frames (resampled to 16kHz mono) into a standard 16-bit PCM WAV Blob. */
export function encodePcm16Wav(samples: Float32Array, sourceRate: number, targetRate = 16000): Blob {
  const resampled = resampleFloat32(samples, sourceRate, targetRate);
  const buffer = new ArrayBuffer(44 + resampled.length * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + resampled.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, resampled.length * 2, true);

  let offset = 44;
  for (const sample of resampled) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export function resampleFloat32(input: Float32Array, srcRate: number, dstRate: number): Float32Array {
  if (srcRate === dstRate || input.length === 0) return input;
  const ratio = srcRate / dstRate;
  const outLen = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const s0 = input[Math.min(idx, input.length - 1)];
    const s1 = input[Math.min(idx + 1, input.length - 1)];
    out[i] = s0 + (s1 - s0) * frac;
  }
  return out;
}

export function float32ToPcm16Bytes(samples: Float32Array, sourceRate: number, targetRate = 16000): ArrayBuffer {
  const resampled = resampleFloat32(samples, sourceRate, targetRate);
  const buffer = new ArrayBuffer(resampled.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < resampled.length; i++) {
    const clamped = Math.max(-1, Math.min(1, resampled[i]));
    view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return buffer;
}

@Injectable({ providedIn: 'root' })
export class AudioCaptureService {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private startedAt = 0;
  private sourceSampleRate = 16000;

  async start(): Promise<void> {
    this.release();
    this.chunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new AudioCtx({ sampleRate: 16000 });
    this.sourceSampleRate = this.audioCtx.sampleRate;
    const source = this.audioCtx.createMediaStreamSource(this.stream);
    this.processor = this.audioCtx.createScriptProcessor(2048, 1, 1);
    this.processor.onaudioprocess = (evt) => {
      const channel = evt.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(channel));
    };
    source.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);
    this.startedAt = performance.now();
  }

  stop(): CapturedWavResult {
    const durationSeconds = Math.max(0.1, (performance.now() - this.startedAt) / 1000);
    const totalLen = this.chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const c of this.chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    const rate = this.sourceSampleRate;
    this.release();
    const wavBlob = encodePcm16Wav(merged, rate, 16000);
    const audioUrl = URL.createObjectURL(wavBlob);
    return { wavBlob, audioUrl, durationSeconds };
  }

  release(): void {
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
    this.chunks = [];
  }
}
