import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../core/services/app-state.service';
import { AuthService, mapApiError } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-5 md:p-8 max-w-3xl mx-auto space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-800" style="font-weight:800;color:#1e293b">Hồ sơ cá nhân</h1>
        @if (!editing()) {
          <button class="btn-secondary cursor-pointer" (click)="startEdit()">✏️ Chỉnh sửa thông tin</button>
        } @else {
          <div class="flex gap-2">
            <button class="btn-secondary cursor-pointer" (click)="cancelEdit()">Hủy</button>
            <button class="btn-primary cursor-pointer" [disabled]="!draftName().trim() || saving()" (click)="saveProfile()">
              {{ saving() ? 'Đang lưu...' : 'Lưu thay đổi' }}
            </button>
          </div>
        }
      </div>

      <!-- Thông tin cá nhân & Avatar -->
      <div class="card p-6">
        <div class="flex items-center gap-6 flex-wrap">
          <!-- Avatar với Icon Camera -->
          <div class="relative group cursor-pointer" (click)="fileInput.click()" title="Nhấn để đổi ảnh đại diện">
            @if (avatarUrl()) {
              <img
                [src]="avatarUrl()!"
                [alt]="displayName()"
                class="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md bg-slate-100 transition-all group-hover:brightness-90"
              />
            } @else {
              <div class="w-24 h-24 rounded-full bg-[#286FB4] text-white flex items-center justify-center font-800 text-3xl border-4 border-white shadow-md select-none group-hover:brightness-90 transition-all">
                {{ userInitial() }}
              </div>
            }

            <!-- Hover overlay -->
            <div class="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <svg class="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>

            <!-- Badge icon máy ảnh ở góc phải -->
            <div class="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#286FB4] text-white flex items-center justify-center shadow-md border-2 border-white">
              @if (uploading()) {
                <svg class="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25"></circle>
                  <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" class="opacity-75"></path>
                </svg>
              } @else {
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            </div>

            <!-- Input file ẩn -->
            <input
              #fileInput
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="hidden"
              (change)="onFileSelected($event)"
              [disabled]="uploading()"
            />
          </div>

          <div class="flex-1 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span class="text-xs block mb-1.5" style="color:#94a3b8">HỌ VÀ TÊN</span>
                @if (editing()) {
                  <input class="input-field text-sm" [value]="draftName()" (input)="updateName($event)" required maxlength="80" />
                } @else {
                  <div class="text-sm font-600" style="color:#1e293b">{{ displayName() }}</div>
                }
              </div>
              <div>
                <span class="text-xs block mb-1.5" style="color:#94a3b8">EMAIL</span>
                <div class="text-sm" style="color:#64748b">{{ displayEmail() }}</div>
              </div>
            </div>

            @if (uploading()) {
              <div class="text-xs text-sky-600 font-500">Đang tải ảnh đại diện lên máy chủ...</div>
            } @else {
              <div class="text-xs text-slate-400">Nhấn vào ảnh đại diện hoặc biểu tượng máy ảnh để tải ảnh mới (JPEG, PNG, WebP tối đa 2 MB).</div>
            }
          </div>
        </div>
      </div>

      <!-- Thống kê học tập -->
      <div class="grid grid-cols-3 gap-4">
        @for (s of userStats(); track s.label) {
          <div class="card p-4 text-center">
            <div class="text-2xl mb-1">{{s.emoji}}</div>
            <div class="font-800 text-base" [style.color]="s.color">{{s.value}}</div>
            <div class="text-xs" style="color:#94a3b8">{{s.label}}</div>
          </div>
        }
      </div>

      <!-- Đổi mật khẩu -->
      <div class="card p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="font-700 text-base" style="font-weight: 700; color: #1e293b">🔒 Đổi mật khẩu</h2>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="text-xs block mb-1 font-600" style="color:#374151">Mật khẩu hiện tại</label>
            <input
              type="password"
              class="input-field text-sm"
              placeholder="••••••••"
              [(ngModel)]="oldPassword"
              name="oldPassword"
            />
          </div>
          <div>
            <label class="text-xs block mb-1 font-600" style="color:#374151">Mật khẩu mới</label>
            <input
              type="password"
              class="input-field text-sm"
              placeholder="Tối thiểu 6 ký tự"
              [value]="newPassword()"
              (input)="updateNewPassword($event)"
              name="newPassword"
            />
            <!-- Password strength indicator (consistent with register) -->
            <div class="flex gap-1 mt-1.5">
              @for (bar of passwordBars(); track bar.index) {
                <div class="flex-1 h-1 rounded-full transition-all" [style.background]="bar.color"></div>
              }
            </div>
            <div class="text-[11px] mt-1" style="color: #94a3b8">
              Độ mạnh: <span class="font-600" [style.color]="passwordStrengthColor()">{{ passwordStrengthText() }}</span>
            </div>
          </div>
          <div>
            <label class="text-xs block mb-1 font-600" style="color:#374151">Xác nhận mật khẩu mới</label>
            <input
              type="password"
              class="input-field text-sm"
              placeholder="Nhập lại mật khẩu"
              [(ngModel)]="confirmNewPassword"
              name="confirmNewPassword"
            />
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <button
            class="btn-primary text-sm cursor-pointer"
            (click)="handleChangePassword()"
            [disabled]="pwdLoading() || !oldPassword || !newPassword"
          >
            {{ pwdLoading() ? 'Đang cập nhật...' : 'Cập nhật mật khẩu' }}
          </button>
        </div>
      </div>

      <!-- Sprint 2: Sở thích & Mục tiêu (để trống tạm thời) -->
      <div class="card p-6">
        <h2 class="font-700 text-base mb-2" style="color:#1e293b">Sở thích</h2>
        <p class="text-xs" style="color:#94a3b8">Sẽ được thiết lập trong bước Onboarding (Sprint 2).</p>
      </div>

      <div class="card p-6">
        <h2 class="font-700 text-base mb-2" style="color:#1e293b">Mục tiêu học tập</h2>
        <p class="text-xs" style="color:#94a3b8">Sẽ được thiết lập trong bước Onboarding (Sprint 2).</p>
      </div>

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
    </div>
  `
})
export class ProfileComponent {
  readonly appState = inject(AppStateService);
  readonly authService = inject(AuthService);
  readonly userService = inject(UserService);
  private readonly toast = inject(ToastService);

  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly savedMessage = signal('');
  readonly errorMessage = signal('');

  // Password change state
  oldPassword = '';
  readonly newPassword = signal('');
  confirmNewPassword = '';
  readonly pwdLoading = signal(false);
  readonly pwdSuccess = signal('');
  readonly pwdError = signal('');

  updateNewPassword(event: Event): void {
    this.newPassword.set((event.target as HTMLInputElement).value);
    this.pwdError.set('');
  }

  readonly isWeakPassword = computed(() => {
    const val = this.newPassword().trim().toLowerCase();
    const commonWeak = new Set([
      '123456', '1234567', '12345678', '123456789',
      'password', 'password123', 'qwerty', '111111',
      '000000', '123123', 'admin123', 'abc123456', 'abcdef'
    ]);
    if (commonWeak.has(val)) return true;
    if (val.length >= 6 && new Set(val).size === 1) return true;
    return false;
  });

  readonly passwordStrengthText = computed(() => {
    const pwd = this.newPassword();
    const len = pwd.length;
    if (len === 0) return 'Nhập mật khẩu';
    if (this.isWeakPassword()) return 'Quá yếu (dễ đoán)';
    if (len < 6) return 'Quá ngắn';
    if (len < 8) return 'Trung bình';
    if (len < 12) return 'Mạnh';
    return 'Rất mạnh';
  });

  readonly passwordStrengthColor = computed(() => {
    const pwd = this.newPassword();
    if (pwd.length === 0) return '#94a3b8';
    if (this.isWeakPassword() || pwd.length < 6) return '#ef4444';
    if (pwd.length < 8) return '#f59e0b';
    return '#16a34a';
  });

  readonly passwordBars = computed(() => {
    const pwd = this.newPassword();
    const len = pwd.length;
    if (len === 0) {
      return [1, 2, 3, 4].map(i => ({ index: i, color: '#E2F0F9' }));
    }
    if (this.isWeakPassword() || len < 6) {
      return [1, 2, 3, 4].map(i => ({ index: i, color: i === 1 ? '#ef4444' : '#E2F0F9' }));
    }
    const strength = len < 8 ? 2 : len < 12 ? 3 : 4;
    const colors = ['#E2F0F9', '#f59e0b', '#f59e0b', '#22c55e', '#16a34a'];
    return [1, 2, 3, 4].map(i => ({
      index: i,
      color: i <= strength ? colors[strength] : '#E2F0F9'
    }));
  });

  readonly displayName = computed(() => {
    return this.authService.currentUser()?.fullName ?? this.appState.appUser().name ?? 'Người dùng';
  });

  readonly displayEmail = computed(() => {
    return this.authService.currentUser()?.email ?? this.appState.appUser().email ?? '';
  });

  readonly avatarUrl = computed(() => {
    const userAvatar = this.authService.currentUser()?.avatarUrl;
    if (userAvatar) {
      if (userAvatar.startsWith('http')) return userAvatar;
      if (userAvatar.startsWith('/')) return `http://localhost:8000${userAvatar}`;
      return userAvatar;
    }
    return null;
  });

  readonly userInitial = computed(() => {
    const name = this.displayName().trim();
    if (!name) return 'U';
    const parts = name.split(/\s+/);
    return parts[parts.length - 1][0].toUpperCase();
  });

  readonly draftName = signal('');

  readonly userStats = computed(() => [
    { label: 'Level hiện tại', value: this.appState.appUser().level || 'A1', emoji: '🎓', color: '#286FB4' },
    { label: 'Tổng XP', value: `${this.appState.totalXp().toLocaleString()} XP`, emoji: '⭐', color: '#f59e0b' },
    { label: 'Streak', value: `${this.appState.currentStreak()} ngày`, emoji: '🔥', color: '#ea580c' }
  ]);

  startEdit(): void {
    this.draftName.set(this.displayName());
    this.savedMessage.set('');
    this.errorMessage.set('');
    this.editing.set(true);
  }

  updateName(event: Event): void {
    this.draftName.set((event.target as HTMLInputElement).value);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    if (file.size > 2 * 1024 * 1024) {
      this.toast.error('Ảnh đại diện không được vượt quá 2 MB.');
      return;
    }

    this.uploading.set(true);

    this.userService.uploadAvatar(file).subscribe({
      next: (resp) => {
        this.uploading.set(false);
        this.toast.success('Ảnh đại diện đã được cập nhật thành công!');
        // Update currentUser signal immediately with the returned avatarUrl (includes timestamp query)
        this.authService.currentUser.update(user => user ? { ...user, avatarUrl: resp.avatarUrl } : null);
        // Refresh local user state from server
        void this.authService.loadCurrentUser();
      },
      error: (err) => {
        this.toast.error(mapApiError(err) || 'Không thể tải ảnh lên.');
        this.uploading.set(false);
      }
    });
  }

  async saveProfile(): Promise<void> {
    const name = this.draftName().trim();
    if (!name) return;

    this.saving.set(true);

    this.userService.updateMe({ fullName: name }).subscribe({
      next: (updated) => {
        this.authService.currentUser.set(updated);
        this.saving.set(false);
        this.editing.set(false);
        this.toast.success('Hồ sơ đã được cập nhật thành công!');
      },
      error: (err) => {
        this.toast.error(mapApiError(err) || 'Không thể lưu thông tin.');
        this.saving.set(false);
      }
    });
  }

  handleChangePassword(): void {
    const newPwd = this.newPassword().trim();

    if (newPwd.length < 6) {
      this.toast.error('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (this.isWeakPassword()) {
      this.toast.error('Mật khẩu quá đơn giản hoặc dễ đoán (như 123456, 111111...). Vui lòng chọn mật khẩu mạnh hơn.');
      return;
    }

    if (this.oldPassword && this.oldPassword.trim() === newPwd) {
      this.toast.error('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
      return;
    }

    if (newPwd !== this.confirmNewPassword.trim()) {
      this.toast.error('Mật khẩu xác nhận không khớp.');
      return;
    }

    this.pwdLoading.set(true);
    this.userService.changePassword({
      oldPassword: this.oldPassword,
      newPassword: newPwd,
    }).subscribe({
      next: () => {
        this.pwdLoading.set(false);
        this.toast.success('Mật khẩu đã được thay đổi thành công!');
        this.oldPassword = '';
        this.newPassword.set('');
        this.confirmNewPassword = '';
      },
      error: (err) => {
        this.pwdLoading.set(false);
        const code = err?.error?.code;
        if (code === 'INVALID_OLD_PASSWORD') {
          this.toast.error('Mật khẩu hiện tại không chính xác.');
        } else if (code === 'PASSWORD_SAME_AS_OLD') {
          this.toast.error('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
        } else if (code === 'PASSWORD_TOO_WEAK') {
          this.toast.error(err?.error?.message || 'Mật khẩu quá đơn giản hoặc dễ đoán.');
        } else {
          this.toast.error(err?.error?.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.');
        }
      }
    });
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }
}
