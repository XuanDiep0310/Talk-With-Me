import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CoachService, CoachTopic, CoachTopicGroup } from '../../core/services/coach.service';
import { ToastService } from '../../core/services/toast.service';
import { AppStateService } from '../../core/services/app-state.service';

@Component({
  selector: 'app-ai-coach',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-5 md:p-8 max-w-4xl mx-auto">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-800 mb-1" style="font-weight: 800; color: #1e293b">AI Coach</h1>
          <p class="text-sm" style="color: #64748b">
            Luyện nói 1-1 với AI Coach Alex bằng giọng nói, phản xạ tự nhiên không áp lực.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span class="badge text-xs px-3 py-1 font-600 rounded-full" style="background: #e2f0f9; color: #286fb4">
            Level mục tiêu: {{ appState.user()?.level || 'B1' }}
          </span>
        </div>

      </div>

      <!-- Search Input -->
      <div class="relative mb-6">
        <svg
          class="absolute left-3 top-1/2 -translate-y-1/2"
          width="16"
          height="16"
          fill="none"
          viewBox="0 0 24 24"
          stroke="#94a3b8"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          class="input-field pl-9 w-full rounded-xl border border-slate-200 py-2.5 text-sm"
          type="search"
          aria-label="Tìm chủ đề luyện nói"
          placeholder="Tìm chủ đề luyện nói (mua sắm, công việc, du lịch...)"
          [value]="search()"
          (input)="updateSearch($event)"
        />
      </div>

      <!-- Selected Topic Active Card (Màn 14) -->
      @if (selected(); as sel) {
        <section
          class="card p-5 mb-8 flex flex-wrap items-center gap-4 rounded-2xl shadow-sm transition-all"
          aria-label="Chủ đề đã chọn"
          style="background: #E2F0F9; border: 2px solid #286FB4"
        >
          <div class="text-3xl shrink-0 p-3 rounded-xl bg-white shadow-sm" aria-hidden="true">
            🎙️
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-700 text-base" style="font-weight: 700; color: #286FB4">
                {{ sel.title }}
              </span>
              <span class="badge text-xs px-2 py-0.5 rounded font-600" style="background: #286FB4; color: #fff">
                {{ sel.minLevel }}+
              </span>
            </div>
            <p class="text-sm line-clamp-2" style="color: #475569">{{ sel.description }}</p>
            <div class="flex flex-wrap items-center gap-2 mt-2">
              <span class="text-xs font-500" style="color: #64748b">Nhóm: {{ sel.category }}</span>
              @for (skill of sel.targetSkills; track skill) {
                <span class="badge text-xs px-2 py-0.5 rounded-full bg-white text-slate-600">
                  ⚡ {{ skill }}
                </span>
              }
            </div>
          </div>
          <div class="flex gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              class="btn-secondary text-sm px-4 py-2 cursor-pointer rounded-xl"
              (click)="selected.set(null)"
            >
              Đổi chủ đề
            </button>
            <button
              type="button"
              class="btn-primary text-sm px-5 py-2 font-700 cursor-pointer rounded-xl flex items-center gap-2 shadow"
              [disabled]="isStarting()"
              (click)="startSession()"
            >
              @if (isStarting()) {
                <span class="inline-block animate-spin">⏳</span> Đang tạo phiên...
              } @else {
                <span>🎙️</span> Bắt đầu nói
              }
            </button>
          </div>
        </section>
      }

      @if (isLoading()) {
        <div class="p-12 text-center text-slate-400">
          <div class="inline-block animate-spin text-2xl mb-2">⏳</div>
          <p class="text-sm">Đang tải danh sách chủ đề cá nhân hóa...</p>
        </div>
      } @else {
        <!-- 1. Recommended For You Group -->
        @if (recommendedTopics().length > 0 && !search()) {
          <section class="mb-8">
            <div class="flex items-center gap-2 mb-4">
              <span class="text-xl" aria-hidden="true">⭐</span>
              <h2 class="font-700 text-base" style="font-weight: 700; color: #1e293b">
                Gợi ý cho bạn
              </h2>
              <span class="text-xs text-slate-500">(Theo trình độ và điểm cần cải thiện)</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              @for (topic of recommendedTopics(); track topic.id) {
                <button
                  type="button"
                  class="card p-4 flex flex-col justify-between text-left rounded-2xl hover:shadow-md transition-all cursor-pointer relative"
                  [attr.aria-pressed]="selected()?.id === topic.id"
                  [style.borderColor]="selected()?.id === topic.id ? '#286FB4' : '#e2e8f0'"
                  [style.background]="selected()?.id === topic.id ? '#F0F7FC' : '#fff'"
                  (click)="selectTopic(topic)"
                >
                  <div>
                    <div class="flex items-start justify-between gap-2 mb-1.5">
                      <span class="font-700 text-sm line-clamp-1" [style.color]="selected()?.id === topic.id ? '#286FB4' : '#1e293b'">
                        {{ topic.title }}
                      </span>
                      <span class="badge text-xs px-2 py-0.5 rounded font-600 shrink-0" style="background: #E2F0F9; color: #286FB4">
                        {{ topic.minLevel }}+
                      </span>
                    </div>
                    <p class="text-xs line-clamp-2 mb-3" style="color: #64748b">
                      {{ topic.description }}
                    </p>
                  </div>
                  <div class="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                    @for (skill of topic.targetSkills; track skill) {
                      <span class="badge text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {{ skill }}
                      </span>
                    }
                  </div>
                </button>
              }
            </div>
          </section>
        }

        <!-- 2. Categorized Topic Groups -->
        @if (displayGroups().length === 0) {
          <div class="card p-8 text-center rounded-2xl" role="status">
            <div class="text-3xl mb-3" aria-hidden="true">🔎</div>
            <h2 class="font-700 mb-1" style="font-weight: 700; color: #1e293b">
              Không tìm thấy chủ đề phù hợp
            </h2>
            <p class="text-sm mb-4" style="color: #64748b">
              Thử tìm kiếm với từ khóa khác hoặc xem toàn bộ danh mục.
            </p>
            <button type="button" class="btn-secondary text-sm cursor-pointer" (click)="search.set('')">
              Xóa tìm kiếm
            </button>
          </div>
        } @else {
          <div class="space-y-8">
            @for (group of displayGroups(); track group.category) {
              <section>
                <div class="flex items-center gap-2 mb-4">
                  <span class="text-lg" aria-hidden="true">💬</span>
                  <h2 class="font-700 text-base" style="font-weight: 700; color: #1e293b">
                    {{ group.category }}
                  </h2>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  @for (topic of group.topics; track topic.id) {
                    <button
                      type="button"
                      class="card p-4 flex items-start gap-3.5 text-left rounded-2xl hover:shadow-md transition-all cursor-pointer"
                      [attr.aria-pressed]="selected()?.id === topic.id"
                      [style.borderColor]="selected()?.id === topic.id ? '#286FB4' : '#e2e8f0'"
                      [style.background]="selected()?.id === topic.id ? '#F0F7FC' : '#fff'"
                      (click)="selectTopic(topic)"
                    >
                      <span class="text-2xl shrink-0 p-2 rounded-xl bg-slate-50" aria-hidden="true">
                        🗣️
                      </span>
                      <span class="flex-1 min-w-0">
                        <span class="flex items-center justify-between gap-2 mb-1">
                          <span
                            class="font-700 text-sm line-clamp-1"
                            [style.color]="selected()?.id === topic.id ? '#286FB4' : '#1e293b'"
                          >
                            {{ topic.title }}
                          </span>
                          <span class="badge text-xs px-2 py-0.5 rounded font-600 shrink-0" style="background: #E2F0F9; color: #286FB4">
                            {{ topic.minLevel }}+
                          </span>
                        </span>
                        <span class="block text-xs line-clamp-2" style="color: #64748b">
                          {{ topic.description }}
                        </span>
                        <span class="flex flex-wrap items-center gap-1.5 mt-2">
                          @for (skill of topic.targetSkills; track skill) {
                            <span class="badge text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {{ skill }}
                            </span>
                          }
                        </span>
                      </span>
                      @if (selected()?.id === topic.id) {
                        <span
                          class="w-5 h-5 rounded-full shrink-0 flex items-center justify-center mt-1"
                          style="background: #286FB4"
                          aria-label="Đã chọn"
                        >
                          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      }
                    </button>
                  }
                </div>
              </section>
            }
          </div>
        }
      }

      @if (!selected() && !isLoading()) {
        <div class="text-center pt-8 pb-4">
          <p class="text-sm mb-3" style="color: #94a3b8">
            Chọn một chủ đề giao tiếp ở trên để bắt đầu luyện nói với Coach Alex 👆
          </p>
        </div>
      }
    </div>
  `,
})
export class AiCoachComponent implements OnInit {
  readonly appState = inject(AppStateService);
  private readonly coachService = inject(CoachService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  readonly search = signal('');
  readonly selected = signal<CoachTopic | null>(null);
  readonly isLoading = signal(true);
  readonly isStarting = signal(false);

  readonly recommendedTopics = signal<CoachTopic[]>([]);
  readonly groups = signal<CoachTopicGroup[]>([]);

  readonly displayGroups = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.groups();

    return this.groups()
      .map((g) => ({
        ...g,
        topics: g.topics.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            g.category.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.topics.length > 0);
  });

  ngOnInit(): void {
    this.loadTopics();
  }

  loadTopics(): void {
    this.isLoading.set(true);
    this.coachService.getTopics().subscribe({
      next: (res) => {
        this.recommendedTopics.set(res.recommended || []);
        this.groups.set(res.groups || []);
        this.isLoading.set(false);
        // Pre-select top recommended topic if available
        if (res.recommended && res.recommended.length > 0 && !this.selected()) {
          this.selected.set(res.recommended[0]);
        }
      },
      error: (err) => {
        console.error('Failed to load topics:', err);
        this.isLoading.set(false);
        this.toastService.show('Không thể tải danh sách chủ đề. Đang dùng mẫu dự phòng.', 'error');
      },
    });
  }

  updateSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.search.set(val);
  }

  selectTopic(topic: CoachTopic): void {
    this.selected.set(topic);
  }

  startSession(): void {
    const sel = this.selected();
    if (!sel || this.isStarting()) return;

    this.isStarting.set(true);
    this.coachService.createSession(sel.id).subscribe({
      next: (session) => {
        this.isStarting.set(false);
        this.appState.selectedTopicId.set(sel.title);
        void this.router.navigate(['/ai-coach-session'], {
          queryParams: { sessionId: session.id },
        });
      },

      error: (err) => {
        this.isStarting.set(false);
        console.error('Error starting session:', err);
        const msg = err.error?.message || 'Không thể bắt đầu phiên AI Coach. Vui lòng thử lại.';
        this.toastService.show(msg, 'error');
      },
    });
  }
}
