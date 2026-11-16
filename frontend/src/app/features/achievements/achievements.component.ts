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
    <div class="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Thành tích & Danh hiệu</h1>
          <p class="text-sm text-slate-500 mt-1">Sổ cái XP, bộ sưu tập huy hiệu, chuỗi luyện tập và nhiệm vụ ngày.</p>
        </div>
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-semibold self-start sm:self-auto">
          <svg class="w-4 h-4 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
          <span>Sổ cái XP minh bạch & cập nhật tức thì</span>
        </div>
      </div>

      <!-- Stats 4-Pillar Overview Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <!-- Total XP -->
        <div class="card p-4 sm:p-5 flex flex-col justify-between border border-slate-200/80 hover:border-amber-300 transition-all shadow-xs">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-slate-500">Tổng XP</span>
            <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
            </div>
          </div>
          <div>
            <div class="text-2xl font-extrabold text-amber-600">{{ totalXpFormatted() }}</div>
            <div class="text-[11px] text-slate-400 mt-0.5">Điểm kinh nghiệm tích lũy</div>
          </div>
        </div>

        <!-- Level -->
        <div class="card p-4 sm:p-5 flex flex-col justify-between border border-slate-200/80 hover:border-sky-300 transition-all shadow-xs">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-slate-500">Trình độ CEFR</span>
            <div class="w-8 h-8 rounded-lg bg-sky-50 text-[#286FB4] flex items-center justify-center">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path d="M12 14l9-5-9-5-9 5 9 5z"/>
                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
              </svg>
            </div>
          </div>
          <div>
            <div class="text-2xl font-extrabold text-[#286FB4]">Level {{ currentLevel() }}</div>
            <div class="text-[11px] text-slate-400 mt-0.5">Mục tiêu kế tiếp: {{ targetLevel() }}</div>
          </div>
        </div>

        <!-- Streak -->
        <div class="card p-4 sm:p-5 flex flex-col justify-between border border-slate-200/80 hover:border-orange-300 transition-all shadow-xs">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-slate-500">Chuỗi Streak</span>
            <div class="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.316.492-.544 1.05-.724 1.636-.29.946-.43 1.94-.475 2.89-.02.433-.034.86-.02 1.282.012.378.04.75.093 1.11a4.978 4.978 0 00-1.075-.418 5.018 5.018 0 00-1.503-.137 4.996 4.996 0 00-1.78.56c-.53.298-.99.71-1.34 1.205a5.05 5.05 0 00-.73 2.535 5.02 5.02 0 001.464 3.535A4.98 4.98 0 009 18a5 5 0 005-5c0-.9-.234-1.75-.65-2.483a5.04 5.04 0 00-1.282-1.488c-.463-.38-.99-.675-1.554-.872.22-.533.493-1.037.818-1.502.32-.456.69-.87 1.104-1.233.395-.347.818-.65 1.258-.903a1 1 0 00.395-1.366 1 1 0 00-.694-.6z" clip-rule="evenodd"/>
              </svg>
            </div>
          </div>
          <div>
            <div class="text-2xl font-extrabold text-orange-600">{{ currentStreak() }} ngày</div>
            <div class="text-[11px] text-slate-400 mt-0.5">Giữ vững phong độ hàng ngày</div>
          </div>
        </div>

        <!-- Badges Count -->
        <div class="card p-4 sm:p-5 flex flex-col justify-between border border-slate-200/80 hover:border-purple-300 transition-all shadow-xs">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-slate-500">Huy hiệu</span>
            <div class="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
              </svg>
            </div>
          </div>
          <div>
            <div class="text-2xl font-extrabold text-purple-600">{{ earnedBadgesCount() }}/{{ badges().length || 6 }}</div>
            <div class="text-[11px] text-slate-400 mt-0.5">Đã mở khóa vào bộ sưu tập</div>
          </div>
        </div>
      </div>

      <!-- Level Advancement Progress Card -->
      <div class="card p-5 border border-slate-200/80 shadow-xs bg-white">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-[#286FB4]"></span>
            <span class="font-bold text-sm text-slate-800">
              Tiến độ thăng hạng: Level {{ currentLevel() }} → {{ targetLevel() }}
            </span>
          </div>
          <span class="text-xs font-bold text-[#286FB4] bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100">
            {{ conditionsMetCount() }}/{{ conditionsTotalCount() }} điều kiện đạt
          </span>
        </div>
        <div class="progress-bar h-2.5 bg-slate-100 rounded-full overflow-hidden mt-2">
          <div
            class="progress-bar-fill h-2.5 rounded-full transition-all duration-500"
            [style.width.%]="advancementPct()"
            style="background: linear-gradient(90deg, #286FB4, #1d5a94)"
          ></div>
        </div>
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 mt-2.5 text-xs text-slate-500">
          <span>{{ advancementStatusText() }}</span>
          <button class="font-bold text-[#286FB4] hover:underline cursor-pointer border-0 bg-transparent p-0 inline-flex items-center gap-1" (click)="appState.go('progress')">
            <span>Xem chi tiết lộ trình CEFR</span>
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        <!-- Badges Tab -->
        <button
          type="button"
          class="inline-flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer border-0 bg-transparent shrink-0"
          [style.borderColor]="tab() === 'badges' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'badges' ? '#286FB4' : '#64748b'"
          (click)="tab.set('badges')"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
          </svg>
          <span>Bộ sưu tập huy hiệu</span>
          <span class="text-xs px-2 py-0.5 rounded-full font-semibold" [ngClass]="tab() === 'badges' ? 'bg-sky-100 text-[#286FB4]' : 'bg-slate-100 text-slate-500'">
            {{ earnedBadgesCount() }}/{{ badges().length }}
          </span>
        </button>

        <!-- Daily Missions Tab -->
        <button
          type="button"
          class="inline-flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer border-0 bg-transparent shrink-0"
          [style.borderColor]="tab() === 'missions' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'missions' ? '#286FB4' : '#64748b'"
          (click)="tab.set('missions')"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span>Nhiệm vụ hôm nay</span>
          <span class="text-xs px-2 py-0.5 rounded-full font-semibold" [ngClass]="tab() === 'missions' ? 'bg-sky-100 text-[#286FB4]' : 'bg-slate-100 text-slate-500'">
            {{ dailyDoneCount() }}/{{ missions().length }}
          </span>
        </button>

        <!-- XP Ledger Tab -->
        <button
          type="button"
          class="inline-flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer border-0 bg-transparent shrink-0"
          [style.borderColor]="tab() === 'xp' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'xp' ? '#286FB4' : '#64748b'"
          (click)="tab.set('xp')"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
          <span>Sổ cái lịch sử XP</span>
        </button>
      </div>

      <!-- BADGES TAB -->
      @if (tab() === 'badges') {
        <div class="space-y-6">
          <!-- Showcase Header Card -->
          <div class="card p-6 border border-slate-200/80 shadow-xs bg-white">
            <div class="flex items-center justify-between flex-wrap gap-4">
              <div class="flex items-center gap-3.5">
                <div class="w-12 h-12 rounded-2xl flex items-center justify-center bg-purple-50 text-purple-600 border border-purple-100 shrink-0">
                  <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
                  </svg>
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h2 class="text-lg font-bold text-slate-900">Danh hiệu chinh phục</h2>
                    <span class="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                      {{ collectorRank() }}
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 mt-0.5">
                    Mở khóa danh hiệu qua việc rèn luyện hội thoại đều đặn, hoàn thành tình huống và nâng hạng CEFR.
                  </p>
                </div>
              </div>

              <!-- Collector Progress -->
              <div class="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 min-w-44 text-right">
                <div class="text-[11px] text-slate-500 font-medium mb-1">Tiến độ bộ sưu tập</div>
                <div class="text-sm font-extrabold text-slate-800 mb-1">{{ earnedBadgesCount() }} / {{ badges().length }} ĐÃ ĐẠT</div>
                <div class="progress-bar h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div class="progress-bar-fill h-1.5 rounded-full transition-all duration-500" [style.width.%]="collectorPct()" style="background: #286FB4"></div>
                </div>
              </div>
            </div>

            <!-- Filter chips -->
            <div class="flex gap-2 mt-4 pt-3 border-t border-slate-100 text-xs font-semibold">
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg border-0 cursor-pointer transition-all"
                [style.background]="badgeFilter() === 'all' ? '#286FB4' : '#F1F5F9'"
                [style.color]="badgeFilter() === 'all' ? '#FFFFFF' : '#475569'"
                (click)="badgeFilter.set('all')"
              >
                Tất cả ({{ badges().length }})
              </button>
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg border-0 cursor-pointer transition-all inline-flex items-center gap-1"
                [style.background]="badgeFilter() === 'unlocked' ? '#286FB4' : '#F1F5F9'"
                [style.color]="badgeFilter() === 'unlocked' ? '#FFFFFF' : '#475569'"
                (click)="badgeFilter.set('unlocked')"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Đã mở khóa ({{ earnedBadgesCount() }})</span>
              </button>
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg border-0 cursor-pointer transition-all inline-flex items-center gap-1"
                [style.background]="badgeFilter() === 'locked' ? '#286FB4' : '#F1F5F9'"
                [style.color]="badgeFilter() === 'locked' ? '#FFFFFF' : '#475569'"
                (click)="badgeFilter.set('locked')"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                <span>Chưa mở ({{ badges().length - earnedBadgesCount() }})</span>
              </button>
            </div>
          </div>

          <!-- Trophy Cards Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (b of filteredBadges(); track b.id || b.key) {
              <div
                class="card card-interactive p-5 relative transition-all duration-200 cursor-pointer border flex flex-col justify-between"
                tabindex="0"
                role="button"
                [attr.aria-label]="b.name"
                [style.borderColor]="b.earned ? '#CBD5E1' : '#E2E8F0'"
                [style.background]="b.earned ? '#FFFFFF' : '#F8FAFC'"
                (click)="selectedBadge.set(b)"
                (keydown.enter)="selectedBadge.set(b)"
              >
                <div>
                  <!-- Rarity & Earned Stamp -->
                  <div class="flex items-center justify-between mb-3">
                    <span
                      class="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider"
                      [style.background]="getRarityMeta(b.key).badgeBg"
                      [style.color]="getRarityMeta(b.key).badgeColor"
                    >
                      {{ getRarityMeta(b.key).tierName }}
                    </span>

                    @if (b.earned) {
                      <span class="text-[11px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        <svg class="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Đã đạt</span>
                      </span>
                    } @else {
                      <span class="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                        </svg>
                        <span>Chưa đạt</span>
                      </span>
                    }
                  </div>

                  <!-- Medal Emblem + Info -->
                  <div class="flex items-start gap-3.5 mb-3">
                    <div
                      class="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                      [style.background]="b.earned ? getRarityMeta(b.key).emblemBg : '#E2E8F0'"
                    >
                      <svg class="w-6 h-6" [class.text-slate-400]="!b.earned" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
                      </svg>
                    </div>

                    <div class="flex-1 min-w-0">
                      <h3 class="font-bold text-sm text-slate-800 truncate">
                        {{ b.name }}
                      </h3>
                      <p class="text-xs text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                        {{ b.description }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Footer Status & XP Reward Bounty -->
                <div class="pt-3 border-t border-slate-100 mt-2">
                  @if (b.earned) {
                    <div class="flex items-center justify-between text-xs">
                      <span class="text-slate-400 text-[11px]">{{ formatDate(b.awardedAt) }}</span>
                      <span class="font-bold text-amber-600 inline-flex items-center gap-1">
                        <span>+{{ getRarityMeta(b.key).rewardXp }} XP</span>
                        <svg class="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                        </svg>
                      </span>
                    </div>
                  } @else {
                    <div>
                      <div class="flex justify-between text-[11px] mb-1">
                        <span class="text-slate-500">Tiến độ</span>
                        <span class="font-semibold text-slate-700">{{ b.progress }}/{{ b.target || b.targetValue || b.total || 1 }}</span>
                      </div>
                      <div class="progress-bar h-1.5 bg-slate-200 rounded-full overflow-hidden mb-1.5">
                        <div class="progress-bar-fill h-1.5 bg-[#286FB4] rounded-full" [style.width.%]="getBadgeProgressPct(b)"></div>
                      </div>
                      <div class="flex justify-between items-center text-[11px]">
                        <span class="text-slate-400">Thưởng mở khóa:</span>
                        <span class="font-bold text-amber-600">+{{ getRarityMeta(b.key).rewardXp }} XP</span>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- DAILY MISSIONS TAB -->
      @if (tab() === 'missions') {
        <div class="space-y-5">
          <!-- Daily Quest Banner -->
          <div class="card p-5 border border-sky-100 shadow-xs bg-white">
            <div class="flex items-center justify-between flex-wrap gap-4">
              <div class="flex items-center gap-3.5">
                <div class="w-11 h-11 rounded-xl bg-sky-50 text-[#286FB4] flex items-center justify-center border border-sky-100 shrink-0">
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h3 class="text-base font-bold text-slate-900">Nhiệm vụ hàng ngày</h3>
                  <p class="text-xs text-slate-500 mt-0.5">
                    Hoàn thành các nhiệm vụ mỗi ngày để duy trì thói quen nói và tích lũy XP thăng cấp.
                  </p>
                </div>
              </div>
              <div class="text-right">
                <div class="text-xs font-bold text-slate-700 mb-1">
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
                class="card p-4 border transition-all flex items-center gap-3.5 bg-white shadow-xs"
                [style.borderColor]="m.status === 'CLAIMED' ? '#E2E8F0' : m.status === 'COMPLETED' ? '#FDE68A' : '#E2E8F0'"
              >
                <!-- Icon box based on status/type -->
                <div
                  class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                  [ngClass]="m.status === 'CLAIMED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : m.status === 'COMPLETED' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200'"
                >
                  @if (m.status === 'CLAIMED') {
                    <svg class="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  } @else if (m.conditionType === 'COACH' || m.conditionType === 'AI_COACH') {
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                    </svg>
                  } @else if (m.conditionType === 'SCENARIO') {
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  } @else {
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.316.492-.544 1.05-.724 1.636-.29.946-.43 1.94-.475 2.89-.02.433-.034.86-.02 1.282.012.378.04.75.093 1.11a4.978 4.978 0 00-1.075-.418 5.018 5.018 0 00-1.503-.137 4.996 4.996 0 00-1.78.56c-.53.298-.99.71-1.34 1.205a5.05 5.05 0 00-.73 2.535 5.02 5.02 0 001.464 3.535A4.98 4.98 0 009 18a5 5 0 005-5c0-.9-.234-1.75-.65-2.483a5.04 5.04 0 00-1.282-1.488c-.463-.38-.99-.675-1.554-.872.22-.533.493-1.037.818-1.502.32-.456.69-.87 1.104-1.233.395-.347.818-.65 1.258-.903a1 1 0 00.395-1.366 1 1 0 00-.694-.6z" clip-rule="evenodd"/>
                    </svg>
                  }
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-0.5">
                    <span class="text-[11px] font-semibold text-slate-500">
                      {{ m.conditionType === 'COACH' || m.conditionType === 'AI_COACH' ? 'AI Coach' : m.conditionType === 'SCENARIO' ? 'Tình huống' : 'Streak' }}
                    </span>
                    <span class="text-xs font-bold text-amber-600">+{{ m.xp }} XP</span>
                  </div>
                  <h4
                    class="text-sm font-semibold truncate"
                    [style.textDecoration]="m.status === 'CLAIMED' ? 'line-through' : 'none'"
                    [style.color]="m.status === 'CLAIMED' ? '#94a3b8' : '#1e293b'"
                  >
                    {{ m.title }}
                  </h4>
                </div>

                <div class="shrink-0">
                  @if (m.status === 'COMPLETED') {
                    <button
                      type="button"
                      class="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white cursor-pointer border-0 shadow-xs bg-emerald-600 hover:bg-emerald-700 transition"
                      (click)="claimMission(m)"
                    >
                      Nhận thưởng
                    </button>
                  } @else if (m.status === 'CLAIMED') {
                    <span class="text-xs font-semibold text-emerald-600 px-2 py-1 rounded bg-emerald-50 border border-emerald-100">
                      Đã nhận
                    </span>
                  } @else {
                    <button
                      type="button"
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

      <!-- XP LEDGER TAB -->
      @if (tab() === 'xp') {
        <div class="space-y-3">
          @if (xpHistory().length === 0) {
            <div class="card p-10 text-center text-sm text-slate-400 bg-white border border-slate-200">
              <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 mx-auto flex items-center justify-center mb-2">
                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
              </div>
              Chưa có giao dịch XP nào trong sổ cái. Hãy hoàn thành buổi luyện tập đầu tiên để nhận XP!
            </div>
          } @else {
            @for (x of xpHistory(); track x.id) {
              <div class="card p-4 sm:p-5 flex items-center gap-4 bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition">
                <div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-amber-50 text-amber-600 border border-amber-100">
                  @if (x.ruleKey === 'COACH_SESSION') {
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                    </svg>
                  } @else if (x.ruleKey === 'SCENARIO_LESSON') {
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  } @else if (x.ruleKey === 'STREAK_BONUS') {
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.316.492-.544 1.05-.724 1.636-.29.946-.43 1.94-.475 2.89-.02.433-.034.86-.02 1.282.012.378.04.75.093 1.11a4.978 4.978 0 00-1.075-.418 5.018 5.018 0 00-1.503-.137 4.996 4.996 0 00-1.78.56c-.53.298-.99.71-1.34 1.205a5.05 5.05 0 00-.73 2.535 5.02 5.02 0 001.464 3.535A4.98 4.98 0 009 18a5 5 0 005-5c0-.9-.234-1.75-.65-2.483a5.04 5.04 0 00-1.282-1.488c-.463-.38-.99-.675-1.554-.872.22-.533.493-1.037.818-1.502.32-.456.69-.87 1.104-1.233.395-.347.818-.65 1.258-.903a1 1 0 00.395-1.366 1 1 0 00-.694-.6z" clip-rule="evenodd"/>
                    </svg>
                  } @else {
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                    </svg>
                  }
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-sm text-slate-800 truncate">
                      {{ x.sourceDisplay || x.description || getXpTitle(x.ruleKey) }}
                    </span>
                    <span class="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-600">
                      {{ x.category || getXpCategory(x.ruleKey) }}
                    </span>
                  </div>
                  <div class="text-xs text-slate-400 mt-0.5 truncate">
                    {{ formatDate(x.createdAt) }} • {{ getXpExplanation(x.ruleKey) }}
                  </div>
                </div>
                <div class="font-extrabold text-base text-amber-600 shrink-0">+{{ x.amount }} XP</div>
              </div>
            }
          }
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
            class="card p-6 max-w-md w-full text-center relative border shadow-2xl bg-white rounded-3xl"
            [style.borderColor]="badge.earned ? '#F59E0B' : '#CBD5E1'"
          >
            <!-- Close Button -->
            <button
              type="button"
              class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 w-8 h-8 rounded-full flex items-center justify-center border-0 bg-slate-100 cursor-pointer"
              (click)="selectedBadge.set(null)"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <!-- Emblem -->
            <div
              class="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center text-white mb-4 shadow-lg relative"
              [style.background]="badge.earned ? getRarityMeta(badge.key).emblemBg : '#E2E8F0'"
            >
              <svg class="w-10 h-10" [class.text-slate-400]="!badge.earned" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
              </svg>
              @if (!badge.earned) {
                <div class="absolute inset-0 flex items-center justify-center bg-slate-900/30 rounded-3xl">
                  <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                </div>
              }
            </div>

            <!-- Rarity Badge -->
            <span
              class="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider inline-block mb-2"
              [style.background]="getRarityMeta(badge.key).badgeBg"
              [style.color]="getRarityMeta(badge.key).badgeColor"
            >
              {{ getRarityMeta(badge.key).tierName }}
            </span>

            <h3 class="text-xl font-extrabold text-slate-900 mb-1">{{ badge.name }}</h3>
            <p class="text-xs text-slate-600 mb-4 leading-relaxed">{{ badge.description }}</p>

            <!-- Reward Box -->
            <div class="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 mb-4">
              <div class="text-[11px] text-amber-800 font-semibold mb-0.5">Phần thưởng thành tích</div>
              <div class="text-2xl font-extrabold text-amber-600 flex items-center justify-center gap-1">
                <span>+{{ getRarityMeta(badge.key).rewardXp }} XP</span>
                <svg class="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
              </div>
              <div class="text-[11px] text-amber-700/80 mt-1">Cộng trực tiếp vào sổ cái XP và tiến độ thăng hạng Level</div>
            </div>

            <!-- Status & Action -->
            @if (badge.earned) {
              <div class="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold mb-4 border border-emerald-100 flex items-center justify-center gap-2">
                <svg class="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Bạn đã chinh phục huy hiệu này vào ngày {{ formatDate(badge.awardedAt) }}!</span>
              </div>
              <button
                type="button"
                class="btn-primary w-full justify-center py-2.5 cursor-pointer border-0"
                (click)="selectedBadge.set(null)"
              >
                Đóng lại
              </button>
            } @else {
              <div class="mb-4 text-left">
                <div class="flex justify-between text-xs mb-1 font-semibold text-slate-700">
                  <span>Tiến độ mở khóa</span>
                  <span class="text-[#286FB4] font-bold">{{ badge.progress }} / {{ badge.target || badge.targetValue || badge.total || 1 }}</span>
                </div>
                <div class="progress-bar h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div class="progress-bar-fill h-2 bg-[#286FB4] rounded-full" [style.width.%]="getBadgeProgressPct(badge)"></div>
                </div>
              </div>
              <button
                type="button"
                class="btn-primary w-full justify-center py-3 cursor-pointer border-0 font-bold shadow-md"
                (click)="huntBadge(badge)"
              >
                Đi săn huy hiệu này ngay!
              </button>
            }
          </div>
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

  readonly totalXpFormatted = computed(() => {
    const val = this.gamificationSummary()?.totalXp ?? this.appState.totalXp() ?? 0;
    return Number(val).toLocaleString();
  });

  readonly currentStreak = computed(() => {
    return this.gamificationSummary()?.currentStreak ?? this.appState.currentStreak() ?? 0;
  });

  readonly collectorPct = computed(() => {
    const total = this.badges().length;
    if (!total) return 0;
    return Math.round((this.earnedBadgesCount() / total) * 100);
  });

  readonly collectorRank = computed(() => {
    const count = this.earnedBadgesCount();
    if (count >= 6) return 'Huyền Thoại Danh Hiệu';
    if (count >= 4) return 'Bậc Thầy Sưu Tầm';
    if (count >= 2) return 'Thợ Săn Tiềm Năng';
    return 'Thợ Săn Tập Sự';
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
          icon: b.icon || b.iconEmoji || 'trophy',
          iconEmoji: b.iconEmoji || b.icon || 'trophy',
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
        // Refresh XP history
        this.gamificationService.getXpHistory(50).subscribe({
          next: (r) => this.xpHistory.set(r.transactions)
        });
      }
    });
  }

  getXpTitle(ruleKey?: string): string {
    switch (ruleKey) {
      case 'COACH_SESSION': return 'Buổi học với AI Coach';
      case 'SCENARIO_LESSON': return 'Thực hành tình huống';
      case 'STREAK_BONUS': return 'Thưởng duy trì chuỗi Streak';
      case 'DAILY_MISSION': return 'Nhiệm vụ hàng ngày';
      default: return 'Hoạt động học tập';
    }
  }

  getXpCategory(ruleKey?: string): string {
    switch (ruleKey) {
      case 'COACH_SESSION': return 'AI Coach';
      case 'SCENARIO_LESSON': return 'Tình huống';
      case 'STREAK_BONUS': return 'Streak';
      case 'DAILY_MISSION': return 'Nhiệm vụ';
      default: return 'Học tập';
    }
  }

  getXpExplanation(ruleKey?: string): string {
    switch (ruleKey) {
      case 'COACH_SESSION': return 'Hoàn thành cuộc trò chuyện 1-1 với AI Coach';
      case 'SCENARIO_LESSON': return 'Đạt kết quả xuất sắc trong bài roleplay tình huống';
      case 'STREAK_BONUS': return 'Luyện tập mỗi ngày để giữ vững thói quen nói tiếng Anh';
      case 'DAILY_MISSION': return 'Hoàn thành và nhận thưởng nhiệm vụ trong ngày';
      default: return 'Cộng điểm thưởng vào sổ cái XP';
    }
  }

  getBadgeProgressPct(badge: BadgeItem): number {
    const target = badge.target || badge.targetValue || badge.total || 1;
    return Math.min(100, Math.round(((badge.progress || 0) / target) * 100));
  }

  goToMissionAction(type: string): void {
    switch (type) {
      case 'AI_COACH': this.appState.go('ai-coach'); break;
      case 'SCENARIO': this.appState.go('scenarios'); break;
      case 'STREAK': this.appState.go('ai-coach'); break;
      default: this.appState.go('ai-coach'); break;
    }
  }

  getRarityMeta(key: string): { tierName: string; badgeBg: string; badgeColor: string; emblemBg: string; glowColor: string; rewardXp: number } {
    switch (key) {
      case 'master_actor':
        return {
          tierName: 'Huyền Thoại',
          badgeBg: '#EDE9FE',
          badgeColor: '#6D28D9',
          emblemBg: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
          glowColor: 'rgba(139, 92, 246, 0.4)',
          rewardXp: 500,
        };
      case 'b1_achiever':
      case 'fluency_master':
        return {
          tierName: 'Sử Thi',
          badgeBg: '#FEF3C7',
          badgeColor: '#B45309',
          emblemBg: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
          glowColor: 'rgba(245, 158, 11, 0.4)',
          rewardXp: 300,
        };
      case 'streak_7':
        return {
          tierName: 'Hiếm',
          badgeBg: '#E0E7FF',
          badgeColor: '#3730A3',
          emblemBg: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
          glowColor: 'rgba(59, 130, 246, 0.35)',
          rewardXp: 200,
        };
      case 'first_speaker':
      default:
        return {
          tierName: 'Đồng',
          badgeBg: '#FFEDD5',
          badgeColor: '#9A3412',
          emblemBg: 'linear-gradient(135deg, #EA580C 0%, #C2410C 100%)',
          glowColor: 'rgba(234, 88, 12, 0.3)',
          rewardXp: 100,
        };
    }
  }

  huntBadge(badge: BadgeItem): void {
    this.selectedBadge.set(null);
    switch (badge.key) {
      case 'master_actor':
        this.appState.go('scenarios');
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
