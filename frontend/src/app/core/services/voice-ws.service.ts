import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TTSResponseData {
  audio_b64: string;
  text: string;
  voice: string;
  content_type: string;
}

@Injectable({
  providedIn: 'root'
})
export class VoiceWsService {
  private socket: WebSocket | null = null;
  private isConnectedSubject = new BehaviorSubject<boolean>(false);
  public isConnected$: Observable<boolean> = this.isConnectedSubject.asObservable();

  private ttsResponseSubject = new Subject<TTSResponseData>();
  public ttsResponse$: Observable<TTSResponseData> = this.ttsResponseSubject.asObservable();

  private errorSubject = new Subject<string>();
  public error$: Observable<string> = this.errorSubject.asObservable();

  constructor(private http: HttpClient) {}

  public connectWebSocket(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsUrl: string;

    if (environment.apiUrl.startsWith('http')) {
      const urlObj = new URL(environment.apiUrl);
      const wsProtocol = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${wsProtocol}//${urlObj.host}${urlObj.pathname}/voice/ws`;
    } else {
      wsUrl = `${protocol}//${window.location.host}${environment.apiUrl}/voice/ws`;
    }

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnectedSubject.next(true);
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'audio_response') {
            this.ttsResponseSubject.next({
              audio_b64: data.audio_b64,
              text: data.text,
              voice: data.voice,
              content_type: data.content_type || 'audio/mpeg'
            });
          } else if (data.type === 'error') {
            this.errorSubject.next(data.message || 'WebSocket server error');
          }
        } catch {
          this.errorSubject.next('Lỗi đọc dữ liệu WebSocket');
        }
      };

      this.socket.onerror = () => {
        this.isConnectedSubject.next(false);
        this.errorSubject.next('Lỗi kết nối WebSocket');
      };

      this.socket.onclose = () => {
        this.isConnectedSubject.next(false);
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.isConnectedSubject.next(false);
      this.errorSubject.next(`Không thể tạo kết nối WebSocket: ${msg}`);
    }
  }

  public requestTTS(text: string, voice = 'vi-VN-HoaiMyNeural'): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'generate_tts',
          text,
          voice
        })
      );
    } else {
      // Fallback to HTTP POST if WebSocket is disconnected
      this.requestTTSHttp(text, voice).then(
        (data) => this.ttsResponseSubject.next(data),
        (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.errorSubject.next(`Lỗi gọi REST API TTS: ${msg}`);
        }
      );
    }
  }

  public async requestTTSHttp(text: string, voice = 'vi-VN-HoaiMyNeural'): Promise<TTSResponseData> {
    const url = `${environment.apiUrl}/voice/tts`;
    return firstValueFrom(
      this.http.post<TTSResponseData>(url, { text, voice })
    );
  }

  public playAudioFromBase64(b64Data: string, contentType = 'audio/mpeg'): HTMLAudioElement {
    const audio = new Audio(`data:${contentType};base64,${b64Data}`);
    audio.play();
    return audio;
  }

  public playAudioFromUrl(url: string): HTMLAudioElement {
    const audio = new Audio(url);
    audio.play();
    return audio;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
