import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AppStateService } from '../../core/services/app-state.service';
import {
  CoachVoiceService,
  LiveTranscriptItem,
} from '../../core/services/coach-voice.service';
import {
  ScenarioService,
  ScenarioDetail,
  ScenarioChunk,
} from '../../core/services/scenario.service';
import { FormatTimePipe } from '../../shared/pipes/app-pipes';

@Component({
  selector: 'app-scenario-roleplay',
  standalone: true,
  imports: [CommonModule, FormatTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      tabindex="-1"
      class="fixed inset-0 flex flex-col z-50 select-none"
      style="background: #0f172a; color: #f8fafc"
    >
      <!-- Top Header -->
      <header
        class="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 shrink-0"
        style="background: #1e293b; border-bottom: 1px solid #334155"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-full flex items-center justify-center bg-indigo-500/20 text-indigo-400 font-700 text-lg">
            🎭
          </div>
          <div class="min-w-0">
            <h1 class="font-700 text-base sm:text-lg truncate text-slate-100">
              {{ scenario()?.titleVi || 'Roleplay Tình huống' }}
            </h1>
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full" [ngClass]="statusDotClass()"></span>
              <span class="text-xs text-slate-300 font-500">{{ statusLabel() }}</span>
              <span class="text-xs text-slate-500 hidden sm:inline">|</span>
              <span class="text-xs text-indigo-300 hidden sm:inline">
                Vai: {{ scenario()?.userRole }} vs {{ scenario()?.aiRole }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Session Timer -->
          <span class="font-700 text-base font-mono text-sky-400 bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-700">
            {{ timer() | formatTime }}
          </span>

          <!-- Chunks Target Drawer Toggle -->
          <button
            type="button"
            class="text-xs font-600 py-2 px-3 rounded-xl transition cursor-pointer flex items-center gap-1.5"
            [style.background]="showChunks() ? '#3b82f6' : '#334155'"
            [style.color]="'#fff'"
            (click)="toggleChunks()"
          >
            <span>🧩</span>
            <span class="hidden sm:inline">Mẫu câu</span> ({{ scenario()?.chunks?.length || 0 }})
          </button>

          <!-- Complete Session button -->
          <button
            type="button"
            class="btn-accent text-xs font-700 py-2 px-4 rounded-xl cursor-pointer"
            (click)="showEndModal.set(true)"
          >
            Hoàn thành
          </button>
        </div>
      </header>

      <!-- Main Layout: Transcripts + Chunks Side Drawer -->
      <div class="flex-1 min-h-0 flex overflow-hidden relative">
        <!-- Conversation Area -->
        <div class="flex-1 min-h-0 flex flex-col overflow-hidden max-w-4xl mx-auto w-full">
          <!-- Message transcript stream -->
          <div
            #transcriptContainer
            class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4"
          >
            <!-- Scenario Context Card at top of stream -->
            @if (scenario(); as s) {
              <div class="p-4 rounded-2xl bg-slate-800/60 border border-slate-700 text-xs text-slate-300 space-y-1 mb-2">
                <div class="font-700 text-indigo-300 text-sm">🎯 Bối cảnh Roleplay:</div>
                <p>{{ s.contextVi }}</p>
                <div class="pt-1 text-slate-400 italic">
                  Bạn nhập vai <strong class="text-slate-200">{{ s.userRole }}</strong>, AI là <strong class="text-slate-200">{{ s.aiRole }}</strong>. Hãy hoàn thành các mục tiêu mà không ngần ngại nhé!
                </div>
              </div>
            }

            @for (t of voiceService.liveTranscripts(); track t.id) {
              <div
                class="flex gap-3"
                [class.flex-row-reverse]="t.speaker === 'USER'"
              >
                <!-- Avatar icon -->
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-700 text-xs text-white shadow"
                  [style.background]="t.speaker === 'AI' ? '#286FB4' : '#7c3aed'"
                >
                  {{ t.speaker === 'AI' ? 'AI' : 'Bạn' }}
                </div>

                <!-- Bubble -->
                <div
                  class="min-w-0 max-w-[85%] sm:max-w-md rounded-2xl p-4 text-sm break-words shadow-sm"
                  [style.background]="t.speaker === 'AI' ? '#1e293b' : '#312e81'"
                  [style.border]="t.speaker === 'AI' ? '1px solid #334155' : '1px solid #4338ca'"
                >
                  <div class="text-slate-100 font-500 leading-relaxed">{{ t.text }}</div>
                  @if (t.translation) {
                    <div class="text-xs mt-1.5 pt-1.5 border-t border-slate-700 text-slate-400">
                      {{ t.translation }}
                    </div>
                  }
                  <div class="text-[10px] text-slate-400 text-right mt-1">
                    {{ t.time }}
                  </div>
                </div>
              </div>
            }

            @if (voiceService.liveTranscripts().length === 0) {
              <div class="py-12 text-center text-slate-500 text-sm">
                Đang chuẩn bị câu chào từ AI...
              </div>
            }
          </div>

          <!-- Controls Bar at bottom -->
          <div
            class="p-4 sm:p-5 shrink-0 flex flex-col items-center gap-3"
            style="background: #1e293b; border-top: 1px solid #334155"
          >
            <!-- Microphone Tap-To-Speak Button -->
            <div class="flex items-center gap-4">
              <button
                type="button"
                class="w-16 h-16 rounded-full flex items-center justify-center text-2xl text-white transition-all duration-300 cursor-pointer shadow-lg hover:scale-105"
                [style.background]="micButtonBackground()"
                [attr.aria-label]="voiceService.isRecordingTurn() ? 'Dừng nói' : 'Bắt đầu nói'"
                (click)="toggleSpeaking()"
              >
                {{ voiceService.isRecordingTurn() ? '⏹' : '🎙️' }}
              </button>
            </div>

            <!-- Hint text -->
            <div class="text-xs text-slate-400 text-center">
              {{ micHintText() }}
            </div>

            <!-- Manual text input fallback -->
            <div class="w-full max-w-lg flex items-center gap-2 pt-1">
              <input
                #fallbackInput
                type="text"
                placeholder="Hoặc gõ câu thoại tại đây rồi Enter..."
                class="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                (keydown.enter)="sendFallbackText(fallbackInput)"
              />
              <button
                type="button"
                class="btn-primary text-xs px-3.5 py-2 rounded-xl cursor-pointer"
                (click)="sendFallbackText(fallbackInput)"
              >
                Gửi
              </button>
            </div>
          </div>
        </div>

        <!-- Chunks Target Drawer (Slide in/out) -->
        @if (showChunks()) {
          <aside
            class="w-80 shrink-0 border-l border-slate-700 p-4 overflow-y-auto hidden md:block"
            style="background: #0f172a"
          >
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-700 text-sm text-sky-400 uppercase tracking-wider">
                🧩 Mẫu câu gợi ý
              </h3>
              <button
                type="button"
                class="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                (click)="showChunks.set(false)"
              >
                Đóng ✕
              </button>
            </div>
            <p class="text-xs text-slate-400 mb-4">
              Dùng các mẫu câu này trong hội thoại để đạt điểm cao và ghi nhận hoàn thành:
            </p>

            <div class="space-y-3">
              @for (c of scenario()?.chunks; track c.id) {
                <div class="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                  <div class="text-[10px] font-700 text-sky-400 uppercase mb-0.5">
                    {{ c.functionalTag }}
                  </div>
                  <div class="text-xs font-700 text-slate-100">
                    "{{ c.text }}"
                  </div>
                  <div class="text-[11px] text-slate-400 mt-1">
                    {{ c.meaningVi }}
                  </div>
                </div>
              }
            </div>
          </aside>
        }
      </div>

      <!-- End confirmation modal -->
      @if (showEndModal()) {
        <div class="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div class="card max-w-sm w-full p-6 space-y-4 bg-slate-800 border-slate-700 text-slate-100 shadow-2xl">
            <h3 class="font-700 text-lg text-white">Kết thúc phiên Roleplay?</h3>
            <p class="text-xs text-slate-300 leading-relaxed">
              AI sẽ chấm điểm 5 kỹ năng, kiểm tra các mục tiêu nhiệm vụ bạn đã đạt và thống kê các chunk bạn dùng tốt.
            </p>
            <div class="flex justify-end gap-3 pt-2">
              <button
                type="button"
                class="btn-secondary text-xs px-4 py-2 cursor-pointer"
                (click)="showEndModal.set(false)"
              >
                Tiếp tục nói
              </button>
              <button
                type="button"
                class="btn-accent text-xs px-4 py-2 font-700 cursor-pointer"
                [disabled]="isEnding()"
                (click)="confirmEndSession()"
              >
                {{ isEnding() ? 'Đang chấm điểm...' : 'Xác nhận hoàn thành' }}
              </button>
            </div>
          </div>
        </div>
      }
    </main>
  `,
})
export class ScenarioRoleplayComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly voiceService = inject(CoachVoiceService);
  private readonly scenarioService = inject(ScenarioService);
  readonly appState = inject(AppStateService);

  @ViewChild('transcriptContainer')
  private transcriptContainer?: ElementRef<HTMLDivElement>;

  readonly sessionId = signal<string>('');
  readonly scenario = signal<ScenarioDetail | null>(null);
  readonly timer = signal<number>(0);
  readonly showChunks = signal<boolean>(true);
  readonly showEndModal = signal<boolean>(false);
  readonly isEnding = signal<boolean>(false);

  private timerInterval?: ReturnType<typeof setInterval>;

  readonly statusLabel = computed(() => {
    const s = this.voiceService.uxState();
    switch (s) {
      case 'user_speaking':
        return 'Bạn đang nói...';
      case 'ai_speaking':
        return 'AI đang phản hồi...';
      case 'processing':
        return 'AI đang suy nghĩ...';
      case 'reconnecting':
        return 'Đang kết nối lại...';
      default:
        return 'Sẵn sàng hội thoại';
    }
  });

  readonly statusDotClass = computed(() => {
    const s = this.voiceService.uxState();
    if (s === 'user_speaking') return 'bg-emerald-400 animate-ping';
    if (s === 'ai_speaking') return 'bg-sky-400 animate-pulse';
    if (s === 'reconnecting') return 'bg-amber-400';
    return 'bg-emerald-500';
  });

  readonly micButtonBackground = computed(() => {
    if (this.voiceService.isRecordingTurn()) return '#DF4C73';
    const s = this.voiceService.uxState();
    if (s === 'ai_speaking') return '#64748b';
    return '#286FB4';
  });

  readonly micHintText = computed(() => {
    if (this.voiceService.isRecordingTurn()) {
      return 'Đang thu âm... Nhấn lại để hoàn thành lượt nói của bạn.';
    }
    const s = this.voiceService.uxState();
    if (s === 'ai_speaking') return 'AI đang trả lời, lắng nghe nhé...';
    return 'Chạm vào micro để bắt đầu nói với AI';
  });

  constructor() {
    effect(() => {
      // Auto-scroll when new transcript arrives
      this.voiceService.liveTranscripts();
      setTimeout(() => {
        if (this.transcriptContainer) {
          const el = this.transcriptContainer.nativeElement;
          el.scrollTop = el.scrollHeight;
        }
      }, 80);
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.sessionId.set(id);

    if (id) {
      // Connect to WebSocket roleplay session
      this.voiceService.startVoiceSession(id);

      // Load scenario details for context
      this.loadScenarioContext();

      // Start timer
      this.timerInterval = setInterval(() => {
        this.timer.update((t) => t + 1);
      }, 1000);
    }
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.voiceService.cleanup();
  }

  loadScenarioContext(): void {
    // Attempt to load scenario info from backend
    this.scenarioService.getScenario('supermarket-shopping').subscribe({
      next: (s) => this.scenario.set(s),
    });
  }

  toggleChunks(): void {
    this.showChunks.update((v) => !v);
  }

  async toggleSpeaking(): Promise<void> {
    await this.voiceService.toggleSpeakingTurn();
  }

  sendFallbackText(input: HTMLInputElement): void {
    const val = input.value.trim();
    if (!val) return;
    this.voiceService.sendUserText(val);
    input.value = '';
  }

  confirmEndSession(): void {
    const id = this.sessionId();
    if (!id) return;

    this.isEnding.set(true);
    this.scenarioService.endRoleplay(id).subscribe({
      next: () => {
        this.isEnding.set(false);
        this.showEndModal.set(false);
        this.router.navigate(['/scenario-result', id]);
      },
      error: () => {
        this.isEnding.set(false);
        this.showEndModal.set(false);
        // Fallback navigation
        this.router.navigate(['/scenario-result', id]);
      },
    });
  }
}
