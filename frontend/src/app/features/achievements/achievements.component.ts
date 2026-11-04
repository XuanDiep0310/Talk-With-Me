import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';
import { AuthService } from '../../core/services/auth.service';
import { GamificationService } from '../../core/services/gamification.service';
import {
  BadgeItem,
  DailyMissionItem,
  XpHistoryItem,
  GamificationSummaryResponse,
} from '../../core/models/gamification.models';

@Component({
  selector: 'app-achievements',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-5 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 class="text-2xl font-800" style="font-weight: 800; color: #1e293b">Thành tích</h1>
        <p class="text-sm mt-1" style="color: #64748b">XP, huy hiệu, chuỗi streak và lịch sử hoạt động của bạn.</p>
      </div>

      <!-- Stats row -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        @for (s of statsList(); track s.label) {
          <div class="card p-5">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-600" style="color: #94a3b8; font-weight: 600">{{ s.label }}</span>
              <span class="text-xl">{{ s.icon }}</span>
            </div>
            <div class="text-xl font-800" [style.color]="s.color" style="font-weight: 800">{{ s.value }}</div>
          </div>
        }
      </div>

      <!-- Level Progress bar (SRS 3.4 & D-02) -->
      <div class="card p-5">
        <div class="flex items-center justify-between mb-2">
          <span class="font-600 text-sm" style="font-weight: 600; color: #374151">
            Tiến độ thăng hạng (Level {{ currentLevel() }} → {{ targetLevel() }})
          </span>
          <span class="text-sm font-700" style="font-weight: 700; color: #286FB4">
            {{ conditionsMetCount() }}/{{ conditionsTotalCount() }} điều kiện
          </span>
        </div>
        <div class="progress-bar h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            class="progress-bar-fill h-3 rounded-full transition-all duration-500"
            [style.width.%]="advancementPct()"
            style="background: linear-gradient(90deg, #286FB4, #1d5a94)"
          ></div>
        </div>
        <div class="flex justify-between mt-2 text-xs" style="color: #94a3b8">
          <span>{{ advancementStatusText() }}</span>
          <button class="text-xs font-600 text-[#286FB4] hover:underline cursor-pointer border-0 bg-transparent" (click)="appState.go('progress')">
            Xem chi tiết lộ trình →
          </button>
        </div>
      </div>

      <!-- Tab navigation -->
      <div class="flex gap-2 border-b" style="border-color: #E2F0F9">
        <button
          class="px-4 py-3 text-sm font-600 border-b-2 transition-all -mb-px cursor-pointer border-0 bg-transparent"
          [style.borderColor]="tab() === 'badges' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'badges' ? '#286FB4' : '#64748b'"
          (click)="tab.set('badges')"
        >
          🏆 Huy hiệu ({{ earnedBadgesCount() }}/{{ badges().length }})
        </button>
        <button
          class="px-4 py-3 text-sm font-600 border-b-2 transition-all -mb-px cursor-pointer border-0 bg-transparent"
          [style.borderColor]="tab() === 'missions' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'missions' ? '#286FB4' : '#64748b'"
          (click)="tab.set('missions')"
        >
          🎯 Nhiệm vụ ngày ({{ dailyDoneCount() }}/{{ missions().length }})
        </button>
        <button
          class="px-4 py-3 text-sm font-600 border-b-2 transition-all -mb-px cursor-pointer border-0 bg-transparent"
          [style.borderColor]="tab() === 'xp' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'xp' ? '#286FB4' : '#64748b'"
          (click)="tab.set('xp')"
        >
          ⭐ Lịch sử XP
        </button>
      </div>

      <!-- Badges Tab -->
      @if (tab() === 'badges') {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (b of badges(); track b.id) {
            <div class="card p-5 transition-all" [class.opacity-60]="!b.earned">
              <div class="flex items-start gap-4">
                <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" [style.background]="b.earned ? '#E2F0F9' : '#F8FAFC'">
                  {{ b.icon }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-700 text-sm" style="font-weight: 700; color: #1e293b">{{ b.name }}</span>
                    @if (b.earned) {
                      <span class="badge" style="background: #DCFCE7; color: #166534; font-size: 10px">✓ Đã đạt</span>
                    }
                  </div>
                  <div class="text-xs mb-2" style="color: #64748b">{{ b.description }}</div>
                  @if (b.earned) {
                    <div class="text-xs" style="color: #94a3b8">Nhận ngày {{ formatDate(b.awardedAt) }}</div>
                  } @else {
                    <div>
                      <div class="progress-bar h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div class="progress-bar-fill h-1.5 bg-sky-500 rounded-full" [style.width.%]="getBadgeProgressPct(b)"></div>
                      </div>
                      <div class="text-xs mt-1" style="color: #94a3b8">{{ b.progress }}/{{ b.target }}</div>
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Missions Tab -->
      @if (tab() === 'missions') {
        <div class="space-y-4">
          <div class="card p-6">
            <h3 class="font-700 mb-4" style="font-weight: 700; color: #1e293b">🎯 Nhiệm vụ hôm nay</h3>
            <div class="space-y-3">
              @for (m of missions(); track m.id) {
                <div
                  class="flex items-center gap-4 p-4 rounded-xl transition-all"
                  [style.background]="m.status === 'CLAIMED' ? '#F0FDF4' : m.status === 'COMPLETED' ? '#FFFBEB' : '#F8FAFC'"
                >
                  <div
                    class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    [style.background]="m.status === 'CLAIMED' ? '#22c55e' : '#E2F0F9'"
                  >
                    @if (m.status === 'CLAIMED') {
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                    } @else {
                      <span>{{ getMissionIcon(m.conditionType) }}</span>
                    }
                  </div>
                  <span
                    class="flex-1 text-sm"
                    [style.color]="m.status === 'CLAIMED' ? '#94a3b8' : '#374151'"
                    [style.textDecoration]="m.status === 'CLAIMED' ? 'line-through' : 'none'"
                  >
                    {{ m.title }}
                  </span>
                  <div class="flex items-center gap-2">
                    <span class="font-700 text-sm" style="color: #f59e0b; font-weight: 700">+{{ m.xp }} XP</span>
                    @if (m.status === 'COMPLETED') {
                      <button
                        class="px-3 py-1.5 rounded-lg text-xs font-700 text-white cursor-pointer border-0 shadow-sm"
                        style="background: #22c55e"
                        (click)="claimMission(m)"
                      >
                        Nhận thưởng
                      </button>
                    } @else if (m.status === 'CLAIMED') {
                      <span class="text-xs font-600 text-emerald-600">✓ Đã nhận</span>
                    } @else {
                      <button
                        class="btn-primary text-xs px-3 py-1.5 cursor-pointer border-0"
                        (click)="goToMissionAction(m.conditionType)"
                      >
                        Bắt đầu
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- XP History Tab -->
      @if (tab() === 'xp') {
        <div class="space-y-3">
          @if (xpHistory().length === 0) {
            <div class="card p-8 text-center text-sm text-slate-400">
              Chưa có giao dịch XP nào trong sổ cái.
            </div>
          } @else {
            @for (x of xpHistory(); track x.id) {
              <div class="card p-5 flex items-center gap-4">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style="background: #FFF5E5">⭐</div>
                <div class="flex-1">
                  <div class="font-600 text-sm" style="font-weight: 600; color: #1e293b">{{ x.sourceDisplay }}</div>
                  <div class="text-xs" style="color: #94a3b8">{{ formatDate(x.createdAt) }}</div>
                </div>
                <div class="font-800 text-base" style="font-weight: 800; color: #f59e0b">+{{ x.amount }} XP</div>
              </div>
            }
          }
        </div>
      }
    </div>
  `
})
export class AchievementsComponent implements OnInit {
  readonly appState = inject(AppStateService);
  private readonly authService = inject(AuthService);
  private readonly gamificationService = inject(GamificationService);

  readonly tab = signal<"badges" | "missions" | "xp">("badges");
  readonly badges = signal<BadgeItem[]>([]);
  readonly missions = signal<DailyMissionItem[]>([]);
  readonly xpHistory = signal<XpHistoryItem[]>([]);
  readonly gamificationSummary = signal<GamificationSummaryResponse | null>(null);

  readonly earnedBadgesCount = computed(() => this.badges().filter(b => b.earned).length);
  readonly dailyDoneCount = computed(() => this.missions().filter(m => m.status === 'COMPLETED' || m.status === 'CLAIMED').length);

  readonly currentLevel = computed(() => {
    return this.gamificationSummary()?.currentLevel ?? this.authService.currentUser()?.cefrLevel ?? this.appState.appUser().level ?? 'A1';
  });

  readonly targetLevel = computed(() => {
    return this.gamificationSummary()?.advancement?.targetLevel ?? 'C1';
  });

  readonly conditionsTotalCount = computed(() => {
    const conds = this.gamificationSummary()?.advancement?.conditions;
    return conds && conds.length > 0 ? conds.length : 4;
  });

  readonly conditionsMetCount = computed(() => {
    const conds = this.gamificationSummary()?.advancement?.conditions;
    return conds ? conds.filter(c => c.met).length : 0;
  });

  readonly advancementPct = computed(() => {
    const total = this.conditionsTotalCount();
    if (!total) return 100;
    return Math.round((this.conditionsMetCount() / total) * 100);
  });

  readonly advancementStatusText = computed(() => {
    const adv = this.gamificationSummary()?.advancement;
    if (adv?.allMet) return 'Đã đủ điều kiện thăng cấp! Hoàn thành thêm buổi luyện để hệ thống cập nhật.';
    return `Đạt ${this.conditionsMetCount()}/${this.conditionsTotalCount()} điều kiện cho Level ${this.targetLevel()}`;
  });

  readonly statsList = computed(() => [
    { label: "Tổng XP", value: (this.gamificationSummary()?.totalXp ?? this.appState.totalXp()).toLocaleString(), icon: "⭐", color: "#f59e0b", bg: "#FFF5E5" },
    { label: "Level", value: this.currentLevel(), icon: "🎓", color: "#286FB4", bg: "#E2F0F9" },
    { label: "Streak", value: `${this.gamificationSummary()?.currentStreak ?? this.appState.currentStreak()} ngày`, icon: "🔥", color: "#ea580c", bg: "#FFF0E8" },
    { label: "Huy hiệu", value: `${this.earnedBadgesCount()}/${this.badges().length || 6}`, icon: "🏆", color: "#7c3aed", bg: "#F5F3FF" }
  ]);

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    if (!this.authService.isAuthenticated()) return;

    this.gamificationService.getGamificationSummary().subscribe({
      next: (summary) => this.gamificationSummary.set(summary)
    });

    this.gamificationService.getBadges().subscribe({
      next: (res) => this.badges.set(res.badges)
    });

    this.gamificationService.getTodayMissions().subscribe({
      next: (res) => this.missions.set(res.missions)
    });

    this.gamificationService.getXpHistory(50).subscribe({
      next: (res) => this.xpHistory.set(res.transactions)
    });
  }

  claimMission(mission: DailyMissionItem): void {
    this.gamificationService.claimMission(mission.id).subscribe({
      next: (res) => {
        this.missions.update(list => list.map(m => m.id === mission.id ? { ...m, status: 'CLAIMED', isClaimed: true } : m));
        this.gamificationSummary.update(s => s ? { ...s, totalXp: res.newTotalXp } : s);
        this.appState.updateGamification(res.newTotalXp, this.appState.currentStreak());
        // Also refresh XP history
        this.gamificationService.getXpHistory(50).subscribe({
          next: (r) => this.xpHistory.set(r.transactions)
        });
      }
    });
  }

  getBadgeProgressPct(badge: BadgeItem): number {
    if (!badge.target) return 0;
    return Math.min(100, Math.round((badge.progress / badge.target) * 100));
  }

  getMissionIcon(type: string): string {
    switch (type) {
      case 'AI_COACH': return '🎙️';
      case 'SCENARIO': return '🎭';
      case 'ROOM': return '👥';
      case 'STREAK': return '🔥';
      default: return '🎯';
    }
  }

  goToMissionAction(type: string): void {
    switch (type) {
      case 'AI_COACH': this.appState.go('ai-coach'); break;
      case 'SCENARIO': this.appState.go('scenarios'); break;
      case 'ROOM': this.appState.go('community'); break;
      case 'STREAK': this.appState.go('ai-coach'); break;
      default: this.appState.go('ai-coach'); break;
    }
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', { year: 'numeric', month: 'numeric', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }
}
