import { KeyValuePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { formatDateTimeDDMMYYYY } from '../../core/utils/date.utils';
import {
  AdminScenarioService, ScenarioFilters, ScenarioSummary, categories, levels, scenarioError, statuses
} from './admin-scenario.service';

@Component({
  selector: 'app-admin-scenarios',
  imports: [FormsModule, KeyValuePipe, RouterLink],
  templateUrl: './admin-scenarios.component.html',
  styleUrl: './admin.scss'
})
export class AdminScenariosComponent {
  private readonly api = inject(AdminScenarioService);
  private appliedFilters: ScenarioFilters = {};
  protected filters: ScenarioFilters = {};
  protected readonly rows = signal<ScenarioSummary[]>([]);
  protected readonly cursor = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly categories = categories;
  protected readonly levels = levels;
  protected readonly statuses = statuses;
  protected readonly formatDate = formatDateTimeDDMMYYYY;

  constructor() {
    void this.search();
  }

  protected search(): Promise<void> {
    this.appliedFilters = { ...this.filters, q: this.filters.q?.trim() };
    return this.load();
  }

  protected async load(cursor?: string): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    if (!cursor) {
      this.rows.set([]);
      this.cursor.set(null);
    }
    try {
      const page = await firstValueFrom(this.api.list({ ...this.appliedFilters, cursor }));
      this.rows.update((rows) => [...rows, ...page.items]);
      this.cursor.set(page.nextCursor);
    } catch (error) {
      this.error.set(scenarioError(error).message);
    } finally {
      this.loading.set(false);
    }
  }
}
