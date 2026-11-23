import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterOutlet],
  template: `
    <div class="min-h-screen bg-slate-50">
      <header class="border-b border-slate-200 bg-white">
        <nav aria-label="Quản trị" class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <a routerLink="/admin/scenarios" class="mr-auto py-2 text-lg font-bold text-brand-blue">
            TalkWithMe <span class="ml-1 text-sm font-medium text-slate-600">Quản trị</span>
          </a>
          <a routerLink="/dashboard" class="py-2 text-sm font-medium text-slate-700 hover:underline">Về trang học</a>
          <button type="button" class="py-2 text-sm font-medium text-slate-700 hover:underline" (click)="auth.logout()">
            Đăng xuất
          </button>
        </nav>
      </header>
      <main class="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <router-outlet />
      </main>
    </div>
  `
})
export class AdminLayoutComponent {
  protected readonly auth = inject(AuthService);
}
