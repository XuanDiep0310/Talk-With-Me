import { KeyValuePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, firstValueFrom, of, switchMap, catchError } from 'rxjs';
import {
  AdminScenarioService, ScenarioDetail, ScenarioInput, ScenarioStatusUpdate,
  categories, levels, scenarioError, statuses
} from './admin-scenario.service';

type ChunkInput = NonNullable<ScenarioInput['chunks']>[number];
type RequirementInput = NonNullable<ScenarioInput['requirements']>[number];
type ChunkForm = Omit<ChunkInput, 'acceptedVariations' | 'distractorsEn' | 'distractorsVi'> & {
  acceptedVariations: string;
  distractorsEn: string;
  distractorsVi: string;
};
type DraftForm = Omit<ScenarioInput, 'goals' | 'chunks' | 'requirements'> & {
  goals: string;
  chunks: ChunkForm[];
  requirements: RequirementInput[];
};

const fieldLabels: Record<string, string> = {
  slug: 'Mã đường dẫn',
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

function toForm(scenario: ScenarioDetail | null): DraftForm {
  if (!scenario) return {
    slug: '', category: 'DAILY_LIFE', level: 'A1', titleVi: '', titleEn: '',
    context: '', userRole: '', aiRole: '', estimatedDurationMinutes: 10, sortOrder: 0,
    goals: '', chunks: [], requirements: []
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
    goals: scenario.goals.join('\n'),
    requirements: scenario.requirements.map((requirement) => ({
      description: requirement.description,
      type: requirement.type,
      expectedChunkFunction: requirement.expectedChunkFunction,
      isMandatory: requirement.isMandatory
    })),
    chunks: scenario.chunks.map((chunk) => ({
      functionTag: chunk.functionTag,
      text: chunk.text,
      meaningVi: chunk.meaningVi,
      exampleSentence: chunk.exampleSentence,
      audioUrl: chunk.audioUrl,
      acceptedVariations: chunk.acceptedVariations?.join('\n') ?? '',
      distractorsEn: chunk.distractorsEn?.join('\n') ?? '',
      distractorsVi: chunk.distractorsVi?.join('\n') ?? ''
    }))
  };
}

function lines(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

@Component({
  selector: 'app-admin-editor',
  imports: [FormsModule, KeyValuePipe, RouterLink],
  templateUrl: './admin-editor.component.html',
  styleUrl: './admin.scss'
})
export class AdminEditorComponent {
  private readonly api = inject(AdminScenarioService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly categories = categories;
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
  protected readonly dirty = signal(false);
  protected readonly preview = signal(false);
  protected readonly error = signal<ReturnType<typeof scenarioError> | null>(null);
  protected readonly notice = signal('');
  protected readonly confirmArchive = signal(false);
  protected readonly showDuplicate = signal(false);
  protected duplicateSlug = '';
  protected draft = toForm(null);

  constructor() {
    this.route.paramMap.pipe(
      switchMap((params) => {
        this.loading.set(true);
        this.loadFailed.set(false);
        this.error.set(null);
        this.notice.set('');
        this.showDuplicate.set(false);
        this.confirmArchive.set(false);
        this.duplicateSlug = '';
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
      this.setSaved(scenario);
      this.preview.set(!!scenario && scenario.status !== 'DRAFT');
      this.loading.set(false);
    });
  }

  protected async save(): Promise<void> {
    const scenario = this.saved();
    const input: ScenarioInput = {
      ...this.draft,
      slug: this.draft.slug.trim(),
      goals: lines(this.draft.goals),
      chunks: this.draft.chunks.map((chunk) => ({
        ...chunk,
        audioUrl: chunk.audioUrl?.trim() || null,
        acceptedVariations: lines(chunk.acceptedVariations),
        distractorsEn: lines(chunk.distractorsEn),
        distractorsVi: lines(chunk.distractorsVi)
      }))
    };
    const saved = await this.run(scenario
      ? this.api.update(scenario.id, { ...input, revision: scenario.revision })
      : this.api.create(input));
    if (!saved) return;
    if (!scenario) {
      await this.router.navigate(['/admin/scenarios', saved.id], { replaceUrl: true });
      return;
    }
    this.setSaved(saved);
    this.notice.set('Đã lưu bản nháp.');
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
    const saved = await this.run(this.api.duplicate(current.id, { slug: this.duplicateSlug.trim() }));
    if (saved) await this.router.navigate(['/admin/scenarios', saved.id]);
  }

  protected addChunk(): void {
    this.draft.chunks.push({
      functionTag: 'REQUEST', text: '', meaningVi: '', exampleSentence: '',
      audioUrl: null, acceptedVariations: '', distractorsEn: '', distractorsVi: ''
    });
    this.dirty.set(true);
  }

  protected addRequirement(): void {
    this.draft.requirements.push({
      description: '', type: 'TASK', expectedChunkFunction: null, isMandatory: true
    });
    this.dirty.set(true);
  }

  protected remove(items: unknown[], index: number): void {
    items.splice(index, 1);
    this.dirty.set(true);
  }

  protected move(items: unknown[], index: number, step: -1 | 1): void {
    const destination = index + step;
    if (destination < 0 || destination >= items.length) return;
    [items[index], items[destination]] = [items[destination], items[index]];
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
    this.dirty.set(false);
  }
}
