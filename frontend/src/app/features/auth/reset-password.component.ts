import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, mapApiError } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex items-center justify-center p-6" style="background: #F0F6FB">
      <div class="w-full max-w-md">
        <!-- Logo -->
        <div class="flex items-center gap-3 mb-10 justify-center">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shadow-md" style="background: #286FB4">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2.5">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
            </svg>
          </div>
          <span class="font-800 text-xl" style="font-weight: 800; color: #1e293b">TalkWithMe</span>
        </div>

        @if (tokenMissing()) {
          <!-- No token in URL -->
          <div class="card p-8 text-center shadow-md">
            <div class="text-5xl mb-4">⚠️</div>
            <h1 class="text-xl font-700 mb-2" style="font-weight: 700; color: #1e293b">Liên kết không hợp lệ</h1>
            <p class="text-sm mb-6" style="color: #64748b">Link đặt lại mật khẩu đã hết hạn hoặc không đúng.</p>
            <button class="btn-primary cursor-pointer w-full justify-center" (click)="goToLogin()">Quay lại đăng nhập</button>
          </div>
        } @else if (success()) {
          <!-- Success state -->
          <div class="card p-8 text-center shadow-md">
            <div class="text-5xl mb-4">✅</div>
            <h1 class="text-xl font-700 mb-2" style="font-weight: 700; color: #1e293b">Đặt lại mật khẩu thành công!</h1>
            <p class="text-sm mb-6" style="color: #64748b">Mật khẩu của bạn đã được cập nhật an toàn. Vui lòng đăng nhập lại để tiếp tục.</p>
            <button class="btn-primary cursor-pointer w-full justify-center" (click)="goToLogin()">Đi đến đăng nhập</button>
          </div>
        } @else {
          <!-- Reset form -->
          <div class="card p-8 shadow-md">
            <h1 class="text-2xl font-800 mb-2" style="font-weight: 800; color: #1e293b">Đặt lại mật khẩu</h1>
            <p class="text-sm mb-8" style="color: #64748b">Nhập mật khẩu mới cho tài khoản của bạn.</p>

            <div class="space-y-4">
              <!-- Mật khẩu mới -->
              <div>
                <label for="new-password" class="text-sm font-600 block mb-1.5" style="color: #374151; font-weight: 600">
                  Mật khẩu mới
                </label>
                <div class="relative">
                  <input
                    id="new-password"
                    class="input-field pr-10"
                    [type]="showNewPass() ? 'text' : 'password'"
                    autocomplete="new-password"
                    placeholder="Tối thiểu 6 ký tự"
                    [value]="newPassword()"
                    (input)="newPassword.set(getInputValue($event))"
                  />
                  <button
                    type="button"
                    class="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                    style="color: #94a3b8"
                    (click)="toggleShowNewPass()"
                    tabindex="-1"
                  >
                    @if (showNewPass()) {
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/>
                      </svg>
                    } @else {
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    }
                  </button>
                </div>
                @if (submitted() && newPassword().length < 6) {
                  <p class="mt-1 text-xs text-rose-600">Mật khẩu cần ít nhất 6 ký tự.</p>
                }
                @if (submitted() && newPassword().length >= 6 && isWeakPassword()) {
                  <p class="mt-1 text-xs text-rose-600">Mật khẩu quá đơn giản hoặc dễ đoán (như 123456). Vui lòng chọn mật khẩu mạnh hơn.</p>
                }
                <!-- Password strength bar -->
                <div class="flex gap-1 mt-2">
                  @for (bar of passwordBars(); track bar.index) {
                    <div class="flex-1 h-1 rounded-full transition-all" [style.background]="bar.color"></div>
                  }
                </div>
                <div class="text-xs mt-1" [style.color]="passwordStrengthColor()">
                  {{ passwordStrengthText() }}
                </div>
              </div>

              <!-- Xác nhận mật khẩu -->
              <div>
                <label for="confirm-password" class="text-sm font-600 block mb-1.5" style="color: #374151; font-weight: 600">
                  Xác nhận mật khẩu
                </label>
                <div class="relative">
                  <input
                    id="confirm-password"
                    class="input-field pr-10"
                    [type]="showConfirmPass() ? 'text' : 'password'"
                    autocomplete="new-password"
                    placeholder="Nhập lại mật khẩu"
                    [value]="confirmPassword()"
                    (input)="confirmPassword.set(getInputValue($event))"
                  />
                  <button
                    type="button"
                    class="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                    style="color: #94a3b8"
                    (click)="toggleShowConfirmPass()"
                    tabindex="-1"
                  >
                    @if (showConfirmPass()) {
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/>
                      </svg>
                    } @else {
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    }
                  </button>
                </div>
                @if (submitted() && confirmPassword().length > 0 && newPassword() !== confirmPassword()) {
                  <p class="mt-1 text-xs text-rose-600">Mật khẩu xác nhận không khớp.</p>
                }
              </div>

              <button
                class="btn-primary w-full justify-center py-3 text-base cursor-pointer mt-2"
                style="border-radius: 12px"
                (click)="handleReset()"
                [disabled]="loading()"
              >
                @if (loading()) {
                  <span class="flex items-center gap-2">
                    <svg class="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="32" strokeDashoffset="10" />
                    </svg>
                    Đang xử lý...
                  </span>
                } @else {
                  <span>Đặt lại mật khẩu</span>
                }
              </button>

              <button
                class="text-sm text-center w-full cursor-pointer transition-colors hover:text-slate-700"
                style="color: #64748b"
                (click)="goToLogin()"
              >
                ← Quay lại đăng nhập
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class ResetPasswordComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  private token = '';

  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly showNewPass = signal(false);
  readonly showConfirmPass = signal(false);
  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly success = signal(false);
  readonly tokenMissing = signal(false);

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
    const len = this.newPassword().length;
    if (len === 0) return 'Nhập mật khẩu';
    if (this.isWeakPassword()) return 'Quá yếu (dễ đoán)';
    if (len < 6) return 'Quá ngắn';
    if (len < 8) return 'Trung bình';
    if (len < 12) return 'Mạnh';
    return 'Rất mạnh';
  });

  readonly passwordStrengthColor = computed(() => {
    const len = this.newPassword().length;
    if (len === 0) return '#94a3b8';
    if (this.isWeakPassword() || len < 6) return '#ef4444';
    if (len < 8) return '#f59e0b';
    return '#16a34a';
  });

  readonly passwordBars = computed(() => {
    const len = this.newPassword().length;
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

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.tokenMissing.set(true);
    } else {
      this.token = token;
    }
  }

  getInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  toggleShowNewPass(): void {
    this.showNewPass.update(v => !v);
  }

  toggleShowConfirmPass(): void {
    this.showConfirmPass.update(v => !v);
  }

  async handleReset(): Promise<void> {
    this.submitted.set(true);

    const newPwd = this.newPassword().trim();
    const confirmPwd = this.confirmPassword().trim();

    if (newPwd.length < 6) {
      this.toast.error('Mật khẩu cần ít nhất 6 ký tự.');
      return;
    }
    if (this.isWeakPassword()) {
      this.toast.error('Mật khẩu quá đơn giản hoặc dễ đoán (như 123456). Vui lòng chọn mật khẩu mạnh hơn.');
      return;
    }
    if (newPwd !== confirmPwd) {
      this.toast.error('Mật khẩu xác nhận không khớp.');
      return;
    }

    this.loading.set(true);
    try {
      await this.authService.resetPassword(this.token, newPwd);
      this.success.set(true);
      this.toast.success('Đặt lại mật khẩu thành công!');
    } catch (err) {
      const errMsg = mapApiError(err);
      this.toast.error(errMsg);
    } finally {
      this.loading.set(false);
    }
  }

  goToLogin(): void {
    void this.router.navigateByUrl('/login');
  }
}
