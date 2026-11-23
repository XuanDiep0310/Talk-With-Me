import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, firstValueFrom, map, of, switchMap, timer } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { formatDateTimeDDMMYYYY } from '../../core/utils/date.utils';
import { AccountUpdate, AdminAccount, AdminConsoleService } from './admin-console.service';
import { scenarioError } from './admin-scenario.service';

@Component({
  selector: 'app-admin-users',
  imports: [FormsModule],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin.scss'
})
export class AdminUsersComponent {
  private readonly api = inject(AdminConsoleService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly queries = new Subject<{ q: string; delay: number }>();
  private generation = 0;
  protected readonly auth = inject(AuthService);
  protected readonly formatDate = formatDateTimeDDMMYYYY;
  protected readonly rows = signal<AdminAccount[]>([]);
  protected readonly next = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected query = '';
  protected pending: { account: AdminAccount; change: AccountUpdate; action: string } | null = null;

  constructor() {
    this.queries.pipe(switchMap(({ q, delay }) => timer(delay).pipe(
      switchMap(() => this.api.listAccounts(q)),
      map((page) => ({ page, error: '' })),
      catchError((error: unknown) => of({ page: null, error: scenarioError(error).message }))
    )), takeUntilDestroyed(this.destroyRef)).subscribe(({ page, error }) => {
      this.rows.set(page?.items ?? []);
      this.next.set(page?.nextCursor ?? null);
      this.error.set(error);
      this.loading.set(false);
    });
    this.search();
  }

  protected search(delay = 0): void {
    this.generation += 1;
    this.loading.set(true);
    this.next.set(null);
    this.error.set('');
    this.queries.next({ q: this.query, delay });
  }

  protected async loadMore(cursor: string): Promise<void> {
    if (this.loading()) return;
    const generation = this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      const page = await firstValueFrom(this.api.listAccounts(this.query, cursor));
      if (generation !== this.generation) return;
      this.rows.update((rows) => [...rows, ...page.items]);
      this.next.set(page.nextCursor);
    } catch (error) {
      if (generation === this.generation) this.error.set(scenarioError(error).message);
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }

  protected confirm(dialog: HTMLDialogElement, account: AdminAccount, type: 'role' | 'active'): void {
    if (type === 'role') {
      this.pending = account.role === 'ADMIN'
        ? { account, change: { role: 'LEARNER' }, action: 'Thu hồi quyền admin' }
        : { account, change: { role: 'ADMIN' }, action: 'Cấp quyền admin' };
    } else {
      this.pending = {
        account, change: { isActive: !account.isActive }, action: account.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'
      };
    }
    dialog.showModal();
  }

  protected async apply(dialog: HTMLDialogElement): Promise<void> {
    if (!this.pending || this.saving()) return;
    const { account, change, action } = this.pending;
    dialog.close();
    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await firstValueFrom(this.api.updateAccount(account.id, change));
      this.notice.set(action + ' thành công.');
      this.search();
    } catch (error) {
      this.error.set(scenarioError(error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
