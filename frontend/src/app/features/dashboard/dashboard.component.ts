import { Component, ChangeDetectionStrategy, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
            Hôm nay là ngày streak thứ <strong style="color: #ea580c">{{ currentStreak() }}</strong> — hãy giữ vững phong độ nhé!
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
              <h2 class="font-700 text-base" style="font-weight: 700; color: #1e293b">Kỹ năng giao tiếp</h2>
              <button class="text-sm font-600 cursor-pointer" style="color: #286FB4; font-weight: 600" (click)="appState.go('progress')">Xem chi tiết →</button>
            </div>
            <div class="space-y-4">
              @for (s of skills(); track s.key) {
                <div>
                  <div class="flex items-center justify-between mb-1.5">
                    <div class="flex items-center gap-1.5">
                      <span class="text-sm font-500" style="font-weight: 500; color: #374151">{{ s.label }}</span>
                      @if (s.isReference) {
                        <span class="text-[10px] px-1.5 py-0.5 rounded font-600" style="background: #F1F5F9; color: #64748b">tham khảo</span>
                      }
                    </div>
                    <span class="text-sm font-700" [style.color]="s.color" style="font-weight: 700">
                      {{ s.score !== null ? s.score : 'N/A' }}
                    </span>
                  </div>
                  <div class="progress-bar h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div class="progress-bar-fill h-2 rounded-full" [style.width.%]="s.score ?? 0" [style.background]="s.color"></div>
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
          <div class="card p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="font-700 text-base" style="font-weight: 700; color: #1e293b">Nhiệm vụ hôm nay</h2>
              <span class="badge" style="background: #E2F0F9; color: #286FB4">
                {{ missionsCompletedCount() }}/{{ missions().length }}
              </span>
            </div>

            <div class="mb-5">
              <div class="flex justify-between text-xs mb-1.5" style="color: #64748b">
                <span>Tiến độ nhiệm vụ</span>
                <span class="font-600" style="font-weight: 600">{{ missionsProgressPct() }}%</span>
              </div>
              <div class="progress-bar h-2 bg-slate-100 rounded-full overflow-hidden">
                <div class="progress-bar-fill h-2 rounded-full" [style.width.%]="missionsProgressPct()" style="background: #286FB4"></div>
              </div>
            </div>

            <div class="space-y-3">
              @for (m of missions(); track m.id) {
                <div
                  class="flex items-center gap-3 p-3 rounded-xl w-full text-left transition-all"
                  [style.background]="m.status === 'CLAIMED' ? '#F0FDF4' : m.status === 'COMPLETED' ? '#FFFBEB' : '#F8FAFC'"
                >
                  <span class="text-xl">{{ getMissionIcon(m.conditionType) }}</span>
                  <div class="flex-1 min-w-0">
                    <div
                      class="text-sm font-500 truncate"
                      [style.textDecoration]="m.status === 'CLAIMED' ? 'line-through' : 'none'"
                      [style.color]="m.status === 'CLAIMED' ? '#64748b' : '#1e293b'"
                      style="font-weight: 500"
                    >
                      {{ m.title }}
                    </div>
                    <div class="text-xs font-600" style="color: #f59e0b; font-weight: 600">+{{ m.xp }} XP</div>
                  </div>

                  @if (m.status === 'COMPLETED') {
                    <button
                      type="button"
                      class="px-2.5 py-1 text-xs font-700 rounded-lg text-white cursor-pointer border-0 shadow-sm"
                      style="background: #22c55e"
                      (click)="claimMission(m)"
                    >
                      Nhận
                    </button>
                  } @else if (m.status === 'CLAIMED') {
                    <span class="text-xs font-700 text-emerald-600">✓ Đã nhận</span>
                  } @else {
                    <button
                      type="button"
                      class="px-2.5 py-1 text-xs font-600 rounded-lg border-0 cursor-pointer"
                      style="background: #E2F0F9; color: #286FB4"
                      (click)="goToMissionAction(m.conditionType)"
                    >
                      Bắt đầu
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
    return this.dashboardData()?.currentStreak ?? this.appState.currentStreak();
  });

  readonly missions = computed(() => {
    return this.dashboardData()?.todayMissions ?? [];
  });

  readonly skills = computed(() => {
    return this.dashboardData()?.skills ?? [
      { key: 'fluency', label: 'Độ trôi chảy', score: null, color: '#286FB4', isReference: false },
      { key: 'vocabulary', label: 'Vốn từ vựng', score: null, color: '#059669', isReference: false },
      { key: 'grammar', label: 'Ngữ pháp', score: null, color: '#7c3aed', isReference: false },
      { key: 'pronunciation', label: 'Phát âm', score: null, color: '#DF4C73', isReference: true },
      { key: 'interaction', label: 'Tương tác & Phản xạ', score: null, color: '#f59e0b', isReference: false },
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
    const totalXp = data?.totalXp !== undefined ? data.totalXp.toLocaleString() : this.appState.totalXp().toLocaleString();
    const streak = data?.currentStreak !== undefined ? String(data.currentStreak) : String(this.appState.currentStreak());
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
        this.appState.updateGamification(data.totalXp, data.currentStreak, data.level);
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

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }
}
