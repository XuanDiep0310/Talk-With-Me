import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import type { components } from '../../core/api/openapi';
import { AdminConsoleService } from './admin-console.service';
import { AdminScenarioService, CategoryDetail } from './admin-scenario.service';

type Topic = components['schemas']['AdminCoachTopic'];
type TopicInput = components['schemas']['AdminCoachTopicInput'];

@Component({
  selector: 'app-admin-coach-topics',
  imports: [ReactiveFormsModule, RouterLink],
  styleUrl: './admin.scss',
  templateUrl: './admin-coach-topics.component.html',
})
export class AdminCoachTopicsComponent {
  private readonly api = inject(AdminConsoleService);
  private readonly scenarioApi = inject(AdminScenarioService);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly levels = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
  protected readonly skills = ['Fluency', 'Vocabulary', 'Response Speed', 'Grammar', 'Accuracy', 'Listening', 'Pronunciation'] as const;
  protected readonly rows = signal<Topic[]>([]);
  protected readonly sharedCategories = signal<CategoryDetail[]>([]);
  protected readonly categoryNames = computed(() =>
    Object.fromEntries(this.sharedCategories().map((c) => [c.code, c.nameVi]))
  );
  protected readonly groupedRows = computed(() => {
    const groups = new Map<string, Topic[]>();
    for (const topic of this.rows()) {
      const list = groups.get(topic.category) ?? [];
      list.push(topic);
      groups.set(topic.category, list);
    }
    const names = this.categoryNames();
    return [...groups.entries()].map(([code, topics]) => ({
      code,
      label: names[code] || code,
      topics,
    }));
  });
  protected readonly editing = signal(false);
  protected readonly busy = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  private editingId: string | undefined;
  protected readonly filters = this.fb.group({ q: '', category: '', minLevel: '', isActive: '' });
  protected readonly idea = this.fb.control('', [Validators.required, Validators.maxLength(4000)]);
  protected readonly form = this.fb.group({
    category: ['DAILY_LIFE', [Validators.required, Validators.maxLength(100)]],
    title: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', [Validators.required, Validators.maxLength(4000)]],
    minLevel: this.fb.control<TopicInput['minLevel']>('A1'),
    targetSkills: this.fb.control<NonNullable<TopicInput['targetSkills']>>([]),
    sortOrder: [0, [Validators.required, Validators.min(0), Validators.max(2147483647)]],
    isActive: false,
  });

  constructor() {
    this.scenarioApi.listCategories().pipe(catchError(() => of([]))).subscribe((items) => {
      this.sharedCategories.set(items);
    });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    const filters = this.filters.getRawValue();
    this.api.listCoachTopics(filters).subscribe({
      next: (items) => {
        this.rows.set(items);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.error.set('Không thể tải danh mục chủ đề.'); },
    });
  }

  protected open(topic?: Topic, defaultCategory?: string): void {
    this.editingId = topic?.id;
    this.error.set('');
    this.notice.set('');
    this.idea.reset();
    const nextOrder = Math.max(0, ...this.rows().map((row) => row.sortOrder + 1));
    const fallbackCategory = this.sharedCategories()[0]?.code ?? 'DAILY_LIFE';
    this.form.reset(topic ? {
      ...topic,
      targetSkills: this.skills.filter((skill) => topic.targetSkills?.includes(skill)),
    } : { sortOrder: nextOrder, category: defaultCategory ?? fallbackCategory });
    this.editing.set(true);
  }

  protected toggleSkill(skill: (typeof this.skills)[number], event: Event): void {
    const selected = this.form.controls.targetSkills.value;
    const checked = (event.target as HTMLInputElement).checked;
    this.form.controls.targetSkills.setValue(checked ? [...selected, skill] : selected.filter((value) => value !== skill));
  }

  protected generate(): void {
    if (this.idea.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api.draftCoachTopic(this.idea.value.trim()).subscribe({
      next: (draft) => {
        const validCategory = this.sharedCategories().some((c) => c.code === draft.category)
          ? draft.category
          : this.form.controls.category.value;
        this.form.patchValue({ ...draft, category: validCategory });
        this.notice.set('Đã điền bản nháp. Kiểm tra nội dung trước khi lưu.');
        this.busy.set(false);
      },
      error: () => { this.busy.set(false); this.error.set('AI chưa thể tạo bản nháp. Bạn có thể tiếp tục chỉnh sửa.'); },
    });
  }

  protected save(): void {
    if (this.form.invalid || this.busy()) return;
    this.persist(this.form.getRawValue(), this.editingId, true);
  }

  protected toggle(topic: Topic): void {
    this.persist({ isActive: !topic.isActive }, topic.id, false);
  }

  protected canMove(): boolean {
    return Object.values(this.filters.getRawValue()).every((value) => !value);
  }

  protected isFirst(topic: Topic): boolean {
    return this.rows()[0]?.id === topic.id;
  }

  protected isLast(topic: Topic): boolean {
    const all = this.rows();
    return all[all.length - 1]?.id === topic.id;
  }

  protected move(topic: Topic, direction: 'up' | 'down'): void {
    this.changeCatalog(this.api.moveCoachTopic(topic.id, direction));
  }

  protected remove(topic: Topic): void {
    if (window.confirm(`Xóa chủ đề “${topic.title}” khỏi danh mục?`)) {
      this.changeCatalog(this.api.deleteCoachTopic(topic.id));
    }
  }

  private changeCatalog(operation: ReturnType<AdminConsoleService['deleteCoachTopic']>): void {
    this.busy.set(true);
    this.error.set('');
    operation.subscribe({
      next: () => {
        this.busy.set(false);
        this.notice.set('Đã cập nhật danh mục.');
        this.load();
      },
      error: (error) => {
        this.busy.set(false);
        this.error.set(error?.error?.code === 'COACH_TOPIC_IN_USE'
          ? 'Chủ đề đã có phiên học. Bạn có thể ẩn chủ đề khỏi danh mục.'
          : 'Không thể cập nhật danh mục.');
      },
    });
  }

  private persist(body: Partial<TopicInput>, id: string | undefined, close: boolean): void {
    this.busy.set(true);
    this.error.set('');
    const operation = id ? this.api.updateCoachTopic(id, body) : this.api.createCoachTopic(this.form.getRawValue());
    operation.subscribe({
      next: () => {
        if (close) this.editing.set(false);
        this.notice.set('Đã lưu chủ đề.');
        this.busy.set(false);
        this.load();
      },
      error: () => { this.busy.set(false); this.error.set('Không thể lưu chủ đề. Kiểm tra nội dung và thử lại.'); },
    });
  }
}
