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
  emoji: string;
  color: string;
  bg: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-5 md:p-8 space-y-6 max-w-6xl mx-auto">
      <!-- Welcome Header -->
      <div class="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-800" style="font-weight: 800; color: #1e293b">
            {{ dashboardData()?.greeting || ('Xin chào, ' + displayName() + '! 👋') }}
          </h1>
          <p class="text-sm mt-1" style="color: #64748b">
            @if (currentStreak() > 0) {
              Hôm nay là ngày streak thứ <strong style="color: #ea580c">{{ currentStreak() }}</strong> — hãy giữ vững phong độ nhé! 🔥
            } @else {
              Bắt đầu chuỗi học liên tiếp (Streak) của bạn ngay hôm nay bằng một buổi luyện nói! 🔥
            }
          </p>
        </div>
        <button class="btn-primary cursor-pointer" (click)="appState.go('ai-coach')">
          🎙️ Bắt đầu nói
        </button>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        @for (s of statsList(); track s.label) {
          <div class="card p-5 flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-600" style="color: #94a3b8; font-weight: 600">{{ s.label }}</span>
              <span class="text-xl">{{ s.icon }}</span>
            </div>
            <div class="flex items-end gap-1">
              <span class="text-2xl font-800" [style.color]="s.color" style="font-weight: 800">{{ s.value }}</span>
              <span class="text-sm pb-0.5" style="color: #94a3b8">{{ s.unit }}</span>
            </div>
          </div>
        }
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Main 2-column area -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Quick Practice Shortcuts -->
          <div>
            <h2 class="text-base font-700 mb-4" style="font-weight: 700; color: #1e293b">Luyện tập ngay</h2>
            <div class="grid grid-cols-2 gap-4">
              @for (s of shortcuts; track s.id) {
                <button
                  class="card p-5 flex flex-col gap-3 text-left hover:shadow-md transition-shadow cursor-pointer"
                  (click)="appState.go(s.id)"
                >
                  <div class="w-11 h-11 rounded-xl flex items-center justify-center text-2xl" [style.background]="s.bg">{{ s.emoji }}</div>
                  <div>
                    <div class="font-700 text-sm" style="font-weight: 700; color: #1e293b">{{ s.label }}</div>
                    <div class="text-xs mt-0.5" style="color: #94a3b8">{{ s.desc }}</div>
                  </div>
                </button>
              }
            </div>
          </div>

          <!-- Skills breakdown overview -->
          <div class="card p-6">
            <div class="flex items-center justify-between mb-5">
              <div>
                <h2 class="font-700 text-base" style="font-weight: 700; color: #1e293b">Kỹ năng giao tiếp</h2>
                <p class="text-xs text-slate-500 mt-0.5">5 trụ cột cốt lõi theo tiêu chuẩn CEFR</p>
              </div>
              <button class="text-sm font-600 cursor-pointer flex items-center gap-1 hover:underline" style="color: #286FB4; font-weight: 600" (click)="appState.go('progress')">
                <span>Chẩn đoán chi tiết</span>
                <span>→</span>
              </button>
            </div>
            <div class="space-y-4">
              @for (s of skills(); track (s.key || s.skill || s.label || $index)) {
                <div>
                  <div class="flex items-center justify-between mb-1.5">
                    <div class="flex items-center gap-1.5">
                      <span class="text-sm font-600" style="font-weight: 600; color: #374151">{{ s.label }}</span>
                      @if (s.isReference) {
                        <span class="text-[10px] px-1.5 py-0.5 rounded font-600" style="background: #F1F5F9; color: #64748b">tham khảo</span>
                      }
                    </div>
                    <span class="text-sm font-700" [style.color]="s.color" style="font-weight: 700">
                      {{ (s.score !== null && s.score !== undefined) ? s.score : ((s.value !== null && s.value !== undefined) ? s.value : 'N/A') }}
                    </span>
                  </div>
                  <div class="progress-bar h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div class="progress-bar-fill h-2 rounded-full transition-all duration-500" [style.width.%]="(s.score ?? s.value ?? 0)" [style.background]="s.color"></div>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Recent sessions -->
          <div class="card p-6">
            <div class="flex items-center justify-between mb-5">
              <h2 class="font-700 text-base" style="font-weight: 700; color: #1e293b">Buổi luyện gần đây</h2>
              <button class="text-sm font-600 cursor-pointer" style="color: #286FB4; font-weight: 600" (click)="appState.go('progress')">Xem tất cả →</button>
            </div>
            <div class="space-y-3">
              @if (recentSessions().length === 0) {
                <div class="p-6 text-center text-xs text-slate-400">
                  Chưa có buổi luyện nào. Bắt đầu ngay với AI Coach!
                </div>
              } @else {
                @for (s of recentSessions(); track s.id) {
                  <div class="flex items-center gap-4 p-4 rounded-xl" style="background: #F8FAFC">
                    <div class="text-2xl">
                      @if (s.type === 'COACH') { 🎙️ } @else if (s.type === 'ROLEPLAY') { 🎭 } @else { 👥 }
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-600 text-sm truncate" style="font-weight: 600; color: #1e293b">{{ s.topic }}</div>
                      <div class="text-xs" style="color: #94a3b8">{{ formatDate(s.date) }} · {{ s.durationDisplay }}</div>
                    </div>
                    <div class="text-right">
                      <div class="font-700 text-sm" [style.color]="(s.score ?? 0) >= 70 ? '#22c55e' : '#f59e0b'" style="font-weight: 700">
                        {{ s.score !== null ? s.score + '/100' : 'N/A' }}
                      </div>
                      <div class="text-xs" style="color: #94a3b8">điểm</div>
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
          <div class="card p-6 border shadow-sm" style="border-color: #E2F0F9">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="text-xl">🎯</span>
                <h2 class="font-700 text-base" style="font-weight: 700; color: #1e293b">Nhiệm vụ hôm nay</h2>
              </div>
              <span class="badge font-700 px-2.5 py-1" style="background: #FEF3C7; color: #92400e; font-size: 11px">
                🎁 Rương +100 XP
              </span>
            </div>

            <!-- Daily Treasure Chest Bar -->
            <div class="p-3 rounded-xl mb-4" style="background: linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%); border: 1px dashed #B0DDE4">
              <div class="flex justify-between items-center text-xs mb-1.5">
                <span class="font-600 text-slate-700 flex items-center gap-1">
                  <span>{{ missionsCompletedCount() === missions().length && missions().length > 0 ? '🎉 Đã mở Rương Ngày!' : 'Mở Rương Ngày:' }}</span>
                  <span class="text-sky-700 font-700">{{ missionsCompletedCount() }}/{{ missions().length }} hoàn thành</span>
                </span>
                <span class="font-800 text-amber-600">{{ missionsProgressPct() }}%</span>
              </div>
              <div class="progress-bar h-2.5 bg-slate-200/80 rounded-full overflow-hidden">
                <div class="progress-bar-fill h-2.5 rounded-full transition-all duration-500" [style.width.%]="missionsProgressPct()" style="background: linear-gradient(90deg, #f59e0b, #22c55e)"></div>
              </div>
            </div>

            <!-- Quest List -->
            <div class="space-y-3">
              @for (m of missions(); track m.id) {
                <div
                  class="p-3.5 rounded-xl border transition-all flex items-center gap-3"
                  [style.borderColor]="m.status === 'CLAIMED' ? '#DCFCE7' : m.status === 'COMPLETED' ? '#FDE68A' : '#E2E8F0'"
                  [style.background]="m.status === 'CLAIMED' ? '#F0FDF4' : m.status === 'COMPLETED' ? '#FFFBEB' : '#FFFFFF'"
                >
                  <div
                    class="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-xs"
                    [style.background]="m.status === 'CLAIMED' ? '#DCFCE7' : m.status === 'COMPLETED' ? '#FEF3C7' : '#E2F0F9'"
                  >
                    @if (m.status === 'CLAIMED') {
                      <span class="text-emerald-600 font-bold">✓</span>
                    } @else {
                      <span>{{ getMissionIcon(m.conditionType) }}</span>
                    }
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5">
                      <span
                        class="text-xs font-700 px-1.5 py-0.5 rounded"
                        [style.background]="m.conditionType === 'COACH' ? '#E2F0F9' : m.conditionType === 'SCENARIO' ? '#FFF0F3' : m.conditionType === 'ROOM' ? '#F5F3FF' : '#FEF3C7'"
                        [style.color]="m.conditionType === 'COACH' ? '#286FB4' : m.conditionType === 'SCENARIO' ? '#DF4C73' : m.conditionType === 'ROOM' ? '#7c3aed' : '#b45309'"
                        style="font-size: 10px"
                      >
                        {{ m.conditionType === 'COACH' ? '🎙️ AI Coach' : m.conditionType === 'SCENARIO' ? '🎭 Tình huống' : m.conditionType === 'ROOM' ? '👥 Phòng thoại' : '🔥 Chuỗi ngày' }}
                      </span>
                      <span class="text-xs font-700 text-amber-600">⭐ +{{ m.xp }} XP</span>
                    </div>
                    <div
                      class="text-xs font-600 truncate"
                      [style.textDecoration]="m.status === 'CLAIMED' ? 'line-through' : 'none'"
                      [style.color]="m.status === 'CLAIMED' ? '#94a3b8' : '#1e293b'"
                      style="font-weight: 600"
                    >
                      {{ m.title }}
                    </div>
                  </div>

                  @if (m.status === 'COMPLETED') {
                    <button
                      type="button"
                      class="px-3 py-1.5 text-xs font-700 rounded-lg text-white cursor-pointer border-0 shadow-md animate-pulse shrink-0"
                      style="background: #22c55e"
                      (click)="claimMission(m)"
                    >
                      Nhận XP 🎁
                    </button>
                  } @else if (m.status === 'CLAIMED') {
                    <span class="text-xs font-700 text-emerald-600 shrink-0">✓ Đã nhận</span>
                  } @else {
                    <button
                      type="button"
                      class="px-3 py-1.5 text-xs font-700 rounded-lg border-0 cursor-pointer text-white shrink-0 shadow-xs"
                      style="background: #286FB4"
                      (click)="goToMissionAction(m.conditionType)"
                    >
                      Luyện ngay ➔
                    </button>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Motivational Box -->
          <div class="p-6 rounded-2xl text-white relative overflow-hidden" style="background: linear-gradient(135deg, #286FB4 0%, #1d5a94 100%)">
            <div class="relative z-10">
              <div class="text-3xl mb-2">🚀</div>
              <div class="font-800 text-lg mb-1" style="font-weight: 800">
                {{ motivationalCard()?.title || ('Cố lên, ' + displayName() + '!') }}
              </div>
              <p class="text-xs text-white/80 leading-relaxed mb-4">
                {{ motivationalCard()?.message || 'Luyện tập thêm mỗi ngày để thăng hạng CEFR và tự tin giao tiếp!' }}
              </p>
              <button
                class="btn-secondary w-full justify-center text-sm py-2.5 cursor-pointer border-0"
                style="background: #fff; color: #286FB4; font-weight: 700"
                (click)="appState.go('ai-coach')"
              >
                {{ motivationalCard()?.actionText || 'Bắt đầu ngay 🎙️' }}
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
      { key: 'fluency', skill: 'fluency', label: 'Độ trôi chảy', score: null, value: null, color: '#286FB4', isReference: false },
      { key: 'vocabulary', skill: 'vocabulary', label: 'Vốn từ vựng', score: null, value: null, color: '#059669', isReference: false },
      { key: 'grammar', skill: 'grammar', label: 'Ngữ pháp', score: null, value: null, color: '#7c3aed', isReference: false },
      { key: 'pronunciation', skill: 'pronunciation', label: 'Phát âm', score: null, value: null, color: '#DF4C73', isReference: true },
      { key: 'interaction', skill: 'interaction', label: 'Tương tác & Phản xạ', score: null, value: null, color: '#f59e0b', isReference: false },
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
    { id: "ai-coach", label: "AI Coach", desc: "Nói chuyện với AI", emoji: "🎙️", color: "#286FB4", bg: "#E2F0F9" },
    { id: "scenarios", label: "Tình huống", desc: "Luyện kịch bản thực tế", emoji: "🎭", color: "#DF4C73", bg: "#FFF0F3" },
    { id: "community", label: "Cộng đồng", desc: "Voice room 3–5 người", emoji: "👥", color: "#7c3aed", bg: "#F5F3FF" },
    { id: "progress", label: "Tiến độ", desc: "Xem kỹ năng của bạn", emoji: "📊", color: "#059669", bg: "#ECFDF5" }
  ];

  readonly statsList = computed(() => {
    const data = this.dashboardData();
    const overall = data?.overallScore !== null && data?.overallScore !== undefined ? String(data.overallScore) : "N/A";
    const xpVal = data?.totalXp ?? data?.xp ?? this.appState.totalXp() ?? 0;
    const totalXp = Number(xpVal).toLocaleString();
    const streakVal = data?.currentStreak ?? data?.streak ?? this.appState.currentStreak() ?? 0;
    const streak = String(streakVal);
    const level = data?.level || this.appState.appUser().level || "A1";

    return [
      { label: "Điểm giao tiếp", value: overall, unit: overall === "N/A" ? "" : "/100", icon: "💬", color: "#286FB4", bg: "#E2F0F9" },
      { label: "XP tích lũy", value: totalXp, unit: " XP", icon: "⭐", color: "#f59e0b", bg: "#FFF5E5" },
      { label: "Streak", value: streak, unit: " ngày", icon: "🔥", color: "#ea580c", bg: "#FFF0E8" },
      { label: "Level", value: level, unit: "", icon: "🎓", color: "#7c3aed", bg: "#F5F3FF" }
    ];
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
        // Update mission locally and update XP
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

  formatDate(dateStr: string | null | undefined): string {
    return formatDDMMYYYY(dateStr);
  }
}
