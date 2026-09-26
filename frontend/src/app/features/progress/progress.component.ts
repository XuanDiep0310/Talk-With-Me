import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';
import { ScoreColorPipe } from '../../shared/pipes/app-pipes';

export interface SkillProgress {
  label: string;
  current: number;
  prev: number;
  color: string;
  desc: string;
  history: number[];
}

export interface SessionHistory {
  date: string;
  topic: string;
  type: string;
  duration: string;
  score: number;
  emoji: string;
}

export interface LevelRequirement {
  level: string;
  done: boolean;
  current?: boolean;
  sessions: number;
  scenarios: number;
  minFluency: number;
  progress?: { sessions: number; scenarios: number; fluency: number } | null;
}

export const SKILL_DATA: SkillProgress[] = [
  { label: "Fluency", current: 72, prev: 60, color: "#286FB4", desc: "Nói trơn tru, ít dừng và ngập ngừng", history: [45, 52, 58, 60, 63, 68, 72] },
  { label: "Listening", current: 68, prev: 58, color: "#22c55e", desc: "Nghe hiểu và phản hồi đúng ý", history: [40, 48, 53, 57, 58, 62, 68] },
  { label: "Vocabulary", current: 61, prev: 55, color: "#DF4C73", desc: "Vốn từ đa dạng và phù hợp ngữ cảnh", history: [38, 44, 49, 52, 55, 58, 61] },
  { label: "Tốc độ P.H", current: 55, prev: 48, color: "#f59e0b", desc: "Thời gian suy nghĩ và phản hồi", history: [30, 36, 40, 44, 47, 51, 55] },
  { label: "Phát âm", current: 64, prev: 56, color: "#7c3aed", desc: "Độ chuẩn xác của phát âm", history: [40, 46, 50, 54, 56, 60, 64] }
];

export const SESSION_HISTORY: SessionHistory[] = [
  { date: "Hôm nay", topic: "Kể về công việc", type: "AI Coach", duration: "18 phút", score: 74, emoji: "🎙️" },
  { date: "Hôm qua", topic: "Đặt bàn nhà hàng", type: "Tình huống", duration: "12 phút", score: 82, emoji: "🎭" },
  { date: "2 ngày trước", topic: "Small Talk at Work", type: "Cộng đồng", duration: "25 phút", score: 70, emoji: "👥" },
  { date: "3 ngày trước", topic: "Du lịch mơ ước", type: "AI Coach", duration: "20 phút", score: 78, emoji: "🎙️" },
  { date: "5 ngày trước", topic: "Check-in khách sạn", type: "Tình huống", duration: "14 phút", score: 68, emoji: "🎭" }
];

export const LEVEL_REQUIREMENTS: LevelRequirement[] = [
  { level: "A1", done: true, sessions: 10, scenarios: 5, minFluency: 40 },
  { level: "A2", done: true, sessions: 20, scenarios: 10, minFluency: 50 },
  { level: "B1", done: false, current: true, sessions: 20, scenarios: 15, minFluency: 70, progress: { sessions: 12, scenarios: 7, fluency: 72 } },
  { level: "B2", done: false, sessions: 30, scenarios: 20, minFluency: 80, progress: null },
  { level: "C1", done: false, sessions: 40, scenarios: 30, minFluency: 90, progress: null }
];

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-5 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 class="text-2xl font-800" style="font-weight: 800; color: #1e293b">Tiến độ học tập</h1>
        <p class="text-sm mt-1" style="color: #64748b">Theo dõi kỹ năng giao tiếp và hành trình của bạn.</p>
      </div>

      <!-- Overall Score Banner -->
      <div class="card p-6" style="background: linear-gradient(135deg, #286FB4, #1d5a94)">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div class="text-white">
            <div class="text-sm opacity-80 mb-1">Điểm giao tiếp tổng hợp</div>
            <div class="text-5xl font-800" style="font-weight: 800">{{ overall() }}<span class="text-2xl">/100</span></div>
            <div class="flex items-center gap-2 mt-2">
              <span class="text-green-300 text-sm">↑ +7 trong 30 ngày qua</span>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4 text-white text-center">
            @for (m of metrics(); track m.label) {
              <div>
                <div class="text-xl font-700" style="font-weight: 700">{{ m.val }}</div>
                <div class="text-xs opacity-70">{{ m.label }}</div>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Tab Buttons -->
      <div class="flex gap-2 border-b" style="border-color: #E2F0F9">
        <button
          class="px-4 py-3 text-sm font-600 border-b-2 transition-all -mb-px cursor-pointer"
          [style.borderColor]="tab() === 'skills' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'skills' ? '#286FB4' : '#64748b'"
          (click)="tab.set('skills')"
        >
          📊 Kỹ năng
        </button>
        <button
          class="px-4 py-3 text-sm font-600 border-b-2 transition-all -mb-px cursor-pointer"
          [style.borderColor]="tab() === 'history' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'history' ? '#286FB4' : '#64748b'"
          (click)="tab.set('history')"
        >
          📅 Lịch sử
        </button>
        <button
          class="px-4 py-3 text-sm font-600 border-b-2 transition-all -mb-px cursor-pointer"
          [style.borderColor]="tab() === 'roadmap' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'roadmap' ? '#286FB4' : '#64748b'"
          (click)="tab.set('roadmap')"
        >
          🗺️ Lộ trình
        </button>
      </div>

      <!-- Skills Tab (Deferrable) -->
      @if (tab() === 'skills') {
        @defer (on viewport) {
          <div class="space-y-4">
            @for (s of skills; track s.label) {
              <div class="card p-6">
                <div class="flex items-center justify-between flex-wrap gap-4">
                  <div class="flex-1 min-w-48">
                    <div class="flex items-center gap-3 mb-1">
                      <span class="font-700 text-base" style="font-weight: 700; color: #1e293b">{{ s.label }}</span>
                      <span class="badge" [style.background]="s.current >= 70 ? '#DCFCE7' : '#FFF5F5'" [style.color]="s.current >= 70 ? '#166534' : '#9f1239'">
                        {{ s.current >= 70 ? 'Tốt' : s.current >= 50 ? 'Đang phát triển' : 'Cần cải thiện' }}
                      </span>
                    </div>
                    <div class="text-sm mb-3" style="color: #64748b">{{ s.desc }}</div>
                    <div class="progress-bar h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div class="progress-bar-fill h-3 rounded-full" [style.width.%]="s.current" [style.background]="s.color"></div>
                    </div>
                    <div class="flex items-center justify-between mt-1.5">
                      <span class="text-xs" style="color: #94a3b8">Trước: {{ s.prev }}</span>
                      <span class="text-xs font-700" [style.color]="s.color" style="font-weight: 700">Hiện tại: {{ s.current }}</span>
                      <span class="text-xs text-emerald-600">↑ +{{ s.current - s.prev }}</span>
                    </div>
                  </div>
                </div>
              </div>
            }
            <button class="btn-primary w-full justify-center py-3 cursor-pointer" (click)="appState.go('ai-coach')">
              🎙️ Luyện để cải thiện điểm
            </button>
          </div>
        } @placeholder {
          <div class="card p-6 text-center text-slate-400">Loading skill charts...</div>
        }
      }

      <!-- History Tab -->
      @if (tab() === 'history') {
        <div class="space-y-3">
          @for (s of sessionHistory; track s.topic) {
            <div class="card p-5 flex items-center gap-4">
              <div class="text-2xl">{{ s.emoji }}</div>
              <div class="flex-1 min-w-0">
                <div class="font-600 text-sm" style="font-weight: 600; color: #1e293b">{{ s.topic }}</div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-xs" style="color: #94a3b8">{{ s.date }} · {{ s.duration }}</span>
                  <span class="badge" style="background: #E2F0F9; color: #286FB4; font-size: 11px">{{ s.type }}</span>
                </div>
              </div>
              <div class="text-right">
                <div class="font-700 text-base" [style.color]="s.score >= 75 ? '#22c55e' : '#f59e0b'" style="font-weight: 700">{{ s.score }}/100</div>
                <div class="text-xs" style="color: #94a3b8">điểm giao tiếp</div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Roadmap Tab -->
      @if (tab() === 'roadmap') {
        <div class="space-y-4">
          @for (l of levelRequirements; track l.level) {
            <div class="card p-6" [style.outline]="l.current ? '2px solid #286FB4' : 'none'">
              <div class="flex items-start gap-4">
                <div
                  class="w-12 h-12 rounded-full flex items-center justify-center font-800 text-sm shrink-0"
                  [style.background]="l.done ? '#286FB4' : l.current ? '#E2F0F9' : '#F8FAFC'"
                  [style.color]="l.done ? '#fff' : l.current ? '#286FB4' : '#94a3b8'"
                  style="font-weight: 800"
                >
                  {{ l.done ? '✓' : l.level }}
                </div>
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="font-700 text-base" style="font-weight: 700; color: #1e293b">Level {{ l.level }}</span>
                    @if (l.done) { <span class="badge" style="background: #DCFCE7; color: #166534">✓ Đã đạt</span> }
                    @if (l.current) { <span class="badge" style="background: #E2F0F9; color: #286FB4">Đang ở đây</span> }
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class ProgressComponent {
  readonly appState = inject(AppStateService);

  readonly tab = signal<"skills" | "history" | "roadmap">("skills");
  readonly skills = SKILL_DATA;
  readonly sessionHistory = SESSION_HISTORY;
  readonly levelRequirements = LEVEL_REQUIREMENTS;

  readonly overall = computed(() => {
    return Math.round(this.skills.reduce((acc, s) => acc + s.current, 0) / this.skills.length);
  });

  readonly metrics = computed(() => [
    { val: "47", label: "Buổi luyện" },
    { val: "12 ngày", label: "Streak hiện tại" },
    { val: this.appState.appUser().level, label: "Level" }
  ]);
}
