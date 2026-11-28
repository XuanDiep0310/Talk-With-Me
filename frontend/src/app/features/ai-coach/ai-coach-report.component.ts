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
import { GamificationService } from '../../core/services/gamification.service';
import { SkillRadarChartComponent } from '../../shared/components/skill-radar-chart.component';

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
  imports: [CommonModule, SkillRadarChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="p-5 md:p-8 max-w-4xl mx-auto space-y-6">
      <!-- Header Navigation -->
      <header class="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-slate-200/80">
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="btn-secondary cursor-pointer flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl"
            (click)="navigateCoach()"
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>AI Coach</span>
          </button>
          <div>
            <h1 class="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              Kết quả & Phản hồi buổi nói
            </h1>
            <p class="text-xs text-slate-500 mt-0.5">
              Chủ đề: <span class="font-bold text-slate-700">{{ topicTitle() }}</span>
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <button
            type="button"
            class="btn-secondary text-xs sm:text-sm px-3.5 py-2 cursor-pointer rounded-xl font-semibold"
            (click)="navigateDashboard()"
          >
            Dashboard
          </button>
          <button
            type="button"
            class="btn-primary text-xs sm:text-sm px-4 py-2 cursor-pointer rounded-xl font-bold flex items-center gap-2 shadow-sm"
            (click)="navigateCoach()"
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            <span>Luyện tập tiếp</span>
          </button>
        </div>
      </header>

      <!-- 1. LOADING / PENDING STATE -->
      @if (feedbackStatus() === 'PENDING') {
        <section class="card p-10 text-center space-y-4 my-8 rounded-3xl">
          <div class="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <svg class="animate-spin h-7 w-7" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
          </div>
          <div>
            <h2 class="text-lg font-bold text-slate-900 tracking-tight">
              AI đang phân tích cuộc hội thoại...
            </h2>
            <p class="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
              Đang tính toán 5 chỉ số giao tiếp theo chuẩn CEFR (Phát âm, Độ lưu loát, Từ vựng, Ngữ pháp, Tương tác) và tổng hợp nhận xét cá nhân hóa.
            </p>
          </div>
          <div class="w-48 h-2 bg-slate-100 rounded-full mx-auto overflow-hidden">
            <div class="h-full bg-blue-600 rounded-full animate-pulse w-3/4"></div>
          </div>
        </section>
      }

      <!-- 2. INSUFFICIENT DATA STATE -->
      @else if (feedbackStatus() === 'INSUFFICIENT_DATA') {
        <section class="card p-8 border-2 border-amber-200 bg-amber-50/40 rounded-3xl text-center space-y-4">
          <div class="w-12 h-12 mx-auto rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h2 class="text-lg font-extrabold text-amber-900 tracking-tight">
              Chưa đủ dữ liệu để tính điểm giao tiếp
            </h2>
            <p class="text-xs sm:text-sm text-amber-800 max-w-xl mx-auto mt-2 leading-relaxed">
              Phiên nói chuyện quá ngắn hoặc chưa có đủ lượt thoại của bạn (tiêu chuẩn tối thiểu: 5 từ, 1 lượt thoại hoàn chỉnh, và 5 giây nói). Hệ thống tuân thủ nguyên tắc <strong>Communication-First</strong>: tuyệt đối không tạo điểm ảo khi thiếu dữ liệu thực tế.
            </p>
          </div>

          <!-- Empty Skill Bars with N/A -->
          <div class="card p-5 bg-white max-w-xl mx-auto text-left shadow-2xs rounded-2xl">
            <h3 class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Chỉ số giao tiếp (N/A)</h3>
            <div class="space-y-3">
              @for (s of skillsList(); track s.name) {
                <div class="flex items-center justify-between text-xs text-slate-500">
                  <span class="font-medium">{{ s.label }}</span>
                  <span class="font-bold text-slate-400">N/A (Chưa đủ dữ liệu)</span>
                </div>
              }
            </div>
          </div>

          <div class="pt-2">
            <button
              type="button"
              class="btn-primary px-6 py-2.5 text-sm cursor-pointer shadow-md rounded-xl font-bold"
              (click)="navigateCoach()"
            >
              Bắt đầu phiên nói mới
            </button>
          </div>
        </section>
      }

      <!-- 3. FAILED STATE -->
      @else if (feedbackStatus() === 'FAILED') {
        <section class="card p-8 border-2 border-rose-200 bg-rose-50/40 rounded-3xl text-center space-y-4">
          <div class="w-12 h-12 mx-auto rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div>
            <h2 class="text-lg font-extrabold text-rose-900 tracking-tight">
              Không thể hoàn thành phân tích phản hồi
            </h2>
            <p class="text-xs sm:text-sm text-rose-800 max-w-md mx-auto mt-1 leading-relaxed">
              {{ errorMessage() || 'Hệ thống đánh giá gặp gián đoạn tạm thời khi phân tích ngôn ngữ.' }}
            </p>
          </div>
          <div class="flex items-center justify-center gap-3 pt-2">
            @if (isRetryable()) {
              <button
                type="button"
                class="btn-primary bg-rose-600! hover:bg-rose-700! border-rose-700! text-white text-xs sm:text-sm px-5 py-2.5 cursor-pointer shadow-md rounded-xl font-bold"
                [disabled]="isRetrying()"
                (click)="onRetryFeedback()"
              >
                @if (isRetrying()) {
                  <span>Đang thử lại...</span>
                } @else {
                  <span>Thử lại phân tích</span>
                }
              </button>
            }
            <button
              type="button"
              class="btn-secondary text-xs sm:text-sm px-4 py-2.5 cursor-pointer rounded-xl font-semibold"
              (click)="navigateCoach()"
            >
              Quay lại AI Coach
            </button>
          </div>
        </section>
      }

      <!-- 4. FEEDBACK_READY STATE -->
      @else if (feedbackStatus() === 'FEEDBACK_READY') {
        <!-- XP Reward Banner -->
        <div class="px-5 py-4 rounded-2xl flex items-center justify-between gap-4 border border-amber-200 bg-amber-50/70 shadow-2xs">
          <div class="flex items-center gap-3.5">
            <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-bold text-amber-900">
                Chúc mừng! Bạn đã nhận <span class="text-amber-700 font-extrabold">+100 XP</span> cho buổi luyện tập này
              </p>
              <p class="text-xs text-amber-700/90 mt-0.5">
                Điểm thưởng và chuỗi Streak đã được ghi nhận an toàn vào sổ cái học tập của bạn.
              </p>
            </div>
          </div>
          <span class="px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs shrink-0">
            +100 XP Đã cộng
          </span>
        </div>

        <!-- Overall Score Card -->
        <section
          class="p-6 md:p-8 text-white rounded-3xl shadow-xl shadow-blue-500/10 relative overflow-hidden bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600"
        >
          <div class="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>

          <div class="relative z-10 flex flex-wrap items-center justify-between gap-6">
            <div>
              <div class="flex items-center gap-2">
                <p class="text-xs uppercase tracking-wider font-bold text-blue-200">
                  Điểm tổng giao tiếp CEFR
                </p>
                @if (isPartial()) {
                  <span class="text-[10px] bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded-full">
                    Ước tính (D-10)
                  </span>
                }
              </div>
              <div class="flex items-baseline gap-2 mt-1">
                @if (overallScore() !== null) {
                  <span class="text-5xl md:text-6xl font-black tracking-tight">
                    {{ overallScore() }}
                  </span>
                  <span class="text-xl text-blue-200 font-bold">/100</span>
                } @else {
                  <span class="text-4xl md:text-5xl font-extrabold text-slate-300">N/A</span>
                }
              </div>
              @if (isPartial()) {
                <p class="text-xs text-blue-100/90 mt-1.5">
                  * Điểm tổng được tính lại trọng số trên các chỉ số có đủ dữ liệu thực tế.
                </p>
              }
            </div>

            <!-- Session Stats -->
            <div class="flex items-center gap-4 sm:gap-6 border-t sm:border-t-0 sm:border-l border-white/20 pt-4 sm:pt-0 sm:pl-6">
              <div>
                <p class="text-xs text-blue-200 font-medium">Thời lượng phiên</p>
                <p class="text-lg md:text-xl font-bold mt-0.5">
                  {{ sessionDuration() }}s
                </p>
              </div>
              <div>
                <p class="text-xs text-blue-200 font-medium">Thời gian bạn nói</p>
                <p class="text-lg md:text-xl font-bold mt-0.5">
                  {{ spokenDuration() }}s
                </p>
              </div>
              <div>
                <p class="text-xs text-blue-200 font-medium">Cấp độ</p>
                <p class="text-lg md:text-xl font-bold text-amber-300 mt-0.5">
                  Level {{ sessionLevel() }}
                </p>
              </div>
              <div>
                <p class="text-xs text-blue-200 font-medium">Thưởng XP</p>
                <p class="text-lg md:text-xl font-extrabold text-amber-300 mt-0.5">
                  +100 XP
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- 5 Communication Skills Breakdown + Radar -->
        <section class="card p-6 md:p-8 rounded-3xl space-y-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 class="font-bold text-base md:text-lg text-slate-900 tracking-tight">
                Chi tiết 5 kỹ năng giao tiếp cốt lõi
              </h2>
              <p class="text-xs text-slate-500 mt-0.5">
                Đánh giá đa chiều (Azure Speech Acoustic + Gemini Semantic · v{{ formulaVersion() }})
              </p>
            </div>
            <div class="shrink-0 flex justify-center">
              <app-skill-radar-chart [scores]="radarScores()" [size]="155" />
            </div>
          </div>

          <div class="space-y-4">
            @for (s of skillsList(); track s.name) {
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-slate-800">
                      {{ s.label }}
                    </span>
                    @if (s.isReference) {
                      <span class="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full border border-slate-200" title="Chỉ số tham khảo từ Azure Speech">
                        Tham khảo
                      </span>
                    }
                  </div>

                  <div>
                    @if (s.score !== null) {
                      <span class="text-sm font-extrabold" [style.color]="s.color">
                        {{ s.score }}/100
                      </span>
                    } @else {
                      <span class="text-xs font-bold text-slate-400" title="{{ s.naReason || 'Không đủ dữ liệu' }}">
                        N/A ({{ s.naReason || 'Chưa đủ dữ liệu' }})
                      </span>
                    }
                  </div>
                </div>

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

          @if (grammarErrors().length > 0) {
            <div class="pt-4 border-t border-slate-100 space-y-2">
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500">Gợi ý sửa ngữ pháp tiêu biểu</h3>
              <div class="space-y-2">
                @for (ge of grammarErrors(); track $index) {
                  <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div>
                      <span class="line-through text-rose-500 mr-2">{{ ge.original }}</span>
                      <span class="font-bold text-emerald-700">→ {{ ge.correction }}</span>
                    </div>
                    <div class="text-slate-600">{{ ge.explanationVi }}</div>
                  </div>
                }
              </div>
            </div>
          }
        </section>

        <!-- Strengths & Improvements Grid -->
        <div class="grid md:grid-cols-2 gap-5 sm:gap-6">
          <!-- Strengths -->
          <section class="card p-6 rounded-3xl border border-emerald-200 bg-emerald-50/20">
            <div class="flex items-center gap-2.5 mb-4">
              <div class="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 class="text-base font-bold text-emerald-950 tracking-tight">
                Điểm mạnh nổi bật
              </h3>
            </div>
            @if (strengths().length > 0) {
              <ul class="space-y-2.5 text-xs sm:text-sm text-slate-700">
                @for (item of strengths(); track item) {
                  <li class="flex items-start gap-2.5">
                    <span class="text-emerald-600 font-bold shrink-0 mt-0.5">•</span>
                    <span class="leading-relaxed">{{ item }}</span>
                  </li>
                }
              </ul>
            } @else {
              <p class="text-xs sm:text-sm text-slate-500 italic">Chưa ghi nhận điểm mạnh cụ thể.</p>
            }
          </section>

          <!-- Improvements -->
          <section class="card p-6 rounded-3xl border border-amber-200 bg-amber-50/20">
            <div class="flex items-center gap-2.5 mb-4">
              <div class="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                  <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
                </svg>
              </div>
              <h3 class="text-base font-bold text-amber-950 tracking-tight">
                Điểm cần cải thiện
              </h3>
            </div>
            @if (improvements().length > 0) {
              <ul class="space-y-2.5 text-xs sm:text-sm text-slate-700">
                @for (item of improvements(); track item) {
                  <li class="flex items-start gap-2.5">
                    <span class="text-amber-600 font-bold shrink-0 mt-0.5">→</span>
                    <span class="leading-relaxed">{{ item }}</span>
                  </li>
                }
              </ul>
            } @else {
              <p class="text-xs sm:text-sm text-slate-500 italic">Không có lỗi cần khắc phục lớn.</p>
            }
          </section>
        </div>

        <!-- Next Practice Recommendation -->
        @if (nextPractice()) {
          <section class="card p-6 rounded-3xl border border-blue-100 bg-blue-50/40">
            <div class="flex items-start gap-3.5">
              <div class="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              </div>
              <div>
                <h3 class="text-xs font-bold text-blue-950 uppercase tracking-wider">
                  Gợi ý luyện tập tiếp theo
                </h3>
                <p class="text-xs sm:text-sm text-slate-700 mt-1 leading-relaxed">
                  {{ nextPractice() }}
                </p>
              </div>
            </div>
          </section>
        }
      }

      <!-- Fallback / No Session State -->
      @else {
        <section class="card p-10 text-center space-y-3 rounded-3xl">
          <div class="w-12 h-12 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
          </div>
          <h2 class="text-base font-bold text-slate-900">Chưa có phiên luyện nói nào</h2>
          <p class="text-xs text-slate-500 max-w-sm mx-auto">
            Hãy bắt đầu một cuộc hội thoại với AI Coach để nhận báo cáo kỹ năng chi tiết.
          </p>
          <button
            type="button"
            class="btn-primary text-xs px-5 py-2.5 cursor-pointer mt-2 rounded-xl"
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
          class="btn-secondary text-xs sm:text-sm px-4 py-2.5 cursor-pointer rounded-xl font-semibold"
          (click)="navigateDashboard()"
        >
          ← Về Dashboard
        </button>
        <button
          type="button"
          class="btn-primary text-xs sm:text-sm px-6 py-2.5 cursor-pointer shadow-md rounded-xl font-bold flex items-center gap-2"
          (click)="navigateCoach()"
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          </svg>
          <span>Luyện nói chủ đề khác</span>
        </button>
      </footer>
    </main>
  `,
})
export class AiCoachReportComponent implements OnInit, OnDestroy {
  readonly appState = inject(AppStateService);
  private readonly coachService = inject(CoachService);
  private readonly gamificationService = inject(GamificationService);
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
  readonly formulaVersion = computed(() => this.feedback()?.formulaVersion ?? '2.0.0');

  readonly radarScores = computed<Record<string, number | null>>(() => {
    const out: Record<string, number | null> = {};
    for (const s of this.skillsList()) {
      out[s.name] = s.score;
    }
    return out;
  });

  readonly grammarErrors = computed(() => {
    const grammarSkill = this.feedback()?.skills?.find((s) => s.skillName === 'grammar');
    const errs = grammarSkill?.components?.['grammarErrors'];
    if (!Array.isArray(errs)) return [];
    return errs as { original: string; correction: string; explanationVi: string }[];
  });

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
      pronunciation: '#0284C7',
      fluency: '#2563EB',
      vocabulary: '#059669',
      grammar: '#7C3AED',
      interaction: '#EA580C',
    };

    const defaultLabels: Record<string, string> = {
      pronunciation: 'Phát âm (Pronunciation)',
      fluency: 'Độ lưu loát (Fluency)',
      vocabulary: 'Từ vựng (Vocabulary)',
      grammar: 'Ngữ pháp (Grammar)',
      interaction: 'Tương tác & Phản xạ (Interaction)',
    };

    const fb = this.feedback();
    if (!fb || !fb.skills || fb.skills.length === 0) {
      return Object.keys(defaultLabels).map((key) => ({
        name: key,
        label: defaultLabels[key],
        score: null,
        color: defaultColorMap[key] || '#2563EB',
        isReference: key === 'pronunciation',
        naReason: 'SESSION_INSUFFICIENT_DATA',
      }));
    }

    return fb.skills.map((s) => ({
      name: s.skillName,
      label: s.label || defaultLabels[s.skillName] || s.skillName,
      score: s.score,
      color: defaultColorMap[s.skillName] || '#2563EB',
      isReference: s.isReference,
      naReason: s.naReason,
    }));
  });

  ngOnInit(): void {
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
        } else if (res.status === 'FEEDBACK_READY') {
          this.syncGamificationAfterSession();
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
        this.stopPolling();
        return;
      }

      this.coachService.getFeedback(sessionId).subscribe({
        next: (res) => {
          this.feedback.set(res);
          if (res.status !== 'PENDING') {
            this.stopPolling();
            if (res.status === 'FEEDBACK_READY') {
              this.syncGamificationAfterSession();
            }
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

  private syncGamificationAfterSession(): void {
    this.gamificationService.getGamificationSummary().subscribe({
      next: (summary) => {
        const xp = summary.totalXp ?? summary.xp ?? 0;
        const streak = summary.currentStreak ?? 0;
        const level = summary.currentLevel ?? summary.level ?? 'A1';
        this.appState.updateGamification(xp, streak, level);
      },
      error: (err) => console.warn('Could not sync gamification after session:', err),
    });
  }

  navigateCoach(): void {
    void this.router.navigate(['/ai-coach']);
  }

  navigateDashboard(): void {
    void this.router.navigate(['/dashboard']);
  }
}
