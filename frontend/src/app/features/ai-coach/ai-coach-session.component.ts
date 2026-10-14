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
                    <!-- Translate Toggle Button -->
                    <button
                      type="button"
                      class="px-2 py-0.5 rounded-full text-xs font-500 transition cursor-pointer flex items-center gap-1"
                      [ngClass]="showTranslation()[item.id] ? 'bg-sky-500/30 text-sky-200 border border-sky-400/40' : 'bg-white/10 hover:bg-white/20 text-slate-300'"
                      [title]="showTranslation()[item.id] ? 'Ẩn bản dịch' : 'Xem bản dịch tiếng Việt'"
                      (click)="toggleTranslation(item)"
                    >
                      <span class="text-[11px]">🌐</span>
                      <span>Dịch</span>
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

              <!-- Optional In-line Translation Box -->
              @if (showTranslation()[item.id]) {
                <div class="mt-2.5 pt-2 border-t border-white/15 text-xs text-sky-200 italic leading-relaxed flex items-start gap-1.5">
                  <span class="shrink-0 font-600 not-italic text-[10px] uppercase tracking-wider text-sky-300 bg-sky-900/60 px-1 py-0.5 rounded">Dịch</span>
                  @if (loadingTranslation()[item.id]) {
                    <span class="animate-pulse">Đang dịch...</span>
                  } @else {
                    <span>{{ translationMap()[item.id] || 'Không thể lấy bản dịch' }}</span>
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

      <!-- Bottom Single-Mic Control Footer ("The Coach" Style — No Text Input Box) -->
      <footer
        class="py-5 px-4 sm:px-6 flex flex-col items-center justify-center gap-3"
        style="background: #1e293b; border-top: 1px solid #334155"
      >
        <!-- Single Central Microphone / Speaking Button -->
        <div class="relative flex items-center justify-center">
          @if (voiceService.isRecordingTurn()) {
            <!-- Expanding pulse rings while user is actively speaking -->
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
              <!-- Active Speaking Wave / Stop Icon -->
              <div class="flex items-center gap-1" title="Nhấn để hoàn tất câu nói">
                <span class="w-1.5 h-4 bg-white rounded-full animate-[bounce_0.8s_infinite]"></span>
                <span class="w-1.5 h-7 bg-white rounded-full animate-[bounce_0.8s_infinite_0.15s]"></span>
                <span class="w-1.5 h-5 bg-white rounded-full animate-[bounce_0.8s_infinite_0.3s]"></span>
                <span class="w-1.5 h-7 bg-white rounded-full animate-[bounce_0.8s_infinite_0.45s]"></span>
                <span class="w-1.5 h-4 bg-white rounded-full animate-[bounce_0.8s_infinite_0.6s]"></span>
              </div>
            } @else {
              <!-- Ready Microphone Icon -->
              <span class="text-2xl sm:text-3xl" title="Nhấn vào micro để bắt đầu nói">🎙️</span>
            }
          </button>
        </div>

        <!-- Clean Helper Instruction Label (Without redundant hints) -->
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

  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private sessionId: string | null = null;
  private isUserScrollingUp = false;

  constructor() {
    // Automatically scroll down when new transcript messages arrive
    effect(() => {
      const items = this.liveTranscripts();
      if (items.length > 0) {
        this.scrollToBottom();
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

  toggleTranslation(item: LiveTranscriptItem): void {
    const isShown = !!this.showTranslation()[item.id];
    if (isShown) {
      this.showTranslation.update((m) => ({ ...m, [item.id]: false }));
      return;
    }

    this.showTranslation.update((m) => ({ ...m, [item.id]: true }));
    if (this.translationMap()[item.id]) {
      return;
    }

    this.loadingTranslation.update((m) => ({ ...m, [item.id]: true }));
    this.coachService.translate(item.text).subscribe({
      next: (res) => {
        this.loadingTranslation.update((m) => ({ ...m, [item.id]: false }));
        this.translationMap.update((m) => ({ ...m, [item.id]: res.translatedText }));
      },
      error: (err) => {
        console.error('Translation error:', err);
        this.loadingTranslation.update((m) => ({ ...m, [item.id]: false }));
        this.translationMap.update((m) => ({ ...m, [item.id]: 'Không thể dịch đoạn này' }));
      },
    });
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
        void this.router.navigate(['/ai-coach']);
      },
      error: (err) => {
        this.isEnding.set(false);
        console.error('Error ending session:', err);
        this.voiceService.cleanup();
        void this.router.navigate(['/ai-coach']);
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
