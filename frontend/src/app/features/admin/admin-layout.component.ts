import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="min-h-screen bg-slate-50">
      <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto max-w-6xl px-4 sm:px-6">
          <div class="flex flex-wrap items-center gap-x-4 border-b border-slate-100 py-2">
            <a routerLink="/admin" class="mr-auto py-1 text-lg font-bold text-brand-blue">
              TalkWithMe <span class="ml-1 text-sm font-medium text-slate-600">Quản trị</span>
            </a>
            <a routerLink="/dashboard" class="py-2 text-sm font-medium text-slate-700 hover:underline">Về trang học</a>
            <button type="button" class="py-2 text-sm font-medium text-slate-700 hover:underline" (click)="signOut()">Đăng xuất</button>
          </div>
          <nav aria-label="Quản trị" class="flex flex-wrap gap-1 py-2">
            <a routerLink="/admin" routerLinkActive="bg-blue-50 text-blue-800" [routerLinkActiveOptions]="{exact: true}" ariaCurrentWhenActive="page" class="rounded-lg px-3 py-2 text-sm font-semibold">Tổng quan</a>
            <a routerLink="/admin/scenarios" routerLinkActive="bg-blue-50 text-blue-800" ariaCurrentWhenActive="page" class="rounded-lg px-3 py-2 text-sm font-semibold">Bài học</a>
            <a routerLink="/admin/categories" routerLinkActive="bg-blue-50 text-blue-800" ariaCurrentWhenActive="page" class="rounded-lg px-3 py-2 text-sm font-semibold">Nhóm chủ đề</a>
            <a routerLink="/admin/users" routerLinkActive="bg-blue-50 text-blue-800" ariaCurrentWhenActive="page" class="rounded-lg px-3 py-2 text-sm font-semibold">Tài khoản</a>
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
