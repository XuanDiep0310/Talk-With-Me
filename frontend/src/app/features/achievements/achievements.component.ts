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

      <!-- Badges Tab (Zombie Tsunami Trophy Hall Style) -->
      @if (tab() === 'badges') {
        <div class="space-y-6">
          <!-- Trophy Showcase Header -->
          <div class="card p-6 border shadow-sm relative overflow-hidden" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: #fff; border-color: #334155">
            <div class="flex items-center justify-between flex-wrap gap-4 relative z-10">
              <div class="flex items-center gap-4">
                <div class="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shadow-lg border border-amber-400/40" style="background: radial-gradient(circle, #f59e0b 0%, #b45309 100%)">
                  🏆
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h2 class="text-xl font-800" style="font-weight: 800; color: #fbbf24">PHÒNG TRUYỀN THỐNG HUY HIỆU</h2>
                    <span class="text-xs px-2.5 py-0.5 rounded-full font-700 bg-amber-500/20 text-amber-300 border border-amber-400/30">
                      {{ collectorRank() }}
                    </span>
                  </div>
                  <p class="text-xs text-slate-300 mt-1 max-w-lg">
                    Săn các danh hiệu huyền thoại bằng cách hoàn thành các thử thách hội thoại, chuỗi streak và cột mốc CEFR!
                  </p>
                </div>
              </div>

              <!-- Badges Collector Bar -->
              <div class="bg-slate-800/80 px-4 py-3 rounded-xl border border-slate-700 min-w-48 text-right">
                <div class="text-xs text-slate-400 font-500 mb-1">Bộ sưu tập huy hiệu</div>
                <div class="text-lg font-800 text-amber-400 mb-1.5">{{ earnedBadgesCount() }}/{{ badges().length }} ĐÃ MỞ</div>
                <div class="progress-bar h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div class="progress-bar-fill h-2 rounded-full transition-all duration-500" [style.width.%]="collectorPct()" style="background: linear-gradient(90deg, #f59e0b, #eab308)"></div>
                </div>
              </div>
            </div>

            <!-- Filter chips -->
            <div class="flex gap-2 mt-5 pt-4 border-t border-slate-700/80 text-xs font-600">
              <button
                class="px-3 py-1.5 rounded-lg border-0 cursor-pointer transition-all"
                [style.background]="badgeFilter() === 'all' ? '#f59e0b' : '#334155'"
                [style.color]="badgeFilter() === 'all' ? '#000' : '#cbd5e1'"
                (click)="badgeFilter.set('all')"
              >
                Tất cả ({{ badges().length }})
              </button>
              <button
                class="px-3 py-1.5 rounded-lg border-0 cursor-pointer transition-all"
                [style.background]="badgeFilter() === 'unlocked' ? '#f59e0b' : '#334155'"
                [style.color]="badgeFilter() === 'unlocked' ? '#000' : '#cbd5e1'"
                (click)="badgeFilter.set('unlocked')"
              >
                🏆 Đã mở khóa ({{ earnedBadgesCount() }})
              </button>
              <button
                class="px-3 py-1.5 rounded-lg border-0 cursor-pointer transition-all"
                [style.background]="badgeFilter() === 'locked' ? '#f59e0b' : '#334155'"
                [style.color]="badgeFilter() === 'locked' ? '#000' : '#cbd5e1'"
                (click)="badgeFilter.set('locked')"
              >
                🔒 Đang săn tìm ({{ badges().length - earnedBadgesCount() }})
              </button>
            </div>
          </div>

          <!-- Zombie Tsunami Trophy Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            @for (b of filteredBadges(); track b.id) {
              <div
                class="card p-5 relative overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-lg hover:-translate-y-1"
                [style.border]="b.earned ? '2px solid #F59E0B' : '2px dashed #CBD5E1'"
                [style.background]="b.earned ? 'radial-gradient(circle at 50% 20%, #FFFBEB 0%, #FFFFFF 100%)' : '#F8FAFC'"
                (click)="selectedBadge.set(b)"
              >
                <!-- Rarity Banner / Stamp -->
                <div class="flex items-center justify-between mb-3">
                  <span
                    class="text-[11px] font-800 px-2 py-0.5 rounded-full uppercase tracking-wider"
                    [style.background]="getRarityMeta(b.key).badgeBg"
                    [style.color]="getRarityMeta(b.key).badgeColor"
                  >
                    {{ getRarityMeta(b.key).tierName }}
                  </span>

                  @if (b.earned) {
                    <span class="text-xs font-800 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      ✓ ĐÃ MỞ
                    </span>
                  } @else {
                    <span class="text-xs font-700 text-slate-400 flex items-center gap-1">
                      <span>🔒</span>
                      <span>Chưa đạt</span>
                    </span>
                  }
                </div>

                <!-- Medal Emblem with 3D feel -->
                <div class="flex flex-col items-center text-center my-2">
                  <div
                    class="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-3 shadow-md relative transition-transform"
                    [style.background]="b.earned ? getRarityMeta(b.key).emblemBg : '#E2E8F0'"
                    [style.boxShadow]="b.earned ? ('0 8px 20px -3px ' + getRarityMeta(b.key).glowColor) : 'none'"
                  >
                    <span [class.grayscale]="!b.earned" [class.opacity-40]="!b.earned">{{ b.icon }}</span>
                    @if (!b.earned) {
                      <div class="absolute inset-0 flex items-center justify-center bg-slate-900/40 rounded-2xl">
                        <span class="text-xl">🔒</span>
                      </div>
                    }
                  </div>

                  <h3 class="font-800 text-base mb-1" style="font-weight: 800; color: #1e293b">
                    {{ b.name }}
                  </h3>
                  <p class="text-xs text-slate-500 mb-3 px-2 line-clamp-2 min-h-8">
                    {{ b.description }}
                  </p>
                </div>

                <!-- Footer Status & XP Reward Bounty -->
                <div class="pt-3 border-t border-slate-100 mt-auto">
                  @if (b.earned) {
                    <div class="flex items-center justify-between text-xs">
                      <span class="text-slate-400">Đạt: {{ formatDate(b.awardedAt) }}</span>
                      <span class="font-800 text-amber-600">+{{ getRarityMeta(b.key).rewardXp }} XP ⭐</span>
                    </div>
                  } @else {
                    <div>
                      <div class="flex justify-between text-xs mb-1">
                        <span class="text-slate-500 font-500">Tiến độ mở khóa</span>
                        <span class="font-700 text-sky-700">{{ b.progress }}/{{ b.target }}</span>
                      </div>
                      <div class="progress-bar h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
                        <div class="progress-bar-fill h-2 bg-sky-500 rounded-full transition-all duration-500" [style.width.%]="getBadgeProgressPct(b)"></div>
                      </div>
                      <div class="flex justify-between items-center text-xs">
                        <span class="text-slate-400 text-[11px]">Thưởng mở khóa:</span>
                        <span class="font-800 text-amber-600">+{{ getRarityMeta(b.key).rewardXp }} XP ⭐</span>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Missions Tab (RPG Daily Quest Chest) -->
      @if (tab() === 'missions') {
        <div class="space-y-5">
          <!-- Daily Quest Chest Banner -->
          <div class="card p-6 border shadow-sm relative overflow-hidden" style="background: linear-gradient(135deg, #286FB4 0%, #1d5a94 100%); color: #fff">
            <div class="flex items-center justify-between flex-wrap gap-4 relative z-10">
              <div class="flex items-center gap-4">
                <div class="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-3xl border border-white/20">
                  🎁
                </div>
                <div>
                  <h3 class="text-lg font-800" style="font-weight: 800">RƯƠNG THƯỞNG NHIỆM VỤ NGÀY</h3>
                  <p class="text-xs text-white/80 mt-0.5">
                    Hoàn thành tất cả 4 thử thách mỗi ngày để nhận thưởng thêm +100 XP từ Rương Kho Báu!
                  </p>
                </div>
              </div>
              <div class="text-right">
                <div class="text-sm font-800 text-amber-300 mb-1">
                  {{ dailyDoneCount() }}/{{ missions().length }} HOÀN THÀNH
                </div>
                <div class="w-48 progress-bar h-2.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    class="progress-bar-fill h-2.5 bg-amber-400 rounded-full transition-all duration-500"
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
                class="card p-5 border transition-all flex items-center gap-4"
                [style.borderColor]="m.status === 'CLAIMED' ? '#DCFCE7' : m.status === 'COMPLETED' ? '#FDE68A' : '#E2E8F0'"
                [style.background]="m.status === 'CLAIMED' ? '#F0FDF4' : m.status === 'COMPLETED' ? '#FFFBEB' : '#FFFFFF'"
              >
                <div
                  class="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-xs"
                  [style.background]="m.status === 'CLAIMED' ? '#DCFCE7' : m.status === 'COMPLETED' ? '#FEF3C7' : '#E2F0F9'"
                >
                  @if (m.status === 'CLAIMED') {
                    <span class="text-emerald-600 font-800">✓</span>
                  } @else {
                    <span>{{ getMissionIcon(m.conditionType) }}</span>
                  }
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      class="text-xs font-700 px-2 py-0.5 rounded"
                      [style.background]="m.conditionType === 'COACH' ? '#E2F0F9' : m.conditionType === 'SCENARIO' ? '#FFF0F3' : m.conditionType === 'ROOM' ? '#F5F3FF' : '#FEF3C7'"
                      [style.color]="m.conditionType === 'COACH' ? '#286FB4' : m.conditionType === 'SCENARIO' ? '#DF4C73' : m.conditionType === 'ROOM' ? '#7c3aed' : '#b45309'"
                    >
                      {{ m.conditionType === 'COACH' ? '🎙️ AI Coach 1-1' : m.conditionType === 'SCENARIO' ? '🎭 Nhập vai tình huống' : m.conditionType === 'ROOM' ? '👥 Phòng cộng đồng' : '🔥 Chuỗi học Streak' }}
                    </span>
                    <span class="text-xs font-700 text-amber-600">⭐ +{{ m.xp }} XP</span>
                  </div>
                  <h4
                    class="text-sm font-700 text-slate-800 mb-0.5"
                    [style.textDecoration]="m.status === 'CLAIMED' ? 'line-through' : 'none'"
                    [style.color]="m.status === 'CLAIMED' ? '#94a3b8' : '#1e293b'"
                  >
                    {{ m.title }}
                  </h4>
                  <p class="text-xs text-slate-500">
                    {{ getMissionDescription(m.conditionType) }}
                  </p>
                </div>

                <div class="shrink-0">
                  @if (m.status === 'COMPLETED') {
                    <button
                      class="px-4 py-2 rounded-xl text-xs font-700 text-white cursor-pointer border-0 shadow-md animate-pulse"
                      style="background: #22c55e"
                      (click)="claimMission(m)"
                    >
                      Nhận thưởng 🎁
                    </button>
                  } @else if (m.status === 'CLAIMED') {
                    <span class="text-xs font-700 text-emerald-600 px-3 py-1.5 rounded-lg bg-emerald-50">✓ Đã nhận</span>
                  } @else {
                    <button
                      class="btn-primary text-xs px-4 py-2 rounded-xl cursor-pointer border-0 shadow-sm"
                      (click)="goToMissionAction(m.conditionType)"
                    >
                      Bắt đầu ➔
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Zombie Tsunami Badge Detail Modal -->
      @if (selectedBadge(); as badge) {
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" (click)="selectedBadge.set(null)">
          <div
            class="card p-6 max-w-md w-full text-center relative border-2 shadow-2xl"
            [style.borderColor]="badge.earned ? '#F59E0B' : '#94A3B8'"
            [style.background]="badge.earned ? 'radial-gradient(circle at 50% 30%, #FFFBEB 0%, #FFFFFF 100%)' : '#FFFFFF'"
            (click)="$event.stopPropagation()"
          >
            <!-- Close Button -->
            <button class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl border-0 bg-transparent cursor-pointer" (click)="selectedBadge.set(null)">✕</button>

            <!-- Big 3D Badge Emblem -->
            <div
              class="w-24 h-24 mx-auto rounded-3xl flex items-center justify-center text-5xl mb-4 shadow-xl relative"
              [style.background]="badge.earned ? getRarityMeta(badge.key).emblemBg : '#E2E8F0'"
              [style.boxShadow]="badge.earned ? ('0 12px 25px -4px ' + getRarityMeta(badge.key).glowColor) : 'none'"
            >
              <span [class.grayscale]="!badge.earned" [class.opacity-50]="!badge.earned">{{ badge.icon }}</span>
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
                  <span class="text-sky-700 font-700">{{ badge.progress }} / {{ badge.target }}</span>
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
