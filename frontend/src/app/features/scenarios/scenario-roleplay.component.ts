import { Component, ChangeDetectionStrategy, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';
import { FormatTimePipe } from '../../shared/pipes/app-pipes';

export interface Line {
  id: number;
  speaker: "AI" | "Bạn";
  text: string;
  translation?: string;
  time: string;
  detectedChunk?: string;
}

export const SCRIPT: Line[] = [
  { id: 1, speaker: "AI", text: "Good evening! Welcome to The Garden Restaurant. Do you have a reservation?", translation: "Chào buổi tối! Chào mừng đến The Garden. Quý khách có đặt bàn trước không?", time: "00:05" },
  { id: 2, speaker: "Bạn", text: "Good evening! Could I have a table for two, please? We don't have a reservation.", time: "00:18", detectedChunk: "c1" },
  { id: 3, speaker: "AI", text: "Of course! Right this way. Here's the menu. Can I start you with something to drink?", translation: "Tất nhiên! Mời quý khách đi theo đây. Đây là thực đơn. Quý khách muốn dùng gì trước không?", time: "00:30" },
  { id: 4, speaker: "Bạn", text: "Could you tell me more about today's specials? And I'd like to order a sparkling water for now.", time: "00:52", detectedChunk: "c3" },
  { id: 5, speaker: "AI", text: "Sure! Today's special is pan-seared sea bass with lemon butter sauce. It's very popular!", translation: "Dạ! Đặc biệt hôm nay là cá vược áp chảo với sốt bơ chanh. Rất được ưa chuộng!", time: "01:05" },
  { id: 6, speaker: "Bạn", text: "That sounds great, I'll go with the sea bass. And I'd like to order the Caesar salad as well.", time: "01:22", detectedChunk: "c4" }
];

@Component({
  selector: 'app-scenario-roleplay',
  standalone: true,
  imports: [CommonModule, FormatTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 flex flex-col z-50" style="background: #0f172a">
      <!-- Header -->
      <div class="flex items-center gap-3 px-4 py-3 shrink-0" style="background: #1e293b; border-bottom: 1px solid #334155">
        <div class="text-xl">🎭</div>
        <div class="flex-1 min-w-0">
          <div class="text-white font-700 text-sm truncate" style="font-weight: 700">
            {{ appState.selectedScenario()?.title || "Roleplay Tình huống" }}
          </div>
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span class="text-xs text-emerald-400">Đang roleplay</span>
          </div>
        </div>

        <span class="font-700 text-base shrink-0 font-mono text-sky-400" style="font-weight: 700">
          {{ timer() | formatTime }}
        </span>

        <button
          class="btn-accent text-xs py-1.5 px-3 cursor-pointer shrink-0"
          (click)="showEndModal.set(true)"
        >
          Hoàn thành
        </button>
      </div>

      <!-- Transcript body -->
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
      </div>

      <!-- Footer controls -->
      <div class="p-6 shrink-0 flex flex-col items-center gap-4" style="background: #1e293b; border-top: 1px solid #334155">
        <div class="flex items-center gap-4">
          <button class="btn-primary px-8 py-3.5 rounded-full text-base font-600 cursor-pointer" (click)="nextSpeechStep()">
            🎙️ Nhấn để nói câu tiếp theo
          </button>
        </div>
      </div>

      <!-- End Confirmation Modal -->
      @if (showEndModal()) {
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div class="card p-6 max-w-sm w-full bg-slate-800 text-white border-slate-700 text-center">
            <div class="text-4xl mb-3">🎉</div>
            <h3 class="text-lg font-700 mb-2">Hoàn thành Roleplay?</h3>
            <p class="text-xs text-slate-400 mb-6">Bạn đã sử dụng thành công các Chunks trong tình huống này.</p>
            <div class="flex gap-3 justify-center">
              <button class="btn-secondary text-sm cursor-pointer" (click)="showEndModal.set(false)">Tiếp tục</button>
              <button class="btn-primary text-sm cursor-pointer" (click)="finishRoleplay()">Xem kết quả</button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class ScenarioRoleplayComponent implements OnInit, OnDestroy {
  readonly appState = inject(AppStateService);

  readonly timer = signal(0);
  readonly transcript = signal<Line[]>([SCRIPT[0]]);
  readonly showEndModal = signal(false);
  readonly scriptIdx = signal(1);

  private timerInterval: any = null;

  ngOnInit(): void {
    this.timerInterval = setInterval(() => {
      this.timer.update(t => t + 1);
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  nextSpeechStep(): void {
    const idx = this.scriptIdx();
    if (idx < SCRIPT.length) {
      this.transcript.update(list => [...list, SCRIPT[idx]]);
      this.scriptIdx.update(i => i + 1);
    } else {
      this.showEndModal.set(true);
    }
  }

  finishRoleplay(): void {
    this.showEndModal.set(false);
    this.appState.go("scenario-result");
  }
}
