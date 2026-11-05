import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatDDMMYYYY } from '../../core/utils/date.utils';
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
          class="px-4 py-3 text-sm font-700 border-b-2 transition-all -mb-px cursor-pointer border-0 bg-transparent"
          [style.borderColor]="tab() === 'badges' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'badges' ? '#286FB4' : '#64748b'"
          (click)="tab.set('badges')"
        >
          🏆 Phòng Huy Hiệu ({{ earnedBadgesCount() }}/{{ badges().length }})
        </button>
        <button
          class="px-4 py-3 text-sm font-700 border-b-2 transition-all -mb-px cursor-pointer border-0 bg-transparent"
          [style.borderColor]="tab() === 'missions' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'missions' ? '#286FB4' : '#64748b'"
          (click)="tab.set('missions')"
        >
          🎯 Nhiệm Vụ Ngày ({{ dailyDoneCount() }}/{{ missions().length }})
        </button>
        <button
          class="px-4 py-3 text-sm font-700 border-b-2 transition-all -mb-px cursor-pointer border-0 bg-transparent"
          [style.borderColor]="tab() === 'xp' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'xp' ? '#286FB4' : '#64748b'"
          (click)="tab.set('xp')"
        >
          ⭐ Sổ Cái XP
        </button>
      </div>

      <!-- Badges Tab: Clean & Engaging Trophy Collection -->
      @if (tab() === 'badges') {
        <div class="space-y-6">
          <!-- Trophy Showcase Header (Clean & Refined) -->
          <div class="card p-6 border shadow-2xs bg-white" style="border-color: #E2E8F0">
            <div class="flex items-center justify-between flex-wrap gap-4">
              <div class="flex items-center gap-3.5">
                <div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-amber-50 border border-amber-200">
                  🏆
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h2 class="text-lg font-700 text-slate-900" style="font-weight: 700">Bộ Sưu Tập Huy Hiệu</h2>
                    <span class="text-xs px-2 py-0.5 rounded-full font-600 bg-sky-50 text-sky-800 border border-sky-200">
                      {{ collectorRank() }}
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 mt-0.5">
                    Mở khóa danh hiệu bằng cách rèn luyện đều đặn, hoàn thành tình huống và thăng hạng CEFR.
                  </p>
                </div>
              </div>

              <!-- Badges Collector Bar -->
              <div class="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 min-w-44 text-right">
                <div class="text-[11px] text-slate-500 font-500 mb-1">Tiến độ bộ sưu tập</div>
                <div class="text-base font-700 text-slate-800 mb-1">{{ earnedBadgesCount() }} / {{ badges().length }} ĐÃ ĐẠT</div>
                <div class="progress-bar h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div class="progress-bar-fill h-2 rounded-full transition-all duration-500" [style.width.%]="collectorPct()" style="background: #286FB4"></div>
                </div>
              </div>
            </div>

            <!-- Filter chips -->
            <div class="flex gap-2 mt-4 pt-3 border-t border-slate-100 text-xs font-600">
              <button
                class="px-3 py-1.5 rounded-lg border-0 cursor-pointer transition-all"
                [style.background]="badgeFilter() === 'all' ? '#286FB4' : '#F1F5F9'"
                [style.color]="badgeFilter() === 'all' ? '#FFFFFF' : '#475569'"
                (click)="badgeFilter.set('all')"
              >
                Tất cả ({{ badges().length }})
              </button>
              <button
                class="px-3 py-1.5 rounded-lg border-0 cursor-pointer transition-all"
                [style.background]="badgeFilter() === 'unlocked' ? '#286FB4' : '#F1F5F9'"
                [style.color]="badgeFilter() === 'unlocked' ? '#FFFFFF' : '#475569'"
                (click)="badgeFilter.set('unlocked')"
              >
                ✓ Đã mở khóa ({{ earnedBadgesCount() }})
              </button>
              <button
                class="px-3 py-1.5 rounded-lg border-0 cursor-pointer transition-all"
                [style.background]="badgeFilter() === 'locked' ? '#286FB4' : '#F1F5F9'"
                [style.color]="badgeFilter() === 'locked' ? '#FFFFFF' : '#475569'"
                (click)="badgeFilter.set('locked')"
              >
                🔒 Đang săn tìm ({{ badges().length - earnedBadgesCount() }})
              </button>
            </div>
          </div>

          <!-- Trophy Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (b of filteredBadges(); track b.id || b.key) {
              <div
                class="card p-5 relative transition-all duration-150 cursor-pointer border hover:border-sky-400 hover:shadow-xs"
                tabindex="0"
                role="button"
                [attr.aria-label]="b.name"
                [style.borderColor]="b.earned ? '#CBD5E1' : '#E2E8F0'"
                [style.background]="b.earned ? '#FFFFFF' : '#FAFAFA'"
                (click)="selectedBadge.set(b)"
                (keydown.enter)="selectedBadge.set(b)"
              >
                <!-- Rarity Banner / Stamp -->
                <div class="flex items-center justify-between mb-3">
                  <span
                    class="text-[10px] font-700 px-2 py-0.5 rounded-md uppercase tracking-wider"
                    [style.background]="getRarityMeta(b.key).badgeBg"
                    [style.color]="getRarityMeta(b.key).badgeColor"
                  >
                    {{ getRarityMeta(b.key).tierName }}
                  </span>

                  @if (b.earned) {
                    <span class="text-[11px] font-700 text-emerald-700 flex items-center gap-1">
                      <span>✓ Đã đạt</span>
                    </span>
                  } @else {
                    <span class="text-[11px] font-500 text-slate-400 flex items-center gap-1">
                      <span>🔒</span>
                      <span>Chưa đạt</span>
                    </span>
                  }
                </div>

                <!-- Medal Emblem -->
                <div class="flex items-start gap-3.5 mb-3">
                  <div
                    class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    [style.background]="b.earned ? getRarityMeta(b.key).emblemBg : '#F1F5F9'"
                  >
                    <span [class.opacity-40]="!b.earned">{{ b.icon || b.iconEmoji || '🏆' }}</span>
                  </div>

                  <div class="flex-1 min-w-0">
                    <h3 class="font-700 text-sm text-slate-800 truncate" style="font-weight: 700">
                      {{ b.name }}
                    </h3>
                    <p class="text-xs text-slate-500 line-clamp-2 mt-0.5">
                      {{ b.description }}
                    </p>
                  </div>
                </div>

                <!-- Footer Status & XP Reward Bounty -->
                <div class="pt-3 border-t border-slate-100">
                  @if (b.earned) {
                    <div class="flex items-center justify-between text-xs">
                      <span class="text-slate-400 text-[11px]">{{ formatDate(b.awardedAt) }}</span>
                      <span class="font-700 text-amber-600">+{{ getRarityMeta(b.key).rewardXp }} XP ⭐</span>
                    </div>
                  } @else {
                    <div>
                      <div class="flex justify-between text-[11px] mb-1">
                        <span class="text-slate-500">Tiến độ</span>
                        <span class="font-600 text-slate-700">{{ b.progress }}/{{ b.target || b.targetValue || b.total || 1 }}</span>
                      </div>
                      <div class="progress-bar h-1.5 bg-slate-200 rounded-full overflow-hidden mb-1.5">
                        <div class="progress-bar-fill h-1.5 bg-[#286FB4] rounded-full" [style.width.%]="getBadgeProgressPct(b)"></div>
                      </div>
                      <div class="flex justify-between items-center text-[11px]">
                        <span class="text-slate-400">Thưởng mở khóa:</span>
                        <span class="font-700 text-amber-600">+{{ getRarityMeta(b.key).rewardXp }} XP</span>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Missions Tab: Clean Daily Tasks -->
      @if (tab() === 'missions') {
        <div class="space-y-5">
          <!-- Daily Quest Banner (Clean & Modern) -->
          <div class="card p-5 border shadow-2xs bg-white" style="border-color: #B0DDE4">
            <div class="flex items-center justify-between flex-wrap gap-4">
              <div class="flex items-center gap-3">
                <div class="w-11 h-11 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center text-xl border border-sky-100">
                  🎯
                </div>
                <div>
                  <h3 class="text-base font-700 text-slate-900" style="font-weight: 700">Nhiệm Vụ Hàng Ngày</h3>
                  <p class="text-xs text-slate-500 mt-0.5">
                    Hoàn thành cả 4 nhiệm vụ mỗi ngày để nhận thưởng thêm +50 XP từ hệ thống.
                  </p>
                </div>
              </div>
              <div class="text-right">
                <div class="text-xs font-700 text-slate-700 mb-1">
                  {{ dailyDoneCount() }}/{{ missions().length }} hoàn tất
                </div>
                <div class="w-40 progress-bar h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    class="progress-bar-fill h-2 bg-[#286FB4] rounded-full transition-all duration-300"
                    [style.width.%]="missions().length ? Math.round((dailyDoneCount() / missions().length) * 100) : 0"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Quest List -->
          <div class="space-y-3">
            @for (m of missions(); track m.id) {
              <div
                class="card p-4 border transition-all flex items-center gap-3.5 bg-white"
                [style.borderColor]="m.status === 'CLAIMED' ? '#E2E8F0' : m.status === 'COMPLETED' ? '#FDE68A' : '#E2E8F0'"
              >
                <div
                  class="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                  [style.background]="m.status === 'CLAIMED' ? '#F0FDF4' : m.status === 'COMPLETED' ? '#FEF3C7' : '#F8FAFC'"
                >
                  @if (m.status === 'CLAIMED') {
                    <span class="text-emerald-600 font-700 text-sm">✓</span>
                  } @else {
                    <span>{{ getMissionIcon(m.conditionType) }}</span>
                  }
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-0.5">
                    <span class="text-[11px] font-600 text-slate-500">
                      {{ m.conditionType === 'COACH' ? 'AI Coach' : m.conditionType === 'SCENARIO' ? 'Tình huống' : m.conditionType === 'ROOM' ? 'Phòng nhóm' : 'Streak' }}
                    </span>
                    <span class="text-xs font-700 text-amber-600">+{{ m.xp }} XP</span>
                  </div>
                  <h4
                    class="text-sm font-600 text-slate-800 truncate"
                    [style.textDecoration]="m.status === 'CLAIMED' ? 'line-through' : 'none'"
                    [style.color]="m.status === 'CLAIMED' ? '#94a3b8' : '#1e293b'"
                  >
                    {{ m.title }}
                  </h4>
                </div>

                <div class="shrink-0">
                  @if (m.status === 'COMPLETED') {
                    <button
                      class="px-3.5 py-1.5 rounded-lg text-xs font-700 text-white cursor-pointer border-0 shadow-xs"
                      style="background: #16a34a"
                      (click)="claimMission(m)"
                    >
                      Nhận thưởng
                    </button>
                  } @else if (m.status === 'CLAIMED') {
                    <span class="text-xs font-600 text-emerald-600 px-2 py-1 rounded bg-emerald-50">✓ Đã nhận</span>
                  } @else {
                    <button
                      class="btn-secondary text-xs px-3.5 py-1.5 rounded-lg cursor-pointer border border-slate-200"
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
      }

      <!-- Badge Detail Modal -->
      @if (selectedBadge(); as badge) {
        <div
          class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
          tabindex="0"
          role="dialog"
          aria-modal="true"
          aria-label="Chi tiết huy hiệu"
          (click)="onBackdropClick($event)"
          (keydown.escape)="selectedBadge.set(null)"
        >
          <div
            class="card p-6 max-w-md w-full text-center relative border-2 shadow-2xl"
            [style.borderColor]="badge.earned ? '#F59E0B' : '#94A3B8'"
            [style.background]="badge.earned ? 'radial-gradient(circle at 50% 30%, #FFFBEB 0%, #FFFFFF 100%)' : '#FFFFFF'"
          >
            <!-- Close Button -->
            <button class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl border-0 bg-transparent cursor-pointer" (click)="selectedBadge.set(null)">✕</button>

            <!-- Big 3D Badge Emblem -->
            <div
              class="w-24 h-24 mx-auto rounded-3xl flex items-center justify-center text-5xl mb-4 shadow-xl relative"
              [style.background]="badge.earned ? getRarityMeta(badge.key).emblemBg : '#E2E8F0'"
              [style.boxShadow]="badge.earned ? ('0 12px 25px -4px ' + getRarityMeta(badge.key).glowColor) : 'none'"
            >
              <span [class.grayscale]="!badge.earned" [class.opacity-50]="!badge.earned">{{ badge.icon || badge.iconEmoji || '🏆' }}</span>
              @if (!badge.earned) {
                <div class="absolute inset-0 flex items-center justify-center bg-slate-900/40 rounded-3xl">
                  <span class="text-3xl">🔒</span>
                </div>
              }
            </div>

            <!-- Rarity Badge -->
            <span
              class="text-xs font-800 px-3 py-1 rounded-full uppercase tracking-wider inline-block mb-2"
              [style.background]="getRarityMeta(badge.key).badgeBg"
              [style.color]="getRarityMeta(badge.key).badgeColor"
            >
              {{ getRarityMeta(badge.key).tierName }}
            </span>

            <h3 class="text-xl font-800 text-slate-900 mb-1" style="font-weight: 800">{{ badge.name }}</h3>
            <p class="text-sm text-slate-600 mb-4">{{ badge.description }}</p>

            <!-- Reward Box -->
            <div class="p-4 rounded-2xl bg-amber-50 border border-amber-200 mb-4">
              <div class="text-xs text-amber-800 font-600 mb-0.5">Phần thưởng thành tích</div>
              <div class="text-2xl font-800 text-amber-600">+{{ getRarityMeta(badge.key).rewardXp }} XP ⭐</div>
              <div class="text-[11px] text-amber-700/80 mt-1">Cộng trực tiếp vào sổ cái XP và tiến độ thăng hạng Level</div>
            </div>

            <!-- Status & Action -->
            @if (badge.earned) {
              <div class="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-700 mb-4">
                🎉 Bạn đã chinh phục huy hiệu này vào ngày {{ formatDate(badge.awardedAt) }}!
              </div>
              <button class="btn-primary w-full justify-center py-2.5 cursor-pointer border-0" (click)="selectedBadge.set(null)">
                Tuyệt vời! Đóng lại
              </button>
            } @else {
              <div class="mb-4 text-left">
                <div class="flex justify-between text-xs mb-1 font-600 text-slate-700">
                  <span>Tiến độ mở khóa</span>
                  <span class="text-sky-700 font-700">{{ badge.progress }} / {{ badge.target || badge.targetValue || badge.total || 1 }}</span>
                </div>
                <div class="progress-bar h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div class="progress-bar-fill h-2.5 bg-sky-500 rounded-full" [style.width.%]="getBadgeProgressPct(badge)"></div>
                </div>
              </div>
              <button
                class="btn-primary w-full justify-center py-3 cursor-pointer border-0 font-700 shadow-md"
                (click)="huntBadge(badge)"
              >
                🎯 Đi săn huy hiệu này ngay!
              </button>
            }
          </div>
        </div>
      }

      <!-- XP History Tab -->
      @if (tab() === 'xp') {
        <div class="space-y-3">
          @if (xpHistory().length === 0) {
            <div class="card p-8 text-center text-sm text-slate-400">
              Chưa có giao dịch XP nào trong sổ cái. Hãy hoàn thành buổi luyện tập đầu tiên để nhận XP!
            </div>
          } @else {
            @for (x of xpHistory(); track x.id) {
              <div class="card p-5 flex items-center gap-4">
                <div class="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0" style="background: #FFF5E5">
                  {{ x.icon || getXpIcon(x.ruleKey) }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-700 text-sm truncate" style="font-weight: 700; color: #1e293b">
                      {{ x.sourceDisplay || x.description || getXpTitle(x.ruleKey) }}
                    </span>
                    <span class="text-[11px] px-2 py-0.5 rounded-full font-600 bg-slate-100 text-slate-600">
                      {{ x.category || getXpCategory(x.ruleKey) }}
                    </span>
                  </div>
                  <div class="text-xs text-slate-400 mt-0.5">
                    {{ formatDate(x.createdAt) }} • {{ getXpExplanation(x.ruleKey) }}
                  </div>
                </div>
                <div class="font-800 text-base shrink-0" style="font-weight: 800; color: #f59e0b">+{{ x.amount }} XP</div>
              </div>
            }
          }
        </div>
      }
    </div>
  `
})
export class AchievementsComponent implements OnInit {
  readonly Math = Math;
  readonly appState = inject(AppStateService);
  private readonly authService = inject(AuthService);
  private readonly gamificationService = inject(GamificationService);

  readonly tab = signal<"badges" | "missions" | "xp">("badges");
  readonly badgeFilter = signal<'all' | 'unlocked' | 'locked'>('all');
  readonly selectedBadge = signal<BadgeItem | null>(null);

  readonly badges = signal<BadgeItem[]>([]);
  readonly missions = signal<DailyMissionItem[]>([]);
  readonly xpHistory = signal<XpHistoryItem[]>([]);
  readonly gamificationSummary = signal<GamificationSummaryResponse | null>(null);

  readonly earnedBadgesCount = computed(() => this.badges().filter(b => b.earned).length);
  readonly dailyDoneCount = computed(() => this.missions().filter(m => m.status === 'COMPLETED' || m.status === 'CLAIMED').length);

  readonly collectorPct = computed(() => {
    const total = this.badges().length;
    if (!total) return 0;
    return Math.round((this.earnedBadgesCount() / total) * 100);
  });

  readonly collectorRank = computed(() => {
    const count = this.earnedBadgesCount();
    if (count >= 6) return 'Huyền Thoại Săn Danh Hiệu 💎';
    if (count >= 4) return 'Bậc Thầy Sưu Tầm 🥇';
    if (count >= 2) return 'Thợ Săn Tiềm Năng 🥈';
    return 'Thợ Săn Tập Sự 🥉';
  });

  readonly filteredBadges = computed(() => {
    const f = this.badgeFilter();
    const list = this.badges();
    if (f === 'unlocked') return list.filter(b => b.earned);
    if (f === 'locked') return list.filter(b => !b.earned);
    return list;
  });

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

  readonly statsList = computed(() => {
    const totalXpVal = this.gamificationSummary()?.totalXp ?? this.appState.totalXp() ?? 0;
    const streakVal = this.gamificationSummary()?.currentStreak ?? this.appState.currentStreak() ?? 0;
    return [
      { label: "Tổng XP", value: Number(totalXpVal).toLocaleString(), icon: "⭐", color: "#f59e0b", bg: "#FFF5E5" },
      { label: "Level", value: this.currentLevel(), icon: "🎓", color: "#286FB4", bg: "#E2F0F9" },
      { label: "Streak", value: `${streakVal} ngày`, icon: "🔥", color: "#ea580c", bg: "#FFF0E8" },
      { label: "Huy hiệu", value: `${this.earnedBadgesCount()}/${this.badges().length || 6}`, icon: "🏆", color: "#7c3aed", bg: "#F5F3FF" }
    ];
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    if (!this.authService.isAuthenticated()) return;

    this.gamificationService.getGamificationSummary().subscribe({
      next: (summary) => {
        this.gamificationSummary.set(summary);
        const xp = summary.totalXp ?? summary.xp ?? 0;
        const streak = summary.currentStreak ?? 0;
        const level = summary.currentLevel ?? summary.level ?? 'A1';
        this.appState.updateGamification(xp, streak, level);
      }
    });

    this.gamificationService.getBadges().subscribe({
      next: (res) => {
        const mapped = (res.badges || []).map(b => ({
          ...b,
          id: b.id || b.key,
          icon: b.icon || b.iconEmoji || '🏆',
          iconEmoji: b.iconEmoji || b.icon || '🏆',
          target: b.target ?? b.targetValue ?? b.total ?? 1,
          targetValue: b.targetValue ?? b.target ?? b.total ?? 1,
          awardedAt: b.awardedAt || b.earnedAt || null,
          earnedAt: b.earnedAt || b.awardedAt || null,
        }));
        this.badges.set(mapped);
      }
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
        this.gamificationSummary.update(s => s ? { ...s, totalXp: res.newTotalXp, xp: res.newTotalXp } : s);
        this.appState.updateGamification(res.newTotalXp, this.appState.currentStreak());
        // Also refresh XP history
        this.gamificationService.getXpHistory(50).subscribe({
          next: (r) => this.xpHistory.set(r.transactions)
        });
      }
    });
  }

  getXpIcon(ruleKey?: string): string {
    switch (ruleKey) {
      case 'COACH_SESSION': return '🎙️';
      case 'SCENARIO_LESSON': return '🎭';
      case 'STREAK_BONUS': return '🔥';
      case 'DAILY_MISSION': return '🎯';
      case 'ROOM_SESSION': return '👥';
      default: return '⭐';
    }
  }

  getXpTitle(ruleKey?: string): string {
    switch (ruleKey) {
      case 'COACH_SESSION': return 'Buổi học với AI Coach';
      case 'SCENARIO_LESSON': return 'Thực hành tình huống';
      case 'STREAK_BONUS': return 'Thưởng duy trì chuỗi Streak';
      case 'DAILY_MISSION': return 'Nhiệm vụ hàng ngày';
      case 'ROOM_SESSION': return 'Phòng luyện nói cộng đồng';
      default: return 'Hoạt động học tập';
    }
  }

  getXpCategory(ruleKey?: string): string {
    switch (ruleKey) {
      case 'COACH_SESSION': return 'AI Coach';
      case 'SCENARIO_LESSON': return 'Tình huống';
      case 'STREAK_BONUS': return 'Streak';
      case 'DAILY_MISSION': return 'Nhiệm vụ';
      case 'ROOM_SESSION': return 'Cộng đồng';
      default: return 'Học tập';
    }
  }

  getXpExplanation(ruleKey?: string): string {
    switch (ruleKey) {
      case 'COACH_SESSION': return 'Hoàn thành cuộc trò chuyện 1-1 với AI Coach đạt tiêu chuẩn';
      case 'SCENARIO_LESSON': return 'Đạt kết quả xuất sắc trong bài roleplay tình huống';
      case 'STREAK_BONUS': return 'Luyện tập mỗi ngày để giữ vững thói quen nói tiếng Anh';
      case 'DAILY_MISSION': return 'Hoàn thành và nhận thưởng nhiệm vụ trong ngày';
      case 'ROOM_SESSION': return 'Tham gia phòng luyện nói nhóm cùng bạn học và AI';
      default: return 'Cộng điểm thưởng vào sổ cái XP';
    }
  }

  getBadgeProgressPct(badge: BadgeItem): number {
    const target = badge.target || badge.targetValue || badge.total || 1;
    return Math.min(100, Math.round(((badge.progress || 0) / target) * 100));
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

  getRarityMeta(key: string): { tierName: string; badgeBg: string; badgeColor: string; emblemBg: string; glowColor: string; rewardXp: number } {
    switch (key) {
      case 'master_actor':
        return {
          tierName: 'Huyền Thoại 💎',
          badgeBg: '#EDE9FE',
          badgeColor: '#6D28D9',
          emblemBg: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
          glowColor: 'rgba(139, 92, 246, 0.4)',
          rewardXp: 500,
        };
      case 'b1_achiever':
      case 'fluency_master':
        return {
          tierName: 'Sử Thi 🥇',
          badgeBg: '#FEF3C7',
          badgeColor: '#B45309',
          emblemBg: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
          glowColor: 'rgba(245, 158, 11, 0.4)',
          rewardXp: 300,
        };
      case 'streak_7':
      case 'community_star':
        return {
          tierName: 'Hiếm 🥈',
          badgeBg: '#E0E7FF',
          badgeColor: '#3730A3',
          emblemBg: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
          glowColor: 'rgba(59, 130, 246, 0.35)',
          rewardXp: 200,
        };
      case 'first_speaker':
      default:
        return {
          tierName: 'Đồng 🥉',
          badgeBg: '#FFEDD5',
          badgeColor: '#9A3412',
          emblemBg: 'linear-gradient(135deg, #EA580C 0%, #C2410C 100%)',
          glowColor: 'rgba(234, 88, 12, 0.3)',
          rewardXp: 100,
        };
    }
  }

  getMissionDescription(type: string): string {
    switch (type) {
      case 'COACH':
      case 'AI_COACH':
        return 'Thực hiện một cuộc trò chuyện giọng nói tự do 1-1 với trợ lý AI Coach.';
      case 'SCENARIO':
        return 'Luyện tập tình huống thực tế để phản xạ và học từ vựng theo ngữ cảnh.';
      case 'ROOM':
        return 'Tham gia phòng luyện nói nhóm cùng bạn học với sự hỗ trợ của Invisible AI.';
      case 'STREAK':
        return 'Hoàn thành ít nhất một buổi học để tiếp tục chuỗi ngày học liên tục.';
      default:
        return 'Thực hiện hoạt động học tập để rèn luyện kỹ năng nói.';
    }
  }

  huntBadge(badge: BadgeItem): void {
    this.selectedBadge.set(null);
    switch (badge.key) {
      case 'master_actor':
        this.appState.go('scenarios');
        break;
      case 'community_star':
        this.appState.go('community');
        break;
      case 'first_speaker':
      case 'fluency_master':
      case 'streak_7':
      case 'b1_achiever':
      default:
        this.appState.go('ai-coach');
        break;
    }
  }

  formatDate(dateStr: string | null | undefined): string {
    return formatDDMMYYYY(dateStr);
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.selectedBadge.set(null);
    }
  }
}