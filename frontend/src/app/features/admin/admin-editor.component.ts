import { KeyValuePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, HostListener, Injector, afterNextRender, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ScenarioDetailComponent } from '../scenarios/scenario-detail.component';
import type { ScenarioDetail as LearnerScenario } from '../../core/services/scenario.service';
import { Observable, firstValueFrom, of, switchMap, catchError } from 'rxjs';
import {
  AdminScenarioService, ScenarioDetail, ScenarioInput, ScenarioStatusUpdate,
  categories, lessonSlug, levels, scenarioError, statuses
} from './admin-scenario.service';

type ChunkInput = NonNullable<ScenarioInput['chunks']>[number];
type RequirementInput = NonNullable<ScenarioInput['requirements']>[number];
type ChunkForm = Omit<ChunkInput, 'acceptedVariations' | 'distractorsEn' | 'distractorsVi'> & {
  acceptedVariations: string[];
  distractorsEn: string[];
  distractorsVi: string[];
};
type DraftForm = Omit<ScenarioInput, 'goals' | 'chunks' | 'requirements'> & {
  goals: string[];
  chunks: ChunkForm[];
  requirements: RequirementInput[];
};

function clean(values: string[]): string[] {
  return values.map((item) => item.trim()).filter(Boolean);
}

const fieldLabels: Record<string, string> = {
  slug: 'Mã đường dẫn',
  estimatedDurationMinutes: 'Thời lượng',
  sortOrder: 'Thứ tự trong thư viện',
  titleVi: 'Tiêu đề tiếng Việt',
  titleEn: 'Tiêu đề tiếng Anh',
  context: 'Bối cảnh',
  userRole: 'Vai người học',
  aiRole: 'Vai AI',
  goals: 'Mục tiêu học tập',
  chunks: 'Cụm từ',
  requirements: 'Yêu cầu roleplay',
  description: 'Mô tả',
  text: 'Cụm từ tiếng Anh',
  meaningVi: 'Nghĩa tiếng Việt',
  exampleSentence: 'Câu mẫu',
  acceptedVariations: 'Biến thể chấp nhận',
  distractorsEn: 'Đáp án nhiễu tiếng Anh',
  distractorsVi: 'Đáp án nhiễu tiếng Việt'
};

function toForm(scenario: ScenarioInput | null): DraftForm {
  if (!scenario) return {
    slug: '', category: 'DAILY_LIFE', level: 'A1', titleVi: '', titleEn: '',
    context: '', userRole: '', aiRole: '', estimatedDurationMinutes: 10, sortOrder: 0,
    goals: [], chunks: [], requirements: []
  };
  return {
    slug: scenario.slug,
    category: scenario.category,
    level: scenario.level,
    titleVi: scenario.titleVi,
    titleEn: scenario.titleEn,
    context: scenario.context,
    userRole: scenario.userRole,
    aiRole: scenario.aiRole,
    estimatedDurationMinutes: scenario.estimatedDurationMinutes,
    sortOrder: scenario.sortOrder,
    goals: [...(scenario.goals ?? [])],
    requirements: (scenario.requirements ?? []).map((requirement) => ({
      description: requirement.description,
      type: requirement.type,
      expectedChunkFunction: requirement.expectedChunkFunction,
      isMandatory: requirement.isMandatory
    })),
    chunks: (scenario.chunks ?? []).map((chunk) => ({
      functionTag: chunk.functionTag,
      text: chunk.text,
      meaningVi: chunk.meaningVi,
      exampleSentence: chunk.exampleSentence,
      audioUrl: chunk.audioUrl,
      acceptedVariations: [...(chunk.acceptedVariations ?? [])],
      distractorsEn: Array.from({ length: 3 }, (_, index) => chunk.distractorsEn?.[index] ?? ''),
      distractorsVi: Array.from({ length: 3 }, (_, index) => chunk.distractorsVi?.[index] ?? '')
    }))
  };
}

@Component({
  selector: 'app-admin-editor',
  imports: [FormsModule, KeyValuePipe, RouterLink, ScenarioDetailComponent],
  templateUrl: './admin-editor.component.html',
  styleUrl: './admin.scss'
})
export class AdminEditorComponent {
  private readonly api = inject(AdminScenarioService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly editor = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly categoryNames = signal(categories);
  protected readonly levels = levels;
  protected readonly statuses = statuses;
  protected readonly functions: Record<ChunkInput['functionTag'], string> = {
    OPENING: 'Mở đầu', REQUEST: 'Đề nghị', CLARIFY: 'Làm rõ',
    AGREE_DECLINE: 'Đồng ý hoặc từ chối', CLOSING: 'Kết thúc'
  };
  protected readonly saved = signal<ScenarioDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly busy = signal(false);
  protected readonly aiBusy = signal(false);
  protected aiTopic = '';
  protected aiCount = 5;
  protected readonly dirty = signal(false);
  protected readonly preview = signal(false);
  protected readonly error = signal<ReturnType<typeof scenarioError> | null>(null);
  protected readonly notice = signal('');
  protected readonly confirmArchive = signal(false);
  protected step = 0;
  protected openChunk = 0;
  protected readonly steps = ['Thông tin bài', 'Cụm từ', 'Nhiệm vụ & kiểm tra'];
  protected previewData: LearnerScenario | null = null;
  protected previewWidth: 'phone' | 'desktop' = 'phone';
  private draggedChunk: number | null = null;
  private slugEdited = false;

  hasUnsavedChanges(): boolean {
    return this.dirty();
  }

  @HostListener('window:beforeunload', ['$event'])
  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  protected goToStep(index: number): void {
    this.step = index;
    afterNextRender(() => {
      this.editor.nativeElement.querySelector<HTMLElement>(`[data-step="${index}"]`)?.focus();
    }, { injector: this.injector });
  }

  protected fixField(path: string): void {
    const [group, index] = path.split('.');
    if (group === 'chunks' && index !== undefined) this.openChunk = Number(index);
    this.step = group === 'chunks' ? 1 : group === 'requirements' ? 2 : 0;
    afterNextRender(() => {
      const root = this.editor.nativeElement;
      const target = root.querySelector<HTMLElement>(`[data-field="${CSS.escape(path)}"]`) ??
        root.querySelector<HTMLElement>(`[data-field="${CSS.escape(group)}"]`) ??
        root.querySelector<HTMLElement>(`[data-step="${this.step}"]`);
      for (let details = target?.closest('details'); details; details = details.parentElement?.closest('details')) {
        details.open = true;
      }
      target?.focus();
    }, { injector: this.injector });
  }

  protected titleChanged(title: string): void {
    this.draft.titleVi = title;
    if (!this.slugEdited) this.draft.slug = lessonSlug(title);
  }

  protected slugChanged(slug: string): void {
    this.slugEdited = true;
    this.draft.slug = slug;
  }

  protected addEntry(values: string[], limit = 20): void {
    if (values.length < limit) values.push('');
    this.dirty.set(true);
  }

  protected startDrag(event: DragEvent, index: number): void {
    this.draggedChunk = index;
    event.dataTransfer?.setData('text/plain', String(index));
  }

  protected cancelDrag(): void { this.draggedChunk = null; }

  protected dropChunk(event: DragEvent, index: number): void {
    event.preventDefault();
    const from = this.draggedChunk;
    this.draggedChunk = null;
    if (from === null || from === index) return;
    const [chunk] = this.draft.chunks.splice(from, 1);
    this.draft.chunks.splice(index, 0, chunk);
    this.openChunk = index;
    this.dirty.set(true);
  }

  protected publicationIssues(): { path: string; message: string }[] {
    const draft = this.draft;
    const issues: { path: string; message: string }[] = [];
    const required = (path: string, value?: string) => {
      if (!value?.trim()) issues.push({ path, message: 'Required for publishing.' });
    };
    for (const key of ['titleVi', 'titleEn', 'context', 'userRole', 'aiRole'] as const) {
      required(key, draft[key]);
    }
    if (!clean(draft.goals).length) issues.push({ path: 'goals', message: 'Add at least one non-empty learning goal.' });
    if (draft.chunks.length < 4) issues.push({ path: 'chunks', message: 'Add between four and six chunks.' });
    draft.chunks.forEach((chunk, index) => {
      const path = `chunks.${index}`;
      for (const key of ['text', 'meaningVi', 'exampleSentence'] as const) required(`${path}.${key}`, chunk[key]);
      if (!clean(chunk.acceptedVariations).length) {
        issues.push({ path: `${path}.acceptedVariations`, message: 'Add at least one non-empty variation.' });
      }
      for (const [key, options, answer] of [
        ['distractorsEn', chunk.distractorsEn, chunk.text],
        ['distractorsVi', chunk.distractorsVi, chunk.meaningVi]
      ] as const) {
        const values = new Set(clean(options).map((option) => option.toLowerCase()));
        if (values.size !== 3 || values.has(answer.trim().toLowerCase())) {
          issues.push({ path: `${path}.${key}`, message: 'Add three distinct incorrect answers.' });
        }
      }
    });
    if (!draft.requirements.some((item) => item.isMandatory)) {
      issues.push({ path: 'requirements', message: 'Add at least one mandatory requirement.' });
    }
    draft.requirements.forEach((item, index) => required(`requirements.${index}.description`, item.description));
    return issues;
  }

  protected openPreview(dialog: HTMLDialogElement): void {
    const draft = this.draft;
    this.previewData = {
      id: '', slug: draft.slug, category: draft.category ?? 'DAILY_LIFE', level: draft.level ?? 'A1',
      titleVi: draft.titleVi || 'Bài học chưa có tiêu đề', titleEn: draft.titleEn || 'Untitled lesson',
      context: draft.context ?? '', userRole: draft.userRole ?? '', aiRole: draft.aiRole ?? '',
      goals: clean(draft.goals), estimatedDurationMinutes: draft.estimatedDurationMinutes ?? 10,
      sortOrder: draft.sortOrder ?? 0, status: 'NOT_STARTED', highestScore: null, xpReward: 100,
      practicedChunks: [],
      chunks: draft.chunks.map((chunk, index) => ({
        ...chunk, id: String(index), sortOrder: index, text: chunk.text ?? '',
        meaningVi: chunk.meaningVi ?? '', exampleSentence: chunk.exampleSentence ?? '',
        acceptedVariations: clean(chunk.acceptedVariations), distractorsEn: clean(chunk.distractorsEn),
        distractorsVi: clean(chunk.distractorsVi)
      })),
      requirements: draft.requirements.map((item, index) => ({
        ...item, id: String(index), sortOrder: index, description: item.description ?? '',
        type: item.type ?? 'TASK', isMandatory: item.isMandatory ?? true
      }))
    };
    dialog.showModal();
  }
  protected draft = toForm(null);

  protected generateOrConfirm(dialog: HTMLDialogElement): void {
    if (this.draft.titleVi || this.draft.titleEn || this.draft.context || this.draft.goals.length ||
        this.draft.chunks.length || this.draft.requirements.length) {
      dialog.showModal();
    } else {
      void this.generateLesson();
    }
  }

  protected async generateLesson(dialog?: HTMLDialogElement): Promise<void> {
    dialog?.close();
    const result = await this.requestAi(this.api.generateLesson({
      topic: this.aiTopic.trim(), chunkCount: this.aiCount,
      level: this.draft.level ?? 'A1', category: this.draft.category ?? 'DAILY_LIFE'
    }));
    if (!result) return;
    const previousSlug = this.draft.slug;
    this.draft = toForm(result);
    if (this.slugEdited && previousSlug) this.draft.slug = previousSlug;
    this.openChunk = 0;
    this.dirty.set(true);
    this.notice.set('AI đã điền bản nháp. Kiểm tra bài trước khi lưu.');
  }

  protected async suggestDistractors(chunk: ChunkForm): Promise<void> {
    if (!chunk.text?.trim()) return;
    const result = await this.requestAi(this.api.generateDistractors({
      text: chunk.text.trim(), level: this.draft.level ?? 'A1', meaningVi: chunk.meaningVi?.trim() || null
    }));
    if (!result) return;
    chunk.meaningVi = chunk.meaningVi?.trim() || result.meaningVi;
    chunk.distractorsEn = result.distractorsEn;
    chunk.distractorsVi = result.distractorsVi;
    this.dirty.set(true);
    this.notice.set('Đã điền đáp án nhiễu để bạn kiểm tra.');
  }

  protected hasDistractors(chunk: ChunkForm): boolean {
    return [...chunk.distractorsEn, ...chunk.distractorsVi].some((value) => !!value.trim());
  }

  private async requestAi<Result>(request: Observable<Result>): Promise<Result | null> {
    if (this.aiBusy() || this.busy()) return null;
    this.aiBusy.set(true);
    this.error.set(null);
    this.notice.set('');
    try { return await firstValueFrom(request.pipe(takeUntilDestroyed(this.destroyRef))); }
    catch (error) { this.error.set(scenarioError(error)); return null; }
    finally { this.aiBusy.set(false); }
  }

  constructor() {
    const resumeStep = this.router.getCurrentNavigation()?.extras.state?.['editorStep'];
    this.api.listCategories().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => this.categoryNames.set(Object.fromEntries(items.map((item) => [item.code, item.nameVi]))),
      error: (error: unknown) => this.error.set(scenarioError(error))
    });
    this.route.paramMap.pipe(
      switchMap((params) => {
        this.loading.set(true);
        this.loadFailed.set(false);
        this.error.set(null);
        this.notice.set('');
        this.confirmArchive.set(false);
        const id = params.get('id');
        const request: Observable<ScenarioDetail | null> = id ? this.api.get(id) : of(null);
        return request.pipe(
          catchError((error: unknown) => {
            this.loadFailed.set(true);
            this.error.set(scenarioError(error));
            return of(null);
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((scenario) => {
      this.step = 0;
      if (scenario?.status === 'DRAFT') {
        if (this.route.snapshot.queryParamMap.get('review') === '1') this.step = 2;
        else if (resumeStep === 1 || resumeStep === 2) this.step = resumeStep;
      }
      this.openChunk = 0;
      this.setSaved(scenario);
      this.preview.set(!!scenario && scenario.status !== 'DRAFT');
      this.loading.set(false);
    });
  }

  protected async save(publish = false): Promise<void> {
    if (this.busy() || this.aiBusy()) return;
    this.error.set(null);
    this.notice.set('');
    let scenario = this.saved();
    if (publish) {
      const issues = this.publicationIssues();
      if (issues.length) {
        this.error.set({
          message: 'Bài học còn thiếu nội dung trước khi xuất bản.',
          fields: Object.fromEntries(issues.map(({ path, message }) => [path, message]))
        });
        this.fixField(issues[0].path);
        return;
      }
    }
    const input: ScenarioInput = {
      ...this.draft,
      slug: this.draft.slug.trim(),
      goals: clean(this.draft.goals),
      chunks: this.draft.chunks.map((chunk) => ({
        ...chunk,
        audioUrl: chunk.audioUrl?.trim() || null,
        acceptedVariations: clean(chunk.acceptedVariations),
        distractorsEn: clean(chunk.distractorsEn),
        distractorsVi: clean(chunk.distractorsVi)
      }))
    };
    const draftErrors: Record<string, string> = {};
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug)) draftErrors['slug'] = 'Invalid slug.';
    if (!Number.isInteger(input.estimatedDurationMinutes) || (input.estimatedDurationMinutes ?? 0) < 1) {
      draftErrors['estimatedDurationMinutes'] = 'Invalid duration.';
    }
    if (!Number.isInteger(input.sortOrder) || (input.sortOrder ?? -1) < 0) draftErrors['sortOrder'] = 'Invalid sort order.';
    const [firstError] = Object.keys(draftErrors);
    if (firstError) {
      this.error.set({ message: 'Kiểm tra thông tin trước khi lưu.', fields: draftErrors });
      this.fixField(firstError);
      return;
    }
    if (!scenario || this.dirty()) {
      scenario = await this.run(scenario
        ? this.api.update(scenario.id, { ...input, revision: scenario.revision })
        : this.api.create(input));
      if (!scenario) {
        const [field] = Object.keys(this.error()?.fields ?? {});
        if (field) this.fixField(field);
        return;
      }
      this.setSaved(scenario);
    }
    if (publish) {
      await this.changeStatus('PUBLISHED');
      if (this.error()) {
        this.notice.set('Đã lưu bản nháp.');
        const [field] = Object.keys(this.error()?.fields ?? {});
        if (field) this.fixField(field);
        return;
      }
    } else {
      this.notice.set('Đã lưu bản nháp.');
    }
    if (!this.route.snapshot.paramMap.has('id')) {
      await this.router.navigate(['/admin/scenarios', scenario.id], {
        replaceUrl: true,
        state: { editorStep: this.step }
      });
    }
  }

  protected async changeStatus(status: ScenarioStatusUpdate['status']): Promise<void> {
    const current = this.saved();
    if (!current || this.dirty()) return;
    this.confirmArchive.set(false);
    const saved = await this.run(this.api.setStatus(current.id, { status, revision: current.revision }));
    if (saved) {
      this.setSaved(saved);
      this.preview.set(true);
      this.notice.set(status === 'ARCHIVED' ? 'Đã ẩn bài học.' : 'Bài học đã xuất hiện trong thư viện.');
    } else if (current.status === 'DRAFT') {
      this.preview.set(false);
    }
  }

  protected async duplicate(): Promise<void> {
    const current = this.saved();
    if (!current) return;
    const saved = await this.run(this.api.createCopy(current));
    if (saved) await this.router.navigate(['/admin/scenarios', saved.id]);
  }

  protected addChunk(): void {
    this.draft.chunks.push({
      functionTag: 'REQUEST', text: '', meaningVi: '', exampleSentence: '',
      audioUrl: null, acceptedVariations: [], distractorsEn: ['', '', ''], distractorsVi: ['', '', '']
    });
    this.openChunk = this.draft.chunks.length - 1;
    this.dirty.set(true);
    this.fixField(`chunks.${this.openChunk}.text`);
  }

  protected addRequirement(): void {
    this.draft.requirements.push({
      description: '', type: 'TASK', expectedChunkFunction: null, isMandatory: true
    });
    this.dirty.set(true);
    this.fixField(`requirements.${this.draft.requirements.length - 1}.description`);
  }

  protected remove(items: unknown[], index: number): void {
    items.splice(index, 1);
    if (items === this.draft.chunks && this.openChunk >= items.length) this.openChunk = items.length - 1;
    this.dirty.set(true);
  }

  protected move(items: unknown[], index: number, step: -1 | 1): void {
    const destination = index + step;
    if (destination < 0 || destination >= items.length) return;
    [items[index], items[destination]] = [items[destination], items[index]];
    if (items === this.draft.chunks) this.openChunk = destination;
    this.dirty.set(true);
  }

  protected fieldLabel(path: string): string {
    const [group, index, field] = path.split('.');
    if (index !== undefined && field) {
      return (fieldLabels[group] ?? group) + ' ' + (Number(index) + 1) + ' · ' + (fieldLabels[field] ?? field);
    }
    return fieldLabels[path] ?? path;
  }

  protected fieldMessage(message: string): string {
    const messages: Record<string, string> = {
      'Required for publishing.': 'Cần nhập trước khi xuất bản.',
      'Invalid slug.': 'Nhập tiêu đề tiếng Việt để tạo đường dẫn, hoặc sửa trong phần nâng cao.',
      'Invalid duration.': 'Nhập thời lượng ít nhất 1 phút.',
      'Invalid sort order.': 'Nhập số nguyên từ 0 trở lên.',
      'Slug conflict.': 'Đường dẫn đã có bài sử dụng. Chọn đường dẫn khác.',
      'Add at least one non-empty learning goal.': 'Thêm ít nhất một mục tiêu học tập.',
      'Add at least one mandatory requirement.': 'Đánh dấu ít nhất một yêu cầu bắt buộc.',
      'Add between four and six chunks.': 'Thêm từ 4 đến 6 cụm từ.',
      'Add at least one non-empty variation.': 'Thêm ít nhất một biến thể.',
      'Add three distinct incorrect answers.': 'Thêm ba đáp án nhiễu khác nhau và khác đáp án đúng.'
    };
    return messages[message] ?? 'Kiểm tra lại giá trị hoặc số lượng ở trường này.';
  }

  private async run(request: Observable<ScenarioDetail>): Promise<ScenarioDetail | null> {
    if (this.busy()) return null;
    this.busy.set(true);
    this.error.set(null);
    this.notice.set('');
    try {
      return await firstValueFrom(request.pipe(takeUntilDestroyed(this.destroyRef)));
    } catch (error) {
      this.error.set(scenarioError(error));
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  private setSaved(scenario: ScenarioDetail | null): void {
    this.saved.set(scenario);
    this.draft = toForm(scenario);
    this.slugEdited = !!scenario;
    this.dirty.set(false);
  }
}
