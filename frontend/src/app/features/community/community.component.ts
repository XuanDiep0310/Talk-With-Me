import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';

const ALL = 'Tất cả';
const ROOM_LEVELS = ['A2', 'B1', 'B2', 'C1'];

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
          <p class="text-sm mt-1" style="color: #64748b">Luyện nói cùng người học khác trong phòng phù hợp với bạn.</p>
        </div>
        <button type="button" class="btn-primary cursor-pointer" (click)="openCreate()">+ Tạo phòng mới</button>
      </div>

      <div class="card p-4 mb-6 space-y-4">
        <label class="block text-sm font-600" style="color:#334155">Tìm phòng
          <input class="mt-2 w-full rounded-lg border px-3 py-2" type="search" placeholder="Tìm theo tên phòng..."
            [value]="search()" (input)="search.set($any($event.target).value)" />
        </label>
        <div class="space-y-2">
          <div class="text-xs font-600" style="color:#64748b">TRÌNH ĐỘ</div>
          <div class="flex gap-2 flex-wrap">@for (item of levels; track item) {
            <button type="button" class="px-3 py-1.5 rounded-lg text-sm cursor-pointer" [style.background]="level() === item ? '#286FB4' : '#E2F0F9'" [style.color]="level() === item ? '#fff' : '#286FB4'" [attr.aria-pressed]="level() === item" (click)="level.set(item)">{{ item }}</button>
          }</div>
        </div>
        <div class="space-y-2">
          <div class="text-xs font-600" style="color:#64748b">CHỦ ĐỀ</div>
          <div class="flex gap-2 flex-wrap">@for (item of topics(); track item) {
            <button type="button" class="px-3 py-1.5 rounded-lg text-sm cursor-pointer" [style.background]="topic() === item ? '#286FB4' : '#E2F0F9'" [style.color]="topic() === item ? '#fff' : '#286FB4'" [attr.aria-pressed]="topic() === item" (click)="topic.set(item)">{{ item }}</button>
          }</div>
        </div>
        @if (hasFilters()) { <button type="button" class="text-sm underline cursor-pointer" style="color:#286FB4" (click)="resetFilters()">Xóa bộ lọc</button> }
      </div>

      @if (filteredRooms().length > 0) {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (room of filteredRooms(); track room.id) {
            <div class="card p-5 flex flex-col gap-4">
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style="background:#E2F0F9">{{ room.emoji }}</div>
                  <div class="min-w-0"><div class="font-700 text-sm" style="font-weight:700;color:#1e293b">{{ room.title }}</div><div class="text-xs" style="color:#94a3b8">do {{ room.host }} tạo</div></div>
                </div>
                <span class="text-xs shrink-0" [style.color]="room.active ? '#16a34a' : '#64748b'">{{ !room.active ? 'Inactive' : isFull(room) ? 'Full' : 'Active' }}</span>
              </div>
              <div class="flex gap-2"><span class="badge" style="background:#E2F0F9;color:#286FB4">{{ room.level }}</span><span class="badge" style="background:#F5F3FF;color:#7c3aed">{{ room.topic }}</span></div>
              <div class="flex items-center justify-between text-xs" style="color:#64748b"><span>👥 {{ room.members }}/{{ room.max }} thành viên</span><span>{{ room.duration }}</span></div>
              <button type="button" class="btn-primary w-full justify-center" [disabled]="!room.active || isFull(room)" [style.opacity]="!room.active || isFull(room) ? 0.55 : 1" (click)="joinRoom(room.id)">{{ !room.active ? 'Không khả dụng' : isFull(room) ? 'Phòng đã đầy' : 'Tham gia phòng' }}</button>
            </div>
          }
        </div>
      } @else {
        <div class="card text-center py-16 px-6">
          <div class="text-5xl mb-4" aria-hidden="true">🔎</div>
          <h2 class="font-700 mb-2" style="color:#1e293b">{{ appState.communityRooms().length ? 'Không tìm thấy phòng phù hợp' : 'Chưa có phòng cộng đồng' }}</h2>
          <p class="text-sm mb-4" style="color:#64748b">Thử từ khóa hoặc bộ lọc khác, hoặc tạo phòng mới.</p>
          @if (hasFilters()) { <button type="button" class="btn-secondary cursor-pointer mr-2" (click)="resetFilters()">Xóa bộ lọc</button> }
          <button type="button" class="btn-primary cursor-pointer" (click)="openCreate()">+ Tạo phòng mới</button>
        </div>
      }

      @if (showCreate()) {
        <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" (click)="closeCreate()">
          <section role="dialog" aria-modal="true" aria-labelledby="create-room-title" class="card bg-white p-6 w-full max-w-md" (click)="$event.stopPropagation()">
            <div class="flex justify-between items-center mb-5"><h2 id="create-room-title" class="text-xl font-700" style="color:#1e293b">Tạo phòng mới</h2><button type="button" aria-label="Đóng" class="cursor-pointer text-xl" (click)="closeCreate()">×</button></div>
            <form class="space-y-4" (submit)="$event.preventDefault(); createRoom()" novalidate>
              <label class="block text-sm font-600">Tên phòng<input class="mt-1 w-full rounded-lg border px-3 py-2" maxlength="80" [value]="roomName()" (input)="roomName.set($any($event.target).value)" (blur)="submitted.set(true)" />
                @if (submitted() && !roomName().trim()) { <span class="block text-xs mt-1 text-red-600">Vui lòng nhập tên phòng.</span> }
                @if (submitted() && roomName().trim().length > 80) { <span class="block text-xs mt-1 text-red-600">Tên phòng tối đa 80 ký tự.</span> }
              </label>
              <label class="block text-sm font-600">Chủ đề<input class="mt-1 w-full rounded-lg border px-3 py-2" maxlength="50" [value]="roomTopic()" (input)="roomTopic.set($any($event.target).value)" (blur)="submitted.set(true)" />
                @if (submitted() && !roomTopic().trim()) { <span class="block text-xs mt-1 text-red-600">Vui lòng nhập chủ đề.</span> }
              </label>
              <label class="block text-sm font-600">Trình độ<select class="mt-1 w-full rounded-lg border px-3 py-2" [value]="roomLevel()" (change)="roomLevel.set($any($event.target).value)"><option value="">Chọn trình độ</option>@for (item of availableLevels; track item) { <option [value]="item">{{ item }}</option> }</select>
                @if (submitted() && !roomLevel()) { <span class="block text-xs mt-1 text-red-600">Vui lòng chọn trình độ.</span> }
              </label>
              <label class="block text-sm font-600">Số thành viên tối đa<input class="mt-1 w-full rounded-lg border px-3 py-2" type="number" min="1" max="20" step="1" [value]="roomMax()" (input)="roomMax.set($any($event.target).value)" (blur)="submitted.set(true)" />
                @if (submitted() && !validMax()) { <span class="block text-xs mt-1 text-red-600">Số thành viên phải là số nguyên từ 1 đến 20.</span> }
              </label>
              <div class="flex justify-end gap-3 pt-2"><button type="button" class="btn-secondary cursor-pointer" (click)="closeCreate()">Hủy</button><button type="submit" class="btn-primary cursor-pointer" [disabled]="!formValid()" [style.opacity]="formValid() ? 1 : 0.6">Tạo phòng</button></div>
            </form>
          </section>
        </div>
      }
    </div>
  `,
})
export class CommunityComponent {
  readonly appState = inject(AppStateService);
  readonly search = signal('');
  readonly level = signal(ALL);
  readonly topic = signal(ALL);
  readonly showCreate = signal(false);
  readonly submitted = signal(false);
  readonly roomName = signal('');
  readonly roomTopic = signal('');
  readonly roomLevel = signal('');
  readonly roomMax = signal('5');
  readonly availableLevels = ROOM_LEVELS;
  readonly levels = [ALL, ...ROOM_LEVELS];
  readonly topics = computed(() => [ALL, ...new Set(this.appState.communityRooms().map((room) => room.topic))]);
  readonly hasFilters = computed(() => !!this.search().trim() || this.level() !== ALL || this.topic() !== ALL);
  readonly filteredRooms = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    return this.appState.communityRooms().filter((room) =>
      (!query || room.title.toLocaleLowerCase().includes(query)) &&
      (this.level() === ALL || room.level === this.level()) &&
      (this.topic() === ALL || room.topic === this.topic()),
    );
  });
  readonly validMax = computed(() => {
    const value = Number(this.roomMax());
    return this.roomMax().trim() !== '' && Number.isInteger(value) && value >= 1 && value <= 20;
  });
  readonly formValid = computed(() => this.roomName().trim().length > 0 && this.roomName().trim().length <= 80 && this.roomTopic().trim().length > 0 && this.roomTopic().trim().length <= 50 && ROOM_LEVELS.includes(this.roomLevel()) && this.validMax());

  isFull(room: { members: number; max: number }): boolean { return room.members >= room.max; }
  joinRoom(id: number): void { this.appState.joinRoom(id); }
  resetFilters(): void { this.search.set(''); this.level.set(ALL); this.topic.set(ALL); }
  openCreate(): void { this.submitted.set(false); this.showCreate.set(true); }
  closeCreate(): void { this.showCreate.set(false); }

  createRoom(): void {
    this.submitted.set(true);
    if (!this.formValid()) return;
    const max = Number(this.roomMax());
    this.appState.createCommunityRoom({
      title: this.roomName().trim(), topic: this.roomTopic().trim(), level: this.roomLevel(),
      members: 1, max, active: true, emoji: '💬', host: this.appState.appUser().name,
      duration: 'Mới tạo',
    });
    this.search.set('');
    this.level.set(ALL);
    this.topic.set(ALL);
    this.roomName.set('');
    this.roomTopic.set('');
    this.roomLevel.set('');
    this.roomMax.set('5');
    this.submitted.set(false);
    this.showCreate.set(false);
  }
}
