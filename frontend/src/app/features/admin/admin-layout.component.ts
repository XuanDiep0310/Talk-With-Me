import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="min-h-screen bg-slate-50 text-slate-900">
      <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div class="mx-auto max-w-6xl px-4 sm:px-6">
          <div class="flex items-center justify-between border-b border-slate-100 py-3">
            <div class="flex items-center gap-3">
              <a routerLink="/admin" class="flex items-center gap-2 text-lg font-bold tracking-tight text-blue-700 transition hover:opacity-90">
                <span>TalkWithMe</span>
                <span class="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">Quản trị</span>
              </a>
            </div>
            <div class="flex items-center gap-3">
              <a routerLink="/dashboard" class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                <span>Về trang học</span>
              </a>
              <div class="h-4 w-px bg-slate-200" aria-hidden="true"></div>
              <button type="button" class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50" (click)="signOut()">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
          <nav aria-label="Quản trị" class="flex flex-wrap gap-1.5 py-2.5">
            <a routerLink="/admin" routerLinkActive="bg-blue-600 text-white shadow-sm" [routerLinkActiveOptions]="{exact: true}" ariaCurrentWhenActive="page" class="rounded-lg px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">Tổng quan</a>
            <a routerLink="/admin/scenarios" routerLinkActive="bg-blue-600 text-white shadow-sm" ariaCurrentWhenActive="page" class="rounded-lg px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">Bài học</a>
            <a routerLink="/admin/categories" routerLinkActive="bg-blue-600 text-white shadow-sm" ariaCurrentWhenActive="page" class="rounded-lg px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">Nhóm chủ đề</a>
            <a routerLink="/admin/users" routerLinkActive="bg-blue-600 text-white shadow-sm" ariaCurrentWhenActive="page" class="rounded-lg px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">Tài khoản</a>
            <a routerLink="/admin/coach-topics" routerLinkActive="bg-blue-600 text-white shadow-sm" ariaCurrentWhenActive="page" class="rounded-lg px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">Chủ đề AI Coach</a>
            <a routerLink="/admin/gamification" routerLinkActive="bg-blue-600 text-white shadow-sm" ariaCurrentWhenActive="page" class="rounded-lg px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">Gamification</a>
            <a routerLink="/admin/sessions" routerLinkActive="bg-blue-600 text-white shadow-sm" ariaCurrentWhenActive="page" class="rounded-lg px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">Phiên học</a>
            <a routerLink="/admin/analytics" routerLinkActive="bg-blue-600 text-white shadow-sm" ariaCurrentWhenActive="page" class="rounded-lg px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">Phân tích</a>
            <a routerLink="/admin/audit-logs" routerLinkActive="bg-blue-600 text-white shadow-sm" ariaCurrentWhenActive="page" class="rounded-lg px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">Kiểm toán</a>
          </nav>
        </div>
      </header>
      <main class="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <router-outlet />
      </main>
    </div>
  `
})
export class AdminLayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected async signOut(): Promise<void> {
    if (await this.router.navigateByUrl('/login')) await this.auth.logout();
  }
}
