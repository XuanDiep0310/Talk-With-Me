import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';
import { CommunityRoom } from '../../core/models/app.models';

export interface RoomItem {
  id: number;
  title: string;
  topic: string;
  level: string;
  members: number;
  max: number;
  active: boolean;
  emoji: string;
  host: string;
  duration: string;
}

export const ROOMS: RoomItem[] = [
  { id: 1, title: "Kể chuyện cuối tuần", topic: "Daily Talk", level: "B1", members: 3, max: 5, active: true, emoji: "🌟", host: "Lan", duration: "12 phút" },
  { id: 2, title: "Work & Career Chat", topic: "Công việc", level: "B2", members: 4, max: 5, active: true, emoji: "💼", host: "Minh", duration: "8 phút" },
  { id: 3, title: "Du lịch mơ ước", topic: "Du lịch", level: "A2", members: 2, max: 5, active: true, emoji: "✈️", host: "Hoa", duration: "5 phút" },
  { id: 4, title: "Phim & Series TV", topic: "Giải trí", level: "B1", members: 5, max: 5, active: false, emoji: "🎬", host: "Tuấn", duration: "20 phút" },
  { id: 5, title: "Startup & Innovation", topic: "Kinh doanh", level: "B2", members: 3, max: 5, active: true, emoji: "🚀", host: "Nam", duration: "3 phút" },
  { id: 6, title: "Book Club - This week", topic: "Sách", level: "C1", members: 2, max: 4, active: true, emoji: "📚", host: "An", duration: "15 phút" }
];

@Component({
  selector: 'app-community',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-5 md:p-8 max-w-5xl mx-auto">
      <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-800" style="font-weight: 800; color: #1e293b">Phòng cộng đồng</h1>
          <p class="text-sm mt-1" style="color: #64748b">Luyện nói cùng người học khác — 3 đến 5 người mỗi phòng.</p>
        </div>
        <button class="btn-primary cursor-pointer" (click)="showCreate.set(true)">+ Tạo phòng mới</button>
      </div>

      <!-- Filters section -->
      <div class="flex flex-wrap gap-3 mb-8">
        <div class="space-y-2 w-full">
          <div class="text-xs font-600" style="color: #94a3b8; font-weight: 600">TRÌNH ĐỘ</div>
          <div class="flex gap-2 flex-wrap">
            @for (l of levels; track l) {
              <button
                class="px-3 py-1.5 rounded-lg text-sm font-500 transition-all cursor-pointer"
                [style.background]="level() === l ? '#286FB4' : '#E2F0F9'"
                [style.color]="level() === l ? '#fff' : '#286FB4'"
                (click)="level.set(l)"
              >
                {{ l }}
              </button>
            }
          </div>
        </div>
        <div class="space-y-2 w-full">
          <div class="text-xs font-600" style="color: #94a3b8; font-weight: 600">CHỦ ĐỀ</div>
          <div class="flex gap-2 flex-wrap">
            @for (t of topics; track t) {
              <button
                class="px-3 py-1.5 rounded-lg text-sm font-500 transition-all cursor-pointer"
                [style.background]="topic() === t ? '#286FB4' : '#E2F0F9'"
                [style.color]="topic() === t ? '#fff' : '#286FB4'"
                (click)="topic.set(t)"
              >
                {{ t }}
              </button>
            }
          </div>
        </div>
      </div>

      <!-- Room Grid (Deferrable View) -->
      @defer (on viewport) {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (r of filteredRooms(); track r.id) {
            <div class="card p-5 flex flex-col gap-4">
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style="background: #E2F0F9">{{ r.emoji }}</div>
                  <div>
                    <div class="font-700 text-sm" style="font-weight: 700; color: #1e293b">{{ r.title }}</div>
                    <div class="text-xs" style="color: #94a3b8">do {{ r.host }} tạo</div>
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  <span class="w-2 h-2 rounded-full" [class.bg-green-500]="r.active" [class.bg-gray-400]="!r.active"></span>
                  <span class="text-xs" [style.color]="r.active ? '#22c55e' : '#94a3b8'">{{ r.active ? 'Đang hoạt động' : 'Đầy' }}</span>
                </div>
              </div>

              <div class="flex gap-2">
                <span class="badge" style="background: #E2F0F9; color: #286FB4">{{ r.level }}</span>
                <span class="badge" style="background: #F5F3FF; color: #7c3aed">{{ r.topic }}</span>
              </div>

              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-xs" style="color: #64748b">👥 {{ r.members }}/{{ r.max }} người</span>
                  <span class="text-xs" style="color: #94a3b8">⏱ {{ r.duration }}</span>
                </div>
              </div>

              <button
                class="btn-primary w-full justify-center cursor-pointer"
                [style.opacity]="!r.active || r.members >= r.max ? 0.5 : 1"
                [disabled]="!r.active || r.members >= r.max"
                (click)="joinRoom(r)"
              >
                {{ r.members >= r.max ? '🔒 Phòng đầy' : '🎙️ Tham gia' }}
              </button>
            </div>
          }
        </div>
      } @placeholder {
        <div class="py-12 text-center text-slate-400">Loading active community rooms...</div>
      }

      @if (filteredRooms().length === 0) {
        <div class="text-center py-20">
          <div class="text-5xl mb-4">🏠</div>
          <div class="font-600 mb-2" style="font-weight: 600">Không tìm thấy phòng phù hợp</div>
          <p class="text-sm mb-4" style="color: #94a3b8">Hãy tạo phòng mới và mời người khác tham gia!</p>
          <button class="btn-primary cursor-pointer" (click)="showCreate.set(true)">+ Tạo phòng mới</button>
        </div>
      }
    </div>
  `
})
export class CommunityComponent {
  readonly appState = inject(AppStateService);

  readonly level = signal("Tất cả");
  readonly topic = signal("Tất cả");
  readonly showCreate = signal(false);

  readonly levels = ["Tất cả", "A2", "B1", "B2", "C1"];
  readonly topics = ["Tất cả", "Daily Talk", "Công việc", "Du lịch", "Giải trí", "Kinh doanh", "Sách"];

  readonly rooms = ROOMS;

  readonly filteredRooms = computed(() => {
    const l = this.level();
    const t = this.topic();
    return this.rooms.filter(r =>
      (l === "Tất cả" || r.level === l) &&
      (t === "Tất cả" || r.topic === t)
    );
  });

  joinRoom(r: RoomItem): void {
    const roomModel: CommunityRoom = {
      id: String(r.id),
      name: r.title,
      topic: r.topic,
      level: r.level,
      members: r.members,
      maxMembers: r.max,
      host: r.host,
      hostAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&h=60&fit=crop",
      tags: [r.topic, r.level]
    };
    this.appState.joinRoom(roomModel);
  }
}
