import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import type { components } from '../../core/api/openapi';
import { AdminConsoleService } from './admin-console.service';

type Schemas = components['schemas'];
type Mission = Schemas['AdminMissionCreate'];
type Badge = Schemas['AdminBadgeCreate'];

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
  protected readonly missionTypes: { value: Mission['conditionType']; label: string }[] = [
    { value: 'COACH_SESSION', label: 'Hoàn thành phiên AI Coach' },
    { value: 'SCENARIO_LESSON', label: 'Hoàn thành bài tình huống' },
    { value: 'STREAK', label: 'Duy trì streak trong ngày' },
  ];
  protected readonly badgeTypes: { value: Badge['criteriaType']; label: string }[] = [
    { value: 'SESSIONS_COUNT', label: 'Số phiên hợp lệ' },
    { value: 'STREAK_DAYS', label: 'Số ngày streak' },
    { value: 'SCENARIOS_COMPLETED', label: 'Số tình huống hoàn thành' },
    { value: 'FLUENCY_SCORE', label: 'Điểm lưu loát cao nhất' },
    { value: 'SPEED_SCORE', label: 'Điểm phản hồi trung bình' },
    { value: 'CEFR_LEVEL', label: 'Trình độ CEFR' },
  ];
  protected readonly levels = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
  protected missionDraft: Mission | null = null;
  protected badgeDraft: Badge | null = null;
  protected editingBadge = false;
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

  protected newMission(): void {
    this.missionDraft = { key: '', title: '', conditionType: 'COACH_SESSION', targetCount: 1, isActive: false, xpReward: null };
  }

  protected createMission(draft: Mission): void {
    this.busy.set(true);
    this.error.set('');
    this.api.createMission({ ...draft, targetCount: draft.conditionType === 'STREAK' ? 1 : draft.targetCount }).subscribe({
      next: (item) => {
        this.missions.update((rows) => [...rows, item]);
        this.missionDraft = null;
        this.busy.set(false);
        this.status.set('Đã tạo nhiệm vụ.');
      },
      error: () => this.failed(),
    });
  }

  protected openBadge(item?: Schemas['AdminBadge']): void {
    this.editingBadge = !!item;
    this.badgeDraft = {
      key: item?.key ?? '', name: item?.name ?? '', description: item?.description ?? '',
      iconEmoji: item?.iconEmoji ?? '', criteriaType: this.badgeTypes.find((kind) => kind.value === item?.criteriaType)?.value ?? 'SESSIONS_COUNT',
      targetValue: item?.targetValue ?? 1, minLevel: this.levels.find((level) => level === item?.minLevel) ?? null,
      isActive: item?.isActive ?? false,
    };
  }

  protected saveBadge(draft: Badge): void {
    this.busy.set(true);
    this.error.set('');
    const { key, ...fields } = draft;
    const payload = {
      ...fields, minLevel: fields.criteriaType === 'CEFR_LEVEL' ? fields.minLevel : null,
      targetValue: fields.criteriaType === 'CEFR_LEVEL' ? 1 : fields.targetValue,
    };
    const operation = this.editingBadge ? this.api.updateBadge(key, payload) : this.api.createBadge({ key, ...payload });
    operation.subscribe({
      next: (item) => {
        this.badges.update((rows) => this.editingBadge ? rows.map((row) => row.key === item.key ? item : row) : [...rows, item]);
        this.badgeDraft = null;
        this.busy.set(false);
        this.status.set('Đã lưu huy hiệu.');
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
