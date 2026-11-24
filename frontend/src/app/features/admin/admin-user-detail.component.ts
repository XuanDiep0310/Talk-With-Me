import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { components } from '../../core/api/openapi';
import { AuthService } from '../../core/services/auth.service';
import { AdminConsoleService } from './admin-console.service';
import { skillLabels } from './admin-session-labels';

type Schemas = components['schemas'];
type Action = 'role' | 'active' | 'logout';

@Component({
  selector: 'app-admin-user-detail',
  imports: [DatePipe, DecimalPipe, PercentPipe, RouterLink],
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
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('[data-cancel]')?.focus();
  }

  protected act(dialog: HTMLDialogElement, user: Schemas['AdminAccountDetail']): void {
    const action = this.pending();
    if (!action || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    const operation = action === 'logout'
      ? this.api.forceLogout(user.id)
      : this.api.updateAccount(user.id, action === 'role'
        ? { role: user.role === 'ADMIN' ? 'LEARNER' : 'ADMIN' }
        : { isActive: !user.isActive });
    operation.subscribe({
      next: () => {
        dialog.close();
        this.busy.set(false);
        this.notice.set(action === 'logout' ? 'Đã thu hồi các phiên đăng nhập.' : 'Đã cập nhật tài khoản.');
        this.load();
      },
      error: () => {
        dialog.close();
        this.busy.set(false);
        this.error.set('Không thể thực hiện thao tác trên tài khoản.');
      },
    });
  }
}
