import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../core/services/toast.service';
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
        <button
          type="button"
          class="w-full py-3 rounded-xl text-sm font-600 cursor-pointer transition-all duration-200 hover:bg-rose-50 hover:border-rose-300 hover:shadow-sm active:scale-[0.99] flex items-center justify-center gap-2"
          style="background:#FFF5F5;color:#DF4C73;border:1.5px solid #fecdd3"
          (click)="logout()"
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Đăng xuất tài khoản
        </button>
      </div>

      <div class="text-center text-xs py-4" style="color: #94a3b8">
        TalkWithMe Angular 19 v1.0.0 · Điều khoản · Bảo mật
      </div>
    </div>
  `
})
export class SettingsComponent implements OnInit {
  readonly appState = inject(AppStateService);
  readonly authService = inject(AuthService);
  readonly userService = inject(UserService);
  private readonly toast = inject(ToastService);

  readonly notifications = signal(true);
  readonly dailyReminder = signal(true);
  readonly aiVoice = signal<'female' | 'male'>('female');
  readonly aiSpeed = signal<'slow' | 'normal' | 'fast'>('normal');
  readonly theme = signal<'light' | 'dark' | 'system'>('system');
  readonly themeOptions = THEME_OPTIONS;

  readonly saveStatus = signal('');

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.userService.getSettings().subscribe({
        next: (settings) => {
          this.notifications.set(settings.notificationsEnabled);
          this.dailyReminder.set(settings.dailyReminderEnabled);
          this.aiVoice.set(settings.aiVoice);
          this.aiSpeed.set(settings.speechSpeed);
          this.theme.set(settings.theme);
        },
        error: () => {
          // fallback to local app state
          const s = this.appState.settings();
          this.notifications.set(s.notifications);
          this.dailyReminder.set(s.dailyReminder);
          this.aiVoice.set(s.aiVoice === 'female' ? 'female' : 'male');
          this.aiSpeed.set(s.aiSpeed === 'slow' || s.aiSpeed === 'fast' ? s.aiSpeed : 'normal');
          this.theme.set(s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system');
        }
      });
    } else {
      const s = this.appState.settings();
      this.notifications.set(s.notifications);
      this.dailyReminder.set(s.dailyReminder);
      this.aiVoice.set(s.aiVoice === 'female' ? 'female' : 'male');
      this.aiSpeed.set(s.aiSpeed === 'slow' || s.aiSpeed === 'fast' ? s.aiSpeed : 'normal');
      this.theme.set(s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system');
    }
  }

  private saveChanges(patch: {
    notificationsEnabled?: boolean;
    dailyReminderEnabled?: boolean;
    aiVoice?: 'female' | 'male';
    speechSpeed?: 'slow' | 'normal' | 'fast';
    theme?: 'light' | 'dark' | 'system';
  }): void {
    if (this.authService.isAuthenticated()) {
      this.userService.updateSettings(patch).subscribe({
        next: () => {
          this.toast.success('Đã lưu thay đổi.');
        },
        error: () => {
          this.toast.error('Không thể lưu cài đặt lên máy chủ.');
        }
      });
    }
  }

  updateAiVoice(event: Event): void {
    const val = (event.target as HTMLSelectElement).value as 'female' | 'male';
    this.aiVoice.set(val);
    this.appState.updateSettings({ aiVoice: val });
    this.saveChanges({ aiVoice: val });
  }

  updateAiSpeed(event: Event): void {
    const val = (event.target as HTMLSelectElement).value as 'slow' | 'normal' | 'fast';
    this.aiSpeed.set(val);
    this.appState.updateSettings({ aiSpeed: val });
    this.saveChanges({ speechSpeed: val });
  }

  toggleNotifications(): void {
    const val = !this.notifications();
    this.notifications.set(val);
    this.appState.updateSettings({ notifications: val });
    this.saveChanges({ notificationsEnabled: val });
  }

  toggleDailyReminder(): void {
    const val = !this.dailyReminder();
    this.dailyReminder.set(val);
    this.appState.updateSettings({ dailyReminder: val });
    this.saveChanges({ dailyReminderEnabled: val });
  }

  setTheme(theme: 'light' | 'dark' | 'system'): void {
    this.theme.set(theme);
    this.appState.updateSettings({ theme });
    this.saveChanges({ theme });
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }
}
