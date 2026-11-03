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
import { CoachService } from '../../core/services/coach.service';
import {
  ScenarioService,
  ScenarioDetail,
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
      class="fixed inset-0 flex flex-col z-50 select-none bg-slate-50 text-slate-800"
    >
      <!-- Top Header (TalkWithMe Design System) -->
      <header
        class="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 shrink-0 bg-white border-b border-slate-200 shadow-xs"
      >
        <div class="flex items-center gap-3 min-w-0">
          <button
            type="button"
            aria-label="Quay lại"
            class="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
            (click)="showEndModal.set(true)"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div class="min-w-0">
            <h1 class="font-800 text-base sm:text-lg truncate text-slate-900 font-extrabold">
              {{ scenario()?.titleVi || 'Roleplay Tình huống' }}
            </h1>
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full" [ngClass]="statusDotClass()"></span>
              <span class="text-xs text-slate-500 font-500">{{ statusLabel() }}</span>
              <span class="text-xs text-slate-300 hidden sm:inline">•</span>
              <span class="text-xs text-[#286FB4] font-600 hidden sm:inline">
                Bạn ({{ scenario()?.userRole }}) vs AI ({{ scenario()?.aiRole }})
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Session Timer -->
          <span class="font-700 text-sm font-mono text-[#286FB4] bg-[#E2F0F9] px-3 py-1 rounded-xl">
            {{ timer() | formatTime }}
          </span>

          <!-- Chunks Target Drawer Toggle -->
          <button
            type="button"
            class="text-xs font-700 py-2 px-3 rounded-xl transition cursor-pointer flex items-center gap-1.5 border"
            [ngClass]="
              showChunks()
                ? 'bg-[#E2F0F9] text-[#286FB4] border-sky-200 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            "
            (click)="toggleChunks()"
          >
            <span>🧩</span>
            <span class="hidden sm:inline">Mẫu câu</span> ({{ scenario()?.chunks?.length || 0 }})
          </button>

          <!-- Complete Session button -->
          <button
            type="button"
            class="btn-primary text-xs font-700 py-2 px-4 rounded-xl cursor-pointer shadow-sm"
            (click)="showEndModal.set(true)"
          >
            Hoàn thành
          </button>
        </div>
      </header>

      <!-- Main Layout: Transcripts + Chunks Side Drawer -->
      <div class="flex-1 min-h-0 flex overflow-hidden relative">
        <!-- Conversation Area -->
        <div class="flex-1 min-h-0 flex flex-col overflow-hidden max-w-3xl mx-auto w-full">
          <!-- Message transcript stream -->
          <div
            #transcriptContainer
            class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4"
          >
            <!-- Scenario Context Card at top of stream -->
            @if (scenario(); as s) {
              <div class="p-4 rounded-2xl bg-[#E2F0F9]/60 border border-sky-100 text-xs text-slate-700 space-y-1 mb-2">
                <div class="font-700 text-[#286FB4] text-sm">🎯 Bối cảnh tình huống:</div>
                <p class="leading-relaxed">{{ s.context }}</p>
                <div class="pt-1 text-slate-500 italic">
                  Hãy tự nhiên trả lời bằng tiếng Anh theo vai của bạn. Bấm loa 🔊 ở mỗi câu để nghe lại.
                </div>
              </div>
            }

            @for (t of voiceService.liveTranscripts(); track t.id) {
              <div
                class="flex gap-3 my-2"
                [class.flex-row-reverse]="t.speaker === 'USER'"
              >
                <!-- Avatar icon -->
                <div
                  class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-xs text-white shadow-xs"
                  [style.background]="t.speaker === 'AI' ? '#286FB4' : '#10b981'"
                >
                  {{ t.speaker === 'AI' ? 'AI' : 'Bạn' }}
                </div>

                <!-- Speech Bubble -->
                <div
                  class="min-w-0 max-w-[85%] sm:max-w-lg rounded-2xl p-4 text-sm shadow-xs transition-all"
                  [ngClass]="
                    t.speaker === 'AI'
                      ? 'bg-white border border-slate-200 text-slate-800'
                      : 'bg-[#286FB4] text-white shadow-md'
                  "
                >
                  <!-- Top Bar: Speaker + Actions (Replay Speaker 🔊 & Translate 🌐) -->
                  <div
                    class="flex items-center justify-between gap-4 text-[11px] mb-1.5"
                    [class.text-slate-400]="t.speaker === 'AI'"
                    [class.text-sky-100]="t.speaker === 'USER'"
                  >
                    <span class="font-700">
                      {{ t.speaker === 'AI' ? (scenario()?.aiRole || 'AI Roleplay') : 'Bạn' }} • {{ t.time }}
                    </span>

                    <div class="flex items-center gap-1.5">
                      <!-- Translate Toggle Button (Globe icon) -->
                      <button
                        type="button"
                        class="w-6 h-6 flex items-center justify-center rounded-full text-xs transition cursor-pointer"
                        [ngClass]="
                          t.speaker === 'AI'
                            ? (showTranslation()[t.id] ? 'bg-sky-100 text-[#286FB4]' : 'hover:bg-slate-100 text-slate-500')
                            : (showTranslation()[t.id] ? 'bg-white/30 text-white' : 'hover:bg-white/15 text-sky-100')
                        "
                        [title]="showTranslation()[t.id] ? 'Ẩn bản dịch' : 'Xem bản dịch tiếng Việt'"
                        (click)="toggleTranslation(t)"
                      >
                        🌐
                      </button>

                      <!-- Audio Replay Speaker Button -->
                      <button
                        type="button"
                        class="w-6 h-6 flex items-center justify-center rounded-full text-xs transition cursor-pointer"
                        [ngClass]="
                          t.speaker === 'AI'
                            ? (voiceService.playingSegmentId() === t.id ? 'bg-amber-100 text-amber-700 animate-pulse' : 'hover:bg-slate-100 text-slate-600')
                            : (voiceService.playingSegmentId() === t.id ? 'bg-white text-[#286FB4] animate-pulse' : 'hover:bg-white/15 text-white')
                        "
                        [title]="voiceService.playingSegmentId() === t.id ? 'Đang phát...' : 'Nghe lại phát âm'"
                        (click)="replaySpeaker(t)"
                      >
                        {{ voiceService.playingSegmentId() === t.id ? '🔊' : '🔈' }}
                      </button>
                    </div>
                  </div>

                  <!-- Spoken English Text -->
                  <div class="font-500 text-[15px] leading-relaxed break-words">
                    {{ t.text }}
                    @if (t.isPartial) {
                      <span class="inline-block animate-pulse font-bold">...</span>
                    }
                  </div>

                  <!-- Full Vietnamese Translation (Always available / auto-shown if available or on toggle) -->
                  @if (showTranslation()[t.id]) {
                    <div
                      class="mt-2.5 pt-2 text-xs leading-relaxed italic border-t"
                      [ngClass]="
                        t.speaker === 'AI'
                          ? 'border-slate-100 text-slate-600'
                          : 'border-white/20 text-sky-100'
                      "
                    >
                      @if (loadingTranslation()[t.id] && !translationMap()[t.id] && !t.translation) {
                        <span class="animate-pulse">Đang dịch...</span>
                      } @else {
                        <span>{{ translationMap()[t.id] || t.translation || 'Không thể lấy bản dịch' }}</span>
                      }
                    </div>
                  }
                </div>
              </div>
            }

            @if (voiceService.liveTranscripts().length === 0) {
              <div class="py-16 text-center text-slate-400 text-sm">
                <div class="text-3xl animate-bounce mb-2">💬</div>
                Đang kết nối và chuẩn bị câu mở đầu từ AI...
              </div>
            }

            <!-- AI Thinking indicator -->
            @if (voiceService.uxState() === 'processing') {
              <div class="flex items-center gap-2 text-xs text-[#286FB4] font-600 py-2">
                <span class="w-2 h-2 rounded-full bg-[#286FB4] animate-ping"></span>
                AI đang xử lý câu trả lời...
              </div>
            }
          </div>

          <!-- Pure Microphone Bottom Bar (No Text Box, Only Microphone) -->
          <footer
            class="p-4 sm:p-5 shrink-0 flex flex-col items-center justify-center gap-2.5 bg-white border-t border-slate-200 shadow-md"
          >
            <!-- Central Microphone Button with Pulsing Wave on Speaking -->
            <div class="relative flex items-center justify-center">
              @if (voiceService.isRecordingTurn()) {
                <span class="absolute w-24 h-24 rounded-full bg-rose-500/20 animate-ping pointer-events-none"></span>
                <span class="absolute w-20 h-20 rounded-full bg-rose-500/30 animate-pulse pointer-events-none"></span>
              }

              <button
                type="button"
                data-testid="roleplay-mic-btn"
                class="relative z-10 w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center text-2xl text-white transition-all duration-200 shadow-xl cursor-pointer hover:scale-105 active:scale-95 focus:outline-none"
                [style.background]="voiceService.isRecordingTurn() ? '#DF4C73' : '#286FB4'"
                [attr.aria-label]="voiceService.isRecordingTurn() ? 'Dừng nói' : 'Bắt đầu nói'"
                (click)="toggleSpeaking()"
              >
                @if (voiceService.isRecordingTurn()) {
                  <div class="flex items-center gap-1" title="Nhấn để hoàn tất câu nói">
                    <span class="w-1.5 h-4 bg-white rounded-full animate-[bounce_0.8s_infinite]"></span>
                    <span class="w-1.5 h-7 bg-white rounded-full animate-[bounce_0.8s_infinite_0.15s]"></span>
                    <span class="w-1.5 h-5 bg-white rounded-full animate-[bounce_0.8s_infinite_0.3s]"></span>
                    <span class="w-1.5 h-7 bg-white rounded-full animate-[bounce_0.8s_infinite_0.45s]"></span>
                    <span class="w-1.5 h-4 bg-white rounded-full animate-[bounce_0.8s_infinite_0.6s]"></span>
                  </div>
                } @else {
                  <span class="text-2xl sm:text-3xl">🎙️</span>
                }
              </button>
            </div>

            <!-- Hint text below microphone -->
            <div class="text-center">
              <p class="text-xs sm:text-sm font-700 text-slate-700">
                @if (voiceService.isRecordingTurn()) {
                  <span class="text-rose-600">Đang lắng nghe... Chạm lại để hoàn tất câu nói</span>
                } @else if (voiceService.uxState() === 'processing') {
                  <span class="text-[#286FB4]">AI đang suy nghĩ...</span>
                } @else if (voiceService.uxState() === 'ai_speaking') {
                  <span class="text-[#286FB4]">AI đang phản hồi qua loa</span>
                } @else {
                  <span class="text-slate-600">Chạm vào micro để nói</span>
                }
              </p>
            </div>
          </footer>
        </div>

        <!-- Chunks Target Drawer (Clean Sidebar for Desktop) -->
        @if (showChunks()) {
          <aside
            class="w-80 shrink-0 border-l border-slate-200 p-5 overflow-y-auto hidden md:block bg-white shadow-xs"
          >
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-800 text-xs text-[#286FB4] uppercase tracking-wider">
                🧩 Mẫu câu gợi ý
              </h3>
              <button
                type="button"
                class="w-6 h-6 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                (click)="showChunks.set(false)"
              >
                ✕
              </button>
            </div>
            <p class="text-xs text-slate-500 mb-4 leading-relaxed">
              Dùng các mẫu câu này trong hội thoại để đạt yêu cầu nhiệm vụ:
            </p>

            <div class="space-y-3">
              @for (c of scenario()?.chunks; track c.id) {
                <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-sky-200 transition">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-bold text-[#286FB4] uppercase">
                      {{ c.functionTag }}
                    </span>
                    <button
                      type="button"
                      class="text-xs hover:scale-110 transition cursor-pointer text-slate-500"
                      title="Nghe mẫu phát âm"
                      (click)="playSample(c.text)"
                    >
                      🔊
                    </button>
                  </div>
                  <div class="text-xs font-bold text-slate-900 leading-snug">
                    "{{ c.text }}"
                  </div>
                  <div class="text-[11px] text-slate-500 mt-1">
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
        <div class="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div class="card max-w-sm w-full p-6 space-y-4 bg-white border-slate-100 text-slate-800 shadow-2xl rounded-3xl">
            <div class="text-3xl text-center">🏁</div>
            <h3 class="font-extrabold text-lg text-slate-900 text-center">Kết thúc phiên Roleplay?</h3>
            <p class="text-xs text-slate-600 leading-relaxed text-center">
              Hệ thống sẽ chấm điểm 5 kỹ năng, kiểm tra các mục tiêu nhiệm vụ bạn đã đạt và thống kê các chunk bạn dùng tốt.
            </p>
            <div class="flex justify-center gap-3 pt-2">
              <button
                type="button"
                class="btn-secondary text-xs px-4 py-2.5 rounded-xl cursor-pointer"
                (click)="showEndModal.set(false)"
              >
                Tiếp tục nói
              </button>
              <button
                type="button"
                class="btn-primary text-xs px-5 py-2.5 rounded-xl font-bold cursor-pointer"
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
  private readonly coachService = inject(CoachService);
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

  // Translation signals (for full translation on demand)
  readonly showTranslation = signal<Record<string, boolean>>({});
  readonly translationMap = signal<Record<string, string>>({});
  readonly loadingTranslation = signal<Record<string, boolean>>({});

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
    if (s === 'user_speaking') return 'bg-emerald-500 animate-ping';
    if (s === 'ai_speaking') return 'bg-[#286FB4] animate-pulse';
    if (s === 'reconnecting') return 'bg-amber-400';
    return 'bg-emerald-500';
  });

  constructor() {
    effect(() => {
      // Auto-scroll when new transcript arrives & auto-enable translations
      const list = this.voiceService.liveTranscripts();
      setTimeout(() => {
        if (this.transcriptContainer) {
          const el = this.transcriptContainer.nativeElement;
          el.scrollTop = el.scrollHeight;
        }
      }, 80);

      // Eagerly prefetch translations and show them
      for (const item of list) {
        if (!this.showTranslation()[item.id]) {
          // Default to showing translation for smooth learning
          this.showTranslation.update((m) => ({ ...m, [item.id]: true }));
        }
        if (!this.translationMap()[item.id] && !item.isPartial) {
          if (item.translation) {
            this.translationMap.update((m) => ({ ...m, [item.id]: item.translation! }));
          } else {
            this.prefetchTranslation(item);
          }
        }
      }
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.sessionId.set(id);

    if (id) {
      // Connect to WebSocket roleplay session
      void this.voiceService.startVoiceSession(id);

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

  replaySpeaker(item: LiveTranscriptItem): void {
    this.voiceService.playSegmentAudio(item);
  }

  playSample(text: string): void {
    this.voiceService.speakText(text);
  }

  prefetchTranslation(item: LiveTranscriptItem): void {
    if (this.translationMap()[item.id] || this.loadingTranslation()[item.id]) return;
    this.loadingTranslation.update((m) => ({ ...m, [item.id]: true }));
    this.coachService.translate(item.text).subscribe({
      next: (res) => {
        this.loadingTranslation.update((m) => ({ ...m, [item.id]: false }));
        this.translationMap.update((m) => ({ ...m, [item.id]: res.translatedText }));
      },
      error: () => {
        this.loadingTranslation.update((m) => ({ ...m, [item.id]: false }));
      },
    });
  }

  toggleTranslation(item: LiveTranscriptItem): void {
    const isShown = !!this.showTranslation()[item.id];
    this.showTranslation.update((m) => ({ ...m, [item.id]: !isShown }));
    if (!this.translationMap()[item.id] && !item.translation) {
      this.prefetchTranslation(item);
    }
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
        this.router.navigate(['/scenario-result', id]);
      },
    });
  }
}
