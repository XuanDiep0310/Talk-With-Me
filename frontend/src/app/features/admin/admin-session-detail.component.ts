import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { exhaustMap, take, takeWhile, timer } from 'rxjs';
import type { components } from '../../core/api/openapi';
import { AdminConsoleService } from './admin-console.service';
import { qaLabels, sessionStatuses, skillLabels } from './admin-session-labels';

type Schemas = components['schemas'];
type Label = Schemas['AdminQaLabels']['labels'][number];

@Component({
  selector: 'app-admin-session-detail',
  imports: [DatePipe, DecimalPipe, RouterLink],
  styleUrl: './admin.scss',
  templateUrl: './admin-session-detail.component.html',
})
export class AdminSessionDetailComponent {
  private readonly api = inject(AdminConsoleService);
  private readonly destroy = inject(DestroyRef);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  protected readonly detail = signal<Schemas['AdminSessionDetail'] | null>(null);
  protected readonly transcript = signal<Schemas['AdminTranscriptItem'][] >([]);
  protected readonly transcriptOpened = signal(false);
  protected readonly next = signal<string | null>(null);
  protected readonly labels = signal<Label[]>([]);
  protected readonly labelOptions = qaLabels;
  protected readonly statuses = sessionStatuses;
  protected readonly skills = skillLabels;
  protected readonly sources: Record<string, string> = {
    AI: 'AI', TEXT: 'Văn bản nhập', STT: 'STT có mốc từ', STT_NO_WORD_TIMES: 'STT thiếu mốc từ', LEGACY: 'Dữ liệu cũ',
  };
  protected readonly components: Record<string, string> = {
    speech_continuity: 'Tính liên tục', pause_score: 'Điểm khoảng ngừng', filler_word_score: 'Điểm từ đệm',
    mtld: 'Độ đa dạng từ vựng (MTLD)', average_confidence: 'STT confidence',
    average_latency_seconds: 'Độ trễ trả lời trung bình (giây)',
  };
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly loadingTranscript = signal(false);
  protected readonly updating = signal(false);
  protected readonly retrying = signal(false);

  constructor() { this.load(); }

  protected load(): void {
    this.error.set('');
    this.api.session(this.id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (item) => { this.detail.set(item); this.labels.set(item.qaLabels); },
      error: () => this.error.set('Không thể tải chi tiết phiên học.'),
    });
  }

  protected loadTranscript(cursor?: string): void {
    this.loadingTranscript.set(true);
    this.error.set('');
    this.api.transcript(this.id, cursor).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (page) => {
        this.transcriptOpened.set(true);
        this.transcript.update((items) => cursor ? [...items, ...page.items] : page.items);
        this.next.set(page.nextCursor ?? null);
        this.loadingTranscript.set(false);
      },
      error: () => { this.loadingTranscript.set(false); this.error.set('Không thể tải transcript.'); },
    });
  }

  protected toggleLabel(label: Label, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.labels.update((values) => checked ? [...values, label] : values.filter((value) => value !== label));
  }

  protected saveLabels(): void {
    this.updating.set(true);
    this.error.set('');
    this.api.updateQaLabels(this.id, { labels: this.labels() }).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: ({ labels }) => {
        this.labels.set(labels);
        this.detail.update((item) => item ? { ...item, qaLabels: labels } : item);
        this.notice.set('Đã lưu nhãn QA.');
        this.updating.set(false);
      },
      error: () => { this.updating.set(false); this.error.set('Không thể lưu nhãn QA.'); },
    });
  }

  protected retry(): void {
    this.retrying.set(true);
    this.error.set('');
    this.api.retryFeedback(this.id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (feedback) => {
        this.notice.set('Đã gửi yêu cầu chấm điểm lại.');
        this.detail.update((item) => item ? { ...item, feedback } : item);
        timer(0, 2000).pipe(
          take(30),
          exhaustMap(() => this.api.session(this.id)),
          takeWhile((item) => item.feedbackStatus === 'PENDING', true),
          takeUntilDestroyed(this.destroy),
        ).subscribe({
          next: (item) => this.detail.set(item),
          complete: () => this.retrying.set(false),
          error: () => { this.retrying.set(false); this.error.set('Không thể cập nhật trạng thái chấm điểm.'); },
        });
      },
      error: () => { this.retrying.set(false); this.error.set('Chưa thể yêu cầu chấm điểm lại.'); },
    });
  }

  protected entries(components: Record<string, unknown> | undefined) {
    return Object.entries(components ?? {}).filter(([key, value]) =>
      !!this.components[key] && (typeof value === 'number' || value === null));
  }
}
