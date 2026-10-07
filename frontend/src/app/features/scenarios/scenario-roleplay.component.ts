import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AppStateService } from '../../core/services/app-state.service';
import { SpeechRecognitionService } from '../../core/services/speech-recognition.service';
import { FormatTimePipe } from '../../shared/pipes/app-pipes';
import { GENERIC_CHUNKS } from './scenario-detail.component';

export interface Line {
  id: number;
  speaker: "AI" | "User";
  text: string;
  translation?: string;
  time: string;
  detectedChunk?: string;
}

export const SCRIPT: Line[] = [
  { id: 1, speaker: "AI", text: "Good evening! Welcome to The Garden Restaurant. Do you have a reservation?", translation: "Chào buổi tối! Chào mừng đến The Garden. Quý khách có đặt bàn trước không?", time: "00:05" },
  { id: 2, speaker: "User", text: "Good evening! Could I have a table for two, please? We don't have a reservation.", time: "00:18", detectedChunk: "c1" },
  { id: 3, speaker: "AI", text: "Of course! Right this way. Here's the menu. Can I start you with something to drink?", translation: "Tất nhiên! Mời quý khách đi theo đây. Đây là thực đơn. Quý khách muốn dùng gì trước không?", time: "00:30" },
  { id: 4, speaker: "User", text: "Could you tell me more about today's specials? And I'd like to order a sparkling water for now.", time: "00:52", detectedChunk: "c3" },
  { id: 5, speaker: "AI", text: "Sure! Today's special is pan-seared sea bass with lemon butter sauce. It's very popular!", translation: "Dạ! Đặc biệt hôm nay là cá vược áp chảo với sốt bơ chanh. Rất được ưa chuộng!", time: "01:05" },
  { id: 6, speaker: "User", text: "That sounds great, I'll go with the sea bass. And I'd like to order the Caesar salad as well.", time: "01:22", detectedChunk: "c4" }
];

@Component({
  selector: 'app-scenario-roleplay',
  standalone: true,
  imports: [CommonModule, FormatTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 flex flex-col z-50" style="background: #0f172a">
      <!-- Header -->
      <div class="flex flex-wrap items-center gap-3 px-3 sm:px-4 py-3 shrink-0" style="background: #1e293b; border-bottom: 1px solid #334155">
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
          class="text-xs py-1.5 px-3 rounded-lg cursor-pointer shrink-0"
          [style.background]="showHints() ? '#334155' : '#0f172a'"
          [attr.aria-expanded]="showHints()"
          (click)="toggleHints()"
        >
          🧩 Chunks
        </button>

        <button
          class="btn-accent text-xs py-1.5 px-3 cursor-pointer shrink-0"
          (click)="showEndModal.set(true)"
        >
          Hoàn thành
        </button>
      </div>

      <!-- Transcript and live practice hints -->
      <div class="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        <div class="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 max-w-3xl mx-auto w-full">
          @for (line of transcript(); track line.id) {
            <div class="flex gap-3" [class.flex-row-reverse]="line.speaker === 'User'">
              <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-700 text-xs text-white" [style.background]="line.speaker === 'AI' ? '#286FB4' : '#7c3aed'">
                {{ line.speaker }}
              </div>
              <div class="min-w-0 max-w-[90%] sm:max-w-md rounded-2xl p-4 text-sm break-words" [style.background]="line.speaker === 'AI' ? '#243b5e' : '#31215f'" [style.color]="'#fff'">
                <div>{{ line.text }}</div>
                @if (line.translation) {
                  <div class="text-xs mt-1 text-slate-400 border-t border-slate-700 pt-1">{{ line.translation }}</div>
                }
              </div>
            </div>
          }
        </div>

        @if (showHints()) {
          <aside class="w-full lg:w-80 max-h-48 lg:max-h-none shrink-0 overflow-y-auto p-4 space-y-5" style="background: #111c30; border-top: 1px solid #334155; border-left: 1px solid #334155">
            <section>
              <div class="flex items-center justify-between mb-2 text-xs font-700 text-slate-400">
                <span>🎯 NHIỆM VỤ</span>
                <span>{{ completedTaskCount() }}/{{ tasks().length }}</span>
              </div>
              <div class="h-1.5 rounded-full bg-slate-700 overflow-hidden mb-3">
                <div class="h-full rounded-full transition-all" style="background: #3b82f6" [style.width.%]="taskProgressPct()"></div>
              </div>
              <div class="space-y-2">
                @for (task of taskStates(); track task.id) {
                  <div class="flex items-center gap-2 text-xs" [style.color]="task.done ? '#94a3b8' : '#e2e8f0'">
                    <span class="w-4 h-4 rounded flex items-center justify-center shrink-0" [style.background]="task.done ? '#22c55e' : '#334155'" [style.color]="'#fff'">
                      {{ task.done ? '✓' : '' }}
                    </span>
                    <span [class.line-through]="task.done">{{ task.label }}</span>
                  </div>
                }
              </div>
            </section>

            <section>
              <h2 class="text-xs font-700 text-slate-400 mb-2">🧩 CHUNKS MỤC TIÊU</h2>
              <div class="space-y-2">
                @for (chunk of targetChunks; track chunk.id) {
                  <div class="rounded-lg p-2.5" style="background: #0f172a; border: 1px solid #334155">
                    <span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-600 mb-1" [style.background]="chunk.bg" [style.color]="chunk.color">{{ chunk.label }}</span>
                    <div class="text-xs italic text-slate-200">"{{ chunk.chunk }}"</div>
                  </div>
                }
              </div>
            </section>
          </aside>
        }
      </div>

      <!-- Footer controls -->
      <div class="p-4 shrink-0 flex flex-col items-center gap-2" style="background: #1e293b; border-top: 1px solid #334155">
        <div class="flex flex-wrap items-center justify-center gap-3">
          <button
            class="btn-primary px-7 py-3 rounded-full text-base font-600 cursor-pointer"
            [style.background]="isListening() ? '#DF4C73' : '#286FB4'"
            [attr.aria-pressed]="isListening()"
            (click)="toggleMicrophone()"
          >
            {{ isListening() ? '⏹ Dừng nghe' : '🎙️ Nhấn để nói' }}
          </button>
          <button class="btn-secondary text-xs cursor-pointer" [disabled]="scriptIdx() >= scriptLength" (click)="nextSpeechStep()">
            ⏭️ Tiếp câu mẫu
          </button>
          <button class="btn-secondary text-xs cursor-pointer" (click)="addMockUserTurn()">Add mock User turn</button>
        </div>
        @if (speechError()) {
          <p class="text-xs text-rose-300" role="alert">{{ speechError() }}</p>
        }
      </div>

      <!-- End Confirmation Modal -->
      @if (showEndModal()) {
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <section role="dialog" aria-modal="true" aria-label="Finish roleplay confirmation" class="card p-5 sm:p-6 max-w-sm w-full max-h-[calc(100dvh-2rem)] overflow-y-auto bg-slate-800 text-white border-slate-700 text-center">
            <div class="text-4xl mb-3">🎉</div>
            <h3 class="text-lg font-700 mb-2">Hoàn thành Roleplay?</h3>
            <p class="text-xs text-slate-400 mb-6">Bạn đã sử dụng thành công các Chunks trong tình huống này.</p>
            <div class="flex gap-3 justify-center">
              <button class="btn-secondary text-sm cursor-pointer" (click)="showEndModal.set(false)">Tiếp tục</button>
              <button class="btn-primary text-sm cursor-pointer" (click)="finishRoleplay()">Xem kết quả</button>
            </div>
          </section>
        </div>
      }
    </div>
  `
})
export class ScenarioRoleplayComponent implements OnInit, OnDestroy {
  readonly appState = inject(AppStateService);
  readonly speechService = inject(SpeechRecognitionService);

  readonly timer = signal(0);
  readonly transcript = signal<Line[]>([SCRIPT[0]]);
  readonly showEndModal = signal(false);
  readonly scriptIdx = signal(1);
  readonly isListening = signal(false);
  readonly speechError = signal('');
  readonly showHints = signal(true);
  readonly targetChunks = GENERIC_CHUNKS;
  readonly scriptLength = SCRIPT.length;
  readonly tasks = computed(() => this.appState.selectedScenario()?.objectives ?? []);
  readonly taskStates = computed(() => this.tasks().map((label, id) => ({ id, label, done: false })));
  readonly completedTaskCount = computed(() => 0);
  readonly taskProgressPct = computed(() => 0);

  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private readonly speechSubscriptions = new Subscription();

  toggleHints(): void {
    this.showHints.update(visible => !visible);
  }

  ngOnInit(): void {
    this.transcript.set([SCRIPT[0]]);
    this.timerInterval = setInterval(() => {
      this.timer.update(t => t + 1);
    }, 1000);
    this.speechSubscriptions.add(this.speechService.isListening$.subscribe(listening => this.isListening.set(listening)));
    this.speechSubscriptions.add(this.speechService.speechResult$.subscribe(result => {
      if (result.text.trim()) {
        this.appendRecognizedSpeech(result.text.trim());
        this.speechService.stopListening();
      }
    }));
    this.speechSubscriptions.add(this.speechService.error$.subscribe(error => this.speechError.set(error)));
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.isListening()) this.speechService.stopListening();
    this.speechSubscriptions.unsubscribe();
  }

  async toggleMicrophone(): Promise<void> {
    this.speechError.set('');
    if (this.isListening()) {
      this.speechService.stopListening();
      return;
    }
    if (!this.speechService.isSupported) {
      this.speechError.set('Trình duyệt này chưa hỗ trợ nhận diện giọng nói. Bạn có thể dùng câu mẫu.');
      return;
    }
    await this.speechService.startListening('en-US');
  }

  private appendRecognizedSpeech(text: string): void {
    const userLine: Line = {
      id: Date.now(),
      speaker: 'User',
      text,
      time: this.formatElapsedTime()
    };
    const nextScriptIndex = this.scriptIdx();
    const nextLine = SCRIPT.slice(nextScriptIndex).find(line => line.speaker === 'AI');
    const reply = nextLine?.speaker === 'AI' ? nextLine : undefined;

    this.transcript.update(lines => reply ? [...lines, userLine, reply] : [...lines, userLine]);
    this.scriptIdx.set(reply ? SCRIPT.indexOf(reply) + 1 : SCRIPT.length);
  }

  private formatElapsedTime(): string {
    const totalSeconds = this.timer();
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
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

  addMockUserTurn(): void {
    const samples = ["Could you tell me more about that?", "I'd like to know what you recommend.", "That sounds good, thank you."];
    const turn = this.transcript().filter(line => line.speaker === 'User').length;
    const userLine: Line = { id: Date.now(), speaker: 'User', text: samples[turn % samples.length], time: this.formatElapsedTime() };
    const nextAi = SCRIPT.slice(this.scriptIdx()).find(line => line.speaker === 'AI');
    this.transcript.update(lines => nextAi ? [...lines, userLine, { ...nextAi, id: Date.now() + 1, time: this.formatElapsedTime() }] : [...lines, userLine]);
    this.scriptIdx.set(nextAi ? SCRIPT.indexOf(nextAi) + 1 : SCRIPT.length);
  }

  finishRoleplay(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.showEndModal.set(false);
    const scenario = this.appState.selectedScenario();
    const tasks = (scenario?.objectives ?? []).map((label, id) => ({ id, label, pass: true }));
    const status = tasks.length > 0 && tasks.every(task => task.pass) ? 'PASS' as const : 'NOT PASSED' as const;
    this.appState.completeRoleplay({
      scenarioId: scenario?.id ?? '', scenarioTitle: scenario?.title ?? 'Roleplay', tasks,
      passCount: tasks.filter(task => task.pass).length, totalTasks: tasks.length,
      xp: status === 'PASS' ? scenario?.xp ?? 40 : 20, status, completedAt: new Date().toISOString()
    });
    this.appState.go("scenario-result");
  }
}
