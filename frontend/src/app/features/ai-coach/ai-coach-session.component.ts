import { Component, ChangeDetectionStrategy, signal, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';
import { FormatTimePipe } from '../../shared/pipes/app-pipes';

export type SessionState = "mic-permission" | "connecting" | "ready" | "ai-speaking" | "user-speaking" | "processing" | "error-mic" | "error-network";

export interface TranscriptLine {
  id: number;
  speaker: "AI" | "Bạn";
  text: string;
  translation?: string;
  time: string;
  final: boolean;
}

export const AI_LINES: TranscriptLine[] = [
  { id: 1, speaker: "AI", text: "Hello! Great to have you here today. Let's talk about travel. What's a place you've always wanted to visit?", translation: "Xin chào! Hôm nay chúng ta hãy nói về du lịch. Có nơi nào bạn luôn muốn đến không?", time: "00:05", final: true },
  { id: 2, speaker: "Bạn", text: "I would really love to visit Japan someday. I'm fascinated by the culture.", translation: "", time: "00:22", final: true },
  { id: 3, speaker: "AI", text: "Japan is a wonderful choice! What specifically draws you to Japanese culture?", translation: "Nhật Bản là lựa chọn tuyệt vời! Điều gì trong văn hóa Nhật Bản thu hút bạn?", time: "00:35", final: true },
  { id: 4, speaker: "Bạn", text: "I love the food, especially sushi and ramen. And the temples are beautiful.", translation: "", time: "00:55", final: true }
];

export const USEFUL_PHRASES = [
  { en: "I've always wanted to...", vi: "Tôi luôn muốn..." },
  { en: "What I find fascinating is...", vi: "Điều tôi thấy thú vị là..." },
  { en: "Could you say that again?", vi: "Bạn có thể nhắc lại không?" }
];

@Component({
  selector: 'app-ai-coach-session',
  standalone: true,
  imports: [CommonModule, FormatTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 flex flex-col z-50" style="background: #0f172a">
      <!-- Session Header -->
      <div class="flex items-center gap-4 px-5 py-4 shrink-0" style="background: #1e293b; border-bottom: 1px solid #334155">
        <div>
          <div class="text-white font-700 text-sm" style="font-weight: 700">{{ appState.selectedTopic() }}</div>
          <div class="flex items-center gap-2">
            @if (state() === 'connecting') {
              <span class="text-xs" style="color: #f59e0b">⏳ Đang kết nối...</span>
            } @else if (state() === 'ai-speaking') {
              <span class="flex items-center gap-1 text-xs" style="color: #38bdf8">
                <span class="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span> AI đang nói...
              </span>
            } @else if (state() === 'user-speaking') {
              <span class="flex items-center gap-1 text-xs" style="color: #4ade80">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Lắng nghe bạn...
              </span>
            } @else {
              <span class="text-xs" style="color: #94a3b8">Đã sẵn sàng</span>
            }
          </div>
        </div>

        <div class="ml-auto flex items-center gap-3">
          <div class="px-3 py-1.5 rounded-xl font-mono text-sm font-700 text-white" style="background: #334155; font-weight: 700">
            {{ timer() | formatTime }}
          </div>
          <button class="btn-accent text-xs py-2 px-3.5 cursor-pointer" (click)="showEndModal.set(true)">
            Kết thúc
          </button>
        </div>
      </div>

      <!-- Main transcript chat body -->
      <div class="flex-1 overflow-y-auto p-5 space-y-4 max-w-3xl mx-auto w-full">
        @for (line of transcript(); track line.id) {
          <div class="flex gap-3" [class.flex-row-reverse]="line.speaker === 'Bạn'">
            <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-700 text-xs text-white" [style.background]="line.speaker === 'AI' ? '#286FB4' : '#059669'">
              {{ line.speaker === 'AI' ? 'AI' : 'Bạn' }}
            </div>
            <div class="max-w-md rounded-2xl p-4 text-sm" [style.background]="line.speaker === 'AI' ? '#1e293b' : '#064e3b'" [style.color]="'#fff'">
              <div>{{ line.text }}</div>
              @if (line.translation) {
                <div class="text-xs mt-1 text-slate-400 border-t border-slate-700 pt-1">{{ line.translation }}</div>
              }
            </div>
          </div>
        }

        @if (interim()) {
          <div class="flex gap-3 flex-row-reverse">
            <div class="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs text-white">Bạn</div>
            <div class="max-w-md rounded-2xl p-4 text-sm bg-emerald-950/80 text-emerald-200 border border-emerald-800 animate-pulse">
              {{ interim() }}...
            </div>
          </div>
        }
      </div>

      <!-- Interactive Controls Footer -->
      <div class="p-6 shrink-0 flex flex-col items-center gap-4" style="background: #1e293b; border-top: 1px solid #334155">
        <div class="flex items-center gap-6">
          <button class="p-4 rounded-full bg-slate-700 text-white cursor-pointer hover:bg-slate-600" (click)="toggleMic()">
            @if (micMuted()) { 🔇 } @else { 🎙️ }
          </button>
          <button class="btn-primary px-8 py-3.5 rounded-full text-base font-600 cursor-pointer" (click)="simulateSpeechCycle()">
            🗣️ Thử trả lời
          </button>
          <button class="p-4 rounded-full bg-slate-700 text-white cursor-pointer hover:bg-slate-600" (click)="togglePhrases()">
            💡
          </button>
        </div>

        @if (showPhrases()) {
          <div class="p-4 rounded-2xl bg-slate-800 border border-slate-700 max-w-md w-full">
            <div class="text-xs font-700 text-slate-400 mb-2 uppercase">Mẫu câu gợi ý</div>
            <div class="space-y-2">
              @for (p of usefulPhrases; track p.en) {
                <div class="text-xs text-slate-200">
                  <strong class="text-sky-400">{{ p.en }}</strong> — {{ p.vi }}
                </div>
              }
            </div>
          </div>
        }
      </div>

      <!-- Exit Confirmation Modal -->
      @if (showEndModal()) {
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div class="card p-6 max-w-sm w-full bg-slate-800 text-white border-slate-700 text-center">
            <div class="text-4xl mb-3">🛑</div>
            <h3 class="text-lg font-700 mb-2">Kết thúc buổi luyện nói?</h3>
            <p class="text-xs text-slate-400 mb-6">Kết quả buổi luyện sẽ được lưu lại trong báo cáo AI Coach của bạn.</p>
            <div class="flex gap-3 justify-center">
              <button class="btn-secondary text-sm cursor-pointer" (click)="showEndModal.set(false)">Hủy</button>
              <button class="btn-primary text-sm cursor-pointer" (click)="endSession()">Xem báo cáo kết quả</button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class AiCoachSessionComponent implements OnInit, OnDestroy {
  readonly appState = inject(AppStateService);

  readonly state = signal<SessionState>("ready");
  readonly timer = signal(0);
  readonly micMuted = signal(false);
  readonly transcript = signal<TranscriptLine[]>(AI_LINES);
  readonly interim = signal("");
  readonly showPhrases = signal(false);
  readonly showEndModal = signal(false);

  readonly usefulPhrases = USEFUL_PHRASES;

  private timerInterval: any = null;

  ngOnInit(): void {
    this.timerInterval = setInterval(() => {
      this.timer.update(t => t + 1);
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  toggleMic(): void {
    this.micMuted.update(m => !m);
  }

  togglePhrases(): void {
    this.showPhrases.update(value => !value);
  }

  simulateSpeechCycle(): void {
    this.state.set("user-speaking");
    this.interim.set("I would really love to visit Japan...");
    setTimeout(() => {
      this.interim.set("");
      this.state.set("ai-speaking");
    }, 1500);
  }

  endSession(): void {
    this.showEndModal.set(false);
    this.appState.go("ai-coach-report");
  }
}
