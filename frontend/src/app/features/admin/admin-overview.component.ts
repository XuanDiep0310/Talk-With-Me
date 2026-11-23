import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminConsoleService, AdminOverview } from './admin-console.service';
import { scenarioError, statuses } from './admin-scenario.service';

@Component({
  selector: 'app-admin-overview',
  imports: [RouterLink],
  styleUrl: './admin.scss',
  template: `
    <div class="page-heading">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900">Tổng quan quản trị</h1>
        <p class="text-sm text-slate-500 mt-1">Theo dõi số liệu người dùng và nội dung bài học</p>
      </div>
      <a class="action primary flex items-center gap-2" routerLink="/admin/scenarios/new">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
        <span>Tạo bài học</span>
      </a>
    </div>

    @if (overview(); as data) {
      <div class="form-grid mb-6">
        <a class="panel metric relative overflow-hidden group" routerLink="/admin/users">
          <div class="flex items-center justify-between mb-2">
            <h2>Tài khoản</h2>
            <div class="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
          </div>
          <strong>{{ data.totalAccounts }}</strong>
          <span class="secondary mt-2 flex items-center gap-1.5 text-slate-600">
            <span class="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            {{ data.activeAccounts }} đang hoạt động · {{ data.newAccounts }} đăng ký trong 7 ngày
          </span>
        </a>

        <section class="panel metric relative overflow-hidden">
          <div class="flex items-center justify-between mb-2">
            <h2>Buổi luyện đã kết thúc</h2>
            <div class="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
          <strong class="text-emerald-700">{{ data.completedSessions }}</strong>
          <span class="secondary mt-2 text-slate-600">{{ data.recentSessions }} buổi trong 7 ngày</span>
        </section>

        <a class="panel metric relative overflow-hidden group" routerLink="/admin/scenarios">
          <div class="flex items-center justify-between mb-2">
            <h2>Bài học tình huống</h2>
            <div class="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
          </div>
          <strong class="text-indigo-700">{{ total(data) }}</strong>
          <span class="secondary mt-2 text-slate-600">{{ data.scenarioCounts['PUBLISHED'] }} bài đang hiển thị</span>
        </a>
      </div>

      <section class="panel" aria-labelledby="overview-lessons">
        <div class="section-heading mb-4">
          <div class="flex items-center gap-2">
            <h2 id="overview-lessons" class="text-base font-bold text-slate-900">Trạng thái bài học</h2>
            <span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">{{ total(data) }} bài</span>
          </div>
          <a class="text-link text-xs font-semibold flex items-center gap-1" routerLink="/admin/scenarios">
            <span>Mở thư viện</span>
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
          </a>
        </div>
        <div class="grid gap-4 sm:grid-cols-3">
          @for (status of states; track status) {
            <div class="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
              <div class="flex items-center justify-between mb-2">
                <span class="status" [attr.data-status]="status">{{ labels[status] }}</span>
                <span class="text-lg font-bold text-slate-800">{{ data.scenarioCounts[status] }}</span>
              </div>
              <progress [attr.aria-label]="labels[status]" [value]="data.scenarioCounts[status]" [max]="total(data) || 1"></progress>
              <span class="text-xs text-slate-600 text-right mt-1.5">
                {{ ((data.scenarioCounts[status] / (total(data) || 1)) * 100).toFixed(0) }}% tổng số
              </span>
            </div>
          }
        </div>
      </section>
    } @else if (error()) {
      <div class="feedback error" role="alert">
        <svg class="w-5 h-5 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p>{{ error() }}</p>
      </div>
    } @else {
      <div class="p-8 text-center text-slate-500" role="status">
        <svg class="w-8 h-8 mx-auto mb-2 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <p>Đang tải số liệu…</p>
      </div>
    }
  `
})
export class AdminOverviewComponent {
  protected readonly overview = signal<AdminOverview | null>(null);
  protected readonly error = signal('');
  protected readonly states = ['PUBLISHED', 'DRAFT', 'ARCHIVED'] as const;
  protected readonly labels = statuses;

  constructor() {
    inject(AdminConsoleService).overview().pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe({
      next: (data) => this.overview.set(data),
      error: (error: unknown) => this.error.set(scenarioError(error).message)
    });
  }

  protected total(data: AdminOverview): number {
    return this.states.reduce((total, status) => total + data.scenarioCounts[status], 0);
  }
}
