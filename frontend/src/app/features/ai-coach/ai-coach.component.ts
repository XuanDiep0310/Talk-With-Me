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
    <div class="p-5 md:p-8 max-w-5xl mx-auto space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-bold mb-2">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            Communication-First AI
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">AI Coach 1-1</h1>
          <p class="text-sm text-slate-500 mt-1 max-w-xl">
            Luyện nói phản xạ tự nhiên cùng Coach Alex bằng giọng nói, không áp lực và không bị ngắt lời.
          </p>
        </div>
        <div class="flex items-center gap-2.5">
          <span class="badge text-xs px-3 py-1.5 font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 shadow-2xs">
            Mục tiêu: {{ appState.user()?.level || 'B1' }}
          </span>
        </div>
      </div>

      <!-- Search Input -->
      <div class="relative">
        <svg
          class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          width="18"
          height="18"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          class="input-field pl-10 pr-10 w-full rounded-2xl border border-slate-200 py-3 text-sm bg-white shadow-2xs"
          type="search"
          aria-label="Tìm chủ đề luyện nói"
          placeholder="Tìm chủ đề luyện nói (mua sắm, công việc, du lịch, phỏng vấn...)"
          [value]="search()"
          (input)="updateSearch($event)"
        />
        @if (search()) {
          <button
            type="button"
            class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            (click)="search.set('')"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        }
      </div>

      <!-- Selected Topic Active Card (Màn 14) -->
      @if (selected(); as sel) {
        <section
          class="p-5 sm:p-6 rounded-3xl border-2 border-blue-600 bg-gradient-to-br from-blue-50/90 via-sky-50/50 to-white shadow-md shadow-blue-500/10 flex flex-col sm:flex-row items-start sm:items-center gap-5 transition-all animate-in fade-in zoom-in-95 duration-200"
          aria-label="Chủ đề đã chọn"
        >
          <div class="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-600/30">
            <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-1.5">
              <span class="font-extrabold text-lg text-slate-900 tracking-tight">
                {{ sel.title }}
              </span>
              <span class="badge text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                +100 XP
              </span>
              <span class="badge text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-600 text-white">
                Level {{ sel.minLevel }}+
              </span>
            </div>
            <p class="text-sm text-slate-600 leading-relaxed">{{ sel.description }}</p>
            <div class="flex flex-wrap items-center gap-2 mt-3">
              <span class="text-xs font-medium text-slate-500">Nhóm: {{ sel.category }}</span>
              <span class="text-slate-300">•</span>
              @for (skill of sel.targetSkills; track skill) {
                <span class="badge text-[11px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-semibold shadow-2xs">
                  {{ skill }}
                </span>
              }
            </div>
          </div>

          <div class="flex gap-3 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-200/60">
            <button
              type="button"
              class="btn-secondary text-sm px-4 py-2.5 rounded-xl cursor-pointer"
              (click)="selected.set(null)"
            >
              Đổi chủ đề
            </button>
            <button
              type="button"
              class="btn-primary text-white text-sm px-6 py-2.5 font-extrabold cursor-pointer rounded-xl flex items-center gap-2 shadow-md shadow-blue-600/25 transition-all"
              [disabled]="isStarting()"
              (click)="startSession()"
            >
              @if (isStarting()) {
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                <span>Đang tạo phiên...</span>
              } @else {
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                </svg>
                <span>Bắt đầu nói</span>
              }
            </button>
          </div>
        </section>
      }

      @if (isLoading()) {
        <div class="p-16 text-center text-slate-400">
          <div class="w-10 h-10 mx-auto rounded-full border-2 border-blue-600 border-t-transparent animate-spin mb-3"></div>
          <p class="text-sm font-medium">Đang tải danh sách chủ đề cá nhân hóa...</p>
        </div>
      } @else {
        <!-- 1. Recommended For You Group -->
        @if (recommendedTopics().length > 0 && !search()) {
          <section class="space-y-4">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <h2 class="font-bold text-base text-slate-900 tracking-tight">
                Gợi ý cho bạn
              </h2>
              <span class="text-xs text-slate-400 font-medium">(Theo trình độ hiện tại và điểm cần cải thiện)</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              @for (topic of recommendedTopics(); track topic.id) {
                <button
                  type="button"
                  class="card-interactive p-5 flex flex-col justify-between text-left rounded-2xl relative border transition-all"
                  [attr.aria-pressed]="selected()?.id === topic.id"
                  [class.border-blue-600]="selected()?.id === topic.id"
                  [class.bg-blue-50]="selected()?.id === topic.id"
                  [class.border-slate-200]="selected()?.id !== topic.id"
                  [class.bg-white]="selected()?.id !== topic.id"
                  (click)="selectTopic(topic)"
                >
                  <div>
                    <div class="flex items-start justify-between gap-2 mb-2">
                      <span class="font-bold text-sm text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
                        {{ topic.title }}
                      </span>
                      <span class="badge text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200/60 shrink-0">
                        +100 XP
                      </span>
                    </div>
                    <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                      {{ topic.description }}
                    </p>
                  </div>
                  <div class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                    <span class="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                      {{ topic.minLevel }}+
                    </span>
                    <div class="flex items-center gap-1">
                      @for (skill of topic.targetSkills.slice(0, 2); track skill) {
                        <span class="badge text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {{ skill }}
                        </span>
                      }
                    </div>
                  </div>
                </button>
              }
            </div>
          </section>
        }

        <!-- 2. Categorized Topic Groups -->
        @if (displayGroups().length === 0) {
          <div class="card p-12 text-center rounded-2xl" role="status">
            <div class="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>
            <h2 class="font-bold text-base text-slate-900 mb-1">
              Không tìm thấy chủ đề phù hợp
            </h2>
            <p class="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
              Thử tìm kiếm với từ khóa khác như "mua sắm", "công sở", hoặc xóa bộ lọc để xem toàn bộ danh mục.
            </p>
            <button type="button" class="btn-secondary text-xs px-4 py-2 cursor-pointer rounded-xl" (click)="search.set('')">
              Xóa tìm kiếm
            </button>
          </div>
        } @else {
          <div class="space-y-8">
            @for (group of displayGroups(); track group.category) {
              <section class="space-y-4">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <h2 class="font-bold text-base text-slate-900 tracking-tight">
                    {{ group.category }}
                  </h2>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  @for (topic of group.topics; track topic.id) {
                    <button
                      type="button"
                      class="card-interactive p-4 sm:p-5 flex items-start gap-4 text-left rounded-2xl border transition-all"
                      [attr.aria-pressed]="selected()?.id === topic.id"
                      [class.border-blue-600]="selected()?.id === topic.id"
                      [class.bg-blue-50]="selected()?.id === topic.id"
                      [class.border-slate-200]="selected()?.id !== topic.id"
                      [class.bg-white]="selected()?.id !== topic.id"
                      (click)="selectTopic(topic)"
                    >
                      <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        </svg>
                      </div>

                      <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-2 mb-1">
                          <span class="font-bold text-sm text-slate-900 line-clamp-1">
                            {{ topic.title }}
                          </span>
                          <span class="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md shrink-0">
                            {{ topic.minLevel }}+
                          </span>
                        </div>
                        <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {{ topic.description }}
                        </p>
                        <div class="flex flex-wrap items-center gap-1.5 mt-2.5">
                          @for (skill of topic.targetSkills; track skill) {
                            <span class="badge text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {{ skill }}
                            </span>
                          }
                        </div>
                      </div>

                      @if (selected()?.id === topic.id) {
                        <div class="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
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
        <div class="text-center pt-6 pb-2 text-xs text-slate-400">
          Chọn một chủ đề giao tiếp ở trên để bắt đầu luyện nói phản xạ 1-1 cùng AI Coach Alex
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
