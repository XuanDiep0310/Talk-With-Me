import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';
import { AppPage, PracticeSession, AchievementMission } from '../../core/models/app.models';
import { MOCK_MISSIONS, MOCK_SESSIONS } from '../../core/mock/mock-data';

interface Skill {
  label: string;
  value: number;
  color: string;
}

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
            Xin chào, {{ appState.appUser().name }}! 👋
          </h1>
          <p class="text-sm mt-1" style="color: #64748b">
            Hôm nay là ngày streak thứ <strong style="color: #ea580c">{{ appState.appUser().streak }}</strong> — hãy giữ vững nhé!
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
          @defer (on viewport) {
            <div class="card p-6">
              <div class="flex items-center justify-between mb-5">
                <h2 class="font-700 text-base" style="font-weight: 700; color: #1e293b">Kỹ năng giao tiếp</h2>
                <button class="text-sm font-600 cursor-pointer" style="color: #286FB4; font-weight: 600" (click)="appState.go('progress')">Xem chi tiết →</button>
              </div>
              <div class="space-y-4">
                @for (s of skills; track s.label) {
                  <div>
                    <div class="flex items-center justify-between mb-1.5">
                      <span class="text-sm font-500" style="font-weight: 500; color: #374151">{{ s.label }}</span>
                      <span class="text-sm font-700" [style.color]="s.color" style="font-weight: 700">{{ s.value }}</span>
                    </div>
                    <div class="progress-bar h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div class="progress-bar-fill h-2 rounded-full" [style.width.%]="s.value" [style.background]="s.color"></div>
                    </div>
                  </div>
                }
              </div>
            </div>
          } @placeholder {
            <div class="card p-6 text-center text-slate-400">Loading skill chart...</div>
          }

          <!-- Recent sessions -->
          @defer (on viewport) {
            <div class="card p-6">
              <div class="flex items-center justify-between mb-5">
                <h2 class="font-700 text-base" style="font-weight: 700; color: #1e293b">Buổi luyện gần đây</h2>
                <button class="text-sm font-600 cursor-pointer" style="color: #286FB4; font-weight: 600" (click)="appState.go('progress')">Xem tất cả →</button>
              </div>
              <div class="space-y-3">
                @for (s of recentSessions; track s.topic) {
                  <div class="flex items-center gap-4 p-4 rounded-xl" style="background: #F8FAFC">
                    <div class="text-2xl">
                      @if (s.type === 'ai-coach') { 🎙️ } @else if (s.type === 'scenario') { 🎭 } @else { 👥 }
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-600 text-sm truncate" style="font-weight: 600; color: #1e293b">{{ s.topic }}</div>
                      <div class="text-xs" style="color: #94a3b8">{{ s.date }} · {{ s.duration }}</div>
                    </div>
                    <div class="text-right">
                      <div class="font-700 text-sm" [style.color]="s.score >= 75 ? '#22c55e' : '#f59e0b'" style="font-weight: 700">{{ s.score }}/100</div>
                      <div class="text-xs" style="color: #94a3b8">điểm</div>
                    </div>
                  </div>
                }
              </div>
            </div>
          } @placeholder {
            <div class="card p-6 text-center text-slate-400">Loading recent sessions...</div>
          }
        </div>

        <!-- Sidebar column: Daily missions & Streak -->
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
                  class="flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer"
                  [style.background]="m.done ? '#F0FDF4' : '#F8FAFC'"
                  (click)="toggleMission(m.id)"
                >
                  <span class="text-xl">{{ m.icon }}</span>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-500 truncate" [style.textDecoration]="m.done ? 'line-through' : 'none'" [style.color]="m.done ? '#64748b' : '#1e293b'" style="font-weight: 500">
                      {{ m.label }}
                    </div>
                    <div class="text-xs font-600" style="color: #f59e0b; font-weight: 600">+{{ m.xp }} XP</div>
                  </div>
                  <input type="checkbox" [checked]="m.done" class="w-4 h-4 accent-blue-600 cursor-pointer" />
                </div>
              }
            </div>
          </div>

          <!-- Motivational Box -->
          <div class="p-6 rounded-2xl text-white relative overflow-hidden" style="background: linear-gradient(135deg, #286FB4 0%, #1d5a94 100%)">
            <div class="relative z-10">
              <div class="text-3xl mb-2">🚀</div>
              <div class="font-800 text-lg mb-1" style="font-weight: 800">Cố lên, {{ appState.appUser().name }}!</div>
              <p class="text-xs text-white/80 leading-relaxed mb-4">
                Luyện tập thêm 10 phút hôm nay để chạm mốc B2 trong tuần này.
              </p>
              <button class="btn-secondary w-full justify-center text-sm py-2.5 cursor-pointer" style="background: #fff; color: #286FB4" (click)="appState.go('ai-coach')">
                Bắt đầu ngay 🎙️
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent {
  readonly appState = inject(AppStateService);

  readonly missions = signal<AchievementMission[]>(MOCK_MISSIONS.map(mission => ({ ...mission })));

  readonly skills: Skill[] = [
    { label: "Fluency", value: 72, color: "#286FB4" },
    { label: "Listening", value: 68, color: "#B0DDE4" },
    { label: "Vocabulary", value: 61, color: "#DF4C73" },
    { label: "Tốc độ P.H", value: 55, color: "#f59e0b" },
    { label: "Phát âm", value: 64, color: "#22c55e" }
  ];

  readonly recentSessions: PracticeSession[] = MOCK_SESSIONS;

  readonly shortcuts: Shortcut[] = [
    { id: "ai-coach", label: "AI Coach", desc: "Nói chuyện với AI", emoji: "🎙️", color: "#286FB4", bg: "#E2F0F9" },
    { id: "scenarios", label: "Tình huống", desc: "Luyện kịch bản thực tế", emoji: "🎭", color: "#DF4C73", bg: "#FFF0F3" },
    { id: "community", label: "Cộng đồng", desc: "Voice room 3–5 người", emoji: "👥", color: "#7c3aed", bg: "#F5F3FF" },
    { id: "progress", label: "Tiến độ", desc: "Xem kỹ năng của bạn", emoji: "📊", color: "#059669", bg: "#ECFDF5" }
  ];

  readonly statsList = computed(() => [
    { label: "Điểm giao tiếp", value: "67", unit: "/100", icon: "💬", color: "#286FB4", bg: "#E2F0F9" },
    { label: "XP tích lũy", value: this.appState.appUser().xp.toLocaleString(), unit: " XP", icon: "⭐", color: "#f59e0b", bg: "#FFF5E5" },
    { label: "Streak", value: String(this.appState.appUser().streak), unit: " ngày", icon: "🔥", color: "#ea580c", bg: "#FFF0E8" },
    { label: "Level", value: this.appState.appUser().level, unit: "", icon: "🎓", color: "#7c3aed", bg: "#F5F3FF" }
  ]);

  readonly missionsCompletedCount = computed(() => this.missions().filter(m => m.done).length);
  readonly missionsProgressPct = computed(() => Math.round((this.missionsCompletedCount() / this.missions().length) * 100));

  toggleMission(id: number): void {
    this.missions.update(list => list.map(m => m.id === id ? { ...m, done: !m.done } : m));
  }
}
