import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatDDMMYYYY } from '../../core/utils/date.utils';
import { AppStateService } from '../../core/services/app-state.service';
import { AuthService } from '../../core/services/auth.service';
import { GamificationService } from '../../core/services/gamification.service';
import {
  ProgressSummaryResponse,
  ProgressSkillItem,
  ProgressHistoryItem,
  GamificationSummaryResponse,
} from '../../core/models/gamification.models';

export interface MilestoneItem {
  id: number;
  title: string;
  description: string;
  type: 'COACH' | 'SCENARIO' | 'CHALLENGE';
}

export interface StageItem {
  level: string;
  name: string;
  description: string;
  minScore: number;
  milestones: MilestoneItem[];
}

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Tiến độ học tập & Kỹ năng</h1>
          <p class="text-sm text-slate-500 mt-1">Chẩn đoán 5 trụ cột ngôn ngữ, lịch sử luyện nói và lộ trình 25 mốc CEFR.</p>
        </div>
      </div>

      <!-- Overall Score Banner -->
      <div class="card p-6 border border-slate-200/80 shadow-xs bg-white">
        <div class="flex items-center justify-between flex-wrap gap-6">
          <div>
            <div class="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Điểm giao tiếp tổng hợp</div>
            <div class="text-4xl font-extrabold text-[#286FB4]">
              {{ overallDisplay() }}<span class="text-xl text-slate-400 font-semibold">{{ overallDisplay() !== 'N/A' ? ' / 100' : '' }}</span>
            </div>
            <div class="flex items-center gap-2 mt-1.5">
              @if (scoreChange30d() !== null) {
                <span class="text-xs font-bold inline-flex items-center gap-1" [style.color]="scoreChange30d()! >= 0 ? '#16a34a' : '#dc2626'">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="scoreChange30d()! >= 0 ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'" />
                  </svg>
                  <span>{{ scoreChange30d()! >= 0 ? '+' + scoreChange30d() : scoreChange30d() }} trong 30 ngày qua</span>
                </span>
              } @else {
                <span class="text-slate-400 text-xs">Cần thêm buổi luyện để tính xu hướng</span>
              }
            </div>
          </div>

          <div class="grid grid-cols-3 gap-6 text-center border-l border-slate-100 pl-6">
            @for (m of metrics(); track m.label) {
              <div>
                <div class="text-lg font-bold text-slate-800">{{ m.val }}</div>
                <div class="text-xs text-slate-400 mt-0.5">{{ m.label }}</div>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Tab Buttons -->
      <div class="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        <button
          type="button"
          class="inline-flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer border-0 bg-transparent shrink-0"
          [style.borderColor]="tab() === 'skills' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'skills' ? '#286FB4' : '#64748b'"
          (click)="tab.set('skills')"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span>Chẩn đoán kỹ năng</span>
        </button>

        <button
          type="button"
          class="inline-flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer border-0 bg-transparent shrink-0"
          [style.borderColor]="tab() === 'history' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'history' ? '#286FB4' : '#64748b'"
          (click)="tab.set('history')"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Lịch sử hoạt động</span>
        </button>

        <button
          type="button"
          class="inline-flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer border-0 bg-transparent shrink-0"
          [style.borderColor]="tab() === 'roadmap' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'roadmap' ? '#286FB4' : '#64748b'"
          (click)="tab.set('roadmap')"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <span>Lộ trình 25 mốc CEFR</span>
        </button>
      </div>

      <!-- SKILLS TAB -->
      @if (tab() === 'skills') {
        <div class="space-y-6">
          <!-- Top Diagnostic Insights Header -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Top Skill -->
            <div class="card p-5 border border-emerald-200 bg-emerald-50/50 shadow-xs">
              <div class="flex items-center gap-2 mb-1">
                <div class="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                </div>
                <span class="text-xs font-bold text-emerald-800 uppercase tracking-wide">Kỹ năng nổi trội nhất</span>
              </div>
              <div class="text-base font-extrabold text-emerald-950 mt-1">
                {{ topSkill()?.label || 'Chưa đủ dữ liệu' }}
              </div>
              <div class="text-xs text-emerald-700 mt-1">
                {{ topSkill()?.current !== null ? (topSkill()?.current + '/100 · CEFR ' + getCefrBand(topSkill()?.current ?? null)) : 'Cần thêm 1 buổi luyện' }}
              </div>
            </div>

            <!-- Focus Skill -->
            <div class="card p-5 border border-amber-200 bg-amber-50/50 shadow-xs">
              <div class="flex items-center gap-2 mb-1">
                <div class="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                </div>
                <span class="text-xs font-bold text-amber-800 uppercase tracking-wide">Trọng tâm cần bứt phá</span>
              </div>
              <div class="text-base font-extrabold text-amber-950 mt-1">
                {{ focusSkill()?.label || 'Chưa đủ dữ liệu' }}
              </div>
              <div class="text-xs text-amber-700 mt-1">
                {{ focusSkill()?.current !== null ? (focusSkill()?.current + '/100 · Ưu tiên rèn luyện') : 'Cần thêm 1 buổi luyện' }}
              </div>
            </div>

            <!-- Balance Score -->
            <div class="card p-5 border border-sky-200 bg-sky-50/40 shadow-xs">
              <div class="flex items-center gap-2 mb-1">
                <div class="w-6 h-6 rounded-md bg-sky-100 text-[#286FB4] flex items-center justify-center">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                </div>
                <span class="text-xs font-bold text-sky-800 uppercase tracking-wide">Cân bằng giao tiếp</span>
              </div>
              <div class="text-base font-extrabold text-sky-950 mt-1">
                {{ skillsBalanceScore() }}% Đồng đều
              </div>
              <div class="text-xs text-sky-700 mt-1">
                Phát triển hài hòa cả 5 trụ cột ngôn ngữ
              </div>
            </div>
          </div>

          <!-- In-depth Diagnostic Skill Cards -->
          <div class="space-y-4">
            @for (s of skills(); track (s.key || $index)) {
              <div class="card p-6 border border-slate-200/80 shadow-xs hover:border-sky-300 transition-all bg-white">
                <!-- Top Row -->
                <div class="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" [style.background]="s.color + '18'" [style.color]="s.color">
                      @if (s.key === 'fluency') {
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      } @else if (s.key === 'vocabulary') {
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      } @else if (s.key === 'grammar') {
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      } @else if (s.key === 'pronunciation') {
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                        </svg>
                      } @else {
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      }
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <h3 class="font-extrabold text-lg text-slate-800">{{ s.label }}</h3>
                        @if (s.isReference) {
                          <span class="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-600 border border-slate-200">Tham khảo</span>
                        }
                        <span
                          class="badge font-bold text-xs px-2.5 py-0.5"
                          [style.background]="s.status === 'Tốt' ? '#DCFCE7' : s.status === 'Đang phát triển' ? '#FEF3C7' : '#FEE2E2'"
                          [style.color]="s.status === 'Tốt' ? '#166534' : s.status === 'Đang phát triển' ? '#92400e' : '#991b1b'"
                        >
                          {{ s.status }}
                        </span>
                      </div>
                      <div class="text-xs text-slate-500 mt-0.5">{{ s.desc }}</div>
                    </div>
                  </div>

                  <!-- Scores & Trends -->
                  <div class="flex items-center gap-4 text-right">
                    <div>
                      <div class="text-2xl font-extrabold" [style.color]="s.color">
                        {{ s.current !== null ? s.current : 'N/A' }}<span class="text-sm text-slate-400">/100</span>
                      </div>
                      <div class="text-[11px] font-semibold" [style.color]="(s.diff ?? 0) >= 0 ? '#16a34a' : '#dc2626'">
                        @if (s.diff !== null) {
                          {{ s.diff >= 0 ? '↑ +' + s.diff : '↓ ' + s.diff }} (30 ngày)
                        } @else {
                          <span class="text-slate-400">Trước: {{ s.prev !== null ? s.prev : 'N/A' }}</span>
                        }
                      </div>
                    </div>
                  </div>
                </div>

                <!-- CEFR Visual Benchmark Track -->
                <div class="mb-4 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <div class="flex justify-between items-center text-[11px] text-slate-500 font-semibold mb-1.5">
                    <span>Thang đo chuẩn CEFR:</span>
                    <span class="font-bold text-slate-800">Trình độ tương đương: {{ getCefrBand(s.current) }}</span>
                  </div>
                  <div class="relative h-2.5 bg-slate-200 rounded-full overflow-hidden mb-1.5">
                    <div class="absolute inset-0 grid grid-cols-5 divide-x divide-white/50 pointer-events-none opacity-40">
                      <div class="h-full"></div>
                      <div class="h-full"></div>
                      <div class="h-full"></div>
                      <div class="h-full"></div>
                      <div class="h-full"></div>
                    </div>
                    <div
                      class="h-2.5 rounded-full transition-all duration-700"
                      [style.width.%]="s.current ?? 0"
                      [style.background]="s.color"
                    ></div>
                  </div>
                  <div class="flex justify-between text-[10px] text-slate-400 font-medium">
                    <span>A1 (0-39)</span>
                    <span>A2 (40-54)</span>
                    <span>B1 (55-69)</span>
                    <span>B2 (70-84)</span>
                    <span>C1 (85-100)</span>
                  </div>
                </div>

                <!-- Pedagogical Diagnostic & Strategy Block -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-4">
                  <div class="p-3.5 rounded-xl bg-sky-50/70 border border-sky-100 text-sky-950">
                    <div class="font-bold text-sky-900 mb-1 flex items-center gap-1.5">
                      <svg class="w-4 h-4 text-sky-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span>Tiêu chí AI đánh giá</span>
                    </div>
                    <p class="leading-relaxed text-sky-900/80">
                      {{ getPedagogy(s.key).aiMetric }}
                    </p>
                  </div>

                  <div class="p-3.5 rounded-xl bg-amber-50/70 border border-amber-100 text-amber-950">
                    <div class="font-bold text-amber-900 mb-1 flex items-center gap-1.5">
                      <svg class="w-4 h-4 text-amber-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Chiến lược bứt phá</span>
                    </div>
                    <p class="leading-relaxed text-amber-900/80">
                      {{ getPedagogy(s.key).strategy }}
                    </p>
                  </div>
                </div>

                <!-- Action Button -->
                <div class="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    class="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer border-0 flex items-center gap-1.5 text-white shadow-xs transition-all hover:opacity-95"
                    [style.background]="s.color"
                    (click)="practiceSkill(s.key)"
                  >
                    <span>{{ getPedagogy(s.key).actionBtn }}</span>
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- HISTORY TAB -->
      @if (tab() === 'history') {
        <div class="space-y-3">
          @if (historyItems().length === 0) {
            <div class="card p-10 text-center text-sm text-slate-400 bg-white border border-slate-200">
              Chưa có phiên luyện tập nào được ghi nhận.
            </div>
          } @else {
            @for (s of historyItems(); track s.id) {
              <div class="card p-4 sm:p-5 flex items-center gap-4 bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
                <div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-sky-50 text-[#286FB4] border border-sky-100">
                  @if (s.type === 'COACH') {
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                    </svg>
                  } @else {
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  }
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-bold text-sm text-slate-800 truncate">{{ s.topic }}</div>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-xs text-slate-400">{{ formatDate(s.date) }} · {{ s.durationDisplay }}</span>
                    <span class="badge text-[11px] px-2 py-0.5 rounded-full font-semibold bg-sky-50 text-[#286FB4] border border-sky-100">
                      {{ s.type === 'COACH' ? 'AI Coach' : 'Tình huống' }}
                    </span>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <div class="font-extrabold text-base" [style.color]="(s.score ?? 0) >= 70 ? '#16a34a' : '#d97706'">
                    {{ s.score !== null ? s.score + '/100' : 'N/A' }}
                  </div>
                  <div class="text-xs text-slate-400">điểm giao tiếp</div>
                </div>
              </div>
            }

            @if (historyHasMore()) {
              <button
                type="button"
                class="w-full py-3 rounded-xl font-bold text-sm cursor-pointer border-0 bg-sky-50 text-[#286FB4] hover:bg-sky-100 transition"
                (click)="loadMoreHistory()"
              >
                Tải thêm lịch sử
              </button>
            }
          }
        </div>
      }

      <!-- ROADMAP TAB: 25-Milestone CEFR Learning Journey -->
      @if (tab() === 'roadmap') {
        <div class="space-y-6">
          <!-- Journey Overview Header -->
          <div class="card p-5 border border-slate-200/80 shadow-xs bg-white">
            <div class="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="text-base font-bold text-slate-900">Lộ trình 25 cột mốc chinh phục CEFR</h2>
                  <span class="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                    Trình độ hiện tại: Level {{ currentLevel() }}
                  </span>
                </div>
                <p class="text-xs text-slate-500 mt-0.5">
                  Mỗi cấp độ CEFR gồm 5 mốc thử thách thực tế từ cơ bản đến nâng cao.
                </p>
              </div>

              <!-- Active Milestone Progress Badge -->
              <div class="bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 text-right">
                <div class="text-[11px] text-slate-500 font-medium">Tiến độ lộ trình</div>
                <div class="text-sm font-bold text-slate-800">{{ completedMilestonesCount() }} / 25 mốc hoàn thành</div>
              </div>
            </div>
          </div>

          <!-- Active Advancement Checklist -->
          @if (advancementInfo(); as adv) {
            <div class="card p-5 border border-sky-200 shadow-xs bg-white">
              <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded-md bg-sky-50 text-[#286FB4] flex items-center justify-center">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="6" />
                      <circle cx="12" cy="12" r="2" />
                    </svg>
                  </div>
                  <h3 class="font-bold text-sm text-slate-900">
                    Điều kiện để bứt phá lên Level {{ adv.targetLevel || 'C1' }}
                  </h3>
                </div>
                <span
                  class="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                  [style.background]="adv.allMet ? '#DCFCE7' : '#FEF3C7'"
                  [style.color]="adv.allMet ? '#166534' : '#92400e'"
                >
                  {{ adv.allMet ? 'Đủ điều kiện thăng cấp' : 'Đang phấn đấu' }}
                </span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                @for (cond of adv.conditions; track cond.label) {
                  <div class="p-3 rounded-lg border bg-slate-50 flex items-center justify-between" style="border-color: #E2E8F0">
                    <div>
                      <div class="text-[11px] text-slate-500 font-medium">{{ cond.label }}</div>
                      <div class="text-xs font-bold text-slate-800 mt-0.5">
                        {{ cond.current }} / {{ cond.target }} {{ cond.unit }}
                      </div>
                    </div>
                    @if (cond.met) {
                      <div class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    } @else {
                      <div class="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          }

          <!-- 5 CEFR Stages with 5 Checkpoints Each (25 Total) -->
          <div class="space-y-6">
            @for (stage of stages; track stage.level) {
              <div class="card p-5 border border-slate-200/80 shadow-xs bg-white">
                <!-- Stage Header -->
                <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 flex-wrap gap-2">
                  <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white" style="background: #286FB4">
                      {{ stage.level }}
                    </span>
                    <div>
                      <h3 class="font-bold text-sm text-slate-900">{{ stage.name }}</h3>
                      <p class="text-xs text-slate-500">{{ stage.description }} · Yêu cầu điểm TB: ≥ {{ stage.minScore }}</p>
                    </div>
                  </div>
                  <span
                    class="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                    [style.background]="isLevelAchieved(stage.level) ? '#DCFCE7' : isCurrentLevel(stage.level) ? '#E2F0F9' : '#F1F5F9'"
                    [style.color]="isLevelAchieved(stage.level) ? '#166534' : isCurrentLevel(stage.level) ? '#286FB4' : '#64748b'"
                  >
                    {{ isLevelAchieved(stage.level) ? 'Đã chinh phục' : isCurrentLevel(stage.level) ? 'Đang thực hiện' : 'Chưa mở khóa' }}
                  </span>
                </div>

                <!-- 5 Granular Checkpoints List -->
                <div class="space-y-2.5">
                  @for (m of stage.milestones; track m.id) {
                    <div
                      class="p-3.5 rounded-xl border flex items-center gap-3 transition-all"
                      [style.borderColor]="getMilestoneStatus(m.id) === 'current' ? '#286FB4' : '#E2E8F0'"
                      [style.background]="getMilestoneStatus(m.id) === 'current' ? '#F8FBFE' : getMilestoneStatus(m.id) === 'conquered' ? '#FFFFFF' : '#FAFAFA'"
                    >
                      <!-- Milestone Number Circle -->
                      <div
                        class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        [style.background]="getMilestoneStatus(m.id) === 'conquered' ? '#DCFCE7' : getMilestoneStatus(m.id) === 'current' ? '#286FB4' : '#E2E8F0'"
                        [style.color]="getMilestoneStatus(m.id) === 'conquered' ? '#166534' : getMilestoneStatus(m.id) === 'current' ? '#FFFFFF' : '#64748b'"
                      >
                        @if (getMilestoneStatus(m.id) === 'conquered') {
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        } @else {
                          {{ m.id }}
                        }
                      </div>

                      <!-- Details -->
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-semibold text-slate-800">{{ m.title }}</span>
                          <span class="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-600 inline-flex items-center gap-1">
                            @if (m.type === 'COACH') {
                              <svg class="w-3 h-3 text-[#286FB4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                              </svg>
                              <span>AI Coach</span>
                            } @else if (m.type === 'SCENARIO') {
                              <svg class="w-3 h-3 text-[#286FB4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              <span>Tình huống</span>
                            } @else {
                              <svg class="w-3 h-3 text-[#286FB4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10" />
                                <circle cx="12" cy="12" r="6" />
                              </svg>
                              <span>Thử thách</span>
                            }
                          </span>
                        </div>
                        <p class="text-xs text-slate-500 truncate mt-0.5">{{ m.description }}</p>
                      </div>

                      <!-- Status & CTA -->
                      <div class="shrink-0 text-right">
                        @if (getMilestoneStatus(m.id) === 'conquered') {
                          <span class="text-xs text-emerald-600 font-bold inline-flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Đã đạt</span>
                          </span>
                        } @else if (getMilestoneStatus(m.id) === 'current') {
                          <button
                            type="button"
                            class="btn-primary text-xs px-3 py-1.5 rounded-lg cursor-pointer border-0 shadow-xs inline-flex items-center gap-1"
                            (click)="practiceMilestone(m)"
                          >
                            <span>Luyện ngay</span>
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        } @else {
                          <span class="text-xs text-slate-400 inline-flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                            </svg>
                            <span>Khóa</span>
                          </span>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
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

  readonly stages: StageItem[] = [
    {
      level: 'A1',
      name: 'Nhập Môn & Giao Tiếp Sinh Tồn',
      description: 'Cụm từ cơ bản, chào hỏi và phản xạ hàng ngày',
      minScore: 0,
      milestones: [
        { id: 1, title: 'Chào hỏi & Làm quen', description: 'Làm chủ các câu chào, hỏi thăm và giới thiệu bản thân cơ bản.', type: 'COACH' },
        { id: 2, title: 'Nghề nghiệp & Gia đình', description: 'Nói về công việc, sở thích đơn giản và người thân trong gia đình.', type: 'COACH' },
        { id: 3, title: 'Mua sắm & Hỏi giá tiền', description: 'Hỏi giá, kích cỡ và cách thanh toán trong cửa hàng tiện lợi.', type: 'SCENARIO' },
        { id: 4, title: 'Gọi món tại nhà hàng', description: 'Xem menu, gọi món ăn, đồ uống và yêu cầu thanh toán hóa đơn.', type: 'SCENARIO' },
        { id: 5, title: 'Thử thách: Vượt ải A1', description: 'Hội thoại tổng hợp 5 lượt nói liên tục không ngắt quãng.', type: 'CHALLENGE' },
      ],
    },
    {
      level: 'A2',
      name: 'Giao Tiếp Đời Sống Thường Nhật',
      description: 'Hỏi đường, du lịch, sinh hoạt và cảm xúc quen thuộc',
      minScore: 40,
      milestones: [
        { id: 6, title: 'Hỏi đường & Di chuyển', description: 'Hỏi đường đến ga tàu, bắt taxi và mô tả vị trí trong thành phố.', type: 'SCENARIO' },
        { id: 7, title: 'Đặt phòng khách sạn', description: 'Thực hiện thủ tục check-in, hỏi tiện ích và đổi phòng khi cần.', type: 'SCENARIO' },
        { id: 8, title: 'Sở thích & Hoạt động cuối tuần', description: 'Kể về kế hoạch cuối tuần, phim ảnh và các hoạt động giải trí.', type: 'COACH' },
        { id: 9, title: 'Thời tiết & Dự định du lịch', description: 'Miêu tả thời tiết các mùa và thảo luận điểm đến kỳ nghỉ.', type: 'COACH' },
        { id: 10, title: 'Thử thách: Vượt ải A2', description: 'Bài test phản xạ tình huống bất ngờ với phản hồi dưới 3 giây.', type: 'CHALLENGE' },
      ],
    },
    {
      level: 'B1',
      name: 'Giao Tiếp Độc Lập & Công Sở',
      description: 'Diễn đạt ý kiến, thảo luận công việc và quan điểm cá nhân',
      minScore: 55,
      milestones: [
        { id: 11, title: 'Họp nhóm & Báo cáo công việc', description: 'Cập nhật tiến độ dự án và trao đổi ý kiến với đồng nghiệp.', type: 'COACH' },
        { id: 12, title: 'Diễn đạt ý kiến & Thuyết phục', description: 'Nêu quan điểm đồng tình hoặc phản bác một cách lịch thiệp.', type: 'COACH' },
        { id: 13, title: 'Xử lý khiếu nại khách hàng', description: 'Lắng nghe, xoa dịu và đưa ra giải pháp thỏa đáng cho đối tác.', type: 'SCENARIO' },
        { id: 14, title: 'Thuyết trình ngắn 3 phút', description: 'Trình bày ý tưởng giải pháp mới một cách có cấu trúc rõ ràng.', type: 'COACH' },
        { id: 15, title: 'Thử thách: Chinh phục B1', description: 'Hội thoại độc lập 10 lượt nói với vốn từ vựng phong phú.', type: 'CHALLENGE' },
      ],
    },
    {
      level: 'B2',
      name: 'Lưu Loát & Tranh Biện Chuyên Sâu',
      description: 'Đàm phán kinh doanh, giải quyết vấn đề và phỏng vấn',
      minScore: 70,
      milestones: [
        { id: 16, title: 'Đàm phán & Thương lượng hợp đồng', description: 'Thương lượng giá cả, điều khoản giao hàng và thời hạn thanh toán.', type: 'SCENARIO' },
        { id: 17, title: 'Phân tích & Đề xuất giải pháp', description: 'Đào sâu nguyên nhân gốc rễ và bảo vệ giải pháp trước ban quản lý.', type: 'SCENARIO' },
        { id: 18, title: 'Tranh luận chủ đề công nghệ & Xã hội', description: 'Tranh biện về tác động của công nghệ và xu hướng làm việc linh hoạt.', type: 'COACH' },
        { id: 19, title: 'Phỏng vấn tuyển dụng chuyên sâu', description: 'Trả lời các câu hỏi hành vi theo mô hình STAR chuyên nghiệp.', type: 'COACH' },
        { id: 20, title: 'Thử thách: Làm chủ B2', description: 'Nói lưu loát tự nhiên trên 120 từ/phút không dùng từ đệm.', type: 'CHALLENGE' },
      ],
    },
    {
      level: 'C1',
      name: 'Bậc Thầy Ngôn Ngữ & Bản Ngữ',
      description: 'Diễn đạt tinh tế, sắc thái thành ngữ và lãnh đạo thảo luận',
      minScore: 85,
      milestones: [
        { id: 21, title: 'Sắc thái & Thành ngữ nâng cao', description: 'Áp dụng thành ngữ, lối nói ẩn dụ và sắc thái từ vựng tinh tế.', type: 'COACH' },
        { id: 22, title: 'Diễn thuyết truyền cảm hứng', description: 'Nghệ thuật sử dụng ngữ điệu và kết nối cảm xúc với người nghe.', type: 'COACH' },
        { id: 23, title: 'Quản trị xung đột đa văn hóa', description: 'Hòa giải bất đồng và gắn kết các quan điểm đa quốc gia.', type: 'COACH' },
        { id: 24, title: 'Tư duy phản biện sắc bén', description: 'Nhận diện ngụy biện và phản biện logic trong các vấn đề trừu tượng.', type: 'COACH' },
        { id: 25, title: 'Đỉnh Vinh Quang C1', description: 'Chạm mốc hoàn thiện mọi tiêu chuẩn CEFR Bậc thầy giao tiếp.', type: 'CHALLENGE' },
      ],
    },
  ];

  readonly summaryData = signal<ProgressSummaryResponse | null>(null);
  readonly skills = signal<ProgressSkillItem[]>([]);
  readonly historyItems = signal<ProgressHistoryItem[]>([]);
  readonly historyNextCursor = signal<string | null>(null);
  readonly historyHasMore = signal<boolean>(false);
  readonly gamificationSummary = signal<GamificationSummaryResponse | null>(null);

  readonly topSkill = computed(() => {
    const list = this.skills().filter(s => s.current !== null);
    if (!list.length) return null;
    return [...list].sort((a, b) => (b.current ?? 0) - (a.current ?? 0))[0];
  });

  readonly focusSkill = computed(() => {
    const list = this.skills().filter(s => s.current !== null);
    if (!list.length) return null;
    return [...list].sort((a, b) => (a.current ?? 0) - (b.current ?? 0))[0];
  });

  readonly skillsBalanceScore = computed(() => {
    const vals = this.skills().map(s => s.current).filter((v): v is number => v !== null);
    if (vals.length < 2) return 85;
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const diff = max - min;
    return Math.max(50, Math.round(100 - diff));
  });

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

  readonly metrics = computed(() => {
    const totalXpVal = this.summaryData()?.totalXp ?? this.appState.totalXp() ?? 0;
    const streakVal = this.summaryData()?.currentStreak ?? this.appState.currentStreak() ?? 0;
    return [
      { val: `${Number(totalXpVal).toLocaleString()} XP`, label: "Tổng XP" },
      { val: `${streakVal} ngày`, label: "Streak hiện tại" },
      { val: `Level ${this.currentLevel()}`, label: "Trình độ CEFR" }
    ];
  });

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
      next: (sum) => {
        this.gamificationSummary.set(sum);
        const xp = sum.totalXp ?? sum.xp ?? 0;
        const streak = sum.currentStreak ?? 0;
        const level = sum.currentLevel ?? sum.level ?? 'A1';
        this.appState.updateGamification(xp, streak, level);
      }
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

  getCefrBand(score: number | null): string {
    if (score === null || score === undefined) return 'Chưa xác định';
    if (score >= 85) return 'C1 (Bậc thầy)';
    if (score >= 70) return 'B2 (Nâng cao)';
    if (score >= 55) return 'B1 (Độc lập)';
    if (score >= 40) return 'A2 (Sơ cấp)';
    return 'A1 (Cơ bản)';
  }

  getPedagogy(key: string): { aiMetric: string; strategy: string; actionBtn: string } {
    switch (key) {
      case 'fluency':
        return {
          aiMetric: 'AI đo lường tốc độ nói (Words Per Minute), thời lượng khoảng lặng, khả năng duy trì câu dài liên tục từ 10-15 từ.',
          strategy: 'Thực hành nói lướt qua các lỗi nhỏ để giữ nhịp điệu tự nhiên. Dùng từ nối chuyển tiếp như "Actually", "Furthermore" để liên kết ý.',
          actionBtn: 'Luyện tốc độ phản xạ với AI Coach',
        };
      case 'vocabulary':
        return {
          aiMetric: 'AI phân tích sự phong phú từ vựng CEFR, cách dùng cụm từ cố định (collocations) và việc hạn chế lặp từ cơ bản.',
          strategy: 'Chủ động áp dụng 2-3 từ vựng mới hoặc thành ngữ trong mỗi lượt nói thay vị chỉ dùng từ vựng quen thuộc cấp A1/A2.',
          actionBtn: 'Học từ vựng qua Tình huống thực tế',
        };
      case 'grammar':
        return {
          aiMetric: 'AI đánh giá độ chuẩn xác về thì động từ, cấu trúc câu phức (mệnh đề quan hệ, câu điều kiện, câu nhượng bộ).',
          strategy: 'Tập ghép 2 câu đơn thành 1 câu phức bằng liên từ chỉ nguyên nhân - kết quả hoặc quan điểm (Although, Due to, In spite of).',
          actionBtn: 'Luyện cấu trúc câu với AI Coach',
        };
      case 'pronunciation':
        return {
          aiMetric: 'Đo lường độ khớp âm thanh (Acoustic confidence) từ mô hình STT, nhấn âm trọng âm từ và ngữ điệu câu. (Tham khảo)',
          strategy: 'Tập trung phát âm rõ các phụ âm cuối (/s/, /z/, /t/, /d/) và lên giọng ở câu hỏi nghi vấn, xuống giọng ở câu khẳng định.',
          actionBtn: 'Luyện phát âm chuẩn với AI Coach',
        };
      case 'interaction':
      default:
        return {
          aiMetric: 'AI đo độ trễ khi phản hồi (Latency), mức độ phản biện và việc chủ động đặt câu hỏi mở rộng hội thoại.',
          strategy: 'Áp dụng công thức ARE (Answer - Reason - Example) cho mọi câu trả lời để kéo dài hội thoại và thể hiện sự tự tin.',
          actionBtn: 'Luyện phản xạ tương tác với AI Coach',
        };
    }
  }

  readonly currentMilestoneId = computed(() => {
    const lvl = this.currentLevel().toUpperCase();
    const sessions = this.summaryData()?.totalSessions ?? 0;
    if (lvl === 'A1') return Math.min(5, Math.max(1, 1 + sessions));
    if (lvl === 'A2') return Math.min(10, Math.max(6, 6 + Math.floor(sessions / 2)));
    if (lvl === 'B1') return Math.min(15, Math.max(11, 11 + Math.floor(sessions / 3)));
    if (lvl === 'B2') return Math.min(20, Math.max(16, 16 + Math.floor(sessions / 4)));
    return Math.min(25, Math.max(21, 21 + Math.floor(sessions / 5)));
  });

  readonly completedMilestonesCount = computed(() => {
    return Math.max(0, this.currentMilestoneId() - 1);
  });

  getMilestoneStatus(id: number): 'conquered' | 'current' | 'locked' {
    const cur = this.currentMilestoneId();
    if (id < cur) return 'conquered';
    if (id === cur) return 'current';
    return 'locked';
  }

  practiceMilestone(m: MilestoneItem): void {
    if (m.type === 'SCENARIO') {
      this.appState.go('scenarios');
    } else {
      this.appState.go('ai-coach');
    }
  }

  practiceSkill(key: string): void {
    if (key === 'vocabulary') {
      this.appState.go('scenarios');
    } else {
      this.appState.go('ai-coach');
    }
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

  formatDate(dateStr: string | null | undefined): string {
    return formatDDMMYYYY(dateStr);
  }
}
