import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../core/services/app-state.service';

interface LoginFeature {
  emoji: string;
  label: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex" style="background: #F0F6FB">
      <!-- Left visual section -->
      <div class="hidden lg:flex flex-col justify-center px-14 w-[480px] shrink-0" style="background: #286FB4">
        <div class="flex items-center gap-3 mb-12">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2.5">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
            </svg>
          </div>
          <span class="font-800 text-xl text-white" style="font-weight: 800">TalkWithMe</span>
        </div>
        <h2 class="text-3xl font-800 text-white mb-4 leading-tight" style="font-weight: 800">
          Chào mừng trở lại!<br />Tiếp tục hành trình của bạn.
        </h2>
        <p class="text-white/80 mb-10">Streak của bạn đang chờ — đừng để chuỗi ngày học bị đứt nhé!</p>

        <div class="space-y-4">
          @for (item of leftHighlights; track item.label) {
            <div class="flex items-center gap-3 p-3 rounded-xl bg-white/15">
              <span class="text-xl">{{ item.emoji }}</span>
              <span class="text-white font-500" style="font-weight: 500">{{ item.label }}</span>
            </div>
          }
        </div>
      </div>

      <!-- Right login form section -->
      <div class="flex-1 flex items-center justify-center p-6">
        <div class="w-full max-w-md">
          <button class="flex items-center gap-2 text-sm mb-8 cursor-pointer" style="color: #64748b" (click)="appState.go('landing')">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            Trang chủ
          </button>

          @if (!forgotMode()) {
            <h1 class="text-2xl font-800 mb-2" style="font-weight: 800; color: #1e293b">Đăng nhập</h1>
            <p class="text-sm mb-8" style="color: #64748b">Chưa có tài khoản?
              <button class="font-600 underline cursor-pointer" style="color: #286FB4; font-weight: 600" (click)="appState.go('register')">Đăng ký miễn phí</button>
            </p>

            <div class="space-y-4">
              <div>
                <label class="text-sm font-600 block mb-1.5" style="color: #374151; font-weight: 600">Email</label>
                <input class="input-field" type="email" placeholder="email@gmail.com" [value]="email()" (input)="updateEmail($event)" />
              </div>
              <div>
                <label class="text-sm font-600 block mb-1.5" style="color: #374151; font-weight: 600">Mật khẩu</label>
                <div class="relative">
                  <input class="input-field pr-10" [type]="showPass() ? 'text' : 'password'" placeholder="••••••••" [value]="password()" (input)="updatePassword($event)" />
                  <button class="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer" style="color: #94a3b8" (click)="toggleShowPass()">
                    @if (showPass()) {
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" /></svg>
                    } @else {
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    }
                  </button>
                </div>
                <button class="text-xs mt-2 cursor-pointer" style="color: #286FB4" (click)="forgotMode.set(true)">Quên mật khẩu?</button>
              </div>

              <div class="flex items-center gap-2">
                <input type="checkbox" id="remember" class="w-4 h-4" />
                <label htmlFor="remember" class="text-sm" style="color: #64748b">Ghi nhớ đăng nhập</label>
              </div>

              <button
                class="btn-primary w-full justify-center py-3 text-base cursor-pointer"
                style="border-radius: 12px"
                (click)="handleLogin()"
                [disabled]="loading()"
              >
                @if (loading()) {
                  <span class="flex items-center gap-2">
                    <svg class="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="32" strokeDashoffset="10" />
                    </svg>
                    Đang đăng nhập...
                  </span>
                } @else {
                  <span>Đăng nhập</span>
                }
              </button>

              <div class="flex items-center gap-3">
                <div class="flex-1 h-px" style="background: #E2F0F9"></div>
                <span class="text-xs" style="color: #94a3b8">hoặc</span>
                <div class="flex-1 h-px" style="background: #E2F0F9"></div>
              </div>

              <button class="w-full flex items-center justify-center gap-3 py-3 rounded-xl border font-500 text-sm cursor-pointer" style="border: 1.5px solid #E2F0F9; color: #374151; font-weight: 500">
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Tiếp tục với Google
              </button>
            </div>
          } @else {
            <h1 class="text-2xl font-800 mb-2" style="font-weight: 800; color: #1e293b">Quên mật khẩu</h1>
            <p class="text-sm mb-8" style="color: #64748b">Nhập email để nhận link đặt lại mật khẩu.</p>
            @if (!forgotSent()) {
              <div class="space-y-4">
                <input class="input-field" type="email" placeholder="email@gmail.com" [value]="email()" (input)="updateEmail($event)" />
                <button class="btn-primary w-full justify-center py-3 cursor-pointer" style="border-radius: 12px" (click)="handleForgot()" [disabled]="loading()">
                  @if (loading()) {
                    <span>Đang gửi...</span>
                  } @else {
                    <span>Gửi link đặt lại</span>
                  }
                </button>
                <button class="text-sm text-center w-full cursor-pointer" style="color: #64748b" (click)="forgotMode.set(false)">← Quay lại đăng nhập</button>
              </div>
            } @else {
              <div class="text-center py-8">
                <div class="text-5xl mb-4">📬</div>
                <div class="font-700 mb-2" style="font-weight: 700; color: #1e293b">Đã gửi!</div>
                <p class="text-sm mb-6" style="color: #64748b">Kiểm tra hộp thư <strong>{{ email() }}</strong> để đặt lại mật khẩu.</p>
                <button class="btn-primary cursor-pointer" (click)="resetForgotState()">Quay lại đăng nhập</button>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  readonly appState = inject(AppStateService);

  readonly email = signal("minhanh@gmail.com");
  readonly password = signal("••••••••");
  readonly loading = signal(false);
  readonly showPass = signal(false);
  readonly forgotMode = signal(false);
  readonly forgotSent = signal(false);

  readonly leftHighlights: LoginFeature[] = [
    { emoji: "🔥", label: "Streak 12 ngày liên tiếp" },
    { emoji: "⭐", label: "3.420 XP tích lũy" },
    { emoji: "🏆", label: "Level B1 — gần đến B2!" }
  ];

  updateEmail(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }

  updatePassword(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
  }

  toggleShowPass(): void {
    this.showPass.update(v => !v);
  }

  handleLogin(): void {
    this.loading.set(true);
    setTimeout(() => {
      this.loading.set(false);
      this.appState.login();
    }, 600);
  }

  handleForgot(): void {
    this.loading.set(true);
    setTimeout(() => {
      this.loading.set(false);
      this.forgotSent.set(true);
    }, 600);
  }

  resetForgotState(): void {
    this.forgotMode.set(false);
    this.forgotSent.set(false);
  }
}
