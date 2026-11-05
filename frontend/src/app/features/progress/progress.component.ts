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
  type: 'COACH' | 'SCENARIO' | 'COMMUNITY' | 'CHALLENGE';
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
    <div class="p-5 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 class="text-2xl font-800" style="font-weight: 800; color: #1e293b">Tiến độ học tập</h1>
        <p class="text-sm mt-1" style="color: #64748b">Theo dõi kỹ năng giao tiếp và hành trình thăng hạng level của bạn.</p>
      </div>

      <!-- Overall Score Banner (Clean & Modern) -->
      <div class="card p-6 border shadow-2xs bg-white" style="border-color: #E2E8F0">
        <div class="flex items-center justify-between flex-wrap gap-6">
          <div>
            <div class="text-xs text-slate-500 font-500 mb-1">Điểm giao tiếp tổng hợp</div>
            <div class="text-4xl font-800 text-[#286FB4]" style="font-weight: 800">
              {{ overallDisplay() }}<span class="text-xl text-slate-400 font-600">{{ overallDisplay() !== 'N/A' ? ' / 100' : '' }}</span>
            </div>
            <div class="flex items-center gap-2 mt-1.5">
              @if (scoreChange30d() !== null) {
                <span class="text-xs font-600" [style.color]="scoreChange30d()! >= 0 ? '#16a34a' : '#dc2626'">
                  {{ scoreChange30d()! >= 0 ? '↑ +' + scoreChange30d() : '↓ ' + scoreChange30d() }} trong 30 ngày qua
                </span>
              } @else {
                <span class="text-slate-400 text-xs">Cần thêm buổi luyện để tính xu hướng</span>
              }
            </div>
          </div>

          <div class="grid grid-cols-3 gap-6 text-center border-l border-slate-100 pl-6">
            @for (m of metrics(); track m.label) {
              <div>
                <div class="text-lg font-700 text-slate-800" style="font-weight: 700">{{ m.val }}</div>
                <div class="text-xs text-slate-400 mt-0.5">{{ m.label }}</div>
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

      <!-- 25-Milestone CEFR Learning Journey (Clean & Structured) -->
      @if (tab() === 'roadmap') {
        <div class="space-y-6">
          <!-- Journey Overview Header -->
          <div class="card p-5 border shadow-2xs bg-white" style="border-color: #E2E8F0">
            <div class="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="text-base font-700 text-slate-900" style="font-weight: 700">Lộ Trình 25 Cột Mốc Chinh Phục Tiếng Anh</h2>
                  <span class="text-xs px-2 py-0.5 rounded-full font-600 bg-sky-50 text-sky-800 border border-sky-200">
                    Trình độ hiện tại: Level {{ currentLevel() }}
                  </span>
                </div>
                <p class="text-xs text-slate-500 mt-0.5">
                  Mỗi cấp độ CEFR gồm 5 mốc thử thách thực tế từ cơ bản đến nâng cao.
                </p>
              </div>

              <!-- Active Milestone Progress Badge -->
              <div class="bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 text-right">
                <div class="text-[11px] text-slate-500 font-500">Tiến độ lộ trình</div>
                <div class="text-sm font-700 text-slate-800">{{ completedMilestonesCount() }} / 25 mốc hoàn thành</div>
              </div>
            </div>
          </div>

          <!-- Active Advancement Checklist -->
          @if (advancementInfo(); as adv) {
            <div class="card p-5 border shadow-2xs bg-white" style="border-color: #B0DDE4">
              <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🎯</span>
                  <h3 class="font-700 text-sm text-slate-900" style="font-weight: 700">
                    Điều kiện để bứt phá lên Level {{ adv.targetLevel || 'C1' }}
                  </h3>
                </div>
                <span
                  class="text-xs px-2.5 py-0.5 rounded-full font-600"
                  [style.background]="adv.allMet ? '#DCFCE7' : '#FEF3C7'"
                  [style.color]="adv.allMet ? '#166534' : '#92400e'"
                >
                  {{ adv.allMet ? '✓ Đủ điều kiện thăng cấp' : 'Đang phấn đấu' }}
                </span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                @for (cond of adv.conditions; track cond.label) {
                  <div class="p-3 rounded-lg border bg-slate-50 flex items-center justify-between" style="border-color: #E2E8F0">
                    <div>
                      <div class="text-[11px] text-slate-500 font-500">{{ cond.label }}</div>
                      <div class="text-xs font-700 text-slate-800 mt-0.5">
                        {{ cond.current }} / {{ cond.target }} {{ cond.unit }}
                      </div>
                    </div>
                    <span class="text-sm">{{ cond.met ? '✅' : '⏳' }}</span>
                  </div>
                }
              </div>
            </div>
          }

          <!-- 5 CEFR Stages with 5 Checkpoints Each (25 Total) -->
          <div class="space-y-6">
            @for (stage of stages; track stage.level) {
              <div class="card p-5 border shadow-2xs bg-white" style="border-color: #E2E8F0">
                <!-- Stage Header -->
                <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 flex-wrap gap-2">
                  <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-lg flex items-center justify-center font-700 text-xs text-white" style="background: #286FB4">
                      {{ stage.level }}
                    </span>
                    <div>
                      <h3 class="font-700 text-sm text-slate-900">{{ stage.name }}</h3>
                      <p class="text-xs text-slate-500">{{ stage.description }} · Yêu cầu điểm TB: ≥ {{ stage.minScore }}</p>
                    </div>
                  </div>
                  <span
                    class="text-xs px-2.5 py-0.5 rounded-full font-600"
                    [style.background]="isLevelAchieved(stage.level) ? '#DCFCE7' : isCurrentLevel(stage.level) ? '#E2F0F9' : '#F1F5F9'"
                    [style.color]="isLevelAchieved(stage.level) ? '#166534' : isCurrentLevel(stage.level) ? '#286FB4' : '#64748b'"
                  >
                    {{ isLevelAchieved(stage.level) ? '✓ Đã chinh phục' : isCurrentLevel(stage.level) ? 'Đang thực hiện' : 'Chưa mở khóa' }}
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
                        class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-700 shrink-0"
                        [style.background]="getMilestoneStatus(m.id) === 'conquered' ? '#DCFCE7' : getMilestoneStatus(m.id) === 'current' ? '#286FB4' : '#E2E8F0'"
                        [style.color]="getMilestoneStatus(m.id) === 'conquered' ? '#166534' : getMilestoneStatus(m.id) === 'current' ? '#FFFFFF' : '#64748b'"
                      >
                        {{ getMilestoneStatus(m.id) === 'conquered' ? '✓' : m.id }}
                      </div>

                      <!-- Details -->
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-600 text-slate-800">{{ m.title }}</span>
                          <span class="text-[10px] px-1.5 py-0.2 rounded font-500 bg-slate-100 text-slate-500">
                            {{ m.type === 'COACH' ? '🎙️ AI Coach' : m.type === 'SCENARIO' ? '🎭 Tình huống' : m.type === 'COMMUNITY' ? '👥 Phòng nhóm' : '🎯 Thử thách' }}
                          </span>
                        </div>
                        <p class="text-xs text-slate-500 truncate mt-0.5">{{ m.description }}</p>
                      </div>

                      <!-- Status & CTA -->
                      <div class="shrink-0 text-right">
                        @if (getMilestoneStatus(m.id) === 'conquered') {
                          <span class="text-xs text-emerald-600 font-600">⭐⭐⭐ Đạt</span>
                        } @else if (getMilestoneStatus(m.id) === 'current') {
                          <button
                            class="btn-primary text-xs px-3 py-1.5 rounded-lg cursor-pointer border-0 shadow-xs"
                            (click)="practiceMilestone(m)"
                          >
                            Luyện ngay ➔
                          </button>
                        } @else {
                          <span class="text-xs text-slate-400">🔒 Khóa</span>
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
        { id: 12, title: 'Diễn đạt ý kiến & Thuyết phục', description: 'Nêu quan điểm đồng tình hoặc phản bác một cách lịch thiệp.', type: 'COMMUNITY' },
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
        { id: 17, title: 'Phân tích & Đề xuất giải pháp', description: 'Đào sâu nguyên nhân gốc rễ và bảo vệ giải pháp trước ban quản lý.', type: 'COMMUNITY' },
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
        { id: 23, title: 'Quản trị xung đột đa văn hóa', description: 'Hòa giải bất đồng và gắn kết các quan điểm đa quốc gia.', type: 'COMMUNITY' },
        { id: 24, title: 'Tư duy phản biện sắc bén', description: 'Nhận diện ngụy biện và phản biện logic trong các vấn đề trừu tượng.', type: 'COMMUNITY' },
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
    } else if (m.type === 'COMMUNITY') {
      this.appState.go('community');
    } else {
      this.appState.go('ai-coach');
    }
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

  formatDate(dateStr: string | null | undefined): string {
    return formatDDMMYYYY(dateStr);
  }
}
