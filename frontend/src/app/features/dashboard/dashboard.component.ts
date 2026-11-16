import { Component, ChangeDetectionStrategy, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatDDMMYYYY } from '../../core/utils/date.utils';
import { AppStateService } from '../../core/services/app-state.service';
import { AuthService } from '../../core/services/auth.service';
import { GamificationService } from '../../core/services/gamification.service';
import { DashboardResponse, DailyMissionItem } from '../../core/models/gamification.models';
import { AppPage } from '../../core/models/app.models';

interface Shortcut {
  id: AppPage;
  label: string;
  desc: string;
  badge: string;
  badgeColor: string;
  gradientFrom: string;
  gradientTo: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-5 md:p-8 space-y-7 max-w-6xl mx-auto">
      <!-- Welcome Hero Banner -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-5 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-blue-500/15 relative overflow-hidden">
        <!-- Subtle background decorative shapes -->
        <div class="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
        <div class="absolute right-20 -bottom-16 w-40 h-40 rounded-full bg-blue-400/20 blur-xl pointer-events-none"></div>

        <div class="relative z-10 max-w-xl">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-semibold text-blue-100 mb-3 border border-white/20">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Hôm nay: {{ todayFormatted() }}
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
            {{ dashboardData()?.greeting || ('Xin chào, ' + displayName() + '!') }}
          </h1>
          <p class="text-sm sm:text-base text-blue-100/90 mt-2 leading-relaxed">
            @if (currentStreak() > 0) {
              Bạn đang giữ chuỗi luyện nói <strong class="text-amber-300 font-bold">{{ currentStreak() }} ngày</strong> liên tiếp. Hãy tiếp tục bứt phá hôm nay!
            } @else {
              Bắt đầu hành trình phản xạ tiếng Anh tự tin ngay hôm nay chỉ với một buổi luyện 10 phút.
            }
          </p>
        </div>

        <div class="relative z-10 flex sm:flex-col gap-3 shrink-0">
          <button
            type="button"
            class="bg-white hover:bg-slate-50 text-blue-700 hover:text-blue-800 px-6 py-3.5 text-sm font-extrabold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-2.5 active:scale-95 border border-white"
            (click)="appState.go('ai-coach')"
          >
            <svg class="w-5 h-5 text-blue-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
            <span class="tracking-tight">Bắt đầu nói với AI</span>
          </button>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
        @for (s of statsList(); track s.label) {
          <div class="card p-5 flex flex-col justify-between gap-3 hover:border-slate-300 transition-colors">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">{{ s.label }}</span>
              <div class="w-9 h-9 rounded-xl flex items-center justify-center" [ngClass]="s.bgClass">
                @switch (s.key) {
                  @case ('score') {
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="text-blue-600">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  }
                  @case ('xp') {
                    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" class="text-amber-500">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  }
                  @case ('streak') {
                    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" class="text-orange-500">
                      <path d="M12 23c-4.97 0-9-4.03-9-9 0-4.66 3.63-8.8 7.39-12.08a1 1 0 0 1 1.48.21C12.82 3.51 14 5.3 14 7.2c0 .99-.32 1.93-.88 2.7 1.41-.66 2.5-1.74 3.06-3.14a1 1 0 0 1 1.77-.18C19.78 9.5 21 12.3 21 14c0 4.97-4.03 9-9 9z" />
                    </svg>
                  }
                  @case ('level') {
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="text-purple-600">
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                      <path d="M6 12v5c3 3 9 3 12 0v-5" />
                    </svg>
                  }
                }
              </div>
            </div>
            <div class="flex items-baseline gap-1 mt-1">
              <span class="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">{{ s.value }}</span>
              <span class="text-xs font-medium text-slate-400">{{ s.unit }}</span>
            </div>
          </div>
        }
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-7">
        <!-- Main 2-column area -->
        <div class="lg:col-span-2 space-y-7">
          <!-- Quick Practice Shortcuts -->
          <div>
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-base font-bold text-slate-900 tracking-tight">Luyện tập mục tiêu</h2>
              <span class="text-xs text-slate-400">Chọn chế độ học phù hợp hôm nay</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              @for (s of shortcuts; track s.id) {
                <button
                  class="card-interactive p-5 flex flex-col justify-between gap-4 text-left border border-slate-200/80 bg-white"
                  (click)="appState.go(s.id)"
                >
                  <div class="flex items-start justify-between">
                    <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xs" [ngClass]="s.gradientFrom">
                      @switch (s.id) {
                        @case ('ai-coach') {
                          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="22" />
                          </svg>
                        }
                        @case ('scenarios') {
                          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            <circle cx="9" cy="10" r="1" fill="currentColor" />
                            <circle cx="15" cy="10" r="1" fill="currentColor" />
                          </svg>
                        }
                        @case ('achievements') {
                          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="8" r="6" />
                            <path d="M18 4H6v7a6 6 0 0 0 12 0V4z" />
                          </svg>
                        }
                        @case ('progress') {
                          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                          </svg>
                        }
                      }
                    </div>
                    <span class="text-[11px] font-bold px-2.5 py-1 rounded-full" [ngClass]="s.badgeColor">
                      {{ s.badge }}
                    </span>
                  </div>
                  <div>
                    <div class="font-bold text-base text-slate-900 group-hover:text-blue-600 transition-colors">{{ s.label }}</div>
                    <div class="text-xs text-slate-500 mt-1 leading-relaxed">{{ s.desc }}</div>
                  </div>
                </button>
              }
            </div>
          </div>

          <!-- Skills breakdown overview (5 CEFR Pillars) -->
          <div class="card p-6">
            <div class="flex items-center justify-between mb-6">
              <div>
                <h2 class="font-bold text-base text-slate-900 tracking-tight">Kỹ năng giao tiếp</h2>
                <p class="text-xs text-slate-500 mt-0.5">5 trụ cột cốt lõi theo khung CEFR</p>
              </div>
              <button
                class="text-xs sm:text-sm font-semibold cursor-pointer flex items-center gap-1.5 text-blue-600 hover:text-blue-800 transition-colors"
                (click)="appState.go('progress')"
              >
                <span>Chẩn đoán chi tiết</span>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
            <div class="space-y-4">
              @for (s of skills(); track (s.key || s.skill || s.label || $index)) {
                <div>
                  <div class="flex items-center justify-between mb-1.5">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-semibold text-slate-700">{{ s.label }}</span>
                      @if (s.isReference) {
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          tham khảo
                        </span>
                      }
                    </div>
                    <span class="text-sm font-bold" [style.color]="s.color">
                      {{ (s.score !== null && s.score !== undefined) ? s.score : ((s.value !== null && s.value !== undefined) ? s.value : 'N/A') }}
                    </span>
                  </div>
                  <div class="progress-bar h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      class="progress-bar-fill h-2.5 rounded-full transition-all duration-500"
                      [style.width.%]="(s.score ?? s.value ?? 0)"
                      [style.background]="s.color"
                    ></div>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Recent sessions -->
          <div class="card p-6">
            <div class="flex items-center justify-between mb-5">
              <h2 class="font-bold text-base text-slate-900 tracking-tight">Buổi luyện gần đây</h2>
              <button
                class="text-xs sm:text-sm font-semibold cursor-pointer text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
                (click)="appState.go('progress')"
              >
                <span>Xem tất cả</span>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
            <div class="space-y-3">
              @if (recentSessions().length === 0) {
                <div class="p-8 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200">
                  <div class="w-10 h-10 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    </svg>
                  </div>
                  <div class="text-sm font-medium text-slate-700">Chưa có buổi luyện nào</div>
                  <div class="text-xs text-slate-400 mt-1">Bắt đầu ngay hôm nay để nhận phản hồi phân tích chi tiết!</div>
                </div>
              } @else {
                @for (s of recentSessions(); track s.id) {
                  <div class="flex items-center gap-4 p-4 rounded-2xl bg-slate-50/70 hover:bg-slate-100/80 transition-colors border border-slate-100">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" [ngClass]="s.type === 'COACH' ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'">
                      @if (s.type === 'COACH') {
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        </svg>
                      } @else {
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      }
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold text-sm truncate text-slate-900">{{ s.topic }}</div>
                      <div class="text-xs text-slate-400 mt-0.5">{{ formatDate(s.date) }} · {{ s.durationDisplay }}</div>
                    </div>
                    <div class="text-right shrink-0">
                      <div class="font-bold text-sm" [style.color]="(s.score ?? 0) >= 70 ? '#10B981' : '#F59E0B'">
                        {{ s.score !== null ? s.score + '/100' : 'N/A' }}
                      </div>
                      <div class="text-[11px] text-slate-400 font-medium">điểm CEFR</div>
                    </div>
                  </div>
                }
              }
            </div>
          </div>
        </div>

        <!-- Sidebar column: Daily missions & Motivational Card -->
        <div class="space-y-6">
          <!-- Daily Missions Quest Box -->
          <div class="card p-6">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                </div>
                <h2 class="font-bold text-base text-slate-900 tracking-tight">Nhiệm vụ hôm nay</h2>
              </div>
              <span class="badge text-[11px] font-bold px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200/60">
                Rương +100 XP
              </span>
            </div>

            <!-- Daily Treasure Chest Bar -->
            <div class="p-3.5 rounded-2xl mb-4 bg-gradient-to-br from-slate-50 to-blue-50/50 border border-blue-100">
              <div class="flex justify-between items-center text-xs mb-2">
                <span class="font-semibold text-slate-700 flex items-center gap-1.5">
                  <span>{{ missionsCompletedCount() === missions().length && missions().length > 0 ? 'Đã mở Rương Ngày!' : 'Tiến độ Rương Ngày:' }}</span>
                  <span class="text-blue-700 font-bold">{{ missionsCompletedCount() }}/{{ missions().length }} hoàn thành</span>
                </span>
                <span class="font-extrabold text-amber-600">{{ missionsProgressPct() }}%</span>
              </div>
              <div class="progress-bar h-2.5 bg-slate-200/80 rounded-full overflow-hidden">
                <div
                  class="progress-bar-fill h-2.5 rounded-full transition-all duration-500 bg-gradient-to-r from-amber-500 to-emerald-500"
                  [style.width.%]="missionsProgressPct()"
                ></div>
              </div>
            </div>

            <!-- Quest List -->
            <div class="space-y-3">
              @for (m of missions(); track m.id) {
                <div
                  class="p-3.5 rounded-2xl border transition-all flex items-center gap-3"
                  [class.border-emerald-200]="m.status === 'CLAIMED'"
                  [class.bg-emerald-50]="m.status === 'CLAIMED'"
                  [class.border-amber-200]="m.status === 'COMPLETED'"
                  [class.bg-amber-50]="m.status === 'COMPLETED'"
                  [class.border-slate-200]="m.status !== 'CLAIMED' && m.status !== 'COMPLETED'"
                  [class.bg-white]="m.status !== 'CLAIMED' && m.status !== 'COMPLETED'"
                >
                  <div
                    class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
                    [class.bg-emerald-100]="m.status === 'CLAIMED'"
                    [class.text-emerald-700]="m.status === 'CLAIMED'"
                    [class.bg-amber-100]="m.status === 'COMPLETED'"
                    [class.text-amber-700]="m.status === 'COMPLETED'"
                    [class.bg-blue-50]="m.status !== 'CLAIMED' && m.status !== 'COMPLETED'"
                    [class.text-blue-600]="m.status !== 'CLAIMED' && m.status !== 'COMPLETED'"
                  >
                    @if (m.status === 'CLAIMED') {
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    } @else {
                      @switch (m.conditionType) {
                        @case ('COACH') {
                          <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          </svg>
                        }
                        @case ('SCENARIO') {
                          <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                        }
                        @default {
                          <svg width="17" height="17" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 23c-4.97 0-9-4.03-9-9 0-4.66 3.63-8.8 7.39-12.08a1 1 0 0 1 1.48.21C12.82 3.51 14 5.3 14 7.2c0 .99-.32 1.93-.88 2.7 1.41-.66 2.5-1.74 3.06-3.14a1 1 0 0 1 1.77-.18C19.78 9.5 21 12.3 21 14c0 4.97-4.03 9-9 9z" />
                          </svg>
                        }
                      }
                    }
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5">
                      <span
                        class="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                        [ngClass]="m.conditionType === 'COACH' ? 'bg-blue-50 text-blue-700' : m.conditionType === 'SCENARIO' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'"
                      >
                        {{ m.conditionType === 'COACH' ? 'AI Coach' : m.conditionType === 'SCENARIO' ? 'Tình huống' : 'Chuỗi ngày' }}
                      </span>
                      <span class="text-xs font-bold text-amber-600">+{{ m.xp }} XP</span>
                    </div>
                    <div
                      class="text-xs font-semibold truncate"
                      [class.line-through]="m.status === 'CLAIMED'"
                      [class.text-slate-400]="m.status === 'CLAIMED'"
                      [class.text-slate-800]="m.status !== 'CLAIMED'"
                    >
                      {{ m.title }}
                    </div>
                  </div>

                  @if (m.status === 'COMPLETED') {
                    <button
                      type="button"
                      class="px-3 py-1.5 text-xs font-bold rounded-xl text-white cursor-pointer bg-emerald-600 hover:bg-emerald-700 shadow-sm shrink-0 active:scale-95 transition-all"
                      (click)="claimMission(m)"
                    >
                      Nhận XP
                    </button>
                  } @else if (m.status === 'CLAIMED') {
                    <span class="text-xs font-bold text-emerald-600 shrink-0">Đã nhận</span>
                  } @else {
                    <button
                      type="button"
                      class="px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer text-blue-700 bg-blue-50 hover:bg-blue-100 shrink-0 transition-colors border border-blue-100"
                      (click)="goToMissionAction(m.conditionType)"
                    >
                      Luyện ngay
                    </button>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Motivational Box -->
          <div class="p-6 rounded-3xl text-white relative overflow-hidden bg-gradient-to-br from-blue-700 to-indigo-700 shadow-md">
            <div class="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none"></div>
            <div class="relative z-10">
              <div class="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center mb-3">
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                  <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                  <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                </svg>
              </div>
              <div class="font-extrabold text-base mb-1">
                {{ motivationalCard()?.title || ('Cố lên, ' + displayName() + '!') }}
              </div>
              <p class="text-xs text-blue-100 leading-relaxed mb-4">
                {{ motivationalCard()?.message || 'Luyện tập đều đặn mỗi ngày để xây dựng phản xạ tự nhiên và thăng hạng CEFR!' }}
              </p>
              <button
                class="w-full justify-center text-sm font-bold py-2.5 rounded-xl cursor-pointer bg-white text-blue-700 hover:bg-blue-50 transition-colors shadow-xs active:scale-98"
                (click)="appState.go('ai-coach')"
              >
                {{ motivationalCard()?.actionText || 'Bắt đầu ngay hôm nay' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  readonly appState = inject(AppStateService);
  private readonly authService = inject(AuthService);
  private readonly gamificationService = inject(GamificationService);

  readonly dashboardData = signal<DashboardResponse | null>(null);

  readonly displayName = computed(() => {
    return this.authService.currentUser()?.fullName ?? this.appState.appUser().name ?? 'bạn';
  });

  readonly currentStreak = computed(() => {
    return this.dashboardData()?.currentStreak ?? this.dashboardData()?.streak ?? this.appState.currentStreak() ?? 0;
  });

  readonly missions = computed(() => {
    return this.dashboardData()?.todayMissions ?? [];
  });

  readonly skills = computed(() => {
    return this.dashboardData()?.skills ?? [
      { key: 'fluency', skill: 'fluency', label: 'Độ trôi chảy', score: null, value: null, color: '#2563EB', isReference: false },
      { key: 'vocabulary', skill: 'vocabulary', label: 'Vốn từ vựng', score: null, value: null, color: '#059669', isReference: false },
      { key: 'grammar', skill: 'grammar', label: 'Ngữ pháp', score: null, value: null, color: '#7C3AED', isReference: false },
      { key: 'pronunciation', skill: 'pronunciation', label: 'Phát âm', score: null, value: null, color: '#E11D48', isReference: true },
      { key: 'interaction', skill: 'interaction', label: 'Tương tác & Phản xạ', score: null, value: null, color: '#D97706', isReference: false },
    ];
  });

  readonly recentSessions = computed(() => {
    return this.dashboardData()?.recentSessions ?? [];
  });

  readonly motivationalCard = computed(() => {
    return this.dashboardData()?.motivationalCard ?? null;
  });

  readonly missionsCompletedCount = computed(() => {
    return this.missions().filter(m => m.status === 'COMPLETED' || m.status === 'CLAIMED').length;
  });

  readonly missionsProgressPct = computed(() => {
    const total = this.missions().length;
    if (!total) return 0;
    return Math.round((this.missionsCompletedCount() / total) * 100);
  });

  readonly shortcuts: Shortcut[] = [
    {
      id: 'ai-coach',
      label: 'AI Coach 1-1',
      desc: 'Hội thoại phản xạ tự nhiên cùng Coach Alex',
      badge: 'Phổ biến',
      badgeColor: 'bg-blue-100 text-blue-700',
      gradientFrom: 'bg-gradient-to-tr from-blue-600 to-indigo-600',
      gradientTo: ''
    },
    {
      id: 'scenarios',
      label: 'Tình huống giao tiếp',
      desc: 'Luyện kịch bản đời thực theo phương pháp Chunking',
      badge: '20 tình huống',
      badgeColor: 'bg-rose-100 text-rose-700',
      gradientFrom: 'bg-gradient-to-tr from-rose-500 to-pink-600',
      gradientTo: ''
    },
    {
      id: 'achievements',
      label: 'Thành tích & Huy hiệu',
      desc: 'Mở khóa huy hiệu và theo dõi sổ cái XP',
      badge: 'Gamification',
      badgeColor: 'bg-amber-100 text-amber-700',
      gradientFrom: 'bg-gradient-to-tr from-amber-500 to-orange-500',
      gradientTo: ''
    },
    {
      id: 'progress',
      label: 'Tiến độ & Chẩn đoán',
      desc: 'Biểu đồ phân tích 5 trụ cột kỹ năng CEFR',
      badge: 'Phân tích AI',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      gradientFrom: 'bg-gradient-to-tr from-emerald-500 to-teal-600',
      gradientTo: ''
    }
  ];

  readonly statsList = computed(() => {
    const data = this.dashboardData();
    const overall = data?.overallScore !== null && data?.overallScore !== undefined ? String(data.overallScore) : 'N/A';
    const xpVal = data?.totalXp ?? data?.xp ?? this.appState.totalXp() ?? 0;
    const totalXp = Number(xpVal).toLocaleString();
    const streakVal = data?.currentStreak ?? data?.streak ?? this.appState.currentStreak() ?? 0;
    const streak = String(streakVal);
    const level = data?.level || this.appState.appUser().level || 'A1';

    return [
      { key: 'score', label: 'Điểm giao tiếp', value: overall, unit: overall === 'N/A' ? '' : '/100', bgClass: 'bg-blue-50' },
      { key: 'xp', label: 'XP tích lũy', value: totalXp, unit: ' XP', bgClass: 'bg-amber-50' },
      { key: 'streak', label: 'Chuỗi Streak', value: streak, unit: ' ngày', bgClass: 'bg-orange-50' },
      { key: 'level', label: 'Cấp độ CEFR', value: level, unit: '', bgClass: 'bg-purple-50' }
    ];
  });

  readonly todayFormatted = computed(() => {
    const now = new Date();
    return formatDDMMYYYY(now.toISOString());
  });

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    if (!this.authService.isAuthenticated()) return;
    this.gamificationService.getDashboard().subscribe({
      next: (data) => {
        this.dashboardData.set(data);
        const xp = data.totalXp ?? data.xp ?? 0;
        const streak = data.currentStreak ?? data.streak ?? 0;
        this.appState.updateGamification(xp, streak, data.level);
      }
    });
  }

  claimMission(mission: DailyMissionItem): void {
    this.gamificationService.claimMission(mission.id).subscribe({
      next: (res) => {
        this.dashboardData.update(d => {
          if (!d) return d;
          return {
            ...d,
            totalXp: res.newTotalXp,
            todayMissions: d.todayMissions.map(m => m.id === mission.id ? { ...m, status: 'CLAIMED', isClaimed: true } : m),
          };
        });
        this.appState.updateGamification(res.newTotalXp, this.currentStreak());
      }
    });
  }

  getMissionIcon(type: string): string {
    switch (type) {
      case 'AI_COACH': return '🎙️';
      case 'SCENARIO': return '🎭';
      case 'STREAK': return '🔥';
      default: return '🎯';
    }
  }

  goToMissionAction(type: string): void {
    switch (type) {
      case 'AI_COACH': this.appState.go('ai-coach'); break;
      case 'SCENARIO': this.appState.go('scenarios'); break;
      case 'STREAK': this.appState.go('ai-coach'); break;
      default: this.appState.go('ai-coach'); break;
    }
  }

  formatDate(dateStr: string | null | undefined): string {
    return formatDDMMYYYY(dateStr);
  }
}
