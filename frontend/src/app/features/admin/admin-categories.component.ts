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
    <a class="text-link inline-flex items-center gap-1.5 mb-4 text-sm font-medium" routerLink="/admin/scenarios">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
      <span>Về danh sách bài học</span>
    </a>
    <div class="page-heading">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900">Nhóm chủ đề</h1>
        <p class="text-sm text-slate-500 mt-1">Phân loại các bài học tình huống theo nhóm ngữ cảnh giao tiếp</p>
      </div>
    </div>
    @if (error()) {
      <div class="feedback error" role="alert">
        <svg class="w-5 h-5 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p>{{ error() }}</p>
      </div>
    }
    @if (notice()) {
      <div class="feedback" role="status">
        <svg class="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
        <span>{{ notice() }}</span>
      </div>
    }
    <form class="panel form-grid" (ngSubmit)="create()">
      <label>Tên nhóm<input name="newName" maxlength="120" placeholder="Ví dụ: Du lịch & Đặt phòng" [(ngModel)]="name" /></label>
      <div class="self-end"><button class="action primary flex items-center gap-1.5" type="submit" [disabled]="busy() || !name.trim()">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
        <span>Thêm nhóm</span>
      </button></div>
      <details class="wide disclosure">
        <summary>Mã nhóm tùy chỉnh</summary>
        <label class="mt-2">Mã nhóm<input name="code" maxlength="50" placeholder="Tự tạo từ tên nhóm nếu để trống" [(ngModel)]="code" /></label>
      </details>
    </form>
    <section class="panel" aria-label="Danh sách nhóm chủ đề" [attr.aria-busy]="busy()">
      <div class="space-y-3">
        @for (row of rows(); track row.code) {
          <form class="group-item filter-form shadow-sm" (ngSubmit)="rename(row)">
            <div>
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 mb-1">{{ row.lessonCount }} bài học</span>
              <span class="secondary font-mono text-xs">{{ row.code }}</span>
            </div>
            <label>Tên nhóm<input name="name" maxlength="120" [(ngModel)]="row.nameVi" /></label>
            <div class="actions">
              <button class="action" type="submit" [disabled]="busy() || !row.nameVi.trim()">Lưu tên</button>
              <button class="action text-rose-600 hover:bg-rose-50" type="button" [disabled]="busy() || row.lessonCount > 0"
                (click)="confirmDelete(deletion, row)">Xóa nhóm</button>
            </div>
          </form>
        } @empty {
          @if (!busy()) { <p class="p-4 text-center text-slate-500">Chưa có nhóm chủ đề.</p> }
        }
      </div>
    </section>
    <dialog #deletion class="admin-dialog" aria-label="Xác nhận xóa nhóm">
      <div class="section-heading border-b border-slate-100 pb-3 mb-4">
        <h2 class="text-lg font-bold text-slate-900">Xác nhận xóa nhóm</h2>
      </div>
      <p class="text-sm text-slate-600 mb-4">Bạn có chắc chắn muốn xóa nhóm <strong>{{ selected?.nameVi }}</strong>?</p>
      <div class="actions justify-end">
        <button class="action primary bg-rose-600 border-rose-600 hover:bg-rose-700" type="button" (click)="delete(deletion)" [disabled]="busy()">Xác nhận xóa</button>
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
