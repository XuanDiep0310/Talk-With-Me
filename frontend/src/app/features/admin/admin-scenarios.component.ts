import { KeyValuePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, catchError, firstValueFrom, map, of, switchMap, timer } from 'rxjs';
import { formatDateTimeDDMMYYYY } from '../../core/utils/date.utils';
import {
  AdminScenarioService, ScenarioDetail, ScenarioFilters, ScenarioStatus, ScenarioSummary,
  categories, levels, scenarioError, statuses
} from './admin-scenario.service';

@Component({
  selector: 'app-admin-scenarios',
  imports: [FormsModule, KeyValuePipe, RouterLink],
  templateUrl: './admin-scenarios.component.html',
  styleUrl: './admin.scss'
})
export class AdminScenariosComponent {
  private readonly api = inject(AdminScenarioService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchChanges = new Subject<{ filters: ScenarioFilters; delay: number }>();
  private generation = 0;
  protected filters: ScenarioFilters = {};
  protected readonly rows = signal<ScenarioSummary[]>([]);
  protected readonly counts = signal<Partial<Record<ScenarioStatus, number>>>({});
  protected readonly cursor = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly categoryNames = signal(categories);
  protected readonly groupedRows = computed(() => {
    const groups = new Map<string, ScenarioSummary[]>();
    for (const row of this.rows()) {
      const list = groups.get(row.category) ?? [];
      list.push(row);
      groups.set(row.category, list);
    }
    const names = this.categoryNames();
    return [...groups.entries()].map(([code, items]) => ({
      code,
      label: names[code] || code,
      items,
    }));
  });
  protected readonly levels = levels;
  protected readonly statuses = statuses;
  protected readonly tabs = ['PUBLISHED', 'DRAFT', 'ARCHIVED'] as const;
  protected readonly formatDate = formatDateTimeDDMMYYYY;
  protected readonly actionId = signal<string | null>(null);
  protected readonly summary = signal<ScenarioDetail | null>(null);

  constructor() {
    this.api.listCategories().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => this.categoryNames.set(Object.fromEntries(items.map((item) => [item.code, item.nameVi]))),
      error: (error: unknown) => this.error.set(scenarioError(error).message)
    });
    this.searchChanges.pipe(
      switchMap(({ filters, delay }) => timer(delay).pipe(
        switchMap(() => this.api.list(filters)),
        map((page) => ({ page, error: '' })),
        catchError((error: unknown) => of({ page: null, error: scenarioError(error).message }))
      )),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ page, error }) => {
      this.rows.set(page?.items ?? []);
      this.cursor.set(page?.nextCursor ?? null);
      this.counts.set(page?.counts ?? {});
      this.error.set(error);
      this.loading.set(false);
    });
    this.search();
  }

  protected total(): number { return this.tabs.reduce((sum, status) => sum + (this.counts()[status] ?? 0), 0); }

  protected search(delay = 0): void {
    this.generation += 1;
    this.loading.set(true);
    this.cursor.set(null);
    this.error.set('');
    this.searchChanges.next({ delay, filters: { ...this.filters, q: this.filters.q?.trim() } });
  }

  protected selectStatus(status?: ScenarioStatus): void {
    this.filters.status = status;
    this.search();
  }

  protected async loadMore(cursor: string): Promise<void> {
    if (this.loading()) return;
    const generation = this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      const page = await firstValueFrom(this.api.list({ ...this.filters, q: this.filters.q?.trim(), cursor }));
      if (generation !== this.generation) return;
      this.rows.update((rows) => [...rows, ...page.items]);
      this.cursor.set(page.nextCursor);
    } catch (error) {
      if (generation === this.generation) this.error.set(scenarioError(error).message);
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }

  protected async openSummary(dialog: HTMLDialogElement, row: ScenarioSummary): Promise<void> {
    this.summary.set(null);
    await this.run(row, async () => {
      this.summary.set(await firstValueFrom(this.api.get(row.id)));
      dialog.showModal();
    });
  }

  protected async duplicate(row: ScenarioSummary): Promise<void> {
    await this.run(row, async () => {
      const draft = await firstValueFrom(this.api.createCopy(row));
      await this.router.navigate(['/admin/scenarios', draft.id]);
    });
  }

  protected async changeStatus(row: ScenarioSummary): Promise<void> {
    await this.run(row, async () => {
      const status = row.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED';
      await firstValueFrom(this.api.setStatus(row.id, { status, revision: row.revision }));
      this.notice.set(status === 'ARCHIVED' ? 'Đã ẩn bài học.' : 'Bài học đã xuất hiện trong thư viện.');
      this.search();
    });
  }

  protected async remove(row: ScenarioSummary): Promise<void> {
    if (row.status === 'PUBLISHED') return;
    if (!window.confirm(`Xóa bài học “${row.titleVi || row.titleEn || row.slug}”?`)) return;
    await this.run(row, async () => {
      await firstValueFrom(this.api.delete(row.id));
      this.notice.set('Đã xóa bài học.');
      this.search();
    });
  }

  private async run(row: ScenarioSummary, action: () => Promise<void>): Promise<void> {
    if (this.actionId()) return;
    this.actionId.set(row.id);
    this.error.set('');
    this.notice.set('');
    try { await action(); }
    catch (error) { this.error.set(scenarioError(error).message); }
    finally { this.actionId.set(null); }
  }
}
