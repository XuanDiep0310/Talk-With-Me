import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';
import { MOCK_AI_COACH_TOPIC_GROUPS } from '../../core/data/mock-data';
import { AiCoachTopic } from '../../core/models/app.models';

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

      <div class="relative mb-6">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input class="input-field pl-9" type="search" aria-label="Tìm chủ đề luyện nói"
          placeholder="Tìm chủ đề luyện nói..." [value]="search()" (input)="updateSearch($event)" />
      </div>

      @if (selected(); as sel) {
        <section class="card p-5 mb-6 flex flex-wrap items-center gap-4" aria-label="Chủ đề đã chọn" style="background: #E2F0F9; border: 2px solid #286FB4">
          <div class="text-3xl" aria-hidden="true">{{ sel.emoji }}</div>
          <div class="flex-1 min-w-0">
            <div class="font-700" style="font-weight: 700; color: #286FB4">{{ sel.label }}</div>
            <div class="text-sm" style="color: #64748b">{{ sel.desc }}</div>
            <div class="text-xs mt-1" style="color: #64748b">{{ sel.category }}</div>
          </div>
          <div class="flex gap-2">
            <button type="button" class="btn-secondary text-sm cursor-pointer" (click)="selected.set(null)">Đổi chủ đề</button>
            <button type="button" class="btn-primary cursor-pointer" [disabled]="!selected()" (click)="startSession()">🎙️ Bắt đầu nói</button>
          </div>
        </section>
      }

      @if (filteredGroups().length === 0) {
        <div class="card p-8 text-center" role="status" aria-live="polite">
          <div class="text-3xl mb-3" aria-hidden="true">🔎</div>
          <h2 class="font-700 mb-1" style="font-weight: 700; color: #1e293b">Không tìm thấy chủ đề</h2>
          <p class="text-sm mb-4" style="color: #64748b">Thử từ khóa khác hoặc xem lại toàn bộ chủ đề.</p>
          <button type="button" class="btn-secondary text-sm cursor-pointer" (click)="search.set('')">Xóa tìm kiếm</button>
        </div>
      } @else {
        <div class="space-y-8">
          @for (group of filteredGroups(); track group.group) {
            <section>
              <div class="flex items-center gap-2 mb-4">
                <span aria-hidden="true">{{ group.emoji }}</span>
                <h2 class="font-700 text-base" style="font-weight: 700; color: #1e293b">{{ group.group }}</h2>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                @for (topic of group.topics; track topic.label) {
                  <button type="button" class="card p-4 flex items-start gap-4 text-left hover:shadow-md transition-all cursor-pointer"
                    [attr.aria-pressed]="selected()?.label === topic.label"
                    [style.borderColor]="selected()?.label === topic.label ? '#286FB4' : '#E2F0F9'"
                    [style.background]="selected()?.label === topic.label ? '#E2F0F9' : '#fff'"
                    (click)="selectTopic(topic, group.group)">
                    <span class="text-2xl" aria-hidden="true">{{ topic.emoji }}</span>
                    <span class="flex-1 min-w-0">
                      <span class="flex items-center gap-2 mb-1">
                        <span class="font-700 text-sm" [style.color]="selected()?.label === topic.label ? '#286FB4' : '#1e293b'" style="font-weight: 700">{{ topic.label }}</span>
                        <span class="badge text-xs" style="background: #E2F0F9; color: #286FB4; font-size: 11px">{{ topic.level }}</span>
                      </span>
                      <span class="block text-xs" style="color: #64748b">{{ topic.desc }}</span>
                    </span>
                    @if (selected()?.label === topic.label) {
                      <span class="w-5 h-5 rounded-full shrink-0 flex items-center justify-center" style="background: #286FB4" aria-label="Đã chọn">
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="3" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                      </span>
                    }
                  </button>
                }
              </div>
            </section>
          }
        </div>
      }

      @if (!selected()) {
        <div class="text-center pt-8 pb-4">
          <p class="text-sm mb-4" style="color: #94a3b8">Chọn một chủ đề ở trên để bắt đầu 👆</p>
          <button type="button" class="btn-primary opacity-50 cursor-not-allowed" disabled>Bắt đầu nói</button>
        </div>
      }
    </div>
  `
})
export class AiCoachComponent {
  readonly appState = inject(AppStateService);
  readonly search = signal('');
  readonly selected = signal<(AiCoachTopic & { id: string; category: string }) | null>(null);
  readonly topicGroups = MOCK_AI_COACH_TOPIC_GROUPS;

  readonly filteredGroups = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.topicGroups.map(group => ({
      ...group,
      topics: group.topics.filter(topic => !query ||
        topic.label.toLowerCase().includes(query) ||
        topic.desc.toLowerCase().includes(query) ||
        group.group.toLowerCase().includes(query))
    })).filter(group => group.topics.length > 0);
  });

  updateSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  selectTopic(topic: AiCoachTopic, category: string): void {
    this.selected.set({ ...topic, id: topic.label, category });
  }

  startSession(): void {
    const topic = this.selected();
    if (topic) this.appState.startAiCoachSession(topic.id);
  }
}
