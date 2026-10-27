import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AppStateService } from '../../core/services/app-state.service';
import {
  ScenarioService,
  RoleplayEvaluationResponse,
} from '../../core/services/scenario.service';

@Component({
  selector: 'app-scenario-result',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-5 md:p-8 max-w-4xl mx-auto space-y-6">
      <!-- Top header bar -->
      <div class="flex items-center gap-3">
        <button
          type="button"
          aria-label="Về danh sách tình huống"
          class="w-10 h-10 rounded-xl btn-secondary flex items-center justify-center shrink-0 cursor-pointer"
          (click)="goLibrary()"
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div>
          <h1 class="text-2xl font-800" style="font-weight: 800; color: #1e293b">
            Đánh giá kết quả Roleplay
          </h1>
          <p class="text-sm text-slate-500">
            {{ evaluation()?.scenarioTitle || 'Nhiệm vụ tình huống và phản xạ giao tiếp thực tế' }}
          </p>
        </div>
      </div>

      <!-- Loading / Error states -->
      @if (isLoading()) {
        <div class="card p-12 text-center text-slate-500 space-y-3">
          <div class="text-4xl animate-bounce">🤖</div>
          <p class="text-sm font-600">Đang tổng hợp đánh giá từ AI Coach...</p>
          <p class="text-xs text-slate-400">Đang phân tích transcript, so khớp chunk và chấm điểm 5 kỹ năng</p>
        </div>
      } @else if (errorMessage()) {
        <div class="card p-6 text-center text-rose-600 bg-rose-50 border-rose-200">
          <p>{{ errorMessage() }}</p>
          <button type="button" class="btn-secondary mt-3 cursor-pointer" (click)="loadEvaluation()">
            Thử tải lại
          </button>
        </div>
      } @else {
        @if (evaluation(); as eval) {
          <!-- Overall Result Banner -->
          <div
            class="card p-6 sm:p-8 text-center text-white shadow-xl rounded-3xl"
            [style.background]="eval.passed ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'linear-gradient(135deg, #e11d48, #be123c)'"
          >
            <div class="text-5xl mb-2">{{ eval.passed ? '🌟' : '💪' }}</div>
            <div class="text-3xl sm:text-4xl font-800 mb-1" style="font-weight: 800">
              {{ eval.passed ? 'NHIỆM VỤ HOÀN THÀNH (PASS)' : 'CẦN LUYỆN TẬP THÊM' }}
            </div>
            <p class="text-sm text-white/80 max-w-md mx-auto mb-5">
              {{ eval.passed ? 'Chúc mừng bạn đã đạt tất cả các mục tiêu nhiệm vụ bắt buộc của tình huống!' : 'Bạn chưa đạt một số mục tiêu bắt buộc. Hãy thử lại để thành thạo hơn nhé!' }}
            </p>

            <div class="flex flex-wrap items-center justify-center gap-6 pt-5 border-t border-white/20">
              <div class="text-center px-4">
                <div class="text-2xl font-800">
                  {{ eval.overallScore !== null ? eval.overallScore + '/100' : 'N/A' }}
                </div>
                <div class="text-xs text-white/70">Điểm giao tiếp</div>
              </div>
              <div class="text-center px-4 border-l border-white/20">
                <div class="text-2xl font-800">
                  {{ passCount() }}/{{ eval.requirements.length }}
                </div>
                <div class="text-xs text-white/70">Mục tiêu đạt</div>
              </div>
              <div class="text-center px-4 border-l border-white/20">
                <div class="text-2xl font-800 text-amber-300">
                  +100 XP
                </div>
                <div class="text-xs text-white/70">Phần thưởng</div>
              </div>
            </div>
          </div>

          <!-- 1. Tasks / Requirements PASS-FAIL Breakdown -->
          <div class="card p-6 space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="font-700 text-base" style="font-weight: 700; color: #1e293b">
                🎯 Đánh giá từng mục tiêu nhiệm vụ
              </h2>
              <span class="text-xs text-slate-500 font-500">
                {{ passCount() }}/{{ eval.requirements.length }} mục tiêu PASS
              </span>
            </div>

            <div class="space-y-3">
              @for (req of eval.requirements; track req.requirementId) {
                <div
                  class="p-4 rounded-2xl border"
                  [style.background]="req.status === 'PASS' ? '#F0FDF4' : '#FFF5F5'"
                  [style.borderColor]="req.status === 'PASS' ? '#BBF7D0' : '#FECDD3'"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex items-start gap-3">
                      <span
                        class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                        [style.background]="req.status === 'PASS' ? '#16a34a' : '#e11d48'"
                      >
                        {{ req.status === 'PASS' ? '✓' : '✕' }}
                      </span>
                      <div>
                        <div class="font-700 text-sm text-slate-800">
                          {{ req.description }}
                        </div>
                        <div class="text-xs text-slate-600 mt-0.5">
                          {{ req.reason }}
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center gap-2 shrink-0">
                      @if (req.isMandatory) {
                        <span class="badge" style="background: #FEE2E2; color: #991B1B; font-size: 10px; font-weight: 700">
                          Bắt buộc
                        </span>
                      }
                      <span
                        class="badge"
                        [style.background]="req.status === 'PASS' ? '#DCFCE7' : '#FFE4E6'"
                        [style.color]="req.status === 'PASS' ? '#166534' : '#9f1239'"
                        style="font-size: 11px; font-weight: 700"
                      >
                        {{ req.status }}
                      </span>
                    </div>
                  </div>

                  @if (req.evidence) {
                    <div class="mt-2.5 pt-2 border-t border-slate-200/60 text-xs italic text-slate-600 bg-white/70 p-2.5 rounded-xl">
                      <strong class="not-italic text-slate-700">Trích xuất lời nói:</strong> "{{ req.evidence }}"
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <!-- 2. Chunks Used Well vs Chunks To Improve -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Chunks Used Well -->
            <div class="card p-5 space-y-3">
              <div class="flex items-center gap-2 text-emerald-700 font-700 text-sm">
                <span>🌟</span>
                <span>Chunk bạn đã dùng tốt ({{ eval.chunksUsedWell.length }})</span>
              </div>

              @if (eval.chunksUsedWell.length > 0) {
                <div class="space-y-2">
                  @for (c of eval.chunksUsedWell; track c.chunkId) {
                    <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs space-y-1">
                      <div class="font-700 text-slate-800">"{{ c.text }}"</div>
                      @if (c.matchedUtterance) {
                        <div class="text-slate-600">
                          Bạn đã nói: <span class="italic text-emerald-800">"{{ c.matchedUtterance }}"</span>
                        </div>
                      }
                      <div class="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <span>Chức năng: {{ c.functionTag }}</span>
                        <span class="font-600 text-emerald-600">{{ c.matchType }}</span>
                      </div>
                    </div>
                  }
                </div>
              } @else {
                <p class="text-xs text-slate-400 py-3 text-center">
                  Chưa ghi nhận chunk mục tiêu nào được dùng trong phiên này.
                </p>
              }
            </div>

            <!-- Chunks To Improve -->
            <div class="card p-5 space-y-3">
              <div class="flex items-center gap-2 text-amber-700 font-700 text-sm">
                <span>📚</span>
                <span>Chunk nên luyện thêm ({{ eval.chunksToImprove.length }})</span>
              </div>

              @if (eval.chunksToImprove.length > 0) {
                <div class="space-y-2">
                  @for (c of eval.chunksToImprove; track c.chunkId) {
                    <div class="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs space-y-1">
                      <div class="font-700 text-slate-800">"{{ c.text }}"</div>
                      @if (c.meaningVi) {
                        <div class="text-slate-600">{{ c.meaningVi }}</div>
                      }
                      <div class="text-[11px] text-amber-800 italic pt-1">
                        💡 {{ c.reason }}
                      </div>
                    </div>
                  }
                  <div class="text-[11px] text-slate-400 italic text-right pt-1">
                    ✓ Đã tự động lưu vào Sổ tay câu mẫu để ôn tập
                  </div>
                </div>
              } @else {
                <p class="text-xs text-slate-400 py-3 text-center">
                  Tuyệt vời! Bạn không bỏ sót chunk quan trọng nào.
                </p>
              }
            </div>
          </div>

          <!-- 3. Strengths & Improvements & Next Practice Suggestions -->
          <div class="card p-6 space-y-4">
            <h2 class="font-700 text-base" style="font-weight: 700; color: #1e293b">
              🤖 Nhận xét từ AI Coach
            </h2>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Strengths -->
              <div class="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <div class="font-700 text-sm text-emerald-800 mb-2">✅ Điểm mạnh</div>
                <ul class="space-y-1.5 text-xs text-emerald-900">
                  @for (s of eval.strengths; track s) {
                    <li>• {{ s }}</li>
                  }
                </ul>
              </div>

              <!-- Improvements -->
              <div class="p-4 rounded-xl bg-amber-50 border border-amber-100">
                <div class="font-700 text-sm text-amber-800 mb-2">🎯 Cần cải thiện</div>
                <ul class="space-y-1.5 text-xs text-amber-900">
                  @for (imp of eval.improvements; track imp) {
                    <li>• {{ imp }}</li>
                  }
                </ul>
              </div>
            </div>

            <!-- Next Practice Suggestions -->
            @if (eval.nextPractice) {
              <div class="p-4 rounded-xl bg-sky-50 border border-sky-100 text-xs">
                <div class="font-700 text-sm text-sky-800 mb-1.5">🚀 Gợi ý bước tiếp theo</div>
                <p class="text-sky-900 leading-relaxed">{{ eval.nextPractice }}</p>
              </div>
            }
          </div>

          <!-- Action Footer -->
          <div class="flex flex-wrap justify-center gap-4 pt-4">
            <button
              type="button"
              class="btn-secondary px-6 py-3 text-sm font-700 cursor-pointer"
              (click)="goLibrary()"
            >
              ← Về thư viện tình huống
            </button>
            <button
              type="button"
              class="btn-primary px-6 py-3 text-sm font-700 cursor-pointer"
              (click)="retryScenario(eval.scenarioId)"
            >
              🔄 Luyện lại tình huống này
            </button>
          </div>
        }
      }
    </div>
  `,
})
export class ScenarioResultComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly scenarioService = inject(ScenarioService);
  readonly appState = inject(AppStateService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly evaluation = signal<RoleplayEvaluationResponse | null>(null);

  readonly passCount = computed(() => {
    const ev = this.evaluation();
    if (!ev || !ev.requirements) return 0;
    return ev.requirements.filter((r) => r.status === 'PASS').length;
  });

  ngOnInit(): void {
    this.loadEvaluation();
  }

  loadEvaluation(): void {
    const sessionId = this.route.snapshot.paramMap.get('id') || '';
    if (!sessionId) {
      this.errorMessage.set('Không tìm thấy thông tin phiên roleplay.');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.scenarioService.getRoleplayEvaluation(sessionId).subscribe({
      next: (res) => {
        this.evaluation.set(res);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Không thể tải kết quả đánh giá nhiệm vụ.');
        this.isLoading.set(false);
      },
    });
  }

  goLibrary(): void {
    this.router.navigate(['/scenarios']);
  }

  retryScenario(scenarioId: string): void {
    this.router.navigate(['/scenarios', scenarioId]);
  }
}
