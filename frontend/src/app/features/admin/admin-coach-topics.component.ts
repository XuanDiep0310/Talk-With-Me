import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { components } from '../../core/api/openapi';
import { AdminConsoleService } from './admin-console.service';

type Topic = components['schemas']['AdminCoachTopic'];
type TopicInput = components['schemas']['AdminCoachTopicInput'];

@Component({
  selector: 'app-admin-coach-topics',
  imports: [ReactiveFormsModule],
  styleUrl: './admin.scss',
  templateUrl: './admin-coach-topics.component.html',
})
export class AdminCoachTopicsComponent {
  private readonly api = inject(AdminConsoleService);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly levels = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
  protected readonly skills = ['Fluency', 'Vocabulary', 'Response Speed', 'Grammar', 'Accuracy', 'Listening', 'Pronunciation'] as const;
  protected readonly rows = signal<Topic[]>([]);
  protected readonly categories = signal<string[]>([]);
  protected readonly editing = signal(false);
  protected readonly busy = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  private editingId: string | undefined;
  protected readonly filters = this.fb.group({ q: '', category: '', minLevel: '', isActive: '' });
  protected readonly idea = this.fb.control('', [Validators.required, Validators.maxLength(4000)]);
  protected readonly form = this.fb.group({
    category: ['', [Validators.required, Validators.maxLength(100)]],
    title: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', [Validators.required, Validators.maxLength(4000)]],
    minLevel: this.fb.control<TopicInput['minLevel']>('A1'),
    targetSkills: this.fb.control<NonNullable<TopicInput['targetSkills']>>([]),
    sortOrder: [0, [Validators.required, Validators.min(0), Validators.max(2147483647)]],
    isActive: false,
  });

  constructor() { this.load(); }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    const filters = this.filters.getRawValue();
    this.api.listCoachTopics(filters).subscribe({
      next: (items) => {
        this.rows.set(items);
        if (!filters.category && !filters.q && !filters.minLevel && !filters.isActive) {
          this.categories.set([...new Set(items.map((item) => item.category))].sort());
        }
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.error.set('Không thể tải danh mục chủ đề.'); },
    });
  }

  protected open(topic?: Topic): void {
    this.editingId = topic?.id;
    this.error.set('');
    this.notice.set('');
    this.idea.reset();
    this.form.reset(topic ? {
      ...topic,
      targetSkills: this.skills.filter((skill) => topic.targetSkills?.includes(skill)),
    } : undefined);
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
        this.form.patchValue(draft);
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
