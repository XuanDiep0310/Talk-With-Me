import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { components } from '../../core/api/openapi';
import { AdminConsoleService } from './admin-console.service';
import { qaLabels, sessionStatuses } from './admin-session-labels';

@Component({
  selector: 'app-admin-sessions',
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink],
  styleUrl: './admin.scss',
  templateUrl: './admin-sessions.component.html',
})
export class AdminSessionsComponent {
  private readonly api = inject(AdminConsoleService);
  private readonly route = inject(ActivatedRoute);
  protected readonly labels = qaLabels;
  protected readonly statuses = sessionStatuses;
  protected readonly stateKeys = Object.keys(sessionStatuses).filter((key) => !['PENDING', 'NOT_REQUESTED'].includes(key));
  protected readonly items = signal<components['schemas']['AdminSessionSummary'][] >([]);
  protected readonly cursor = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly userId = this.route.snapshot.queryParamMap.get('userId');
  protected filters = { type: '', status: '', q: '', label: '', minScore: null as number | null, maxScore: null as number | null, fromDate: '', toDate: '' };
  private appliedFilters: Record<string, string> = {};

  constructor() { this.load(); }

  protected load(cursor?: string): void {
    if (!cursor) {
      const filters = this.filters;
      this.appliedFilters = {
        type: filters.type, status: filters.status, q: filters.q, label: filters.label,
        minScore: filters.minScore?.toString() ?? '', maxScore: filters.maxScore?.toString() ?? '',
        fromDate: filters.fromDate ? new Date(filters.fromDate).toISOString() : '',
        toDate: filters.toDate ? new Date(filters.toDate).toISOString() : '',
        userId: this.userId ?? '',
      };
    }
    this.loading.set(true);
    this.error.set('');
    this.api.sessions({ ...this.appliedFilters, cursor: cursor ?? '' }).subscribe({
      next: (page) => {
        this.items.update((rows) => cursor ? [...rows, ...page.items] : page.items);
        this.cursor.set(page.nextCursor ?? null);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.error.set('Không thể tải phiên học. Kiểm tra bộ lọc và thử lại.'); },
    });
  }
}
