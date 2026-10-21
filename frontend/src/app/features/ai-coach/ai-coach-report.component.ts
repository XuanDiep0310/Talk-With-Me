import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { AppStateService } from '../../core/services/app-state.service';
import { CoachService, SessionFeedback, CoachSession } from '../../core/services/coach.service';

interface SkillDisplay {
  name: string;
  label: string;
  score: number | null;
  color: string;
  isReference: boolean;
  naReason?: string | null;
}

@Component({
  selector: 'app-ai-coach-report',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="p-5 md:p-8 max-w-4xl mx-auto space-y-6">
      <!-- Header Navigation -->
      <header class="flex items-center justify-between flex-wrap gap-4">
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="btn-secondary cursor-pointer flex items-center gap-1.5 px-3 py-2 text-sm"
            (click)="navigateCoach()"
          >
            ← AI Coach
          </button>
          <div>
            <h1 class="text-2xl font-800" style="font-weight: 800; color: #1e293b">
              Kết quả & Phản hồi buổi nói
            </h1>
            <p class="text-xs text-slate-500 mt-0.5">
              Chủ đề: <span class="font-600 text-slate-700">{{ topicTitle() }}</span>
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="btn-secondary text-sm px-3 py-2 cursor-pointer"
            (click)="navigateDashboard()"
          >
            Dashboard
          </button>
          <button
            type="button"
            class="btn-primary text-sm px-4 py-2 cursor-pointer"
            (click)="navigateCoach()"
          >
            Luyện tập tiếp 🎙️
          </button>
        </div>
      </header>

      <!-- 1. LOADING / PENDING STATE -->
      @if (feedbackStatus() === 'PENDING') {
        <section class="card p-8 text-center space-y-4 my-8">
          <div class="w-16 h-16 mx-auto rounded-full bg-blue-50 flex items-center justify-center animate-spin text-3xl">
            🔄
          </div>
          <div>
            <h2 class="text-lg font-700 text-slate-800">
              AI đang phân tích cuộc hội thoại...
            </h2>
            <p class="text-sm text-slate-500 max-w-md mx-auto mt-1">
              Đang tính toán 5 chỉ số giao tiếp (Độ trôi chảy, Thấu hiểu, Từ vựng, Tốc độ phản xạ, Phát âm) và tổng hợp nhận xét cá nhân hóa.
            </p>
          </div>
          <div class="w-48 h-1.5 bg-slate-100 rounded-full mx-auto overflow-hidden">
            <div class="h-full bg-blue-600 rounded-full animate-pulse w-3/4"></div>
          </div>
        </section>
      }

      <!-- 2. INSUFFICIENT DATA STATE -->
      @else if (feedbackStatus() === 'INSUFFICIENT_DATA') {
        <section class="card p-8 border-2 border-amber-200 bg-amber-50/50 rounded-2xl text-center space-y-4">
          <div class="text-4xl">⚠️</div>
          <div>
            <h2 class="text-lg font-800 text-amber-900">
              Chưa đủ dữ liệu để tính điểm giao tiếp
            </h2>
            <p class="text-sm text-amber-800 max-w-xl mx-auto mt-2 leading-relaxed">
              Phiên nói chuyện quá ngắn hoặc chưa có đủ lượt phản hồi của bạn (tiêu chuẩn tối thiểu: 5 từ, 1 lượt thoại hoàn chỉnh, và 5 giây nói). Hệ thống tuân thủ nguyên tắc <strong>Communication-First</strong>: tuyệt đối không bịa đặt điểm số khi thiếu dữ liệu thực tế.
            </p>
          </div>

          <!-- Empty Skill Bars with N/A -->
          <div class="card p-6 bg-white max-w-xl mx-auto text-left shadow-sm">
            <h3 class="text-sm font-700 text-slate-700 mb-3">Chỉ số giao tiếp (N/A)</h3>
            <div class="space-y-3">
              @for (s of skillsList(); track s.name) {
                <div class="flex items-center justify-between text-xs text-slate-500">
                  <span>{{ s.label }}</span>
                  <span class="font-700 text-slate-400">N/A (Chưa đủ dữ liệu)</span>
                </div>
              }
            </div>
          </div>

          <div class="pt-2">
            <button
              type="button"
              class="btn-primary px-6 py-2.5 text-sm cursor-pointer shadow-md"
              (click)="navigateCoach()"
            >
              Bắt đầu phiên nói mới 🎙️
            </button>
          </div>
        </section>
      }

      <!-- 3. FAILED STATE -->
      @else if (feedbackStatus() === 'FAILED') {
        <section class="card p-8 border-2 border-rose-200 bg-rose-50/50 rounded-2xl text-center space-y-4">
          <div class="text-4xl">❌</div>
          <div>
            <h2 class="text-lg font-800 text-rose-900">
              Không thể hoàn thành phân tích phản hồi
            </h2>
            <p class="text-sm text-rose-800 max-w-md mx-auto mt-1">
              {{ errorMessage() || 'Hệ thống đánh giá gặp gián đoạn tạm thời khi phân tích ngôn ngữ.' }}
            </p>
          </div>
          <div class="flex items-center justify-center gap-3 pt-2">
            @if (isRetryable()) {
              <button
                type="button"
                class="btn-primary bg-rose-600 hover:bg-rose-700 text-white text-sm px-5 py-2.5 cursor-pointer shadow-md"
                [disabled]="isRetrying()"
                (click)="onRetryFeedback()"
              >
                @if (isRetrying()) {
                  <span>Đang thử lại...</span>
                } @else {
                  <span>Thử lại phân tích 🔄</span>
                }
              </button>
            }
            <button
              type="button"
              class="btn-secondary text-sm px-4 py-2.5 cursor-pointer"
              (click)="navigateCoach()"
            >
              Quay lại AI Coach
            </button>
          </div>
        </section>
      }

      <!-- 4. FEEDBACK_READY STATE -->
      @else if (feedbackStatus() === 'FEEDBACK_READY') {
        <!-- Overall Score Card -->
        <section
          class="card p-6 md:p-8 text-white rounded-2xl shadow-xl relative overflow-hidden"
          style="background: linear-gradient(135deg, #286FB4 0%, #1d5a94 100%)"
        >
          <div class="relative z-10 flex flex-wrap items-center justify-between gap-6">
            <div>
              <div class="flex items-center gap-2">
                <p class="text-xs md:text-sm uppercase tracking-wider font-700 text-sky-200">
                  Điểm tổng giao tiếp
                </p>
                @if (isPartial()) {
                  <span class="text-[11px] bg-amber-400 text-slate-900 font-700 px-2 py-0.5 rounded-full">
                    Ước tính (D-10)
                  </span>
                }
              </div>
              <div class="flex items-baseline gap-2 mt-1">
                @if (overallScore() !== null) {
                  <span class="text-5xl md:text-6xl font-900 tracking-tight" style="font-weight: 900">
                    {{ overallScore() }}
                  </span>
                  <span class="text-2xl text-sky-200 font-700">/100</span>
                } @else {
                  <span class="text-4xl md:text-5xl font-800 text-slate-300">N/A</span>
                }
              </div>
              @if (isPartial()) {
                <p class="text-xs text-sky-100/90 mt-1">
                  * Điểm tổng được tính lại trọng số trên các chỉ số có đủ dữ liệu.
                </p>
              }
            </div>

            <!-- Session Stats -->
            <div class="flex items-center gap-4 sm:gap-6 border-t sm:border-t-0 sm:border-l border-white/20 pt-4 sm:pt-0 sm:pl-6">
              <div>
                <p class="text-xs text-sky-200 font-500">Thời lượng phiên</p>
                <p class="text-lg md:text-xl font-700 mt-0.5">
                  {{ sessionDuration() }}s
                </p>
              </div>
              <div>
                <p class="text-xs text-sky-200 font-500">Thời lượng bạn nói</p>
                <p class="text-lg md:text-xl font-700 mt-0.5">
                  {{ spokenDuration() }}s
                </p>
              </div>
              <div>
                <p class="text-xs text-sky-200 font-500">Trình độ</p>
                <p class="text-lg md:text-xl font-700 text-amber-300 mt-0.5">
                  {{ sessionLevel() }}
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- 5 Communication Skills Breakdown (Reusing Dashboard Style) -->
        <section class="card p-6 md:p-8 rounded-2xl space-y-5">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-800 text-base md:text-lg text-slate-900" style="font-weight: 800">
                Chi tiết 5 kỹ năng giao tiếp
              </h2>
              <p class="text-xs text-slate-500 mt-0.5">
                Đánh giá theo chuẩn CEFR & SRS F-03 (Công thức TalkWithMe v{{ formulaVersion() }})
              </p>
            </div>
          </div>

          <div class="space-y-4">
            @for (s of skillsList(); track s.name) {
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-600 text-slate-800" style="font-weight: 600">
                      {{ s.label }}
                    </span>
                    @if (s.isReference) {
                      <span class="text-[10px] bg-slate-100 text-slate-600 font-700 px-2 py-0.5 rounded border border-slate-200" title="Đánh giá tham khảo dựa trên STT confidence">
                        Tham khảo
                      </span>
                    }
                  </div>

                  <div>
                    @if (s.score !== null) {
                      <span class="text-sm font-800" [style.color]="s.color" style="font-weight: 800">
                        {{ s.score }}/100
                      </span>
                    } @else {
                      <span class="text-xs font-700 text-slate-400" title="{{ s.naReason || 'Không đủ dữ liệu' }}">
                        N/A ({{ s.naReason || 'Chưa đủ dữ liệu' }})
                      </span>
                    }
                  </div>
                </div>

                <!-- Progress Bar matching Dashboard style -->
                <div class="progress-bar h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  @if (s.score !== null) {
                    <div
                      class="progress-bar-fill h-2.5 rounded-full transition-all duration-500"
                      [style.width.%]="s.score"
                      [style.background]="s.color"
                    ></div>
                  } @else {
                    <div class="h-2.5 bg-slate-200 rounded-full w-0"></div>
                  }
                </div>
              </div>
            }
          </div>
        </section>

        <!-- Strengths & Improvements Grid -->
        <div class="grid md:grid-cols-2 gap-6">
          <!-- Strengths -->
          <section class="card p-6 rounded-2xl border-l-4 border-emerald-500 bg-emerald-50/20">
            <div class="flex items-center gap-2 mb-4">
              <span class="text-xl">🌟</span>
              <h3 class="text-base font-800 text-emerald-900" style="font-weight: 800">
                Điểm mạnh nổi bật
              </h3>
            </div>
            @if (strengths().length > 0) {
              <ul class="space-y-2.5 text-sm text-slate-700">
                @for (item of strengths(); track item) {
                  <li class="flex items-start gap-2">
                    <span class="text-emerald-600 font-bold shrink-0">✓</span>
                    <span>{{ item }}</span>
                  </li>
                }
              </ul>
            } @else {
              <p class="text-sm text-slate-500 italic">Chưa ghi nhận điểm mạnh cụ thể.</p>
            }
          </section>

          <!-- Improvements -->
          <section class="card p-6 rounded-2xl border-l-4 border-amber-500 bg-amber-50/20">
            <div class="flex items-center gap-2 mb-4">
              <span class="text-xl">💡</span>
              <h3 class="text-base font-800 text-amber-900" style="font-weight: 800">
                Điểm cần cải thiện
              </h3>
            </div>
            @if (improvements().length > 0) {
              <ul class="space-y-2.5 text-sm text-slate-700">
                @for (item of improvements(); track item) {
                  <li class="flex items-start gap-2">
                    <span class="text-amber-600 font-bold shrink-0">→</span>
                    <span>{{ item }}</span>
                  </li>
                }
              </ul>
            } @else {
              <p class="text-sm text-slate-500 italic">Không có lỗi cần khắc phục lớn.</p>
            }
          </section>
        </div>

        <!-- Next Practice Recommendation -->
        @if (nextPractice()) {
          <section class="card p-6 rounded-2xl border border-blue-100 bg-sky-50/40">
            <div class="flex items-start gap-3">
              <span class="text-2xl shrink-0">🎯</span>
              <div>
                <h3 class="text-sm font-800 text-sky-950 uppercase tracking-wide" style="font-weight: 800">
                  Gợi ý luyện tập tiếp theo
                </h3>
                <p class="text-sm text-slate-700 mt-1.5 leading-relaxed">
                  {{ nextPractice() }}
                </p>
              </div>
            </div>
          </section>
        }
      }

      <!-- Fallback / No Session State -->
      @else {
        <section class="card p-8 text-center space-y-3">
          <div class="text-4xl">🎙️</div>
          <h2 class="text-lg font-700 text-slate-800">Chưa có phiên luyện nói nào</h2>
          <p class="text-sm text-slate-500">
            Hãy bắt đầu một cuộc hội thoại với AI Coach để nhận báo cáo kỹ năng chi tiết.
          </p>
          <button
            type="button"
            class="btn-primary text-sm px-5 py-2.5 cursor-pointer mt-2"
            (click)="navigateCoach()"
          >
            Chọn chủ đề luyện tập
          </button>
        </section>
      }

      <!-- Footer Action Row -->
      <footer class="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <button
          type="button"
          class="btn-secondary text-sm px-4 py-2.5 cursor-pointer"
          (click)="navigateDashboard()"
        >
          ← Về Dashboard
        </button>
        <button
          type="button"
          class="btn-primary text-sm px-6 py-2.5 cursor-pointer shadow-md"
          (click)="navigateCoach()"
        >
          Luyện nói chủ đề khác 🎙️
        </button>
      </footer>
    </main>
  `,
})
export class AiCoachReportComponent implements OnInit, OnDestroy {
  readonly appState = inject(AppStateService);
  private readonly coachService = inject(CoachService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly sessionId = signal<string | null>(null);
  readonly sessionData = signal<CoachSession | null>(null);
  readonly feedback = signal<SessionFeedback | null>(null);
  readonly isRetrying = signal<boolean>(false);
  readonly isLoading = signal<boolean>(true);

  private pollSub: Subscription | null = null;
  private pollCount = 0;

  readonly feedbackStatus = computed(() => {
    const fb = this.feedback();
    if (!fb) {
      return this.isLoading() ? 'PENDING' : 'EMPTY';
    }
    return fb.status;
  });

  readonly overallScore = computed(() => this.feedback()?.overallScore ?? null);
  readonly isPartial = computed(() => this.feedback()?.partial ?? false);
  readonly isRetryable = computed(() => this.feedback()?.retryable ?? false);
  readonly errorMessage = computed(() => this.feedback()?.errorMessage ?? null);
  readonly strengths = computed(() => this.feedback()?.strengths ?? []);
  readonly improvements = computed(() => this.feedback()?.improvements ?? []);
  readonly nextPractice = computed(() => this.feedback()?.nextPractice ?? null);
  readonly formulaVersion = computed(() => this.feedback()?.formulaVersion ?? '1.0.0');

  readonly topicTitle = computed(() => {
    return (
      this.sessionData()?.topic?.title ||
      this.appState.latestAiCoachSession()?.topic ||
      'Luyện nói tự do cùng Alex'
    );
  });

  readonly sessionDuration = computed(() => {
    return Math.round(this.sessionData()?.durationSeconds ?? 0);
  });

  readonly spokenDuration = computed(() => {
    return Math.round(this.sessionData()?.spokenSeconds ?? 0);
  });

  readonly sessionLevel = computed(() => {
    return this.sessionData()?.level || 'A1';
  });

  readonly skillsList = computed<SkillDisplay[]>(() => {
    const defaultColorMap: Record<string, string> = {
      fluency: '#286FB4',
      listening: '#059669',
      vocabulary: '#7c3aed',
      response_speed: '#ea580c',
      pronunciation: '#0284c7',
    };

    const defaultLabels: Record<string, string> = {
      fluency: 'Độ trôi chảy (Fluency)',
      listening: 'Khả năng hiểu (Listening)',
      vocabulary: 'Từ vựng & Ngữ pháp (Vocabulary)',
      response_speed: 'Tốc độ phản xạ (Response Speed)',
      pronunciation: 'Độ chuẩn phát âm (Pronunciation)',
    };

    const fb = this.feedback();
    if (!fb || !fb.skills || fb.skills.length === 0) {
      return Object.keys(defaultLabels).map((key) => ({
        name: key,
        label: defaultLabels[key],
        score: null,
        color: defaultColorMap[key] || '#286FB4',
        isReference: key === 'pronunciation',
        naReason: 'SESSION_INSUFFICIENT_DATA',
      }));
    }

    return fb.skills.map((s) => ({
      name: s.skillName,
      label: s.label || defaultLabels[s.skillName] || s.skillName,
      score: s.score,
      color: defaultColorMap[s.skillName] || '#286FB4',
      isReference: s.isReference,
      naReason: s.naReason,
    }));
  });

  ngOnInit(): void {
    // 1. Resolve Session ID from Route params, query params, or appState
    const idFromParam = this.route.snapshot.paramMap.get('id');
    const idFromQuery = this.route.snapshot.queryParamMap.get('sessionId');
    const resolvedId = idFromParam || idFromQuery || this.appState.latestAiCoachSession()?.id;

    if (resolvedId) {
      this.sessionId.set(resolvedId);
      this.loadSessionInfo(resolvedId);
      this.loadFeedback(resolvedId);
    } else {
      this.isLoading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private loadSessionInfo(sessionId: string): void {
    this.coachService.getSession(sessionId).subscribe({
      next: (sess) => this.sessionData.set(sess),
      error: (err) => console.warn('Could not load session info:', err),
    });
  }

  loadFeedback(sessionId: string): void {
    this.stopPolling();
    this.isLoading.set(true);

    this.coachService.getFeedback(sessionId).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.feedback.set(res);

        if (res.status === 'PENDING') {
          this.startPolling(sessionId);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error fetching feedback:', err);
      },
    });
  }

  private startPolling(sessionId: string): void {
    this.stopPolling();
    this.pollCount = 0;

    this.pollSub = interval(2000).subscribe(() => {
      this.pollCount++;
      if (this.pollCount > 30) {
        // Stop polling after 60 seconds
        this.stopPolling();
        return;
      }

      this.coachService.getFeedback(sessionId).subscribe({
        next: (res) => {
          this.feedback.set(res);
          if (res.status !== 'PENDING') {
            this.stopPolling();
          }
        },
        error: (err) => {
          console.warn('Poll feedback error:', err);
        },
      });
    });
  }

  private stopPolling(): void {
    if (this.pollSub) {
      this.pollSub.unsubscribe();
      this.pollSub = null;
    }
  }

  onRetryFeedback(): void {
    const id = this.sessionId();
    if (!id || this.isRetrying()) return;

    this.isRetrying.set(true);
    this.coachService.retryFeedback(id).subscribe({
      next: (res) => {
        this.isRetrying.set(false);
        this.feedback.set(res);
        this.startPolling(id);
      },
      error: (err) => {
        this.isRetrying.set(false);
        console.error('Retry feedback failed:', err);
      },
    });
  }

  navigateCoach(): void {
    void this.router.navigate(['/ai-coach']);
  }

  navigateDashboard(): void {
    void this.router.navigate(['/dashboard']);
  }
}
