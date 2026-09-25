import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

export interface SpeechResult {
  text: string;
  audioBlob?: Blob;
  audioUrl?: string;
}

interface ISpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface ISpeechRecognitionErrorEvent {
  error: string;
}

interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

@Injectable({
  providedIn: 'root'
})
export class SpeechRecognitionService {
  private recognition: ISpeechRecognition | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  private isListeningSubject = new BehaviorSubject<boolean>(false);
  public isListening$: Observable<boolean> = this.isListeningSubject.asObservable();

  private speechResultSubject = new Subject<SpeechResult>();
  public speechResult$: Observable<SpeechResult> = this.speechResultSubject.asObservable();

  private errorSubject = new Subject<string>();
  public error$: Observable<string> = this.errorSubject.asObservable();

  public isSupported = false;

  constructor(private ngZone: NgZone) {
    this.initSpeechRecognition();
  }

  private initSpeechRecognition(): void {
    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      this.isSupported = true;
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'vi-VN';

      this.recognition.onstart = () => {
        this.ngZone.run(() => this.isListeningSubject.next(true));
      };

      this.recognition.onresult = (event: ISpeechRecognitionEvent) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (event.results[0].isFinal) {
          this.handleFinalResult(transcript);
        }
      };

      this.recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
        this.ngZone.run(() => {
          this.isListeningSubject.next(false);
          this.errorSubject.next(`Lỗi nhận diện giọng nói: ${event.error}`);
        });
      };

      this.recognition.onend = () => {
        this.ngZone.run(() => this.isListeningSubject.next(false));
      };
    } else {
      this.isSupported = false;
    }
  }

  public async startListening(lang = 'vi-VN'): Promise<void> {
    if (!this.isSupported || !this.recognition) {
      this.errorSubject.next('Trình duyệt không hỗ trợ Web Speech API.');
      return;
    }

    try {
      // Start MediaRecorder to capture actual user voice audio
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      this.mediaRecorder.start();

      // Start WebSpeech Recognition
      this.recognition.lang = lang;
      this.recognition.start();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.errorSubject.next(`Không thể truy cập Microphone: ${msg}`);
    }
  }

  public stopListening(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore if already stopped
      }
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      // Stop all audio tracks to release microphone
      this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
    }
  }

  private handleFinalResult(transcript: string): void {
    let audioBlob: Blob | undefined;
    let audioUrl: string | undefined;

    if (this.audioChunks.length > 0) {
      audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      audioUrl = URL.createObjectURL(audioBlob);
    }

    this.ngZone.run(() => {
      this.speechResultSubject.next({
        text: transcript,
        audioBlob,
        audioUrl
      });
    });
  }
}
