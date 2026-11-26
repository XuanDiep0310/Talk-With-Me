import { DatePipe, JsonPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { components } from '../../core/api/openapi';
import { AdminConsoleService } from './admin-console.service';

@Component({
  selector: 'app-admin-audit-logs',
  imports: [DatePipe, FormsModule, JsonPipe],
  styleUrl: './admin.scss',
  templateUrl: './admin-audit-logs.component.html',
})
export class AdminAuditLogsComponent {
  private readonly api = inject(AdminConsoleService);
  protected readonly items = signal<components['schemas']['AdminAuditItem'][] >([]);
  protected readonly next = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly targets: Record<string, string> = {
    ACCOUNT: 'Tài khoản', SCENARIO: 'Bài học', COACH_TOPIC: 'Chủ đề AI Coach',
    SESSION: 'Phiên học', XP_RULE: 'Quy tắc XP', MISSION: 'Nhiệm vụ', BADGE: 'Huy hiệu',
  };
  protected readonly targetKeys = Object.keys(this.targets);
  protected filters = { fromDate: '', toDate: '', traceId: '', targetType: '', action: '' };
  private appliedFilters: Record<string, string> = {};

  constructor() { this.load(); }

  protected load(cursor?: string): void {
    if (!cursor) {
      const {fromDate, toDate, ...criteria} = this.filters;
      this.appliedFilters = {
        ...criteria,
        fromDate: fromDate ? new Date(fromDate).toISOString() : '',
        toDate: toDate ? new Date(toDate).toISOString() : '',
      };
    }
    this.loading.set(true);
    this.error.set('');
    this.api.auditLogs({ ...this.appliedFilters, cursor: cursor ?? '' }).subscribe({
      next: (page) => {
        this.items.update((rows) => cursor ? [...rows, ...page.items] : page.items);
        this.next.set(page.nextCursor ?? null);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.error.set('Không thể tải nhật ký. Kiểm tra bộ lọc và thử lại.'); },
    });
  }
}
