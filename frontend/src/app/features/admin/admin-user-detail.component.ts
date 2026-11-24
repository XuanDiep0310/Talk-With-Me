import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { components } from '../../core/api/openapi';
import { AuthService } from '../../core/services/auth.service';
import { AdminConsoleService } from './admin-console.service';
import { skillLabels } from './admin-session-labels';

type Schemas = components['schemas'];
type Action = 'role' | 'active' | 'logout' | 'reset' | 'level' | 'xp';

@Component({
  selector: 'app-admin-user-detail',
  imports: [DatePipe, DecimalPipe, PercentPipe, RouterLink, FormsModule],
  styleUrl: './admin.scss',
  templateUrl: './admin-user-detail.component.html',
})
export class AdminUserDetailComponent {
  private readonly api = inject(AdminConsoleService);
  protected readonly auth = inject(AuthService);
  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  protected readonly user = signal<Schemas['AdminAccountDetail'] | null>(null);
  protected readonly placements = signal<Schemas['AdminPlacement'][] >([]);
  protected readonly next = signal<string | null>(null);
  protected readonly loadingPlacements = signal(false);
  protected readonly pending = signal<Action | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly levels = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
  protected level: Schemas['AdminLevelAdjustment']['level'] = 'A1';
  protected amount: number | null = null;
  protected reason = '';
  private xpRequestId = '';
  protected readonly skillLabels = skillLabels;
  protected readonly logins: Record<string, string> = { google: 'Google', password: 'Email và mật khẩu' };
  protected readonly placementStatuses: Record<string, string> = {
    CREATED: 'Đã tạo', IN_PROGRESS: 'Đang làm', COMPLETED: 'Hoàn tất', FAILED: 'Thất bại',
  };

  constructor() {
    this.load();
    this.loadPlacements();
  }

  protected load(): void {
    this.api.account(this.id).subscribe({
      next: (user) => this.user.set(user),
      error: () => this.error.set('Không thể tải hồ sơ tài khoản.'),
    });
  }

  protected loadPlacements(cursor?: string): void {
    this.loadingPlacements.set(true);
    this.api.placements(this.id, cursor).subscribe({
      next: (page) => {
        this.placements.update((items) => cursor ? [...items, ...page.items] : page.items);
        this.next.set(page.nextCursor ?? null);
        this.loadingPlacements.set(false);
      },
      error: () => { this.loadingPlacements.set(false); this.error.set('Không thể tải lịch sử Placement Test.'); },
    });
  }

  protected confirm(dialog: HTMLDialogElement, action: Action): void {
    this.pending.set(action);
    this.reason = '';
    this.amount = null;
    this.level = this.levels.find((level) => level === this.user()?.cefrLevel) ?? 'A1';
    if (action === 'xp') this.xpRequestId = crypto.randomUUID();
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('[data-cancel]')?.focus();
  }

  protected act(dialog: HTMLDialogElement, user: Schemas['AdminAccountDetail']): void {
    const action = this.pending();
    if (!action || this.busy() || !this.valid(action)) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    const operation = this.accountAction(action, user);
    operation.subscribe({
      next: () => {
        dialog.close();
        this.busy.set(false);
        const messages = { logout: 'Đã thu hồi các phiên đăng nhập.', reset: 'Đã yêu cầu gửi email đặt lại mật khẩu.',
          role: 'Đã cập nhật vai trò.', active: 'Đã cập nhật trạng thái.', level: 'Đã cập nhật CEFR.', xp: 'Đã ghi điều chỉnh vào sổ cái XP.' };
        this.notice.set(messages[action]);
        this.load();
      },
      error: (error) => {
        this.busy.set(false);
        this.error.set(error?.error?.code === 'XP_BALANCE_OUT_OF_RANGE'
          ? 'Số dư XP sau điều chỉnh nằm ngoài giới hạn.'
          : 'Không thể thực hiện thao tác trên tài khoản.');
      },
    });
  }
  protected valid(action: Action | null): boolean {
    if (action === 'level') return this.reason.trim().length >= 3;
    if (action === 'xp') return this.reason.trim().length >= 3 && this.amount !== null
      && Number.isInteger(this.amount) && this.amount !== 0 && Math.abs(this.amount) <= 100000;
    return action !== null;
  }

  private accountAction(action: Action, user: Schemas['AdminAccountDetail']) {
    switch (action) {
      case 'logout': return this.api.forceLogout(user.id);
      case 'reset': return this.api.sendPasswordReset(user.id);
      case 'level': return this.api.adjustLevel(user.id, { level: this.level, reason: this.reason });
      case 'xp': return this.api.adjustXp(user.id, { requestId: this.xpRequestId, amount: this.amount ?? 0, reason: this.reason });
      case 'role': return this.api.updateAccount(user.id, { role: user.role === 'ADMIN' ? 'LEARNER' : 'ADMIN' });
      case 'active': return this.api.updateAccount(user.id, { isActive: !user.isActive });
    }
  }
}
