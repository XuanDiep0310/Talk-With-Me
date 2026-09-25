import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SpeechRecognitionService } from '../../core/services/speech-recognition.service';
import { VoiceWsService } from '../../core/services/voice-ws.service';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  audioUrl?: string; // For user recorded audio OR blob URL
  audioB64?: string; // For Edge-TTS base64 MP3
  isPlaying?: boolean;
  timestamp: Date;
}

@Component({
  selector: 'app-voice-demo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './voice-demo.component.html',
  styleUrls: ['./voice-demo.component.scss']
})
export class VoiceDemoComponent implements OnInit, OnDestroy {
  public messages: ChatMessage[] = [];
  public isListening = false;
  public isWsConnected = false;
  public selectedVoice = 'vi-VN-HoaiMyNeural';
  public manualTextInput = '';
  public errorMessage: string | null = null;
  public currentlyPlayingAudio: HTMLAudioElement | null = null;
  public currentlyPlayingId: string | null = null;

  public availableVoices = [
    { id: 'vi-VN-HoaiMyNeural', name: 'Hoài Mỹ (Nữ miền Bắc)' },
    { id: 'vi-VN-NamMinhNeural', name: 'Nam Minh (Nam miền Bắc)' },
    { id: 'en-US-AvaNeural', name: 'Ava (Female English)' }
  ];

  private subs = new Subscription();

  constructor(
    public speechService: SpeechRecognitionService,
    public wsService: VoiceWsService
  ) {}

  ngOnInit(): void {
    this.wsService.connectWebSocket();

    // Subscribe to WS connection status
    this.subs.add(
      this.wsService.isConnected$.subscribe((connected) => {
        this.isWsConnected = connected;
      })
    );

    // Subscribe to Speech Recognition listening state
    this.subs.add(
      this.speechService.isListening$.subscribe((listening) => {
        this.isListening = listening;
      })
    );

    // Subscribe to Recognized Speech from Microphone
    this.subs.add(
      this.speechService.speechResult$.subscribe((result) => {
        if (result.text && result.text.trim()) {
          this.addUserMessage(result.text, result.audioUrl);
          // Automatically request AI response & TTS for demo
          this.generateAiResponse(result.text);
        }
      })
    );

    // Subscribe to Edge-TTS Audio response from WebSocket
    this.subs.add(
      this.wsService.ttsResponse$.subscribe((data) => {
        this.addAiMessage(data.text, data.audio_b64);
      })
    );

    // Subscribe to Errors
    this.subs.add(
      this.speechService.error$.subscribe((err) => {
        this.errorMessage = err;
      })
    );
    this.subs.add(
      this.wsService.error$.subscribe((err) => {
        this.errorMessage = err;
      })
    );

    // Add initial welcome message
    this.messages.push({
      id: 'welcome-1',
      sender: 'ai',
      text: 'Xin chào! Hãy bấm nút Micro để bắt đầu nói, hoặc nhập chữ bên dưới.',
      timestamp: new Date()
    });
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.stopCurrentAudio();
    this.wsService.disconnect();
  }

  public toggleMicrophone(): void {
    this.errorMessage = null;
    if (this.isListening) {
      this.speechService.stopListening();
    } else {
      this.speechService.startListening();
    }
  }

  public sendManualText(): void {
    if (!this.manualTextInput || !this.manualTextInput.trim()) {
      return;
    }
    const text = this.manualTextInput.trim();
    this.manualTextInput = '';
    this.addUserMessage(text);
    this.generateAiResponse(text);
  }

  private addUserMessage(text: string, audioUrl?: string): void {
    const msg: ChatMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text,
      audioUrl,
      timestamp: new Date()
    };
    this.messages.push(msg);
  }

  private generateAiResponse(userText: string): void {
    // Generate AI response text and request Edge-TTS
    const aiText = `Tôi đã nghe bạn nói: "${userText}"`;
    this.wsService.requestTTS(aiText, this.selectedVoice);
  }

  private addAiMessage(text: string, audioB64?: string): void {
    const msg: ChatMessage = {
      id: 'ai-' + Date.now(),
      sender: 'ai',
      text,
      audioB64,
      timestamp: new Date()
    };
    this.messages.push(msg);
  }

  public playMessageAudio(msg: ChatMessage): void {
    this.stopCurrentAudio();

    if (msg.sender === 'user' && msg.audioUrl) {
      // Play user's actual microphone recorded audio
      this.currentlyPlayingId = msg.id;
      msg.isPlaying = true;
      this.currentlyPlayingAudio = this.wsService.playAudioFromUrl(msg.audioUrl);
      this.currentlyPlayingAudio.onended = () => {
        msg.isPlaying = false;
        this.currentlyPlayingId = null;
      };
    } else if (msg.audioB64) {
      // Play AI Edge-TTS MP3 audio
      this.currentlyPlayingId = msg.id;
      msg.isPlaying = true;
      this.currentlyPlayingAudio = this.wsService.playAudioFromBase64(msg.audioB64);
      this.currentlyPlayingAudio.onended = () => {
        msg.isPlaying = false;
        this.currentlyPlayingId = null;
      };
    } else {
      // Fallback: Request TTS on demand if not present
      this.wsService.requestTTSHttp(msg.text, this.selectedVoice).then((data) => {
        msg.audioB64 = data.audio_b64;
        this.playMessageAudio(msg);
      });
    }
  }

  public stopCurrentAudio(): void {
    if (this.currentlyPlayingAudio) {
      this.currentlyPlayingAudio.pause();
      this.currentlyPlayingAudio = null;
    }
    this.messages.forEach((m) => (m.isPlaying = false));
    this.currentlyPlayingId = null;
  }

  public dismissError(): void {
    this.errorMessage = null;
  }
}
