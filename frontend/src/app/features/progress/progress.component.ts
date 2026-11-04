import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';
import { AuthService } from '../../core/services/auth.service';
import { GamificationService } from '../../core/services/gamification.service';
import {
  ProgressSummaryResponse,
  ProgressSkillItem,
  ProgressHistoryItem,
  GamificationSummaryResponse,
} from '../../core/models/gamification.models';

interface LevelRoadmapItem {
  level: string;
  name: string;
  description: string;
  minOverall: number;
  minSessions: number;
  minScenarios: number;
  minSkill?: { name: string; score: number };
}

const ROADMAP_LEVELS: LevelRoadmapItem[] = [
  { level: 'A1', name: 'Người mới bắt đầu', description: 'Giao tiếp cơ bản với các câu đơn giản', minOverall: 0, minSessions: 0, minScenarios: 0 },
  { level: 'A2', name: 'Sơ cấp', description: 'Giao tiếp tình huống hàng ngày quen thuộc', minOverall: 40, minSessions: 5, minScenarios: 3 },
  { level: 'B1', name: 'Trung cấp độc lập', description: 'Diễn đạt ý kiến, thảo luận sở thích và công việc', minOverall: 55, minSessions: 10, minScenarios: 5 },
  { level: 'B2', name: 'Trung cấp nâng cao', description: 'Giao tiếp tự nhiên, lưu loát, lập luận mạch lạc', minOverall: 70, minSessions: 20, minScenarios: 5, minSkill: { name: 'Mọi kỹ năng', score: 60 } },
  { level: 'C1', name: 'Thành thạo chuyên nghiệp', description: 'Lưu loát linh hoạt, dùng ngữ điệu và từ vựng phức tạp', minOverall: 85, minSessions: 30, minScenarios: 5, minSkill: { name: 'Mọi kỹ năng', score: 75 } },
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
        <p class="text-sm mt-1" style="color: #64748b">Theo dõi kỹ năng giao tiếp và hành trình thăng hạng level của bạn.</p>
      </div>

      <!-- Overall Score Banner -->
      <div class="card p-6" style="background: linear-gradient(135deg, #286FB4, #1d5a94)">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div class="text-white">
            <div class="text-sm opacity-80 mb-1">Điểm giao tiếp tổng hợp</div>
            <div class="text-5xl font-800" style="font-weight: 800">
              {{ overallDisplay() }}<span class="text-2xl">{{ overallDisplay() !== 'N/A' ? '/100' : '' }}</span>
            </div>
            <div class="flex items-center gap-2 mt-2">
              @if (scoreChange30d() !== null) {
                <span class="text-green-300 text-sm font-600">
                  {{ scoreChange30d()! >= 0 ? '↑ +' + scoreChange30d() : '↓ ' + scoreChange30d() }} trong 30 ngày qua
                </span>
              } @else {
                <span class="text-white/70 text-xs">Cần thêm session để tính thay đổi 30 ngày</span>
              }
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
          class="px-4 py-3 text-sm font-600 border-b-2 transition-all -mb-px cursor-pointer border-0 bg-transparent"
          [style.borderColor]="tab() === 'skills' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'skills' ? '#286FB4' : '#64748b'"
          (click)="tab.set('skills')"
        >
          📊 Kỹ năng
        </button>
        <button
          class="px-4 py-3 text-sm font-600 border-b-2 transition-all -mb-px cursor-pointer border-0 bg-transparent"
          [style.borderColor]="tab() === 'history' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'history' ? '#286FB4' : '#64748b'"
          (click)="tab.set('history')"
        >
          📅 Lịch sử
        </button>
        <button
          class="px-4 py-3 text-sm font-600 border-b-2 transition-all -mb-px cursor-pointer border-0 bg-transparent"
          [style.borderColor]="tab() === 'roadmap' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'roadmap' ? '#286FB4' : '#64748b'"
          (click)="tab.set('roadmap')"
        >
          🗺️ Lộ trình
        </button>
      </div>

      <!-- Skills Tab -->
      @if (tab() === 'skills') {
        <div class="space-y-4">
          @for (s of skills(); track s.key) {
            <div class="card p-6">
              <div class="flex items-center justify-between flex-wrap gap-4">
                <div class="flex-1 min-w-48">
                  <div class="flex items-center gap-3 mb-1">
                    <span class="font-700 text-base" style="font-weight: 700; color: #1e293b">{{ s.label }}</span>
                    @if (s.isReference) {
                      <span class="text-[10px] px-1.5 py-0.5 rounded font-600" style="background: #F1F5F9; color: #64748b">tham khảo</span>
                    }
                    <span
                      class="badge"
                      [style.background]="s.status === 'Tốt' ? '#DCFCE7' : s.status === 'Đang phát triển' ? '#FEF3C7' : '#FFF5F5'"
                      [style.color]="s.status === 'Tốt' ? '#166534' : s.status === 'Đang phát triển' ? '#92400e' : '#9f1239'"
                    >
                      {{ s.status }}
                    </span>
                  </div>
                  <div class="text-sm mb-3" style="color: #64748b">{{ s.desc }}</div>
                  <div class="progress-bar h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div class="progress-bar-fill h-3 rounded-full" [style.width.%]="s.current ?? 0" [style.background]="s.color"></div>
                  </div>
                  <div class="flex items-center justify-between mt-2">
                    <span class="text-xs" style="color: #94a3b8">
                      Trước: {{ s.prev !== null ? s.prev : 'N/A' }}
                    </span>
                    <span class="text-xs font-700" [style.color]="s.color" style="font-weight: 700">
                      Hiện tại: {{ s.current !== null ? s.current : 'N/A' }}
                    </span>
                    <span class="text-xs font-600" [style.color]="(s.diff ?? 0) >= 0 ? '#16a34a' : '#dc2626'">
                      @if (s.diff !== null) {
                        {{ s.diff >= 0 ? '↑ +' + s.diff : '↓ ' + s.diff }}
                      } @else {
                        —
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          }

          <button class="btn-primary w-full justify-center py-3 cursor-pointer border-0" (click)="appState.go('ai-coach')">
            🎙️ Luyện để cải thiện điểm
          </button>
        </div>
      }

      <!-- History Tab -->
      @if (tab() === 'history') {
        <div class="space-y-3">
          @if (historyItems().length === 0) {
            <div class="card p-8 text-center text-sm text-slate-400">
              Chưa có phiên luyện tập nào được ghi nhận.
            </div>
          } @else {
            @for (s of historyItems(); track s.id) {
              <div class="card p-5 flex items-center gap-4">
                <div class="text-2xl">
                  @if (s.type === 'COACH') { 🎙️ } @else if (s.type === 'ROLEPLAY') { 🎭 } @else { 👥 }
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-600 text-sm" style="font-weight: 600; color: #1e293b">{{ s.topic }}</div>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-xs" style="color: #94a3b8">{{ formatDate(s.date) }} · {{ s.durationDisplay }}</span>
                    <span class="badge" style="background: #E2F0F9; color: #286FB4; font-size: 11px">
                      {{ s.type === 'COACH' ? 'AI Coach' : s.type === 'ROLEPLAY' ? 'Tình huống' : 'Cộng đồng' }}
                    </span>
                  </div>
                </div>
                <div class="text-right">
                  <div class="font-700 text-base" [style.color]="(s.score ?? 0) >= 70 ? '#22c55e' : '#f59e0b'" style="font-weight: 700">
                    {{ s.score !== null ? s.score + '/100' : 'N/A' }}
                  </div>
                  <div class="text-xs" style="color: #94a3b8">điểm giao tiếp</div>
                </div>
              </div>
            }

            @if (historyHasMore()) {
              <button
                class="w-full py-3 rounded-xl font-600 text-sm cursor-pointer border-0"
                style="background: #E2F0F9; color: #286FB4"
                (click)="loadMoreHistory()"
              >
                Tải thêm lịch sử
              </button>
            }
          }
        </div>
      }

      <!-- Roadmap Tab (SRS 3.4 & D-02) -->
      @if (tab() === 'roadmap') {
        <div class="space-y-4">
          <!-- Current Advancement Card -->
          @if (advancementInfo(); as adv) {
            <div class="card p-6 border" style="border-color: #B0DDE4; background: #F8FBFE">
              <div class="flex items-center justify-between mb-3">
                <h3 class="font-700 text-base" style="color: #1e293b; font-weight: 700">
                  Điều kiện thăng cấp lên Level {{ adv.targetLevel || 'C1 (Max)' }}
                </h3>
                <span class="badge" [style.background]="adv.allMet ? '#DCFCE7' : '#FEF3C7'" [style.color]="adv.allMet ? '#166534' : '#92400e'">
                  {{ adv.allMet ? '✓ Đủ điều kiện thăng cấp' : 'Đang phấn đấu' }}
                </span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                @for (cond of adv.conditions; track cond.label) {
                  <div class="p-3.5 rounded-xl border bg-white flex items-center justify-between" style="border-color: #E2F0F9">
                    <div>
                      <div class="text-xs text-slate-500 font-500">{{ cond.label }}</div>
                      <div class="text-sm font-700 mt-0.5" style="color: #1e293b">
                        {{ cond.current }} / {{ cond.target }} {{ cond.unit }}
                      </div>
                    </div>
                    <span class="text-base">
                      {{ cond.met ? '✅' : '⏳' }}
                    </span>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Roadmap Levels -->
          @for (lvl of roadmapLevels; track lvl.level) {
            <div
              class="card p-6 transition-all"
              [style.outline]="isCurrentLevel(lvl.level) ? '2px solid #286FB4' : 'none'"
            >
              <div class="flex items-start gap-4">
                <div
                  class="w-12 h-12 rounded-full flex items-center justify-center font-800 text-sm shrink-0"
                  [style.background]="isLevelAchieved(lvl.level) ? '#286FB4' : isCurrentLevel(lvl.level) ? '#E2F0F9' : '#F8FAFC'"
                  [style.color]="isLevelAchieved(lvl.level) ? '#fff' : isCurrentLevel(lvl.level) ? '#286FB4' : '#94a3b8'"
                  style="font-weight: 800"
                >
                  {{ isLevelAchieved(lvl.level) ? '✓' : lvl.level }}
                </div>
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1 flex-wrap">
                    <span class="font-700 text-base" style="font-weight: 700; color: #1e293b">
                      Level {{ lvl.level }} · {{ lvl.name }}
                    </span>
                    @if (isCurrentLevel(lvl.level)) {
                      <span class="badge" style="background: #E2F0F9; color: #286FB4">Cấp độ hiện tại</span>
                    } @else if (isLevelAchieved(lvl.level)) {
                      <span class="badge" style="background: #DCFCE7; color: #166534">✓ Đã đạt</span>
                    }
                  </div>
                  <div class="text-xs text-slate-500 mb-2">{{ lvl.description }}</div>
                  <div class="flex flex-wrap gap-2 text-xs text-slate-600">
                    <span class="px-2 py-1 rounded bg-slate-100">Điểm TB >= {{ lvl.minOverall }}</span>
                    <span class="px-2 py-1 rounded bg-slate-100">{{ lvl.minSessions }} buổi luyện</span>
                    <span class="px-2 py-1 rounded bg-slate-100">{{ lvl.minScenarios }} tình huống khác nhau</span>
                    @if (lvl.minSkill) {
                      <span class="px-2 py-1 rounded bg-slate-100">{{ lvl.minSkill.name }} >= {{ lvl.minSkill.score }}</span>
                    }
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
export class ProgressComponent implements OnInit {
  readonly appState = inject(AppStateService);
  private readonly authService = inject(AuthService);
  private readonly gamificationService = inject(GamificationService);

  readonly tab = signal<"skills" | "history" | "roadmap">("skills");
  readonly roadmapLevels = ROADMAP_LEVELS;

  readonly summaryData = signal<ProgressSummaryResponse | null>(null);
  readonly skills = signal<ProgressSkillItem[]>([]);
  readonly historyItems = signal<ProgressHistoryItem[]>([]);
  readonly historyNextCursor = signal<string | null>(null);
  readonly historyHasMore = signal<boolean>(false);
  readonly gamificationSummary = signal<GamificationSummaryResponse | null>(null);

  readonly overallDisplay = computed(() => {
    const s = this.summaryData()?.overallScore;
    return s !== null && s !== undefined ? String(s) : "N/A";
  });

  readonly scoreChange30d = computed(() => {
    return this.summaryData()?.scoreChange30d ?? null;
  });

  readonly currentLevel = computed(() => {
    return this.gamificationSummary()?.currentLevel ?? this.summaryData()?.currentLevel ?? this.authService.currentUser()?.cefrLevel ?? 'A1';
  });

  readonly advancementInfo = computed(() => {
    return this.gamificationSummary()?.advancement ?? null;
  });

  readonly metrics = computed(() => [
    { val: `${(this.summaryData()?.totalXp ?? this.appState.totalXp()).toLocaleString()} XP`, label: "Tổng XP" },
    { val: `${this.summaryData()?.currentStreak ?? this.appState.currentStreak()} ngày`, label: "Streak hiện tại" },
    { val: `Level ${this.currentLevel()}`, label: "Trình độ CEFR" }
  ]);

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    if (!this.authService.isAuthenticated()) return;

    this.gamificationService.getProgressSummary().subscribe({
      next: (summary) => this.summaryData.set(summary)
    });

    this.gamificationService.getProgressSkills().subscribe({
      next: (res) => this.skills.set(res.skills)
    });

    this.gamificationService.getProgressHistory(null, 15).subscribe({
      next: (res) => {
        this.historyItems.set(res.items);
        this.historyNextCursor.set(res.nextCursor);
        this.historyHasMore.set(res.hasMore);
      }
    });

    this.gamificationService.getGamificationSummary().subscribe({
      next: (sum) => this.gamificationSummary.set(sum)
    });
  }

  loadMoreHistory(): void {
    const cursor = this.historyNextCursor();
    if (!cursor) return;

    this.gamificationService.getProgressHistory(cursor, 15).subscribe({
      next: (res) => {
        this.historyItems.update(prev => [...prev, ...res.items]);
        this.historyNextCursor.set(res.nextCursor);
        this.historyHasMore.set(res.hasMore);
      }
    });
  }

  isCurrentLevel(lvl: string): boolean {
    return this.currentLevel().toUpperCase() === lvl.toUpperCase();
  }

  isLevelAchieved(lvl: string): boolean {
    const ranks = ['A1', 'A2', 'B1', 'B2', 'C1'];
    const curIdx = ranks.indexOf(this.currentLevel().toUpperCase());
    const targetIdx = ranks.indexOf(lvl.toUpperCase());
    return curIdx > targetIdx;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', { year: 'numeric', month: 'numeric', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }
}
