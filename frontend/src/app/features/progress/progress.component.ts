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
  campName: string;
  altitude: string;
  campEmoji: string;
  description: string;
  minOverall: number;
  minSessions: number;
  minScenarios: number;
  minSkill?: { name: string; score: number };
}

const ROADMAP_LEVELS: LevelRoadmapItem[] = [
  { level: 'A1', name: 'Người mới bắt đầu', campName: 'Trại Chân Núi', altitude: '1,000m', campEmoji: '🏕️', description: 'Giao tiếp cơ bản với các câu đơn giản và phản xạ sinh tồn', minOverall: 0, minSessions: 0, minScenarios: 0 },
  { level: 'A2', name: 'Sơ cấp', campName: 'Vách Đá Sơ Cấp', altitude: '2,500m', campEmoji: '🧗', description: 'Giao tiếp tình huống hàng ngày quen thuộc, sinh hoạt và mua sắm', minOverall: 40, minSessions: 5, minScenarios: 3 },
  { level: 'B1', name: 'Trung cấp độc lập', campName: 'Cao Nguyên Độc Lập', altitude: '4,500m', campEmoji: '🌲', description: 'Diễn đạt ý kiến, thảo luận sở thích và công việc chủ động', minOverall: 55, minSessions: 10, minScenarios: 5 },
  { level: 'B2', name: 'Trung cấp nâng cao', campName: 'Trạm Dừng Gió Tuyết', altitude: '6,800m', campEmoji: '🏔️', description: 'Giao tiếp tự nhiên, lưu loát, phản biện sắc bén và đàm phán', minOverall: 70, minSessions: 20, minScenarios: 5, minSkill: { name: 'Mọi kỹ năng', score: 60 } },
  { level: 'C1', name: 'Thành thạo chuyên nghiệp', campName: 'Đỉnh Everest CEFR', altitude: '8,848m', campEmoji: '🚩', description: 'Lưu loát linh hoạt, dùng ngữ điệu và từ vựng phức tạp như người bản xứ', minOverall: 85, minSessions: 30, minScenarios: 5, minSkill: { name: 'Mọi kỹ năng', score: 75 } },
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
          class="px-4 py-3 text-sm font-700 border-b-2 transition-all -mb-px cursor-pointer border-0 bg-transparent"
          [style.borderColor]="tab() === 'skills' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'skills' ? '#286FB4' : '#64748b'"
          (click)="tab.set('skills')"
        >
          📊 Chẩn Đoán Kỹ Năng
        </button>
        <button
          class="px-4 py-3 text-sm font-700 border-b-2 transition-all -mb-px cursor-pointer border-0 bg-transparent"
          [style.borderColor]="tab() === 'history' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'history' ? '#286FB4' : '#64748b'"
          (click)="tab.set('history')"
        >
          📅 Lịch Sử Hoạt Động
        </button>
        <button
          class="px-4 py-3 text-sm font-700 border-b-2 transition-all -mb-px cursor-pointer border-0 bg-transparent"
          [style.borderColor]="tab() === 'roadmap' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'roadmap' ? '#286FB4' : '#64748b'"
          (click)="tab.set('roadmap')"
        >
          🏔️ Hành Trình Leo Núi CEFR
        </button>
      </div>

      <!-- Skills Tab: Comprehensive Diagnostic & Training Suite -->
      @if (tab() === 'skills') {
        <div class="space-y-6">
          <!-- Top Diagnostic Insights Header -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="card p-5 border shadow-xs" style="border-color: #DCFCE7; background: #F0FDF4">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xl">🌟</span>
                <span class="text-xs font-700 text-emerald-800 uppercase tracking-wide">Kỹ năng nổi trội nhất</span>
              </div>
              <div class="text-base font-800 text-emerald-950 mt-1">
                {{ topSkill()?.label || 'Chưa đủ dữ liệu' }}
              </div>
              <div class="text-xs text-emerald-700 mt-1">
                {{ topSkill()?.current !== null ? (topSkill()?.current + '/100 · CEFR ' + getCefrBand(topSkill()?.current ?? null)) : 'Cần thêm 1 buổi luyện' }}
              </div>
            </div>

            <div class="card p-5 border shadow-xs" style="border-color: #FDE68A; background: #FFFBEB">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xl">🎯</span>
                <span class="text-xs font-700 text-amber-800 uppercase tracking-wide">Trọng tâm cần bứt phá</span>
              </div>
              <div class="text-base font-800 text-amber-950 mt-1">
                {{ focusSkill()?.label || 'Chưa đủ dữ liệu' }}
              </div>
              <div class="text-xs text-amber-700 mt-1">
                {{ focusSkill()?.current !== null ? (focusSkill()?.current + '/100 · Ưu tiên rèn luyện') : 'Cần thêm 1 buổi luyện' }}
              </div>
            </div>

            <div class="card p-5 border shadow-xs" style="border-color: #E2F0F9; background: #F8FBFE">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xl">⚖️</span>
                <span class="text-xs font-700 text-sky-800 uppercase tracking-wide">Cân bằng giao tiếp</span>
              </div>
              <div class="text-base font-800 text-sky-950 mt-1">
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
              <div class="card p-6 border shadow-xs hover:shadow-md transition-all" style="border-color: #E2F0F9">
                <!-- Skill Card Top Row -->
                <div class="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl" [style.background]="s.color + '18'" [style.color]="s.color">
                      {{ getSkillIcon(s.key) }}
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <h3 class="font-800 text-lg text-slate-800" style="font-weight: 800">{{ s.label }}</h3>
                        @if (s.isReference) {
                          <span class="text-[10px] px-2 py-0.5 rounded font-700 bg-slate-100 text-slate-600 border border-slate-200">Tham khảo</span>
                        }
                        <span
                          class="badge font-700 text-xs px-2.5 py-0.5"
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
                      <div class="text-2xl font-800" [style.color]="s.color" style="font-weight: 800">
                        {{ s.current !== null ? s.current : 'N/A' }}<span class="text-sm text-slate-400">/100</span>
                      </div>
                      <div class="text-[11px] font-600" [style.color]="(s.diff ?? 0) >= 0 ? '#16a34a' : '#dc2626'">
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
                  <div class="flex justify-between items-center text-[11px] text-slate-500 font-600 mb-1.5">
                    <span>Thang đo chuẩn CEFR:</span>
                    <span class="font-700 text-slate-800">Trình độ tương đương: {{ getCefrBand(s.current) }}</span>
                  </div>
                  <div class="relative h-3 bg-slate-200 rounded-full overflow-hidden mb-1.5">
                    <div class="absolute inset-0 grid grid-cols-5 divide-x divide-white/50 text-[9px] pointer-events-none opacity-40">
                      <div class="h-full"></div>
                      <div class="h-full"></div>
                      <div class="h-full"></div>
                      <div class="h-full"></div>
                      <div class="h-full"></div>
                    </div>
                    <div
                      class="h-3 rounded-full transition-all duration-700"
                      [style.width.%]="s.current ?? 0"
                      [style.background]="s.color"
                    ></div>
                  </div>
                  <div class="flex justify-between text-[10px] text-slate-400 font-500">
                    <span>A1 (0-39)</span>
                    <span>A2 (40-54)</span>
                    <span>B1 (55-69)</span>
                    <span>B2 (70-84)</span>
                    <span>C1 (85-100)</span>
                  </div>
                </div>

                <!-- Pedagogical Diagnostic & Strategy Block -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-4">
                  <div class="p-3 rounded-xl bg-sky-50/70 border border-sky-100 text-sky-950">
                    <div class="font-700 text-sky-900 mb-1 flex items-center gap-1.5">
                      <span>💡</span>
                      <span>Tiêu chí AI đánh giá</span>
                    </div>
                    <p class="leading-relaxed text-sky-900/80">
                      {{ getPedagogy(s.key).aiMetric }}
                    </p>
                  </div>

                  <div class="p-3 rounded-xl bg-amber-50/70 border border-amber-100 text-amber-950">
                    <div class="font-700 text-amber-900 mb-1 flex items-center gap-1.5">
                      <span>🚀</span>
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
                    class="px-4 py-2 rounded-xl text-xs font-700 cursor-pointer border-0 flex items-center gap-1.5 text-white shadow-xs transition-all hover:opacity-95"
                    [style.background]="s.color"
                    (click)="practiceSkill(s.key)"
                  >
                    <span>{{ getPedagogy(s.key).actionBtn }}</span>
                    <span>➔</span>
                  </button>
                </div>
              </div>
            }
          </div>
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

      <!-- Mountain Climbing Adventure Roadmap (SRS 3.4 & D-02) -->
      @if (tab() === 'roadmap') {
        <div class="space-y-6">
          <!-- Mountain Expedition Summit Banner -->
          <div class="card p-6 border shadow-md relative overflow-hidden text-white" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #286FB4 100%); border-color: #334155">
            <div class="relative z-10 flex items-center justify-between flex-wrap gap-4">
              <div class="flex items-center gap-4">
                <div class="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-4xl border border-white/20 shadow-lg">
                  🏔️
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h2 class="text-xl font-800 tracking-wide text-amber-300">HÀNH TRÌNH CHINH PHỤC ĐỈNH CEFR</h2>
                    <span class="text-xs px-2.5 py-0.5 rounded-full font-700 bg-amber-400/20 text-amber-200 border border-amber-300/30">
                      0m → 8,848m
                    </span>
                  </div>
                  <p class="text-xs text-slate-200 mt-1 max-w-lg">
                    Leo từ Trại Chân Núi (A1) vượt qua các cao nguyên thử thách để cắm cờ tại Đỉnh Everest CEFR (C1)!
                  </p>
                </div>
              </div>

              <!-- Climber Elevation Meter -->
              <div class="bg-black/40 px-5 py-3 rounded-2xl border border-white/15 min-w-48 text-right">
                <div class="text-xs text-slate-300 font-500 mb-0.5">Độ cao hiện tại</div>
                <div class="text-2xl font-800 text-amber-400 mb-1">{{ currentAltitude() }}</div>
                <div class="text-xs text-white/80 font-600">Trạm cắm trại: Level {{ currentLevel() }}</div>
              </div>
            </div>
          </div>

          <!-- Active Mountain Camp Advancement Checklist -->
          @if (advancementInfo(); as adv) {
            <div class="card p-6 border-2 shadow-sm" style="border-color: #286FB4; background: #F8FBFE">
              <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-2xl">🧗‍♂️</span>
                  <h3 class="font-800 text-base text-slate-900" style="font-weight: 800">
                    Chặng leo tiếp theo: Lên {{ adv.targetLevel || 'C1 (Đỉnh Cao)' }}
                  </h3>
                </div>
                <span
                  class="badge font-700 px-3 py-1 text-xs"
                  [style.background]="adv.allMet ? '#DCFCE7' : '#FEF3C7'"
                  [style.color]="adv.allMet ? '#166534' : '#92400e'"
                >
                  {{ adv.allMet ? '🎉 ĐỦ ĐIỀU KIỆN THĂNG HẠNG!' : '⏳ ĐANG LEO DỐC' }}
                </span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                @for (cond of adv.conditions; track cond.label) {
                  <div class="p-3.5 rounded-xl border bg-white flex items-center justify-between shadow-2xs" style="border-color: #E2F0F9">
                    <div>
                      <div class="text-xs text-slate-500 font-500">{{ cond.label }}</div>
                      <div class="text-sm font-800 mt-0.5 text-slate-800">
                        {{ cond.current }} / {{ cond.target }} {{ cond.unit }}
                      </div>
                    </div>
                    <span class="text-lg">
                      {{ cond.met ? '✅' : '⏳' }}
                    </span>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Winding Mountain Climbing Trail (Top to Bottom Expedition) -->
          <div class="relative pl-6 sm:pl-10 space-y-8 before:absolute before:left-8 sm:before:left-12 before:top-4 before:bottom-4 before:w-1.5 before:bg-gradient-to-b before:from-amber-400 before:via-sky-400 before:to-slate-300 before:rounded-full">
            @for (camp of mountainCamps; track camp.level) {
              <div class="relative flex items-start gap-4 sm:gap-6">
                <!-- Mountain Camp Node Icon -->
                <div
                  class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 z-10 shadow-md transition-transform"
                  [style.background]="getCampStatus(camp.level) === 'conquered' ? '#DCFCE7' : getCampStatus(camp.level) === 'current' ? '#286FB4' : '#F1F5F9'"
                  [style.border]="getCampStatus(camp.level) === 'current' ? '3px solid #F59E0B' : '2px solid #CBD5E1'"
                  [style.boxShadow]="getCampStatus(camp.level) === 'current' ? '0 0 20px rgba(40, 111, 180, 0.5)' : 'none'"
                >
                  @if (getCampStatus(camp.level) === 'conquered') {
                    <span class="text-emerald-700 font-800 text-xl">✓</span>
                  } @else if (getCampStatus(camp.level) === 'current') {
                    <span class="text-white text-2xl animate-bounce">🧗‍♂️</span>
                  } @else {
                    <span class="text-slate-400 text-xl">🔒</span>
                  }
                </div>

                <!-- Camp Details Card -->
                <div
                  class="flex-1 card p-5 sm:p-6 transition-all duration-200 border-2"
                  [style.borderColor]="getCampStatus(camp.level) === 'current' ? '#286FB4' : getCampStatus(camp.level) === 'conquered' ? '#86EFAC' : '#E2E8F0'"
                  [style.background]="getCampStatus(camp.level) === 'current' ? 'radial-gradient(circle at 50% 10%, #F0F9FF 0%, #FFFFFF 100%)' : '#FFFFFF'"
                >
                  <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-lg">{{ camp.campEmoji }}</span>
                      <h3 class="font-800 text-base sm:text-lg text-slate-800" style="font-weight: 800">
                        {{ camp.campName }} · Level {{ camp.level }}
                      </h3>
                      <span class="text-xs font-700 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        Độ cao: {{ camp.altitude }}
                      </span>
                    </div>

                    <!-- Status Stamp -->
                    @if (getCampStatus(camp.level) === 'conquered') {
                      <span class="badge bg-emerald-100 text-emerald-800 font-800 text-xs px-2.5 py-1 border border-emerald-300">
                        ✓ ĐÃ CHINH PHỤC
                      </span>
                    } @else if (getCampStatus(camp.level) === 'current') {
                      <span class="badge bg-sky-100 text-sky-800 font-800 text-xs px-2.5 py-1 border border-sky-300 animate-pulse">
                        ⛺ TRẠM CỦA BẠN
                      </span>
                    } @else {
                      <span class="badge bg-slate-100 text-slate-500 font-700 text-xs px-2.5 py-1">
                        ☁️ ĐỈNH CAO PHÍA TRƯỚC
                      </span>
                    }
                  </div>

                  <p class="text-xs sm:text-sm text-slate-600 mb-3">{{ camp.description }}</p>

                  <!-- Expedition Prerequisites -->
                  <div class="flex flex-wrap gap-2 text-xs font-600 text-slate-600 mb-3">
                    <span class="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">
                      🎯 Điểm TB: ≥ {{ camp.minOverall }}
                    </span>
                    <span class="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">
                      🎙️ {{ camp.minSessions }} buổi luyện nói
                    </span>
                    <span class="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">
                      🎭 {{ camp.minScenarios }} tình huống khác nhau
                    </span>
                    @if (camp.minSkill) {
                      <span class="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">
                        ⚡ {{ camp.minSkill.name }} ≥ {{ camp.minSkill.score }}
                      </span>
                    }
                  </div>

                  <!-- Direct Action CTA for Current Camp -->
                  @if (getCampStatus(camp.level) === 'current') {
                    <div class="pt-3 border-t border-sky-100 flex items-center justify-between flex-wrap gap-2">
                      <span class="text-xs text-sky-900 font-600">Đang chuẩn bị trang bị và rèn luyện để bứt phá lên trạm tiếp theo!</span>
                      <button
                        class="btn-primary text-xs px-4 py-2 rounded-xl cursor-pointer border-0 shadow-sm font-700"
                        (click)="appState.go('ai-coach')"
                      >
                        🧗‍♂️ Leo tiếp: Luyện nói ngay!
                      </button>
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
  readonly roadmapLevels = ROADMAP_LEVELS;
  readonly mountainCamps = [...ROADMAP_LEVELS].reverse();

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

  readonly currentAltitude = computed(() => {
    const lvl = this.currentLevel().toUpperCase();
    const camp = ROADMAP_LEVELS.find(c => c.level === lvl);
    return camp ? camp.altitude : '1,000m';
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

  getSkillIcon(key: string): string {
    switch (key) {
      case 'fluency': return '⚡';
      case 'vocabulary': return '📚';
      case 'grammar': return '🧩';
      case 'pronunciation': return '🎯';
      case 'interaction': return '💬';
      default: return '📊';
    }
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
          strategy: 'Chủ động áp dụng 2-3 từ vựng mới hoặc thành ngữ trong mỗi lượt nói thay vì chỉ dùng từ vựng quen thuộc cấp A1/A2.',
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
          actionBtn: 'Luyện giao tiếp nhóm hoặc AI Coach',
        };
    }
  }

  getCampStatus(lvl: string): 'conquered' | 'current' | 'locked' {
    if (this.isCurrentLevel(lvl)) return 'current';
    if (this.isLevelAchieved(lvl)) return 'conquered';
    return 'locked';
  }

  practiceSkill(key: string): void {
    if (key === 'vocabulary') {
      this.appState.go('scenarios');
    } else if (key === 'interaction') {
      this.appState.go('community');
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
