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
    <div class="page-heading"><h1>Tổng quan quản trị</h1><a class="action primary" routerLink="/admin/scenarios/new">Tạo bài học</a></div>
    @if (overview(); as data) {
      <div class="form-grid mb-6">
        <a class="panel metric" routerLink="/admin/users">
          <h2>Tài khoản</h2><strong>{{ data.totalAccounts }}</strong>
          <span class="secondary">{{ data.activeAccounts }} đang hoạt động · {{ data.newAccounts }} đăng ký trong 7 ngày</span>
        </a>
        <section class="panel metric">
          <h2>Buổi luyện đã kết thúc</h2><strong>{{ data.completedSessions }}</strong>
          <span class="secondary">{{ data.recentSessions }} buổi trong 7 ngày</span>
        </section>
        <a class="panel metric" routerLink="/admin/scenarios">
          <h2>Bài học tình huống</h2>
          <strong>{{ total(data) }}</strong>
          <span class="secondary">{{ data.scenarioCounts['PUBLISHED'] }} bài đang hiển thị</span>
        </a>
      </div>
      <section class="panel" aria-labelledby="overview-lessons">
        <div class="section-heading"><h2 id="overview-lessons">Trạng thái bài học</h2><a class="text-link" routerLink="/admin/scenarios">Mở thư viện</a></div>
        @for (status of states; track status) {
          <div class="mb-3">
            <p><span class="status" [attr.data-status]="status">{{ labels[status] }}</span> {{ data.scenarioCounts[status] }}</p>
            <progress [attr.aria-label]="labels[status]" [value]="data.scenarioCounts[status]" [max]="total(data) || 1"></progress>
          </div>
        }
      </section>
    } @else if (error()) { <p class="feedback error" role="alert">{{ error() }}</p> }
    @else { <p role="status">Đang tải số liệu…</p> }
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
