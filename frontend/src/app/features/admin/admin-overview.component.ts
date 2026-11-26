import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import type { components } from '../../core/api/openapi';
import { AdminConsoleService, AdminOverview } from './admin-console.service';
import { scenarioError, statuses } from './admin-scenario.service';

type Schemas = components['schemas'];

@Component({
  selector: 'app-admin-overview',
  imports: [RouterLink, DatePipe, DecimalPipe],
  styleUrl: './admin.scss',
  templateUrl: './admin-overview.component.html',
})
export class AdminOverviewComponent {
  private readonly api = inject(AdminConsoleService);
  private readonly destroy = inject(DestroyRef);
  protected readonly overview = signal<AdminOverview | null>(null);
  protected readonly analytics = signal<Schemas['AdminAnalytics'] | null>(null);
  protected readonly auditLogs = signal<Schemas['AdminAuditItem'][]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly states = ['PUBLISHED', 'DRAFT', 'ARCHIVED'] as const;
  protected readonly labels = statuses;

  protected readonly maxDaily = computed(() =>
    Math.max(1, ...(this.analytics()?.days.map((d) => d.coachSessions + d.roleplaySessions) ?? [1]))
  );
  protected readonly failedFeedbackCount = computed(() =>
    this.analytics()?.feedbackStatuses['FAILED'] ?? 0
  );

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      overview: this.api.overview(),
      analytics: this.api.analytics('7d').pipe(catchError(() => of(null))),
      audit: this.api.auditLogs({ limit: '6' }).pipe(catchError(() => of(null))),
    }).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: ({ overview, analytics, audit }) => {
        this.overview.set(overview);
        this.analytics.set(analytics);
        this.auditLogs.set(audit?.items ?? []);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(scenarioError(err).message);
      },
    });
  }

  protected total(data: AdminOverview): number {
    return this.states.reduce((sum, status) => sum + data.scenarioCounts[status], 0);
  }

  protected barHeight(count: number): number {
    return (count / this.maxDaily()) * 108;
  }

  protected roundTick(value: number): number {
    return Math.round(value);
  }
}
