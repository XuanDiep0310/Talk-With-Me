/// <reference types="jasmine" />
import { encodePcm16Wav, float32ToPcm16Bytes, resampleFloat32 } from './audio-capture.service';

describe('AudioCaptureService PCM16 & WAV helpers', () => {
  it('encodes standard 16kHz PCM16 RIFF WAV header and payload', async () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1.0, -1.0]);
    const wavBlob = encodePcm16Wav(samples, 16000, 16000);
    const bytes = new Uint8Array(await wavBlob.arrayBuffer());

    expect(wavBlob.type).toBe('audio/wav');
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe('RIFF');
    expect(String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])).toBe('WAVE');
    expect(bytes.length).toBe(44 + samples.length * 2);
  });

  it('resamples and clamps Float32 samples into PCM16 bytes cleanly', () => {
    const samples = new Float32Array(4800).fill(0.25);
    const resampled = resampleFloat32(samples, 48000, 16000);
    expect(resampled.length).toBe(1600);

    const pcm = float32ToPcm16Bytes(new Float32Array([2.5, -2.5]), 16000, 16000);
    const view = new DataView(pcm);
    expect(view.getInt16(0, true)).toBe(0x7fff);
    expect(view.getInt16(2, true)).toBe(-0x8000);
  });
});
