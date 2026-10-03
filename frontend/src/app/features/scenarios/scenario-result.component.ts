import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';

@Component({
  selector: 'app-scenario-result',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-5 md:p-8 max-w-3xl mx-auto space-y-6">
      <!-- Header bar -->
      <div class="flex items-center gap-3">
        <button class="w-9 h-9 rounded-xl btn-secondary flex items-center justify-center shrink-0 cursor-pointer" (click)="appState.go('scenarios')">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
        </button>
        <div>
          <h1 class="text-2xl font-800" style="font-weight: 800; color: #1e293b">Kết quả Roleplay</h1>
          <p class="text-sm" style="color: #64748b">{{ result()?.scenarioTitle || appState.selectedScenario()?.title || 'Roleplay Tình huống' }}</p>
        </div>
      </div>

      <!-- Overall Result Banner -->
      <div
        class="card p-6 text-center"
        [style.background]="passed() ? 'linear-gradient(135deg, #286FB4, #1d5a94)' : 'linear-gradient(135deg, #DF4C73, #c43d62)'"
      >
        <div class="text-5xl mb-2">{{ passed() ? '🌟' : '💪' }}</div>
        <div class="text-4xl font-800 text-white mb-1" style="font-weight: 800">
          {{ passed() ? 'PASS' : 'CHƯA ĐẠT' }}
        </div>
        <div class="text-white/80 mb-4">{{ result()?.passCount ?? 0 }}/{{ result()?.totalTasks ?? 0 }} tasks passed</div>
        <div class="flex items-center justify-center gap-6 pt-4 border-t border-white/20">
          <div class="text-white text-center">
            <div class="font-700 text-xl" style="font-weight: 700">+{{ result()?.xp ?? 0 }} XP</div>
            <div class="text-xs opacity-70">nhận được</div>
          </div>
          <div class="text-white text-center">
              <div class="font-700 text-xl" style="font-weight: 700">{{ result()?.totalTasks ?? 0 }}</div>
            <div class="text-xs opacity-70">total tasks</div>
          </div>
        </div>
      </div>

      <!-- Task Results Breakdown (Deferrable) -->
      @defer (on viewport) {
        <div class="card p-6">
          <h2 class="font-700 text-base mb-5" style="font-weight: 700; color: #1e293b">
            🎯 Kết quả từng mục tiêu
          </h2>
          <div class="space-y-3">
            @for (t of taskResults(); track t.id) {
              <div
                class="flex items-start gap-4 p-4 rounded-xl"
                [style.background]="t.pass ? '#F0FDF4' : '#FFF5F5'"
              >
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  [style.background]="t.pass ? '#22c55e' : '#DF4C73'"
                >
                  @if (t.pass) {
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  } @else {
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  }
                </div>
                <div class="flex-1">
                  <div class="font-700 text-sm" style="font-weight: 700; color: #1e293b">{{ t.label }}</div>
                  <div class="text-xs mt-0.5" [style.color]="t.pass ? '#166534' : '#9f1239'">{{ t.pass ? 'Objective achieved.' : 'Not completed.' }}</div>
                </div>
                <span
                  class="badge shrink-0"
                  [style.background]="t.pass ? '#DCFCE7' : '#FFE4E6'"
                  [style.color]="t.pass ? '#166534' : '#9f1239'"
                  style="font-size: 11px; font-weight: 700"
                >
                  {{ t.pass ? 'PASS' : 'NOT PASSED' }}
                </span>
              </div>
            }
          </div>
        </div>
      } @placeholder {
        <div class="card p-6 text-center text-slate-400">Loading task evaluation...</div>
      }

      <!-- AI Feedback section -->
      <div class="card p-6">
        <h2 class="font-700 text-base mb-4" style="font-weight: 700; color: #1e293b">🤖 Nhận xét từ AI Coach</h2>
        <div class="space-y-4">
          <div class="p-4 rounded-xl" style="background: #F0FDF4; border: 1px solid #86efac">
            <div class="font-700 text-sm mb-2" style="font-weight: 700; color: #166534">✅ Strengths</div>
            <ul class="space-y-1.5 text-sm" style="color: #166534">
              <li>• Dùng chunk "Could I have..." rất tự nhiên — phản xạ tốt</li>
              <li>• Hỏi thông tin thêm đúng lúc, duy trì ngữ cảnh tốt</li>
            </ul>
          </div>
          <div class="p-4 rounded-xl" style="background: #FFF5E5; border: 1px solid #fde68a">
            <div class="font-700 text-sm mb-2" style="font-weight: 700; color: #92400e">🎯 Improvements</div>
            <ul class="space-y-1.5 text-sm" style="color: #78350f">
              <li>• Thử kết thúc bằng "Could we have the bill" ở lượt sau</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="grid grid-cols-2 gap-4 pb-4">
        <button class="btn-secondary justify-center py-3 cursor-pointer" (click)="appState.go('scenarios')">
          ← Tình huống khác
        </button>
        <button class="btn-primary justify-center py-3 cursor-pointer" (click)="appState.go('scenario-roleplay')">
          🔄 Luyện lại
        </button>
      </div>
      <button class="btn-accent w-full justify-center py-3 cursor-pointer" (click)="appState.go('ai-coach')">
        🎙️ Tiếp tục với AI Coach
      </button>
    </div>
  `
})
export class ScenarioResultComponent {
  readonly appState = inject(AppStateService);

  readonly result = computed(() => this.appState.roleplayResult());
  readonly taskResults = computed(() => this.result()?.tasks ?? []);
  readonly passCount = computed(() => this.result()?.passCount ?? 0);
  readonly passed = computed(() => this.result()?.status === 'PASS');
}
