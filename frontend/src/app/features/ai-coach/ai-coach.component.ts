import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';

interface Topic {
  label: string;
  desc: string;
  emoji: string;
  level: string;
}

interface TopicGroup {
  group: string;
  emoji: string;
  topics: Topic[];
}

export const TOPIC_GROUPS: TopicGroup[] = [
  {
    group: "Gợi ý cho bạn",
    emoji: "✨",
    topics: [
      { label: "Giới thiệu bản thân", desc: "Tell me about yourself — Fluency cơ bản", emoji: "👤", level: "A2+" },
      { label: "Kể về công việc", desc: "What do you do? — Vocabulary công sở", emoji: "💼", level: "B1+" },
      { label: "Du lịch yêu thích", desc: "Travel & places — Sở thích của bạn", emoji: "✈️", level: "B1+" }
    ]
  },
  {
    group: "Giao tiếp hằng ngày",
    emoji: "☀️",
    topics: [
      { label: "Mua sắm & đặt hàng", desc: "Shopping & ordering", emoji: "🛍️", level: "A2+" },
      { label: "Hỏi đường & di chuyển", desc: "Directions & transport", emoji: "🗺️", level: "A2+" },
      { label: "Nói về cuối tuần", desc: "Weekend plans & activities", emoji: "🎉", level: "B1+" },
      { label: "Thời tiết & tin tức", desc: "Small talk starters", emoji: "🌤️", level: "A2+" }
    ]
  },
  {
    group: "Công việc & Chuyên nghiệp",
    emoji: "💼",
    topics: [
      { label: "Họp & thuyết trình", desc: "Meetings & presentations", emoji: "📊", level: "B2+" },
      { label: "Email & báo cáo", desc: "Professional writing style", emoji: "📧", level: "B1+" },
      { label: "Phỏng vấn xin việc", desc: "Job interview practice", emoji: "🤝", level: "B1+" },
      { label: "Đàm phán & thuyết phục", desc: "Negotiation skills", emoji: "💡", level: "B2+" }
    ]
  },
  {
    group: "Chủ đề nâng cao",
    emoji: "🚀",
    topics: [
      { label: "Tranh luận & quan điểm", desc: "Opinions & debates", emoji: "🗣️", level: "B2+" },
      { label: "Kể chuyện", desc: "Storytelling & narratives", emoji: "📖", level: "B2+" },
      { label: "Hài hước & chơi chữ", desc: "Humor & word play", emoji: "😄", level: "C1+" }
    ]
  }
];

@Component({
  selector: 'app-ai-coach',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-5 md:p-8 max-w-4xl mx-auto">
      <div class="mb-6">
        <h1 class="text-2xl font-800 mb-1" style="font-weight: 800; color: #1e293b">AI Coach</h1>
        <p class="text-sm" style="color: #64748b">Chọn chủ đề để bắt đầu luyện nói với AI Coach cá nhân hóa.</p>
      </div>

      <!-- Search Input -->
      <div class="relative mb-6">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          class="input-field pl-9"
          placeholder="Tìm chủ đề luyện nói..."
          [value]="search()"
          (input)="updateSearch($event)"
        />
      </div>

      <!-- Selected Topic Preview Card -->
      @if (selected(); as sel) {
        <div class="card p-5 mb-6 flex items-center gap-4" style="background: #E2F0F9; border: 2px solid #286FB4">
          <div class="text-3xl">{{ selectedEmoji() }}</div>
          <div class="flex-1">
            <div class="font-700" style="font-weight: 700; color: #286FB4">{{ sel }}</div>
            <div class="text-sm" style="color: #64748b">Sẵn sàng bắt đầu buổi luyện nói?</div>
          </div>
          <div class="flex gap-2">
            <button class="btn-secondary text-sm cursor-pointer" (click)="selected.set(null)">Đổi chủ đề</button>
            <button class="btn-primary cursor-pointer" (click)="startSession(sel)">🎙️ Bắt đầu nói</button>
          </div>
        </div>
      }

      <!-- Topic Groups (Deferrable) -->
      @defer (on viewport) {
        <div class="space-y-8">
          @for (g of filteredGroups(); track g.group) {
            <div>
              <div class="flex items-center gap-2 mb-4">
                <span>{{ g.emoji }}</span>
                <h2 class="font-700 text-base" style="font-weight: 700; color: #1e293b">{{ g.group }}</h2>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                @for (t of g.topics; track t.label) {
                  <button
                    class="card p-4 flex items-start gap-4 text-left hover:shadow-md transition-all cursor-pointer"
                    [style.borderColor]="selected() === t.label ? '#286FB4' : '#E2F0F9'"
                    [style.background]="selected() === t.label ? '#E2F0F9' : '#fff'"
                    (click)="selected.set(t.label)"
                  >
                    <span class="text-2xl">{{ t.emoji }}</span>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="font-700 text-sm" [style.color]="selected() === t.label ? '#286FB4' : '#1e293b'" style="font-weight: 700">
                          {{ t.label }}
                        </span>
                        <span class="badge text-xs" style="background: #E2F0F9; color: #286FB4; font-size: 11px">{{ t.level }}</span>
                      </div>
                      <div class="text-xs" style="color: #64748b">{{ t.desc }}</div>
                    </div>
                    @if (selected() === t.label) {
                      <div class="w-5 h-5 rounded-full shrink-0 flex items-center justify-center" style="background: #286FB4">
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                      </div>
                    }
                  </button>
                }
              </div>
            </div>
          }
        </div>
      } @placeholder {
        <div class="py-12 text-center text-slate-400">Loading AI Coach topics...</div>
      }

      @if (!selected()) {
        <div class="text-center pt-8 pb-4">
          <p class="text-sm" style="color: #94a3b8">Chọn một chủ đề ở trên để bắt đầu 👆</p>
        </div>
      }
    </div>
  `
})
export class AiCoachComponent {
  readonly appState = inject(AppStateService);

  readonly search = signal("");
  readonly selected = signal<string | null>(null);
  readonly topicGroups = TOPIC_GROUPS;

  readonly filteredGroups = computed(() => {
    const query = this.search().toLowerCase().trim();
    return this.topicGroups.map(g => ({
      ...g,
      topics: g.topics.filter(t =>
        !query ||
        t.label.toLowerCase().includes(query) ||
        t.desc.toLowerCase().includes(query)
      )
    })).filter(g => g.topics.length > 0);
  });

  readonly selectedEmoji = computed(() => {
    const sel = this.selected();
    if (!sel) return "🎙️";
    const allTopics = this.topicGroups.flatMap(g => g.topics);
    return allTopics.find(t => t.label === sel)?.emoji || "🎙️";
  });

  updateSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  startSession(topic: string): void {
    this.appState.startAiCoachSession(topic);
  }
}
