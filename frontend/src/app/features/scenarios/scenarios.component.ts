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
import { AppStateService } from '../../core/services/app-state.service';
import {
  ScenarioService,
  ScenarioSummary,
  ScenarioLibraryResponse,
} from '../../core/services/scenario.service';

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  DAILY_LIFE: { label: 'Đời sống hằng ngày', icon: 'sun' },
  SOCIAL: { label: 'Giao tiếp xã hội', icon: 'users' },
  TRAVEL_SHOPPING: { label: 'Du lịch & Mua sắm', icon: 'plane' },
  WORKPLACE: { label: 'Nơi làm việc', icon: 'briefcase' },
};

@Component({
  selector: 'app-scenarios',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-5 md:p-8 max-w-6xl mx-auto space-y-6">
      <!-- Header & Progress bar -->
      <div class="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 text-xs font-bold mb-2">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Phương pháp Chunking
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Thư viện tình huống</h1>
          <p class="text-sm text-slate-500 mt-1">
            Đã hoàn thành <strong class="text-blue-700 font-bold">{{ completedCount() }}</strong> / {{ totalCount() }} tình huống (còn {{ remainingCount() }} chưa học)
          </p>
        </div>
        <div class="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
          <div class="progress-bar h-2.5 w-32 sm:w-40 bg-slate-100 rounded-full overflow-hidden">
            <div
              class="progress-bar-fill h-2.5 rounded-full transition-all duration-500 bg-gradient-to-r from-blue-600 to-indigo-600"
              [style.width.%]="completionPercent()"
            ></div>
          </div>
          <span class="text-sm font-bold text-blue-700">
            {{ completionPercent() }}%
          </span>
        </div>
      </div>

      <!-- Filters Row -->
      <div class="flex flex-wrap items-center gap-3">
        <div class="relative flex-1 min-w-64">
          <svg
            class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            width="17"
            height="17"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            class="input-field pl-10 pr-4 text-sm w-full rounded-xl border border-slate-200 bg-white shadow-2xs py-2.5"
            aria-label="Search scenarios"
            placeholder="Tìm theo tên tình huống, vai trò..."
            [value]="searchQuery()"
            (input)="onSearchInput($event)"
          />
        </div>

        <!-- Level filters -->
        <div class="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
          @for (lvl of levels; track lvl) {
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
              [class.bg-white]="selectedLevel() === lvl"
              [class.text-blue-700]="selectedLevel() === lvl"
              [class.shadow-2xs]="selectedLevel() === lvl"
              [class.text-slate-600]="selectedLevel() !== lvl"
              [attr.aria-pressed]="selectedLevel() === lvl"
              (click)="setLevel(lvl)"
            >
              {{ lvl }}
            </button>
          }
        </div>

        <!-- Status filters -->
        <div class="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
          @for (st of statusFilters; track st.value) {
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
              [class.bg-white]="selectedStatus() === st.value"
              [class.text-blue-700]="selectedStatus() === st.value"
              [class.shadow-2xs]="selectedStatus() === st.value"
              [class.text-slate-600]="selectedStatus() !== st.value"
              [attr.aria-pressed]="selectedStatus() === st.value"
              (click)="setStatus(st.value)"
            >
              {{ st.label }}
            </button>
          }
        </div>
      </div>

      <!-- Category Filter Tabs -->
      <div class="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          class="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer border"
          [class.bg-blue-600]="selectedCategory() === 'all'"
          [class.text-white]="selectedCategory() === 'all'"
          [class.border-blue-600]="selectedCategory() === 'all'"
          [class.bg-white]="selectedCategory() !== 'all'"
          [class.text-slate-700]="selectedCategory() !== 'all'"
          [class.border-slate-200]="selectedCategory() !== 'all'"
          [attr.aria-pressed]="selectedCategory() === 'all'"
          (click)="setCategory('all')"
        >
          Tất cả nhóm
        </button>
        @for (cat of categoryOptions(); track cat.id) {
          <button
            type="button"
            class="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer border flex items-center gap-2"
            [class.bg-blue-600]="selectedCategory() === cat.id"
            [class.text-white]="selectedCategory() === cat.id"
            [class.border-blue-600]="selectedCategory() === cat.id"
            [class.bg-white]="selectedCategory() !== cat.id"
            [class.text-slate-700]="selectedCategory() !== cat.id"
            [class.border-slate-200]="selectedCategory() !== cat.id"
            [attr.aria-pressed]="selectedCategory() === cat.id"
            (click)="setCategory(cat.id)"
          >
            <span>{{ cat.label }}</span>
          </button>
        }
      </div>

      <!-- Scenarios Grid -->
      @if (isLoading()) {
        <div class="py-20 text-center text-slate-400">
          <div class="w-10 h-10 mx-auto rounded-full border-2 border-blue-600 border-t-transparent animate-spin mb-3"></div>
          <p class="text-sm font-medium">Đang tải danh sách tình huống...</p>
        </div>
      } @else if (errorMessage()) {
        <div class="card p-8 text-center text-rose-600 bg-rose-50/60 border-rose-200 rounded-2xl">
          <p class="text-sm font-semibold">{{ errorMessage() }}</p>
          <button type="button" class="btn-secondary mt-3 text-xs px-4 py-2 cursor-pointer rounded-xl" (click)="loadScenarios()">
            Thử lại
          </button>
        </div>
      } @else {
        <div class="space-y-10">
          @for (group of groupedScenarios(); track group.category) {
            <section class="space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <h2 class="font-extrabold text-lg text-slate-900 tracking-tight">
                    {{ group.label }}
                  </h2>
                </div>
                <span class="badge text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                  {{ group.completedCount }}/{{ group.items.length }} hoàn thành
                </span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                @for (s of group.items; track s.id) {
                  <button
                    type="button"
                    class="card-interactive p-5 flex flex-col text-left rounded-2xl border border-slate-200/80 bg-white justify-between gap-3 group"
                    (click)="selectScenario(s)"
                  >
                    <div>
                      <div class="flex items-start justify-between gap-2 mb-3">
                        <div class="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-blue-50 text-slate-600 group-hover:text-blue-600 flex items-center justify-center transition-colors">
                          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                        </div>
                        @if (s.status === 'COMPLETED') {
                          <span class="badge text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Đã hoàn thành
                          </span>
                        } @else if (s.status === 'IN_PROGRESS') {
                          <span class="badge text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Đang học
                          </span>
                        } @else {
                          <span class="badge text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                            {{ s.level }}
                          </span>
                        }
                      </div>

                      <div class="font-bold text-base text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 mb-1">
                        {{ s.titleVi }}
                      </div>
                      <div class="text-xs italic text-slate-400 font-medium line-clamp-1 mb-2">
                        {{ s.titleEn }}
                      </div>
                      <div class="text-xs text-slate-500 line-clamp-2">
                        Vai: <strong class="text-slate-700 font-semibold">{{ s.userRole }}</strong>
                      </div>
                    </div>

                    <div class="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                      <span class="text-slate-400 flex items-center gap-1 font-medium">
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {{ s.estimatedDurationMinutes || 10 }} phút
                      </span>
                      <span class="font-bold text-amber-600">
                        +{{ s.xpReward }} XP
                      </span>
                    </div>
                  </button>
                }
              </div>
            </section>
          }

          @if (groupedScenarios().length === 0) {
            <div class="card p-12 text-center rounded-2xl">
              <div class="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <div class="font-bold text-base text-slate-800 mb-1">
                Không tìm thấy tình huống nào
              </div>
              <p class="text-xs text-slate-400 mb-4">
                Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.
              </p>
              <button type="button" class="btn-secondary text-xs px-4 py-2 cursor-pointer rounded-xl" (click)="resetFilters()">
                Xóa bộ lọc
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ScenariosComponent implements OnInit {
  private readonly scenarioService = inject(ScenarioService);
  private readonly router = inject(Router);
  readonly appState = inject(AppStateService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly searchQuery = signal('');
  readonly selectedLevel = signal('Tất cả');
  readonly selectedStatus = signal('all');
  readonly selectedCategory = signal('all');

  readonly libraryData = signal<ScenarioLibraryResponse | null>(null);

  readonly levels = ['Tất cả', 'A1', 'A2', 'B1', 'B2', 'C1'];

  readonly statusFilters = [
    { value: 'all', label: 'Tất cả trạng thái' },
    { value: 'COMPLETED', label: 'Đã hoàn thành' },
    { value: 'IN_PROGRESS', label: 'Đang học' },
    { value: 'NOT_STARTED', label: 'Chưa học' },
  ] as const;

  readonly categoryOptions = computed(() => (this.libraryData()?.categories ?? [])
    .map((category) => ({ id: category.category, label: category.nameVi })));

  readonly totalCount = computed(() => this.libraryData()?.totalCount ?? 0);
  readonly completedCount = computed(() => this.libraryData()?.completedCount ?? 0);
  readonly remainingCount = computed(
    () => (this.libraryData()?.totalCount ?? 0) - (this.libraryData()?.completedCount ?? 0)
  );
  readonly completionPercent = computed(
    () => this.libraryData()?.totalProgressPct ?? 0
  );

  readonly groupedScenarios = computed(() => {
    const data = this.libraryData();
    if (!data || !data.scenarios) return [];

    const categoryGroups: Record<
      string,
      {
        category: string;
        label: string;
        completedCount: number;
        items: ScenarioSummary[];
      }
    > = {};

    for (const s of data.scenarios) {
      if (!categoryGroups[s.category]) {
        const meta = CATEGORY_META[s.category] || { label: s.category, icon: 'folder' };
        categoryGroups[s.category] = {
          category: s.category,
          label: data.categories.find((item) => item.category === s.category)?.nameVi ?? meta.label,
          completedCount: 0,
          items: [],
        };
      }
      categoryGroups[s.category].items.push(s);
      if (s.status === 'COMPLETED') {
        categoryGroups[s.category].completedCount++;
      }
    }

    return Object.values(categoryGroups);
  });

  ngOnInit(): void {
    this.loadScenarios();
  }

  loadScenarios(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.scenarioService
      .getScenarios({
        category: this.selectedCategory(),
        level: this.selectedLevel(),
        status: this.selectedStatus(),
        q: this.searchQuery(),
      })
      .subscribe({
        next: (res) => {
          this.libraryData.set(res);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Không thể tải danh sách tình huống. Vui lòng thử lại.');
          this.isLoading.set(false);
        },
      });
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.loadScenarios();
  }

  setLevel(lvl: string): void {
    this.selectedLevel.set(lvl);
    this.loadScenarios();
  }

  setStatus(status: string): void {
    this.selectedStatus.set(status);
    this.loadScenarios();
  }

  setCategory(cat: string): void {
    this.selectedCategory.set(cat);
    this.loadScenarios();
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.selectedLevel.set('Tất cả');
    this.selectedStatus.set('all');
    this.selectedCategory.set('all');
    this.loadScenarios();
  }

  selectScenario(scenario: ScenarioSummary): void {
    this.router.navigate(['/scenarios', scenario.id]);
  }
}
