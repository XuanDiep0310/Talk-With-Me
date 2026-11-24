import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import type { components } from '../../core/api/openapi';
import { AdminConsoleService } from './admin-console.service';

type Schemas = components['schemas'];

@Component({
  selector: 'app-admin-gamification',
  imports: [FormsModule, DatePipe],
  styleUrl: './admin.scss',
  templateUrl: './admin-gamification.component.html',
})
export class AdminGamificationComponent {
  private readonly api = inject(AdminConsoleService);
  protected readonly rules = signal<Schemas['AdminXpRule'][]>([]);
  protected readonly missions = signal<Schemas['AdminMission'][]>([]);
  protected readonly badges = signal<Schemas['AdminBadge'][]>([]);
  protected readonly transactions = signal<Schemas['AdminXpTransaction'][]>([]);
  protected readonly page = signal<string | null>(null);
  protected readonly tab = signal('rules');
  protected readonly busy = signal(false);
  protected readonly status = signal('');
  protected readonly error = signal('');
  protected filters = { learner: '', ruleKey: '', idempotencyKey: '', fromDate: '', toDate: '' };

  constructor() {
    forkJoin([this.api.xpRules(), this.api.missions(), this.api.badges()]).subscribe({
      next: ([rules, missions, badges]) => {
        this.rules.set(rules);
        this.missions.set(missions);
        this.badges.set(badges);
      },
      error: () => this.error.set('Không thể tải cấu hình Gamification.'),
    });
  }

  protected select(tab: string): void {
    this.tab.set(tab);
    this.status.set('');
    this.error.set('');
    if (tab === 'transactions') this.loadTransactions();
  }

  protected saveRule(rule: Schemas['AdminXpRule']): void {
    this.busy.set(true);
    this.error.set('');
    this.status.set('');
    const { xpAmount, description, isActive } = rule;
    this.api.updateXpRule(rule.key, { xpAmount, description, isActive }).subscribe({
      next: (item) => {
        this.rules.update((rows) => rows.map((row) => row.key === item.key ? item : row));
        this.busy.set(false);
        this.status.set('Đã lưu quy tắc XP.');
      },
      error: () => this.failed(),
    });
  }

  protected saveMission(mission: Schemas['AdminMission']): void {
    this.busy.set(true);
    this.error.set('');
    this.status.set('');
    const { title, targetCount, xpReward, isActive } = mission;
    this.api.updateMission(mission.key, { title, targetCount, xpReward, isActive }).subscribe({
      next: (item) => {
        this.missions.update((rows) => rows.map((row) => row.key === item.key ? item : row));
        this.busy.set(false);
        this.status.set('Đã lưu định nghĩa nhiệm vụ.');
      },
      error: () => this.failed(),
    });
  }

  protected loadTransactions(cursor?: string): void {
    this.busy.set(true);
    this.error.set('');
    const { fromDate, toDate, ...filters } = this.filters;
    this.api.xpTransactions({
      ...filters, cursor: cursor ?? '',
      fromDate: fromDate ? new Date(fromDate).toISOString() : '',
      toDate: toDate ? new Date(toDate).toISOString() : '',
    }).subscribe({
      next: (data) => {
        this.transactions.update((rows) => cursor ? [...rows, ...data.items] : data.items);
        this.page.set(data.nextCursor ?? null);
        this.busy.set(false);
      },
      error: () => { this.busy.set(false); this.error.set('Không thể tải sổ cái XP.'); },
    });
  }

  private failed(): void {
    this.busy.set(false);
    this.error.set('Không thể lưu cấu hình. Kiểm tra giá trị và thử lại.');
  }
}
