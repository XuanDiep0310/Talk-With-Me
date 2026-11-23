import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminScenarioService, CategoryDetail, lessonSlug, scenarioError } from './admin-scenario.service';

@Component({
  selector: 'app-admin-categories',
  imports: [FormsModule, RouterLink],
  styleUrl: './admin.scss',
  template: `
    <a class="text-link inline-block mb-4" routerLink="/admin/scenarios">Về danh sách bài học</a>
    <div class="page-heading"><h1>Nhóm chủ đề</h1></div>
    @if (error()) { <p class="feedback error" role="alert">{{ error() }}</p> }
    @if (notice()) { <p class="feedback" role="status">{{ notice() }}</p> }
    <form class="panel form-grid" (ngSubmit)="create()">
      <label>Tên nhóm<input name="newName" maxlength="120" [(ngModel)]="name" /></label>
      <div class="self-end"><button class="action primary" type="submit" [disabled]="busy() || !name.trim()">Thêm nhóm</button></div>
      <details class="wide disclosure">
        <summary>Mã nhóm tùy chỉnh</summary>
        <label>Mã nhóm<input name="code" maxlength="50" placeholder="Tự tạo từ tên nhóm" [(ngModel)]="code" /></label>
      </details>
    </form>
    <section class="panel" aria-label="Danh sách nhóm chủ đề" [attr.aria-busy]="busy()">
      @for (row of rows(); track row.code) {
        <form class="group-item filter-form" (ngSubmit)="rename(row)">
          <div><strong>{{ row.lessonCount }} bài học</strong><span class="secondary">{{ row.code }}</span></div>
          <label>Tên nhóm<input name="name" maxlength="120" [(ngModel)]="row.nameVi" /></label>
          <div class="actions">
            <button class="action" type="submit" [disabled]="busy() || !row.nameVi.trim()">Lưu tên</button>
            <button class="action" type="button" [disabled]="busy() || row.lessonCount > 0"
              (click)="confirmDelete(deletion, row)">Xóa nhóm</button>
          </div>
        </form>
      } @empty {
        @if (!busy()) { <p>Chưa có nhóm chủ đề.</p> }
      }
    </section>
    <dialog #deletion class="admin-dialog" aria-label="Xác nhận xóa nhóm">
      <p class="mb-4">Xóa nhóm {{ selected?.nameVi }}?</p>
      <div class="actions">
        <button class="action primary" type="button" (click)="delete(deletion)" [disabled]="busy()">Xác nhận xóa</button>
        <form method="dialog"><button class="action">Hủy</button></form>
      </div>
    </dialog>
  `
})
export class AdminCategoriesComponent {
  private readonly api = inject(AdminScenarioService);
  protected rows = signal<CategoryDetail[]>([]);
  protected busy = signal(false);
  protected error = signal('');
  protected notice = signal('');
  protected code = '';
  protected name = '';
  protected selected: CategoryDetail | null = null;

  constructor() { void this.run(async () => this.refresh()); }

  protected async create(): Promise<void> {
    await this.run(async () => {
      const name = this.name.trim();
      const generatedCode = lessonSlug(name).slice(0, 50).replace(/-+$/, '').replace(/-/g, '_').toUpperCase();
      const code = this.code.trim().toUpperCase() || generatedCode || 'NHOM_' + crypto.randomUUID().slice(0, 8).toUpperCase();
      await firstValueFrom(this.api.createCategory({ code, nameVi: name }));
      this.code = '';
      this.name = '';
      this.notice.set('Đã thêm nhóm.');
      await this.refresh();
    });
  }

  protected async rename(row: CategoryDetail): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.api.renameCategory(row.code, row.nameVi.trim()));
      this.notice.set('Đã lưu tên nhóm.');
      await this.refresh();
    });
  }

  protected confirmDelete(dialog: HTMLDialogElement, row: CategoryDetail): void {
    this.selected = row;
    dialog.showModal();
  }

  protected async delete(dialog: HTMLDialogElement): Promise<void> {
    const row = this.selected;
    if (!row) return;
    dialog.close();
    await this.run(async () => {
      await firstValueFrom(this.api.deleteCategory(row.code));
      this.notice.set('Đã xóa nhóm.');
      await this.refresh();
    });
  }

  private async refresh(): Promise<void> { this.rows.set(await firstValueFrom(this.api.listCategories())); }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try { await action(); }
    catch (error) { this.error.set(scenarioError(error).message); }
    finally { this.busy.set(false); }
  }
}
