import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';
import { Achievement, AchievementMission } from '../../core/models/app.models';
import { MOCK_ACHIEVEMENTS, MOCK_MISSIONS } from '../../core/mock/mock-data';

export const BADGES: Achievement[] = MOCK_ACHIEVEMENTS;
export const MISSIONS: AchievementMission[] = MOCK_MISSIONS;

export const XP_HISTORY = [
  { date: "Hôm nay", xp: 70, source: "AI Coach + Streak" },
  { date: "Hôm qua", xp: 120, source: "Tình huống + AI Coach" },
  { date: "2 ngày trước", xp: 90, source: "Voice Room + AI Coach" },
  { date: "3 ngày trước", xp: 50, source: "AI Coach" },
  { date: "4 ngày trước", xp: 140, source: "Tình huống + Badge" }
];

@Component({
  selector: 'app-achievements',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-5 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 class="text-2xl font-800" style="font-weight: 800; color: #1e293b">Thành tích</h1>
        <p class="text-sm mt-1" style="color: #64748b">XP, huy hiệu, streak và nhiệm vụ hàng ngày của bạn.</p>
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

      <!-- Level Progress bar -->
      <div class="card p-5">
        <div class="flex items-center justify-between mb-2">
          <span class="font-600 text-sm" style="font-weight: 600; color: #374151">
            XP đến level tiếp theo ({{ appState.appUser().level }} → {{ nextLevelLabel() }})
          </span>
          <span class="text-sm font-700" style="font-weight: 700; color: #f59e0b">còn {{ xpToNextLevel() }} XP</span>
        </div>
        <div class="progress-bar h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            class="progress-bar-fill h-3 rounded-full"
            [style.width.%]="xpProgressPct()"
            style="background: linear-gradient(90deg, #f59e0b, #ea580c)"
          ></div>
        </div>
        <div class="flex justify-between mt-1.5 text-xs" style="color: #94a3b8">
          <span>{{ currentXpMod() }} XP</span>
          <span>1000 XP</span>
        </div>
      </div>

      <!-- Tab navigation -->
      <div class="flex gap-2 border-b" style="border-color: #E2F0F9">
        <button
          class="px-4 py-3 text-sm font-600 border-b-2 transition-all -mb-px cursor-pointer"
          [style.borderColor]="tab() === 'badges' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'badges' ? '#286FB4' : '#64748b'"
          (click)="tab.set('badges')"
        >
          🏆 Huy hiệu ({{ earnedBadgesCount() }})
        </button>
        <button
          class="px-4 py-3 text-sm font-600 border-b-2 transition-all -mb-px cursor-pointer"
          [style.borderColor]="tab() === 'missions' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'missions' ? '#286FB4' : '#64748b'"
          (click)="tab.set('missions')"
        >
          🎯 Nhiệm vụ ngày ({{ dailyDoneCount() }}/{{ missions.length }})
        </button>
        <button
          class="px-4 py-3 text-sm font-600 border-b-2 transition-all -mb-px cursor-pointer"
          [style.borderColor]="tab() === 'xp' ? '#286FB4' : 'transparent'"
          [style.color]="tab() === 'xp' ? '#286FB4' : '#64748b'"
          (click)="tab.set('xp')"
        >
          ⭐ Lịch sử XP
        </button>
      </div>

      <!-- Badges Tab (Deferrable) -->
      @if (tab() === 'badges') {
        @defer (on viewport) {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (b of badges; track b.id) {
              <div class="card p-5 transition-all" [class.opacity-60]="!b.earned">
                <div class="flex items-start gap-4">
                  <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" [style.background]="b.earned ? '#E2F0F9' : '#F8FAFC'">
                    {{ b.emoji }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="font-700 text-sm" style="font-weight: 700; color: #1e293b">{{ b.name }}</span>
                      @if (b.earned) { <span class="badge" style="background: #DCFCE7; color: #166534; font-size: 10px">✓</span> }
                    </div>
                    <div class="text-xs mb-2" style="color: #64748b">{{ b.desc }}</div>
                    @if (b.earned) {
                      <div class="text-xs" style="color: #94a3b8">Nhận ngày {{ b.date }}</div>
                    } @else {
                      <div>
                        <div class="progress-bar h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div class="progress-bar-fill h-1.5 bg-sky-500 rounded-full" [style.width.%]="((b.progress || 0) / (b.total || 1)) * 100"></div>
                        </div>
                        <div class="text-xs mt-1" style="color: #94a3b8">{{ b.progress }}/{{ b.total }}</div>
                      </div>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        } @placeholder {
          <div class="card p-6 text-center text-slate-400">Loading badges...</div>
        }
      }

      <!-- Missions Tab -->
      @if (tab() === 'missions') {
        <div class="space-y-4">
          <div class="card p-6">
            <h3 class="font-700 mb-4" style="font-weight: 700; color: #1e293b">🎯 Nhiệm vụ hôm nay</h3>
            <div class="space-y-3">
              @for (m of missions; track m.id) {
                <div class="flex items-center gap-4 p-4 rounded-xl" [class.opacity-70]="m.done" style="background: #F8FAFC">
                  <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" [style.background]="m.done ? '#22c55e' : '#E2F0F9'">
                    @if (m.done) {
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                    } @else {
                      <span>{{ m.icon }}</span>
                    }
                  </div>
                  <span class="flex-1 text-sm" [style.color]="m.done ? '#94a3b8' : '#374151'" [style.textDecoration]="m.done ? 'line-through' : 'none'">
                    {{ m.label }}
                  </span>
                  <div class="flex items-center gap-2">
                    <span class="font-700 text-sm" style="color: #f59e0b; font-weight: 700">+{{ m.xp }} XP</span>
                    @if (!m.done) {
                      <button class="btn-primary text-xs px-3 py-1.5 cursor-pointer" (click)="appState.go('ai-coach')">Bắt đầu</button>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- XP History Tab -->
      @if (tab() === 'xp') {
        <div class="space-y-3">
          @for (x of xpHistory; track $index) {
            <div class="card p-5 flex items-center gap-4">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style="background: #FFF5E5">⭐</div>
              <div class="flex-1">
                <div class="font-600 text-sm" style="font-weight: 600; color: #1e293b">{{ x.source }}</div>
                <div class="text-xs" style="color: #94a3b8">{{ x.date }}</div>
              </div>
              <div class="font-800 text-base" style="font-weight: 800; color: #f59e0b">+{{ x.xp }} XP</div>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class AchievementsComponent {
  readonly appState = inject(AppStateService);

  readonly tab = signal<"badges" | "missions" | "xp">("badges");
  readonly badges = BADGES;
  readonly missions = MISSIONS;
  readonly xpHistory = XP_HISTORY;

  readonly earnedBadgesCount = computed(() => this.badges.filter(b => b.earned).length);
  readonly dailyDoneCount = computed(() => this.missions.filter(m => m.done).length);

  readonly currentXpMod = computed(() => this.appState.appUser().xp % 1000);
  readonly xpToNextLevel = computed(() => 1000 - this.currentXpMod());
  readonly xpProgressPct = computed(() => (this.currentXpMod() / 1000) * 100);
  readonly nextLevelLabel = computed(() => this.appState.appUser().level === "B1" ? "B2" : "C1");

  readonly statsList = computed(() => [
    { label: "Tổng XP", value: this.appState.appUser().xp.toLocaleString(), icon: "⭐", color: "#f59e0b", bg: "#FFF5E5" },
    { label: "Level", value: this.appState.appUser().level, icon: "🎓", color: "#286FB4", bg: "#E2F0F9" },
    { label: "Streak", value: `${this.appState.appUser().streak} ngày`, icon: "🔥", color: "#ea580c", bg: "#FFF0E8" },
    { label: "Huy hiệu", value: `${this.earnedBadgesCount()}/${this.badges.length}`, icon: "🏆", color: "#7c3aed", bg: "#F5F3FF" }
  ]);
}
