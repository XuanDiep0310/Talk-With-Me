import { DOCUMENT, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, filter, merge, switchMap, timer } from 'rxjs';
import type { components } from '../../core/api/openapi';
import { AdminConsoleService } from './admin-console.service';
import { sessionStatuses, skillLabels } from './admin-session-labels';

type Overview = components['schemas']['AdminAnalytics'];
type Period = Overview['range'];

@Component({
  selector: 'app-admin-analytics',
  imports: [DatePipe, DecimalPipe, PercentPipe],
  styleUrl: './admin.scss',
  templateUrl: './admin-analytics.component.html',
})
export class AdminAnalyticsComponent {
  private readonly api = inject(AdminConsoleService);
  private readonly document = inject(DOCUMENT);
  private readonly reload = new Subject<void>();
  private readonly destroy = inject(DestroyRef);
  protected readonly period = signal<Period>('7d');
  protected readonly data = signal<Overview | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'UNKNOWN'];
  protected readonly metrics = skillLabels;
  protected readonly statuses = sessionStatuses;
  protected readonly statusKeys = ['FEEDBACK_READY', 'PENDING', 'INSUFFICIENT_DATA', 'FAILED', 'NOT_REQUESTED'];
  protected readonly maxActivity = computed(() =>
    Math.max(1, ...(this.data()?.days.map((day) => day.coachSessions + day.roleplaySessions) ?? [])));
  protected readonly levelTotal = computed(() =>
    Object.values(this.data()?.cefr ?? {}).reduce((total, count) => total + count, 0));
  protected readonly totalFeedback = computed(() =>
    Object.values(this.data()?.feedbackStatuses ?? {}).reduce((total, count) => total + count, 0));

  constructor() {
    const periodic = timer(0, 60_000).pipe(filter(() => this.document.visibilityState === 'visible'));
    merge(periodic, this.reload).pipe(
      switchMap(() => {
        this.loading.set(true);
        this.error.set('');
        return this.api.analytics(this.period()).pipe(catchError(() => {
          this.loading.set(false);
          this.error.set('Không thể cập nhật báo cáo. Vui lòng thử lại.');
          return EMPTY;
        }));
      }),
      takeUntilDestroyed(this.destroy),
    ).subscribe((report) => {
      this.data.set(report);
      this.loading.set(false);
    });
  }

  protected refresh(): void { this.reload.next(); }

  protected select(period: Period): void {
    if (period !== this.period()) {
      this.period.set(period);
      this.data.set(null);
      this.refresh();
    }
  }

  protected height(count: number): number {
    return count / this.maxActivity() * 115;
  }
}
