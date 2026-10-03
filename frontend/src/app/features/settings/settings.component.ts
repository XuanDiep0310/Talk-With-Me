import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';
import { THEME_OPTIONS } from '../../core/data/mock-data';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-5 md:p-8 max-w-2xl mx-auto space-y-6">
      <h1 class="text-2xl font-800" style="font-weight: 800; color: #1e293b">Cài đặt</h1>

      <!-- Notifications -->
      <div class="card p-6">
        <h2 class="font-700 text-base mb-5" style="font-weight: 700; color: #1e293b">🔔 Thông báo</h2>
        <div class="space-y-4">
          <div class="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4">
            <div class="min-w-0 flex-1">
              <div class="text-sm font-600" style="font-weight: 600; color: #374151">Bật thông báo</div>
              <div class="text-xs mt-0.5" style="color: #94a3b8">Nhận thông báo từ TalkWithMe</div>
            </div>
            <button
              type="button" role="switch" [attr.aria-checked]="notifications()" aria-label="Notifications"
              (click)="toggleNotifications()"
              class="w-12 h-6 rounded-full transition-all relative shrink-0 cursor-pointer"
              [style.background]="notifications() ? '#286FB4' : '#E2F0F9'"
            >
              <div
                class="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow"
                [style.left]="notifications() ? 'calc(100% - 22px)' : '2px'"
              ></div>
            </button>
          </div>

          <div class="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4">
            <div class="min-w-0 flex-1">
              <div class="text-sm font-600" style="font-weight: 600; color: #374151">Nhắc nhở hằng ngày</div>
              <div class="text-xs mt-0.5" style="color: #94a3b8">Nhắc luyện tập đúng giờ</div>
            </div>
            <button
              type="button" role="switch" [attr.aria-checked]="dailyReminder()" aria-label="Daily reminder"
              (click)="toggleDailyReminder()"
              class="w-12 h-6 rounded-full transition-all relative shrink-0 cursor-pointer"
              [style.background]="dailyReminder() ? '#286FB4' : '#E2F0F9'"
            >
              <div
                class="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow"
                [style.left]="dailyReminder() ? 'calc(100% - 22px)' : '2px'"
              ></div>
            </button>
          </div>
        </div>
      </div>

      <!-- AI Coach Settings -->
      <div class="card p-6">
        <h2 class="font-700 text-base mb-5" style="font-weight: 700; color: #1e293b">🎙️ AI Coach Settings</h2>
        <div class="space-y-4">
          <div class="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4">
            <div>
              <div class="text-sm font-600" style="font-weight: 600; color: #374151">Giọng AI</div>
            </div>
            <select aria-label="AI voice" class="input-field text-sm w-full sm:w-[130px]" [value]="aiVoice()" (change)="updateAiVoice($event)">
              <option value="female">Giọng nữ</option>
              <option value="male">Giọng nam</option>
              <option value="neutral">Trung tính</option>
            </select>
          </div>

          <div class="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4">
            <div class="min-w-0 flex-1">
              <div class="text-sm font-600" style="font-weight: 600; color: #374151">Tốc độ nói của AI</div>
              <div class="text-xs mt-0.5" style="color: #94a3b8">Ảnh hưởng đến độ khó khi nghe</div>
            </div>
            <select aria-label="AI speech speed" class="input-field text-sm w-full sm:w-[130px]" [value]="aiSpeed()" (change)="updateAiSpeed($event)">
              <option value="slow">Chậm</option>
              <option value="normal">Bình thường</option>
              <option value="fast">Nhanh</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Theme & Appearance -->
      <div class="card p-6">
        <h2 class="font-700 text-base mb-5" style="font-weight: 700; color: #1e293b">🎨 Giao diện</h2>
        <div class="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4">
          <div>
            <div class="text-sm font-600" style="font-weight: 600; color: #374151">Giao diện màu</div>
          </div>
          <div class="flex flex-wrap gap-2">
            @for (t of themeOptions; track t.val) {
              <button
                class="px-3 py-1.5 rounded-lg text-xs font-600 transition-all cursor-pointer"
                [style.background]="theme() === t.val ? '#286FB4' : '#E2F0F9'"
                [style.color]="theme() === t.val ? '#fff' : '#286FB4'"
                [attr.aria-pressed]="theme() === t.val"
                (click)="setTheme(t.val)"
              >
                {{ t.label }}
              </button>
            }
          </div>
        </div>
      </div>

      <!-- System Health Diagnostics Link -->
      <div class="card p-6">
        <div class="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="text-sm font-600" style="font-weight: 600; color: #374151">Trạng thái hệ thống</div>
            <div class="text-xs mt-0.5" style="color: #94a3b8">Kiểm tra kết nối Backend FastAPI, PostgreSQL, Redis</div>
          </div>
          <button class="btn-secondary text-sm cursor-pointer" (click)="appState.go('health')">
            Kiểm tra Health
          </button>
        </div>
      </div>

      <!-- Account Actions -->
      <div class="card p-6">
        <button class="w-full text-left text-sm py-2 cursor-pointer text-rose-600 font-600" (click)="appState.logout()">
          Đăng xuất tài khoản
        </button>
      </div>

      <div class="text-center text-xs py-4" style="color: #94a3b8">
        TalkWithMe Angular 19 v1.0.0 · Điều khoản · Bảo mật
      </div>
    </div>
  `
})
export class SettingsComponent {
  readonly appState = inject(AppStateService);

  readonly notifications = computed(() => this.appState.settings().notifications);
  readonly dailyReminder = computed(() => this.appState.settings().dailyReminder);
  readonly aiVoice = computed(() => this.appState.settings().aiVoice);
  readonly aiSpeed = computed(() => this.appState.settings().aiSpeed);
  readonly theme = computed(() => this.appState.settings().theme);
  readonly themeOptions = THEME_OPTIONS;

  updateAiVoice(event: Event): void {
    this.appState.updateSettings({ aiVoice: (event.target as HTMLSelectElement).value });
  }

  updateAiSpeed(event: Event): void {
    this.appState.updateSettings({ aiSpeed: (event.target as HTMLSelectElement).value });
  }

  toggleNotifications(): void {
    this.appState.updateSettings({ notifications: !this.notifications() });
  }

  toggleDailyReminder(): void {
    this.appState.updateSettings({ dailyReminder: !this.dailyReminder() });
  }

  setTheme(theme: 'light' | 'dark' | 'system'): void { this.appState.updateSettings({ theme }); }
}
