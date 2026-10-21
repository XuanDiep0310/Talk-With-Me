import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AppStateService } from '../../core/services/app-state.service';
import { CoachService } from '../../core/services/coach.service';
import {
  CoachVoiceService,
  LiveTranscriptItem,
} from '../../core/services/coach-voice.service';
import { FormatTimePipe } from '../../shared/pipes/app-pipes';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-ai-coach-session',
  standalone: true,
  imports: [CommonModule, FormatTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      tabindex="-1"
      class="fixed inset-0 z-50 flex flex-col min-w-0"
      style="background: #0f172a; color: #f8fafc"
      (document:keydown.escape)="closeEndModal()"
    >
      <!-- Top Navigation Header -->
      <header
        class="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5"
        style="background: #1e293b; border-bottom: 1px solid #334155"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-full flex items-center justify-center bg-sky-500/20 text-sky-400 font-700 text-lg">
            🤖
          </div>
          <div class="min-w-0">
            <h1 class="font-700 text-base sm:text-lg truncate text-slate-100">
              {{ currentTopicTitle() }}
            </h1>
            <div class="flex items-center gap-2">
              <span
                class="badge text-xs px-2.5 py-0.5 rounded-full font-600 flex items-center gap-1.5"
                [ngClass]="stateBadgeClass()"
              >
                <span class="w-2 h-2 rounded-full" [ngClass]="stateDotClass()"></span>
                {{ stateText() }}
              </span>
              @if (voiceService.isMockMode()) {
                <span class="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-500">
                  Dev Mock Mode
                </span>
              }
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 sm:gap-4">
          <!-- Session Timer -->
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700">
            <span class="text-xs text-slate-400">⏱️</span>
            <span class="font-mono text-base font-600 text-slate-200">
              {{ elapsedSeconds() | formatTime }}
            </span>
          </div>

          <!-- Desktop Hint Toggle Button -->
          <button
            type="button"
            class="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-600 transition cursor-pointer border shadow-sm"
            [ngClass]="
              showHints()
                ? 'bg-amber-400/20 text-amber-300 border-amber-400/40 shadow-amber-400/10'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            "
            [title]="showHints() ? 'Đóng khung gợi ý' : 'Mở khung gợi ý câu trả lời'"
            (click)="showHints.set(!showHints())"
          >
            <span>💡 Gợi ý</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-400/30">
              {{ userLevel() }}
            </span>
          </button>

          <!-- Dev Mock Switch (D-08) -->
          <label class="hidden md:flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              class="rounded border-slate-600 text-sky-600 focus:ring-0"
              [checked]="voiceService.isMockMode()"
              (change)="toggleMockMode()"
            />
            <span>Mock Mic</span>
          </label>

          <!-- End Session Action Button -->
          <button
            type="button"
            class="px-4 py-1.5 rounded-xl text-sm font-700 text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer shadow-sm"
            (click)="showEndModal.set(true)"
          >
            Kết thúc
          </button>
        </div>
      </header>

      <!-- Connection / Reconnecting Banner -->
      @if (voiceService.uxState() === 'reconnecting') {
        <div class="bg-amber-600/90 text-white text-xs px-4 py-2 text-center flex items-center justify-center gap-2" role="alert">
          <span class="animate-spin">🔄</span>
          <span>Đang mất kết nối tạm thời. Hệ thống đang tự động nối lại và giữ nguyên đoạn nói của bạn...</span>
        </div>
      }

      @if (voiceService.uxState() === 'mic_error') {
        <div class="bg-rose-600/90 text-white text-xs px-4 py-2 text-center flex items-center justify-center gap-2" role="alert">
          <span>⚠️</span>
          <span>Không thể truy cập Micro. Vui lòng kiểm tra quyền truy cập microphone trên trình duyệt.</span>
        </div>
      }


      <!-- Main Content Area: Flex layout for Live Script (left) & Desktop Hint Panel (right) -->
      <div class="flex-1 flex min-h-0 relative overflow-hidden">
        <!-- Conversation Live Script (Scrollable Area) -->
        <section
          #transcriptContainer
          class="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 max-w-3xl w-full mx-auto space-y-4"
          aria-label="Hội thoại Live Script"
          aria-live="polite"
          (scroll)="onUserScroll()"
        >
          @if (liveTranscripts().length === 0) {
            <div class="text-center py-16 text-slate-500">
              <p class="text-3xl mb-2">🎙️</p>
              <p class="text-sm">Đang thiết lập phiên thoại với Alex...</p>
            </div>
          }

          @for (item of liveTranscripts(); track item.id) {
            <article
              class="flex items-start gap-3 my-3"
              [class.justify-end]="item.speaker === 'USER'"
              [class.speaker-ai]="item.speaker === 'AI'"
              [class.speaker-user]="item.speaker === 'USER'"
            >
              @if (item.speaker === 'AI') {
                <div class="w-9 h-9 rounded-full bg-sky-600 flex items-center justify-center text-white shrink-0 text-sm font-700 shadow">
                  A
                </div>
              }

              <div
                class="max-w-xl rounded-2xl p-4 text-sm leading-relaxed shadow-sm transition-all"
                [style.background]="item.speaker === 'AI' ? '#1e293b' : '#0369a1'"
                [style.color]="'#f8fafc'"
                [class.opacity-70]="item.isPartial"
                [class.border]="item.isPartial || voiceService.playingSegmentId() === item.id"
                [class.border-sky-400]="item.isPartial || voiceService.playingSegmentId() === item.id"
              >
                <div class="flex items-center justify-between gap-4 text-[11px] mb-1.5">
                  <div class="flex items-center gap-2 opacity-80">
                    <span class="font-700">{{ item.speaker === 'AI' ? 'Coach Alex' : 'Bạn' }}</span>
                    <span>•</span>
                    <span>{{ item.time }}</span>
                  </div>

                  <!-- Action Buttons: Translate & Replay -->
                  @if (!item.isPartial) {
                    <div class="flex items-center gap-1.5">
                      <!-- Translate Toggle Button (Icon only) -->
                      <button
                        type="button"
                        class="w-7 h-7 flex items-center justify-center rounded-full text-xs font-500 transition cursor-pointer"
                        [ngClass]="showTranslation()[item.id] ? 'bg-sky-500/30 text-sky-200 border border-sky-400/40' : 'bg-white/10 hover:bg-white/20 text-slate-300'"
                        [title]="showTranslation()[item.id] ? 'Ẩn bản dịch' : 'Xem bản dịch tiếng Việt'"
                        (click)="toggleTranslation(item)"
                      >
                        <span class="text-xs">🌐</span>
                      </button>

                      <!-- Speaker / Replay Button (Icon only) -->
                      <button
                        type="button"
                        class="w-7 h-7 flex items-center justify-center rounded-full text-xs transition cursor-pointer"
                        [ngClass]="
                          voiceService.playingSegmentId() === item.id
                            ? 'bg-amber-400 text-slate-900 shadow-sm animate-pulse'
                            : 'bg-white/15 hover:bg-white/25 text-white'
                        "
                        [title]="voiceService.playingSegmentId() === item.id ? 'Đang phát âm thanh...' : 'Nghe lại'"
                        (click)="replaySegment(item)"
                      >
                        @if (voiceService.playingSegmentId() === item.id) {
                          <span>🔊</span>
                        } @else {
                          <span>🔈</span>
                        }
                      </button>
                    </div>
                  }
                </div>

                <p class="break-words select-text text-[15px] leading-relaxed">
                  {{ item.text }}
                  @if (item.isPartial) {
                    <span class="inline-block animate-pulse font-bold">...</span>
                  }
                </p>

                <!-- Optional In-line Translation Box (Without the word 'Dịch') -->
                @if (showTranslation()[item.id]) {
                  <div class="mt-2.5 pt-2 border-t border-white/15 text-xs text-sky-200/95 italic leading-relaxed">
                    @if (loadingTranslation()[item.id] && !translationMap()[item.id] && !item.translation) {
                      <span class="animate-pulse">Đang dịch...</span>
                    } @else {
                      <span>{{ translationMap()[item.id] || item.translation || 'Không thể lấy bản dịch' }}</span>
                    }
                  </div>
                }
              </div>

              @if (item.speaker === 'USER') {
                <div class="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-white shrink-0 text-xs font-700 shadow">
                  👤
                </div>
              }
            </article>
          }

          <!-- AI Processing / Thinking Indicator -->
          @if (voiceService.uxState() === 'processing') {
            <div class="flex items-center gap-3 my-2">
              <div class="w-9 h-9 rounded-full bg-sky-600 flex items-center justify-center text-white shrink-0 text-sm font-700 shadow">
                A
              </div>
              <div class="rounded-2xl px-4 py-2.5 bg-slate-800 text-sky-400 text-xs flex items-center gap-2">
                <span class="flex gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce"></span>
                  <span class="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:0.2s]"></span>
                  <span class="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:0.4s]"></span>
                </span>
                <span>Alex đang suy nghĩ câu trả lời...</span>
              </div>
            </div>
          }
        </section>

        <!-- Desktop / Tablet AI Hint Side Panel (visible on >= md when showHints() is true) -->
        @if (showHints()) {
          <aside
            class="hidden md:flex flex-col w-80 lg:w-96 shrink-0 border-l border-slate-700/80 bg-slate-900/95 p-4 overflow-y-auto shadow-2xl backdrop-blur-md"
            aria-label="Khung gợi ý câu trả lời"
          >
            <div class="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div class="flex items-center gap-2">
                <span class="text-amber-400 text-base">💡</span>
                <h2 class="text-sm font-700 text-slate-100">Gợi ý câu trả lời</h2>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-sky-900/60 text-sky-300 font-600 border border-sky-400/30">
                  Level {{ userLevel() }}
                </span>
              </div>
              <button
                type="button"
                class="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer text-sm"
                title="Đóng khung gợi ý"
                (click)="showHints.set(false)"
              >
                ✕
              </button>
            </div>

            @if (suggestions().length > 0) {
              <div class="space-y-3">
                @for (sugg of suggestions(); track sugg.text) {
                  <div
                    class="group p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 hover:border-sky-500/50 transition cursor-pointer flex items-start justify-between gap-2.5 shadow-sm"
                  >
                    <div class="flex-1 min-w-0">
                      <p class="text-xs sm:text-sm font-600 text-slate-100 group-hover:text-sky-300 transition leading-relaxed">
                        "{{ sugg.text }}"
                      </p>
                      <p class="text-xs text-slate-400 italic mt-1 leading-relaxed">
                        {{ sugg.translation }}
                      </p>
                    </div>
                    <button
                      type="button"
                      class="w-7 h-7 shrink-0 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs text-slate-300 hover:text-white transition cursor-pointer"
                      title="Nghe phát âm mẫu"
                      (click)="playSampleAudio(sugg.text)"
                    >
                      🔊
                    </button>
                  </div>
                }
              </div>
              <p class="text-[11px] text-slate-500 mt-4 text-center">
                💡 Bấm loa 🔊 để nghe phát âm, rồi nhấn micro bên dưới để tự nói
              </p>
            } @else {
              <div class="text-center py-12 text-slate-500 text-xs">
                <span class="text-2xl block mb-2">⏳</span>
                Đang chuẩn bị gợi ý câu trả lời...
              </div>
            }
          </aside>
        }
      </div>

      <!-- Mobile Slide-up Bottom Sheet for Hints (visible on < md when showHints() is true) -->
      @if (showHints()) {
        <div
          class="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-hints-title"
        >
          <!-- Backdrop overlay button -->
          <button
            type="button"
            class="fixed inset-0 w-full h-full bg-black/60 backdrop-blur-xs border-0 p-0 cursor-default"
            aria-label="Đóng gợi ý"
            tabindex="-1"
            (click)="showHints.set(false)"
          ></button>

          <section
            class="relative z-10 bg-slate-900 border-t border-slate-700 rounded-t-3xl p-4 sm:p-5 max-h-[75vh] flex flex-col shadow-2xl"
          >
            <div class="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-3"></div>
            <div class="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div class="flex items-center gap-2">
                <span class="text-amber-400 text-base">💡</span>
                <h2 id="mobile-hints-title" class="text-sm font-700 text-slate-100">Gợi ý câu trả lời</h2>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-sky-900/60 text-sky-300 font-600 border border-sky-400/30">
                  Level {{ userLevel() }}
                </span>
              </div>
              <button
                type="button"
                class="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer text-xs"
                aria-label="Đóng bảng gợi ý"
                (click)="showHints.set(false)"
              >
                ✕
              </button>
            </div>

            <div class="overflow-y-auto space-y-2.5 flex-1 pr-1">
              @for (sugg of suggestions(); track sugg.text) {
                <div
                  class="p-3 rounded-2xl bg-slate-800/90 border border-slate-700/70 flex items-start justify-between gap-3 shadow-sm"
                >
                  <div class="flex-1 min-w-0">
                    <p class="text-xs sm:text-sm font-600 text-slate-100 leading-snug">
                      "{{ sugg.text }}"
                    </p>
                    <p class="text-[11px] text-slate-400 italic mt-1 leading-snug">
                      {{ sugg.translation }}
                    </p>
                  </div>
                  <button
                    type="button"
                    class="w-8 h-8 shrink-0 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs text-slate-200 transition cursor-pointer"
                    title="Nghe phát âm mẫu"
                    (click)="playSampleAudio(sugg.text)"
                  >
                    🔊
                  </button>
                </div>
              }
            </div>
            <p class="text-[10px] text-slate-500 mt-3 text-center">
              💡 Bấm vào loa 🔊 để nghe phát âm mẫu, rồi nhấn micro bên dưới để luyện nói
            </p>
          </section>
        </div>
      }

      <!-- Bottom Single-Mic Control Footer ("The Coach" Style) -->
      <footer
        class="py-4 px-4 sm:px-6 flex flex-col items-center justify-center gap-2"
        style="background: #1e293b; border-top: 1px solid #334155"
      >
        <!-- Horizontal Row: Left Spacer | Central Mic | Right Hint Button -->
        <div class="w-full max-w-sm sm:max-w-md flex items-center justify-between relative px-2">
          <!-- Left spacer for visual balance -->
          <div class="w-11 sm:w-12"></div>

          <!-- Central Microphone Button -->
          <div class="relative flex items-center justify-center">
            @if (voiceService.isRecordingTurn()) {
              <span class="absolute w-24 h-24 rounded-full bg-rose-500/25 animate-ping pointer-events-none"></span>
              <span class="absolute w-20 h-20 rounded-full bg-rose-500/40 animate-pulse pointer-events-none"></span>
            }

            <button
              type="button"
              data-testid="coach-mic-btn"
              class="relative z-10 w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl cursor-pointer focus:outline-none"
              [ngClass]="
                voiceService.isRecordingTurn()
                  ? 'bg-rose-600 hover:bg-rose-500 text-white scale-105 ring-4 ring-rose-400/50'
                  : 'bg-sky-600 hover:bg-sky-500 text-white hover:scale-105 ring-4 ring-sky-400/30'
              "
              [disabled]="voiceService.uxState() === 'connecting' || voiceService.uxState() === 'ending'"
              [attr.aria-label]="voiceService.isRecordingTurn() ? 'Đang nói - Nhấn để dừng và gửi câu nói' : 'Nhấn để bắt đầu nói'"
              (click)="onMicButtonClick()"
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
                <span class="text-2xl sm:text-3xl" title="Nhấn vào micro để bắt đầu nói">🎙️</span>
              }
            </button>
          </div>

          <!-- Right: Hint Toggle Button (On the same horizontal row as mic for mobile!) -->
          <div class="w-11 sm:w-12 flex items-center justify-end">
            <button
              type="button"
              class="relative w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-lg sm:text-xl transition cursor-pointer shadow-md"
              [ngClass]="
                showHints()
                  ? 'bg-amber-400 text-slate-950 ring-4 ring-amber-400/30 font-bold'
                  : 'bg-slate-700/90 hover:bg-slate-700 text-amber-300 hover:scale-105 border border-slate-600'
              "
              [title]="showHints() ? 'Đóng gợi ý câu trả lời' : 'Mở gợi ý câu trả lời'"
              (click)="toggleHints()"
            >
              💡
              @if (suggestions().length > 0 && !showHints()) {
                <span class="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping"></span>
                <span class="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-sky-500 border border-slate-800"></span>
              }
            </button>
          </div>
        </div>

        <!-- Instruction Label -->
        <div class="text-center">
          <p class="text-sm font-700 text-slate-100">
            @if (voiceService.isRecordingTurn()) {
              <span class="text-rose-400">Đang ghi âm... Nhấn lại để hoàn tất câu</span>
            } @else if (voiceService.uxState() === 'processing') {
              <span class="text-purple-300">Đang xử lý câu nói...</span>
            } @else if (voiceService.uxState() === 'ai_speaking') {
              <span class="text-sky-300">Coach Alex đang nói</span>
            } @else {
              <span>Nhấn vào micro để nói</span>
            }
          </p>
        </div>
      </footer>

      <!-- End Session Confirmation Modal -->
      @if (showEndModal()) {
        <div
          class="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
          role="presentation"
        >
          <section
            class="card p-6 max-w-md w-full rounded-2xl text-center text-slate-800 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="end-title"
          >
            <div class="text-4xl mb-3">🏁</div>
            <h2 id="end-title" class="text-xl font-800 mb-2 text-slate-900">
              Kết thúc phiên luyện nói?
            </h2>
            <p class="text-sm text-slate-600 mb-6">
              Bạn đã luyện tập được {{ elapsedSeconds() | formatTime }}. Toàn bộ bản ghi hội thoại Live Script sẽ được lưu lại.
            </p>
            <div class="flex gap-3 justify-center">
              <button
                type="button"
                class="btn-secondary px-5 py-2.5 rounded-xl text-sm font-600 cursor-pointer"
                (click)="showEndModal.set(false)"
              >
                Tiếp tục nói
              </button>
              <button
                type="button"
                class="px-5 py-2.5 rounded-xl text-sm font-700 text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer"
                [disabled]="isEnding()"
                (click)="confirmEndSession()"
              >
                @if (isEnding()) {
                  <span>Đang lưu...</span>
                } @else {
                  <span>Xác nhận kết thúc</span>
                }
              </button>
            </div>
          </section>
        </div>
      }
    </main>
  `,
})
export class AiCoachSessionComponent implements OnInit, OnDestroy {
  readonly appState = inject(AppStateService);
  readonly voiceService = inject(CoachVoiceService);
  private readonly coachService = inject(CoachService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastService = inject(ToastService);

  @ViewChild('transcriptContainer') private transcriptContainer!: ElementRef<HTMLDivElement>;

  readonly showEndModal = signal(false);
  readonly elapsedSeconds = signal(0);
  readonly isEnding = signal(false);
  readonly currentTopicTitle = signal<string>('Daily Conversation');
  readonly liveTranscripts = this.voiceService.liveTranscripts;

  readonly showTranslation = signal<Record<string, boolean>>({});
  readonly translationMap = signal<Record<string, string>>({});
  readonly loadingTranslation = signal<Record<string, boolean>>({});

  readonly showHints = signal(false);
  readonly userLevel = signal<string>('B1');
  readonly suggestions = this.voiceService.currentSuggestions;

  toggleHints(): void {
    this.showHints.update((v) => !v);
  }

  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private sessionId: string | null = null;
  private isUserScrollingUp = false;

  constructor() {
    // Automatically scroll down and eagerly prefetch/populate translations so "Dịch" is instant
    effect(() => {
      const items = this.liveTranscripts();
      if (items.length > 0) {
        this.scrollToBottom();
        for (const item of items) {
          if (!this.translationMap()[item.id]) {
            if (item.translation) {
              this.translationMap.update((m) => ({ ...m, [item.id]: item.translation! }));
            } else if (!item.isPartial) {
              this.prefetchTranslation(item);
            }
          }
        }
      }
    });
  }

  readonly stateText = computed(() => {
    const s = this.voiceService.uxState();
    switch (s) {
      case 'ready':
        return 'Sẵn sàng';
      case 'requesting_mic':
        return 'Đang xin quyền mic';
      case 'connecting':
        return 'Đang kết nối';
      case 'ai_speaking':
        return 'AI đang nói';
      case 'user_speaking':
        return 'Bạn đang nói';
      case 'processing':
        return 'Đang xử lý';
      case 'reconnecting':
        return 'Đang kết nối lại';
      case 'mic_error':
        return 'Lỗi microphone';
      case 'ai_error':
        return 'Lỗi dịch vụ AI';
      case 'ending':
        return 'Đang kết thúc';
    }
  });

  readonly stateBadgeClass = computed(() => {
    const s = this.voiceService.uxState();
    if (s === 'ai_speaking') return 'bg-sky-500/20 text-sky-300';
    if (s === 'user_speaking') return 'bg-rose-500/20 text-rose-300';
    if (s === 'processing') return 'bg-purple-500/20 text-purple-300';
    if (s === 'reconnecting') return 'bg-amber-500/20 text-amber-300';
    if (s === 'mic_error' || s === 'ai_error') return 'bg-rose-500/20 text-rose-300';
    return 'bg-slate-700 text-slate-300';
  });

  readonly stateDotClass = computed(() => {
    const s = this.voiceService.uxState();
    if (s === 'ai_speaking') return 'bg-sky-400 animate-pulse';
    if (s === 'user_speaking') return 'bg-rose-400 animate-ping';
    if (s === 'processing') return 'bg-purple-400 animate-spin';
    if (s === 'reconnecting') return 'bg-amber-400 animate-pulse';
    if (s === 'mic_error' || s === 'ai_error') return 'bg-rose-400';
    return 'bg-slate-400';
  });

  ngOnInit(): void {
    const qSessionId =
      this.route.snapshot.paramMap.get('id') ||
      this.route.snapshot.queryParamMap.get('sessionId');
    if (!qSessionId) {
      this.toastService.show('Không tìm thấy phiên thoại hợp lệ', 'error');
      void this.router.navigate(['/ai-coach']);
      return;
    }
    this.sessionId = qSessionId;

    // Load initial session details
    this.coachService.getSession(this.sessionId).subscribe({
      next: (sess) => {
        if (sess.topic?.title) {
          this.currentTopicTitle.set(sess.topic.title);
        } else if (this.appState.selectedTopic()) {
          this.currentTopicTitle.set(this.appState.selectedTopic()!);
        }

        // Populate initial transcript if present
        if (sess.transcripts && sess.transcripts.length > 0) {
          const initialItems: LiveTranscriptItem[] = sess.transcripts.map((t) => ({
            id: t.id,
            speaker: t.speaker,
            text: t.text,
            isPartial: false,
            time: '00:00',
            seq: t.seq,
          }));
          this.voiceService.liveTranscripts.set(initialItems);
        }

        if (sess.level) {
          this.userLevel.set(sess.level);
        }

        // Fetch initial level-tailored suggestions for user
        this.coachService.getSuggestions(this.sessionId!).subscribe({
          next: (res) => {
            if (res.suggestions?.length && this.voiceService.currentSuggestions().length === 0) {
              this.voiceService.currentSuggestions.set(res.suggestions);
            }
          },
          error: (err) => console.warn('Could not load suggestions:', err),
        });

        // Start WebSocket voice connection
        void this.voiceService.startVoiceSession(this.sessionId!);
        this.startTimer();
      },
      error: (err) => {
        console.error('Cannot retrieve session:', err);
        this.toastService.show('Không thể tải phiên thoại. Vui lòng thử lại.', 'error');
        void this.router.navigate(['/ai-coach']);
      },
    });
  }

  ngOnDestroy(): void {
    this.stopTimer();
    this.voiceService.cleanup();
  }

  onMicButtonClick(): void {
    void this.voiceService.toggleSpeakingTurn();
  }

  replaySegment(item: LiveTranscriptItem): void {
    this.voiceService.playSegmentAudio(item);
  }

  playSampleAudio(text: string): void {
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

    // If translation wasn't pre-populated, fetch it now
    if (!this.translationMap()[item.id] && !item.translation) {
      this.prefetchTranslation(item);
    }
  }

  onUserScroll(): void {
    if (!this.transcriptContainer) return;
    const el = this.transcriptContainer.nativeElement;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    this.isUserScrollingUp = !atBottom;
  }

  private scrollToBottom(): void {
    if (this.isUserScrollingUp || !this.transcriptContainer) return;
    setTimeout(() => {
      try {
        const el = this.transcriptContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      } catch {
        // Ignored
      }
    }, 50);
  }

  toggleMockMode(): void {
    this.voiceService.toggleMockMode();
  }

  closeEndModal(): void {
    this.showEndModal.set(false);
  }

  confirmEndSession(): void {
    if (!this.sessionId || this.isEnding()) return;

    this.isEnding.set(true);
    this.voiceService.uxState.set('ending');

    this.coachService.endSession(this.sessionId).subscribe({
      next: () => {
        this.isEnding.set(false);
        this.showEndModal.set(false);
        this.voiceService.cleanup();
        this.toastService.show('Đã lưu thành công phiên luyện nói!', 'success');
        void this.router.navigate(['/ai-coach/sessions', this.sessionId, 'feedback']);
      },
      error: (err) => {
        this.isEnding.set(false);
        console.error('Error ending session:', err);
        this.voiceService.cleanup();
        void this.router.navigate(['/ai-coach/sessions', this.sessionId, 'feedback']);
      },
    });
  }

  private startTimer(): void {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds.update((s) => s + 1);
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
}
