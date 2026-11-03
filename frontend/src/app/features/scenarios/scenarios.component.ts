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

const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  DAILY_LIFE: { label: 'Đời sống hằng ngày', emoji: '☀️' },
  SOCIAL: { label: 'Giao tiếp xã hội', emoji: '🤝' },
  TRAVEL_SHOPPING: { label: 'Du lịch & Mua sắm', emoji: '✈️' },
  WORKPLACE: { label: 'Nơi làm việc', emoji: '💼' },
};

const SCENARIO_EMOJIS: Record<string, string> = {
  'supermarket-shopping': '🛒',
  'restaurant-reservation': '🍽️',
  'doctor-visit': '🏥',
  'apartment-renting': '🏠',
  'coffee-ordering': '☕',
  'self-introduction': '👋',
  'party-small-talk': '🎉',
  'making-friends-online': '💬',
  'asking-for-help': '🤝',
  'inviting-a-friend': '✉️',
  'hotel-checkin': '🏨',
  'asking-for-directions': '🗺️',
  'shopping-at-the-mall': '👗',
  'museum-tour': '🏛️',
  'airport-transit': '🛫',
  'job-interview': '💼',
  'project-team-meeting': '📊',
  'handling-customer-call': '📞',
  'email-and-report': '📧',
  'giving-a-presentation': '🗣️',
};

@Component({
  selector: 'app-scenarios',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-5 md:p-8 max-w-6xl mx-auto">
      <!-- Header & Progress bar -->
      <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-800" style="font-weight: 800; color: #1e293b">Thư viện tình huống</h1>
          <p class="text-sm mt-1" style="color: #64748b">
            Hoàn thành {{ completedCount() }}/{{ totalCount() }} tình huống · {{ remainingCount() }} còn lại
          </p>
        </div>
        <div class="flex items-center gap-3">
          <div class="progress-bar h-2.5 w-36 bg-slate-100 rounded-full overflow-hidden">
            <div
              class="progress-bar-fill h-2.5 rounded-full transition-all duration-500"
              [style.width.%]="completionPercent()"
              style="background: #286FB4"
            ></div>
          </div>
          <span class="text-sm font-700" style="color: #286FB4; font-weight: 700">
            {{ completionPercent() }}%
          </span>
        </div>
      </div>

      <!-- Filters Row -->
      <div class="flex flex-wrap gap-3 mb-6">
        <div class="relative flex-1 min-w-56">
          <svg
            class="absolute left-3 top-1/2 -translate-y-1/2"
            width="16"
            height="16"
            fill="none"
            viewBox="0 0 24 24"
            stroke="#94a3b8"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            class="input-field pl-9 text-sm w-full"
            aria-label="Search scenarios"
            placeholder="Tìm theo tên tình huống, vai trò..."
            [value]="searchQuery()"
            (input)="onSearchInput($event)"
          />
        </div>

        <!-- Level filters -->
        <div class="flex flex-wrap gap-2">
          @for (lvl of levels; track lvl) {
            <button
              type="button"
              class="px-3 py-2 rounded-xl text-sm font-600 transition-all cursor-pointer"
              [style.background]="selectedLevel() === lvl ? '#286FB4' : '#fff'"
              [style.color]="selectedLevel() === lvl ? '#fff' : '#64748b'"
              [style.borderColor]="selectedLevel() === lvl ? '#286FB4' : '#E2F0F9'"
              [attr.aria-pressed]="selectedLevel() === lvl"
              style="border-width: 1.5px"
              (click)="setLevel(lvl)"
            >
              {{ lvl }}
            </button>
          }
        </div>

        <!-- Status filters -->
        <div class="flex flex-wrap gap-2">
          @for (st of statusFilters; track st.value) {
            <button
              type="button"
              class="px-3 py-2 rounded-xl text-sm font-600 transition-all cursor-pointer"
              [style.background]="selectedStatus() === st.value ? '#286FB4' : '#fff'"
              [style.color]="selectedStatus() === st.value ? '#fff' : '#64748b'"
              [style.borderColor]="selectedStatus() === st.value ? '#286FB4' : '#E2F0F9'"
              [attr.aria-pressed]="selectedStatus() === st.value"
              style="border-width: 1.5px"
              (click)="setStatus(st.value)"
            >
              {{ st.label }}
            </button>
          }
        </div>
      </div>

      <!-- Category Filter Tabs -->
      <div class="flex gap-2 mb-8 overflow-x-auto pb-1">
        <button
          type="button"
          class="px-4 py-2 rounded-full text-sm font-600 whitespace-nowrap shrink-0 transition-all cursor-pointer"
          [style.background]="selectedCategory() === 'all' ? '#286FB4' : '#E2F0F9'"
          [style.color]="selectedCategory() === 'all' ? '#fff' : '#286FB4'"
          [attr.aria-pressed]="selectedCategory() === 'all'"
          (click)="setCategory('all')"
        >
          🗂️ Tất cả nhóm
        </button>
        @for (cat of categoryOptions; track cat.id) {
          <button
            type="button"
            class="px-4 py-2 rounded-full text-sm font-600 whitespace-nowrap shrink-0 transition-all cursor-pointer"
            [style.background]="selectedCategory() === cat.id ? '#286FB4' : '#E2F0F9'"
            [style.color]="selectedCategory() === cat.id ? '#fff' : '#286FB4'"
            [attr.aria-pressed]="selectedCategory() === cat.id"
            (click)="setCategory(cat.id)"
          >
            {{ cat.emoji }} {{ cat.label }}
          </button>
        }
      </div>

      <!-- Scenarios Grid -->
      @if (isLoading()) {
        <div class="py-20 text-center text-slate-400">
          <div class="text-4xl animate-bounce mb-3">💬</div>
          <p class="text-sm">Đang tải danh sách tình huống...</p>
        </div>
      } @else if (errorMessage()) {
        <div class="card p-6 text-center text-rose-600 bg-rose-50 border-rose-200">
          <p>{{ errorMessage() }}</p>
          <button type="button" class="btn-secondary mt-3 cursor-pointer" (click)="loadScenarios()">
            Thử lại
          </button>
        </div>
      } @else {
        <div class="space-y-10">
          @for (group of groupedScenarios(); track group.category) {
            <div>
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-2">
                  <span class="text-xl">{{ group.emoji }}</span>
                  <h2 class="font-700 text-lg" style="font-weight: 700; color: #1e293b">
                    {{ group.label }}
                  </h2>
                </div>
                <span class="badge" style="background: #E2F0F9; color: #286FB4; font-size: 12px; font-weight: 700">
                  {{ group.completedCount }}/{{ group.items.length }} hoàn thành
                </span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                @for (s of group.items; track s.id) {
                  <button
                    type="button"
                    class="card p-5 flex flex-col text-left hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer border border-slate-100"
                    (click)="selectScenario(s)"
                  >
                    <div class="flex items-start justify-between mb-3">
                      <span class="text-3xl">{{ getEmoji(s.slug) }}</span>
                      @if (s.status === 'COMPLETED') {
                        <span class="badge" style="background: #DCFCE7; color: #166534; font-weight: 700">
                          ✓ Đã xong
                        </span>
                      } @else if (s.status === 'IN_PROGRESS') {
                        <span class="badge" style="background: #FEF3C7; color: #92400e; font-weight: 700">
                          ⚡ Đang học
                        </span>
                      } @else {
                        <span class="badge" style="background: #E2F0F9; color: #286FB4; font-weight: 700">
                          {{ s.level }}
                        </span>
                      }
                    </div>

                    <div class="font-700 text-base mb-1" style="font-weight: 700; color: #1e293b">
                      {{ s.titleVi }}
                    </div>
                    <div class="text-xs italic mb-2 text-slate-500 font-500">
                      {{ s.titleEn }}
                    </div>
                    <div class="text-xs mb-3 flex-1 text-slate-600 line-clamp-2">
                      Vai của bạn: <span class="font-600 text-slate-800">{{ s.userRole }}</span>
                    </div>

                    <div class="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span class="text-xs" style="color: #94a3b8">⏱ {{ s.estimatedDurationMinutes || 10 }} phút</span>
                      <span class="text-xs font-700" style="color: #f59e0b; font-weight: 700">
                        +{{ s.xpReward }} XP
                      </span>
                    </div>
                  </button>
                }
              </div>
            </div>
          }

          @if (groupedScenarios().length === 0) {
            <div class="text-center py-20">
              <div class="text-5xl mb-4">🔍</div>
              <div class="font-700 text-base mb-2" style="font-weight: 700; color: #374151">
                Không tìm thấy tình huống nào
              </div>
              <p class="text-sm" style="color: #94a3b8">
                Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.
              </p>
              <button type="button" class="btn-secondary mt-4 cursor-pointer" (click)="resetFilters()">
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
    { value: 'all', label: 'Mọi trạng thái' },
    { value: 'COMPLETED', label: 'Đã hoàn thành' },
    { value: 'IN_PROGRESS', label: 'Đang học' },
    { value: 'NOT_STARTED', label: 'Chưa học' },
  ] as const;

  readonly categoryOptions = [
    { id: 'DAILY_LIFE', label: 'Đời sống hằng ngày', emoji: '☀️' },
    { id: 'SOCIAL', label: 'Giao tiếp xã hội', emoji: '🤝' },
    { id: 'TRAVEL_SHOPPING', label: 'Du lịch & Mua sắm', emoji: '✈️' },
    { id: 'WORKPLACE', label: 'Nơi làm việc', emoji: '💼' },
  ] as const;

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
        emoji: string;
        completedCount: number;
        items: ScenarioSummary[];
      }
    > = {};

    for (const s of data.scenarios) {
      if (!categoryGroups[s.category]) {
        const meta = CATEGORY_META[s.category] || { label: s.category, emoji: '📁' };
        categoryGroups[s.category] = {
          category: s.category,
          label: meta.label,
          emoji: meta.emoji,
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

  getEmoji(slug: string): string {
    return SCENARIO_EMOJIS[slug] || '💬';
  }
}
