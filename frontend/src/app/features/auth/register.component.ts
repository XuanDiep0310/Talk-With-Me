import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AppStateService } from '../../core/services/app-state.service';
import { AuthService, mapApiError } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { environment } from '../../../environments/environment';

interface GooglePromptNotification {
  isDisplayed(): boolean;
  isNotDisplayed(): boolean;
  getNotDisplayedReason(): string;
  isSkippedMoment(): boolean;
  getSkippedReason(): string;
  isDismissedMoment(): boolean;
  getDismissedReason(): string;
}

declare const google: {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
      prompt: (momentListener?: (notification: GooglePromptNotification) => void) => void;
    };
  };
};

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex" style="background: #F0F6FB">
      <!-- Left sidebar visual -->
      <div class="hidden lg:flex flex-col justify-center px-14 w-[480px] shrink-0" style="background: linear-gradient(160deg, #286FB4 0%, #1d5a94 100%)">
        <div class="flex items-center gap-3 mb-12">
          <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2.5">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
            </svg>
          </div>
          <span class="font-800 text-xl text-white" style="font-weight: 800">TalkWithMe</span>
        </div>
        <h2 class="text-3xl font-800 text-white mb-4 leading-tight" style="font-weight: 800">
          Bắt đầu hành trình<br />nói tiếng Anh tự tin!
        </h2>
        <p class="text-white/80 mb-10">Chỉ 15 phút/ngày — AI Coach sẽ đồng hành cùng bạn mỗi ngày.</p>
        <div class="space-y-3">
          @for (t of highlights; track t) {
            <div class="text-white/90 text-sm">{{ t }}</div>
          }
        </div>
      </div>

      <!-- Right Form -->
      <div class="flex-1 flex items-center justify-center p-6">
        <div class="w-full max-w-md">
          <button class="flex items-center gap-2 text-sm mb-8 cursor-pointer" style="color: #64748b" (click)="appState.go('landing')">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            Trang chủ
          </button>

          <h1 class="text-2xl font-800 mb-2" style="font-weight: 800; color: #1e293b">Tạo tài khoản miễn phí</h1>
          <p class="text-sm mb-8" style="color: #64748b">Đã có tài khoản?
            <button class="font-600 underline cursor-pointer" style="color: #286FB4; font-weight: 600" (click)="appState.go('login')">Đăng nhập</button>
          </p>

          <div class="space-y-4">
            <div>
              <label for="reg-name" class="text-sm font-600 block mb-1.5" style="color: #374151; font-weight: 600">Họ và tên</label>
              <input id="reg-name" class="input-field" type="text" autocomplete="name" required placeholder="Nguyễn Văn A" [value]="name()" (input)="updateName($event)" />
              @if (submitted() && name().trim().length <= 1) { <p class="mt-1 text-xs text-rose-600">Vui lòng nhập họ tên.</p> }
            </div>
            <div>
              <label for="reg-email" class="text-sm font-600 block mb-1.5" style="color: #374151; font-weight: 600">Email</label>
              <input id="reg-email" class="input-field" type="email" autocomplete="email" required placeholder="email@gmail.com" [value]="email()" (input)="updateEmail($event)" />
              @if (submitted() && !isEmailValid()) { <p class="mt-1 text-xs text-rose-600">Vui lòng nhập email hợp lệ.</p> }
            </div>
            <div>
              <label for="reg-password" class="text-sm font-600 block mb-1.5" style="color: #374151; font-weight: 600">Mật khẩu</label>
              <div class="relative">
                <input
                  id="reg-password"
                  class="input-field pr-10"
                  [type]="showPass() ? 'text' : 'password'"
                  autocomplete="new-password"
                  required
                  placeholder="Tối thiểu 6 ký tự"
                  [value]="password()"
                  (input)="updatePassword($event)"
                />
                <button
                  type="button"
                  class="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                  style="color: #94a3b8"
                  (click)="toggleShowPass()"
                  tabindex="-1"
                >
                  @if (showPass()) {
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" /></svg>
                  } @else {
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  }
                </button>
              </div>
              @if (submitted() && password().length < 6) { <p class="mt-1 text-xs text-rose-600">Mật khẩu cần ít nhất 6 ký tự.</p> }
              @if (submitted() && password().length >= 6 && isWeakPassword()) { <p class="mt-1 text-xs text-rose-600">Mật khẩu quá đơn giản hoặc dễ đoán (như 123456). Vui lòng chọn mật khẩu mạnh hơn.</p> }
              <!-- Password strength bar -->
              <div class="flex gap-1 mt-2">
                @for (bar of passwordBars(); track bar.index) {
                  <div class="flex-1 h-1 rounded-full transition-all" [style.background]="bar.color"></div>
                }
              </div>
              <div class="text-xs mt-1" style="color: #94a3b8">
                {{ passwordStrengthText() }}
              </div>
            </div>

            <!-- Terms checkbox -->
            <label class="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" class="mt-0.5 w-4 h-4" [checked]="agree()" (change)="toggleAgree()" />
              <span class="text-sm" style="color: #64748b">
                Tôi đồng ý với
                <span class="underline" style="color: #286FB4">Điều khoản dịch vụ</span> và
                <span class="underline" style="color: #286FB4">Chính sách bảo mật</span>
              </span>
            </label>
            @if (submitted() && !agree()) { <p class="text-xs text-rose-600" role="alert">Bạn cần đồng ý với điều khoản để tiếp tục.</p> }

            <button
              class="btn-primary w-full justify-center py-3 text-base cursor-pointer"
              [style.opacity]="valid() ? 1 : 0.5"
              (click)="handleRegister()"
              [disabled]="!valid() || loading()"
            >
              @if (loading()) {
                <span class="flex items-center gap-2">
                  <svg class="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="32" strokeDashoffset="10" />
                  </svg>
                  Đang tạo tài khoản...
                </span>
              } @else {
                <span>🎙️ Bắt đầu học ngay</span>
              }
            </button>

            <div class="flex items-center gap-3">
              <div class="flex-1 h-px" style="background: #E2F0F9"></div>
              <span class="text-xs" style="color: #94a3b8">hoặc</span>
              <div class="flex-1 h-px" style="background: #E2F0F9"></div>
            </div>

            <button
              class="w-full flex items-center justify-center gap-3 py-3 rounded-xl border font-500 text-sm cursor-pointer transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm active:scale-[0.99]"
              style="border: 1.5px solid #E2F0F9; color: #374151; font-weight: 500"
              (click)="handleGoogleLogin()"
              [disabled]="loading()"
            >
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Tiếp tục với Google
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class RegisterComponent {
  readonly appState = inject(AppStateService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly showPass = signal(false);
  readonly agree = signal(false);
  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly apiError = signal('');

  readonly highlights = [
    '✅ Phân tích phát âm chi tiết',
    '✅ Hơn 200 tình huống thực tế',
    '✅ Phòng luyện tập cộng đồng',
    '✅ Theo dõi tiến độ hằng ngày'
  ];

  readonly isWeakPassword = computed(() => {
    const val = this.password().trim().toLowerCase();
    const commonWeak = new Set([
      '123456', '1234567', '12345678', '123456789',
      'password', 'password123', 'qwerty', '111111',
      '000000', '123123', 'admin123', 'abc123456', 'abcdef'
    ]);
    if (commonWeak.has(val)) return true;
    if (val.length >= 6 && new Set(val).size === 1) return true;
    return false;
  });

  readonly valid = computed(() => {
    return this.name().trim().length > 1 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim()) &&
      this.password().length >= 6 &&
      !this.isWeakPassword() &&
      this.agree();
  });

  readonly passwordStrengthText = computed(() => {
    const len = this.password().length;
    if (len === 0) return 'Nhập mật khẩu';
    if (this.isWeakPassword()) return 'Quá yếu (dễ đoán)';
    if (len < 6) return 'Quá ngắn';
    if (len < 8) return 'Trung bình';
    if (len < 12) return 'Mạnh';
    return 'Rất mạnh';
  });

  readonly passwordBars = computed(() => {
    const len = this.password().length;
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

  toggleShowPass(): void {
    this.showPass.update(v => !v);
  }

  updateName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  updateEmail(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }

  updatePassword(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
  }

  toggleAgree(): void {
    this.agree.update(v => !v);
  }

  isEmailValid(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim());
  }

  async handleRegister(): Promise<void> {
    this.submitted.set(true);
    this.apiError.set('');
    if (!this.valid()) return;
    this.loading.set(true);
    try {
      await this.authService.register({
        email: this.email().trim(),
        fullName: this.name().trim(),
        password: this.password(),
        termsAccepted: this.agree()
      });
      this.toast.success('Đăng ký tài khoản thành công!');
    } catch (err) {
      const errMsg = mapApiError(err);
      this.apiError.set(errMsg);
      this.toast.error(errMsg);
    } finally {
      this.loading.set(false);
    }
  }

  handleGoogleLogin(): void {
    const clientId = environment.googleClientId?.trim();
    if (!clientId) {
      this.toast.error('Chưa cấu hình Google Client ID. Vui lòng kiểm tra cài đặt môi trường.');
      return;
    }

    if (typeof google === 'undefined' || !google.accounts?.id) {
      this.toast.error('Không thể tải Google Identity Services SDK. Vui lòng kiểm tra kết nối mạng hoặc tiện ích chặn quảng cáo.');
      return;
    }

    this.loading.set(true);
    try {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp) => {
          try {
            await this.authService.loginWithGoogle(resp.credential);
            this.toast.success('Đăng nhập Google thành công!');
          } catch (err) {
            this.toast.error(mapApiError(err));
          } finally {
            this.loading.set(false);
          }
        }
      });
      google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed()) {
          this.loading.set(false);
          const reason = notification.getNotDisplayedReason();
          if (reason === 'origin_not_authorized') {
            this.toast.error('Lỗi 403: Tên miền của bạn (http://localhost:4200) chưa được thêm vào "Authorized JavaScript origins" trong Google Cloud Console.');
          } else if (reason === 'suppressed_by_user') {
            this.toast.error('Hộp thoại đăng nhập Google bị tạm khóa do đã đóng trước đó. Vui lòng mở lại trong tab ẩn danh hoặc thử lại sau.');
          } else if (reason === 'opt_out_or_no_session') {
            this.toast.error('Vui lòng đăng nhập sẵn tài khoản Google trên trình duyệt để sử dụng tính năng này.');
          } else {
            this.toast.error(`Google Sign-In không hiển thị (${reason}).`);
          }
        } else if (notification.isSkippedMoment() || notification.isDismissedMoment()) {
          this.loading.set(false);
        }
      });
    } catch {
      this.toast.error('Không thể khởi tạo đăng nhập Google.');
      this.loading.set(false);
    }
  }
}
