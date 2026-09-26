import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';
import { Scenario } from '../../core/models/app.models';
import { LevelBadgePipe } from '../../shared/pipes/app-pipes';

export interface ScenarioItem {
  id: number;
  title: string;
  desc: string;
  level: string;
  duration: string;
  emoji: string;
  done: boolean;
  xp: number;
}

export interface ScenarioGroup {
  id: string;
  label: string;
  emoji: string;
  scenarios: ScenarioItem[];
}

export const GROUPS: ScenarioGroup[] = [
  {
    id: "daily",
    label: "Đời sống hằng ngày",
    emoji: "☀️",
    scenarios: [
      { id: 1, title: "Mua sắm tại siêu thị", desc: "Hỏi giá, tìm sản phẩm, thanh toán", level: "A2", duration: "10 phút", emoji: "🛒", done: true, xp: 30 },
      { id: 2, title: "Đặt bàn tại nhà hàng", desc: "Đặt bàn qua điện thoại, chọn món", level: "A2", duration: "12 phút", emoji: "🍽️", done: false, xp: 30 },
      { id: 3, title: "Đến gặp bác sĩ", desc: "Mô tả triệu chứng, hỏi đơn thuốc", level: "B1", duration: "15 phút", emoji: "🏥", done: false, xp: 40 },
      { id: 4, title: "Thuê căn hộ", desc: "Hỏi giá thuê, tiện ích, điều kiện", level: "B1", duration: "15 phút", emoji: "🏠", done: true, xp: 40 }
    ]
  },
  {
    id: "social",
    label: "Giao tiếp xã hội",
    emoji: "🤝",
    scenarios: [
      { id: 5, title: "Giới thiệu bản thân", desc: "Gặp gỡ người mới, kể về bản thân", level: "A2", duration: "10 phút", emoji: "👋", done: true, xp: 25 },
      { id: 6, title: "Tiệc gặp mặt (Party)", desc: "Tham gia hội thoại nhóm, small talk", level: "B1", duration: "20 phút", emoji: "🎉", done: false, xp: 45 },
      { id: 7, title: "Kết bạn online", desc: "Chat video, tìm điểm chung", level: "B1", duration: "15 phút", emoji: "💬", done: false, xp: 35 }
    ]
  },
  {
    id: "travel",
    label: "Du lịch & Mua sắm",
    emoji: "✈️",
    scenarios: [
      { id: 8, title: "Check-in khách sạn", desc: "Đặt phòng, yêu cầu dịch vụ", level: "A2", duration: "12 phút", emoji: "🏨", done: false, xp: 30 },
      { id: 9, title: "Hỏi đường & Di chuyển", desc: "Hỏi đường, dùng phương tiện công cộng", level: "A2", duration: "10 phút", emoji: "🗺️", done: false, xp: 25 },
      { id: 10, title: "Mua sắm tại trung tâm", desc: "Hỏi size, màu, mặc cả", level: "B1", duration: "15 phút", emoji: "👗", done: false, xp: 35 },
      { id: 11, title: "Tham quan bảo tàng", desc: "Hỏi thông tin, giải thích văn hóa", level: "B2", duration: "20 phút", emoji: "🏛️", done: false, xp: 50 }
    ]
  },
  {
    id: "work",
    label: "Nơi làm việc",
    emoji: "💼",
    scenarios: [
      { id: 12, title: "Phỏng vấn xin việc", desc: "Trả lời câu hỏi HR, giới thiệu kinh nghiệm", level: "B1", duration: "20 phút", emoji: "🤝", done: false, xp: 60 },
      { id: 13, title: "Họp nhóm dự án", desc: "Trình bày tiến độ, đặt câu hỏi", level: "B2", duration: "25 phút", emoji: "📊", done: false, xp: 60 },
      { id: 14, title: "Gọi điện khách hàng", desc: "Giải quyết khiếu nại, đề xuất giải pháp", level: "B2", duration: "20 phút", emoji: "📞", done: false, xp: 55 },
      { id: 15, title: "Email & Báo cáo", desc: "Soạn email chuyên nghiệp, tóm tắt report", level: "C1", duration: "25 phút", emoji: "📧", done: false, xp: 70 }
    ]
  }
];

@Component({
  selector: 'app-scenarios',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-5 md:p-8 max-w-5xl mx-auto">
      <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-800" style="font-weight: 800; color: #1e293b">Thư viện tình huống</h1>
          <p class="text-sm mt-1" style="color: #64748b">
            Hoàn thành {{ totalDone() }}/{{ totalCount() }} tình huống · {{ totalRemaining() }} còn lại
          </p>
        </div>
        <div class="flex items-center gap-2">
          <div class="progress-bar h-2 w-32 bg-slate-100 rounded-full overflow-hidden">
            <div class="progress-bar-fill h-2 rounded-full" [style.width.%]="totalProgressPct()" style="background: #286FB4"></div>
          </div>
          <span class="text-sm font-600" style="color: #286FB4; font-weight: 600">{{ totalProgressPct() }}%</span>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap gap-3 mb-6">
        <div class="relative flex-1 min-w-48">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            class="input-field pl-9 text-sm"
            placeholder="Tìm tình huống..."
            [value]="search()"
            (input)="updateSearch($event)"
          />
        </div>
        <div class="flex gap-2">
          @for (l of levels; track l) {
            <button
              class="px-3 py-2 rounded-xl text-sm font-600 transition-all cursor-pointer"
              [style.background]="level() === l ? '#286FB4' : '#fff'"
              [style.color]="level() === l ? '#fff' : '#64748b'"
              [style.borderColor]="level() === l ? '#286FB4' : '#E2F0F9'"
              style="border-width: 1.5px"
              (click)="level.set(l)"
            >
              {{ l }}
            </button>
          }
        </div>
      </div>

      <!-- Group Category filter tabs -->
      <div class="flex gap-2 mb-8 overflow-x-auto pb-1">
        <button
          class="px-4 py-2 rounded-full text-sm font-500 whitespace-nowrap shrink-0 transition-all cursor-pointer"
          [style.background]="!selectedGroup() ? '#286FB4' : '#E2F0F9'"
          [style.color]="!selectedGroup() ? '#fff' : '#286FB4'"
          (click)="selectedGroup.set(null)"
        >
          🗂️ Tất cả nhóm
        </button>
        @for (g of groups; track g.id) {
          <button
            class="px-4 py-2 rounded-full text-sm font-500 whitespace-nowrap shrink-0 transition-all cursor-pointer"
            [style.background]="selectedGroup() === g.id ? '#286FB4' : '#E2F0F9'"
            [style.color]="selectedGroup() === g.id ? '#fff' : '#286FB4'"
            (click)="toggleGroup(g.id)"
          >
            {{ g.emoji }} {{ g.label }}
          </button>
        }
      </div>

      <!-- Scenarios Grid (Deferrable views) -->
      @defer (on viewport) {
        <div class="space-y-8">
          @for (g of filteredGroups(); track g.id) {
            <div>
              <div class="flex items-center gap-2 mb-4">
                <span>{{ g.emoji }}</span>
                <h2 class="font-700 text-base" style="font-weight: 700; color: #1e293b">{{ g.label }}</h2>
                <span class="badge" style="background: #E2F0F9; color: #286FB4; font-size: 11px">
                  {{ g.doneCount }}/{{ g.scenarios.length }}
                </span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                @for (s of g.scenarios; track s.id) {
                  <button
                    class="card p-5 flex flex-col text-left hover:shadow-md transition-all cursor-pointer"
                    (click)="selectScenario(s)"
                  >
                    <div class="flex items-start justify-between mb-3">
                      <span class="text-2xl">{{ s.emoji }}</span>
                      @if (s.done) {
                        <span class="badge" style="background: #DCFCE7; color: #166534">✓ Xong</span>
                      } @else {
                        <span class="badge" style="background: #E2F0F9; color: #286FB4">{{ s.level }}</span>
                      }
                    </div>
                    <div class="font-700 text-sm mb-1" style="font-weight: 700; color: #1e293b">{{ s.title }}</div>
                    <div class="text-xs mb-3 flex-1" style="color: #64748b">{{ s.desc }}</div>
                    <div class="flex items-center justify-between">
                      <span class="text-xs" style="color: #94a3b8">⏱ {{ s.duration }}</span>
                      <span class="text-xs font-600" style="color: #f59e0b; font-weight: 600">+{{ s.xp }} XP</span>
                    </div>
                  </button>
                }
              </div>
            </div>
          }
        </div>
      } @placeholder {
        <div class="py-12 text-center text-slate-400">Loading scenarios library...</div>
      }

      @if (filteredGroups().length === 0) {
        <div class="text-center py-20">
          <div class="text-5xl mb-4">🔍</div>
          <div class="font-600 mb-2" style="font-weight: 600; color: #374151">Không tìm thấy tình huống</div>
          <p class="text-sm" style="color: #94a3b8">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
          <button class="btn-secondary mt-4 cursor-pointer" (click)="resetFilters()">Xóa bộ lọc</button>
        </div>
      }
    </div>
  `
})
export class ScenariosComponent {
  readonly appState = inject(AppStateService);

  readonly search = signal("");
  readonly level = signal("Tất cả");
  readonly selectedGroup = signal<string | null>(null);

  readonly levels = ["Tất cả", "A2", "B1", "B2", "C1"];
  readonly groups = GROUPS;

  readonly allScenarios = computed(() => this.groups.flatMap(g => g.scenarios));
  readonly totalCount = computed(() => this.allScenarios().length);
  readonly totalDone = computed(() => this.allScenarios().filter(s => s.done).length);
  readonly totalRemaining = computed(() => this.totalCount() - this.totalDone());
  readonly totalProgressPct = computed(() => Math.round((this.totalDone() / this.totalCount()) * 100));

  readonly filteredGroups = computed(() => {
    const query = this.search().toLowerCase().trim();
    const curLevel = this.level();
    const curGroup = this.selectedGroup();

    return this.groups.map(g => {
      const scenarios = g.scenarios.filter(s => {
        const matchLevel = curLevel === "Tất cả" || s.level === curLevel;
        const matchQuery = !query || s.title.toLowerCase().includes(query) || s.desc.toLowerCase().includes(query);
        const matchGroup = !curGroup || g.id === curGroup;
        return matchLevel && matchQuery && matchGroup;
      });
      const doneCount = scenarios.filter(s => s.done).length;
      return { ...g, scenarios, doneCount };
    }).filter(g => g.scenarios.length > 0);
  });

  updateSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  toggleGroup(groupId: string): void {
    this.selectedGroup.update(g => g === groupId ? null : groupId);
  }

  selectScenario(scenario: ScenarioItem): void {
    const scModel: Scenario = {
      id: String(scenario.id),
      title: scenario.title,
      category: "Đời sống",
      level: scenario.level,
      duration: scenario.duration,
      description: scenario.desc,
      objectives: ["Hoàn thành cuộc hội thoại thực tế", "Dùng từ vựng đúng ngữ cảnh"],
      vocabulary: [{ word: "Reservation", meaning: "Đặt chỗ trước" }],
      image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=200&fit=crop"
    };
    this.appState.selectScenario(scModel);
  }

  resetFilters(): void {
    this.search.set("");
    this.level.set("Tất cả");
    this.selectedGroup.set(null);
  }
}
