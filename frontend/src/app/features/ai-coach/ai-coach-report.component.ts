import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';

interface SkillMetric {
  label: string;
  score: number;
  prev: number;
  color: string;
  desc: string;
}

interface RecommendedExercise {
  title: string;
  type: string;
  emoji: string;
  mins: number;
}

@Component({
  selector: 'app-ai-coach-report',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-5 md:p-8 max-w-3xl mx-auto space-y-6">
      <!-- Top header bar -->
      <div class="flex items-center gap-4">
        <button class="w-9 h-9 rounded-xl flex items-center justify-center btn-secondary cursor-pointer" (click)="appState.go('ai-coach')">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
        </button>
        <div>
          <h1 class="text-2xl font-800" style="font-weight: 800; color: #1e293b">Báo cáo buổi luyện</h1>
          <p class="text-sm" style="color: #64748b">Chủ đề: {{ appState.selectedTopic() }}</p>
        </div>
      </div>

      <!-- Summary Card -->
      <div class="card p-6" style="background: linear-gradient(135deg, #286FB4, #1d5a94)">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div class="text-white">
            <div class="text-5xl font-800 mb-1" style="font-weight: 800">{{ overallScore() }}<span class="text-2xl">/100</span></div>
            <div class="opacity-80">Điểm giao tiếp tổng hợp</div>
            <div class="flex items-center gap-2 mt-2">
              <span class="text-green-300 text-sm">↑ +5 so với buổi trước</span>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4 text-white text-center">
            @for (item of summaryMetrics; track item.label) {
              <div>
                <div class="text-xl font-700" style="font-weight: 700">{{ item.val }}</div>
                <div class="text-xs opacity-70">{{ item.label }}</div>
              </div>
            }
          </div>
        </div>
        <div class="mt-4 pt-4 border-t border-white/20">
          <div class="text-sm text-white/80">+50 XP nhận được 🎉</div>
        </div>
      </div>

      <!-- Skills breakdown (Deferrable view) -->
      @defer (on viewport) {
        <div class="card p-6">
          <h2 class="font-700 text-base mb-5" style="font-weight: 700; color: #1e293b">Phân tích kỹ năng</h2>
          <div class="space-y-5">
            @for (s of skills; track s.label) {
              <div>
                <div class="flex items-center justify-between mb-2">
                  <div>
                    <span class="text-sm font-600" style="font-weight: 600; color: #374151">{{ s.label }}</span>
                    <span class="text-xs ml-2" style="color: #94a3b8">{{ s.desc }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs" style="color: #94a3b8">{{ s.prev }}</span>
                    <span class="text-xs text-emerald-600">→ +{{ s.score - s.prev }}</span>
                    <span class="font-700 text-sm" [style.color]="s.color" style="font-weight: 700">{{ s.score }}</span>
                  </div>
                </div>
                <div class="progress-bar h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div class="progress-bar-fill h-2.5 rounded-full" [style.width.%]="s.score" [style.background]="s.color"></div>
                </div>
              </div>
            }
          </div>
        </div>
      } @placeholder {
        <div class="card p-6 text-center text-slate-400">Loading skill analytics...</div>
      }

      <!-- Strengths & Weaknesses -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="card p-6">
          <h2 class="font-700 text-base mb-4 flex items-center gap-2" style="font-weight: 700; color: #1e293b">
            <span>✅</span> Điểm mạnh
          </h2>
          <div class="space-y-3">
            @for (t of strengths; track t) {
              <div class="flex items-start gap-2">
                <span class="mt-0.5 text-green-500">✓</span>
                <span class="text-sm" style="color: #374151">{{ t }}</span>
              </div>
            }
          </div>
        </div>

        <div class="card p-6">
          <h2 class="font-700 text-base mb-4 flex items-center gap-2" style="font-weight: 700; color: #1e293b">
            <span>🎯</span> Cần cải thiện
          </h2>
          <div class="space-y-3">
            @for (t of improvements; track t) {
              <div class="flex items-start gap-2">
                <span class="mt-0.5 text-rose-500">→</span>
                <span class="text-sm" style="color: #374151">{{ t }}</span>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Recommended exercises -->
      @defer (on viewport) {
        <div class="card p-6">
          <h2 class="font-700 text-base mb-5" style="font-weight: 700; color: #1e293b">📚 Bài tập đề xuất</h2>
          <div class="space-y-3">
            @for (e of exercises; track e.title) {
              <div class="flex items-center gap-4 p-4 rounded-xl" style="background: #F8FAFC">
                <div class="text-2xl">{{ e.emoji }}</div>
                <div class="flex-1">
                  <div class="font-600 text-sm" style="font-weight: 600; color: #1e293b">{{ e.title }}</div>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="badge" style="background: #E2F0F9; color: #286FB4; font-size: 11px">{{ e.type }}</span>
                    <span class="text-xs" style="color: #94a3b8">{{ e.mins }} phút</span>
                  </div>
                </div>
                <button class="btn-secondary text-xs px-3 py-1.5 cursor-pointer">Bắt đầu</button>
              </div>
            }
          </div>
        </div>
      } @placeholder {
        <div class="card p-6 text-center text-slate-400">Loading exercise recommendations...</div>
      }

      <!-- Bottom action buttons -->
      <div class="flex gap-4 pb-4">
        <button class="btn-secondary flex-1 justify-center cursor-pointer" (click)="appState.go('scenarios')">
          🎭 Luyện tình huống
        </button>
        <button class="btn-primary flex-1 justify-center cursor-pointer" (click)="appState.go('ai-coach')">
          🎙️ Luyện tiếp
        </button>
      </div>
    </div>
  `
})
export class AiCoachReportComponent {
  readonly appState = inject(AppStateService);

  readonly skills: SkillMetric[] = [
    { label: "Fluency", score: 74, prev: 68, color: "#286FB4", desc: "Nói tương đối trơn tru, ít dừng lâu." },
    { label: "Listening", score: 81, prev: 75, color: "#22c55e", desc: "Hiểu tốt các câu hỏi của AI." },
    { label: "Vocabulary", score: 62, prev: 61, color: "#DF4C73", desc: "Vốn từ tốt nhưng hay lặp từ." },
    { label: "Tốc độ P.H", score: 58, prev: 55, color: "#f59e0b", desc: "Cần rút ngắn thời gian suy nghĩ." },
    { label: "Phát âm", score: 69, prev: 64, color: "#7c3aed", desc: "Phát âm khá, một số âm cần chú ý." }
  ];

  readonly summaryMetrics = [
    { val: "18:24", label: "Thời lượng" },
    { val: "12:10", label: "Thời gian nói" },
    { val: "14", label: "Lượt trao đổi" }
  ];

  readonly strengths = [
    "Duy trì chủ đề xuyên suốt, không bị lạc đề",
    "Dùng từ nối tốt: 'however', 'especially', 'because'",
    "Nghe và phản hồi đúng ý câu hỏi của AI"
  ];

  readonly improvements = [
    "Rút ngắn thời gian suy nghĩ trước khi trả lời",
    "Đa dạng hóa từ vựng — tránh lặp 'nice', 'good'",
    "Phát âm âm cuối '-ed' chưa rõ (visited, loved)"
  ];

  readonly exercises: RecommendedExercise[] = [
    { title: "Luyện âm 'th' và 'v'", type: "Phát âm", emoji: "🔤", mins: 5 },
    { title: "Shadowing: Travel podcast", type: "Tốc độ P.H", emoji: "🎧", mins: 10 },
    { title: "Tình huống: Đặt khách sạn", type: "Vocabulary", emoji: "🎭", mins: 15 }
  ];

  readonly overallScore = computed(() => {
    return Math.round(this.skills.reduce((acc, s) => acc + s.score, 0) / this.skills.length);
  });
}
