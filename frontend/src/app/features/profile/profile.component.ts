import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';
import { AppUser } from '../../core/models/app.models';
import { USER_GOALS, USER_INTERESTS } from '../../core/mock/mock-data';


@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-5 md:p-8 max-w-3xl mx-auto space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-800" style="font-weight: 800; color: #1e293b">Hồ sơ cá nhân</h1>
        @if (!editing()) {
          <button class="btn-secondary cursor-pointer" (click)="editing.set(true)">✏️ Chỉnh sửa</button>
        } @else {
          <div class="flex gap-2">
            <button class="btn-secondary cursor-pointer" (click)="cancelEdit()">Hủy</button>
            <button class="btn-primary cursor-pointer" (click)="saveProfile()">Lưu thay đổi</button>
          </div>
        }
      </div>

      @if (saved()) {
        <div class="p-4 rounded-xl text-sm font-600" style="background: #DCFCE7; color: #166534; font-weight: 600">
          ✅ Hồ sơ đã được cập nhật!
        </div>
      }

      <!-- Profile Header Avatar Card -->
      <div class="card p-6">
        <div class="flex items-start gap-6 flex-wrap">
          <div class="relative">
            <img [src]="appState.appUser().avatar" [alt]="appState.appUser().name" class="w-20 h-20 rounded-2xl object-cover" />
            @if (editing()) {
              <button class="absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-sm cursor-pointer" style="background: #286FB4; color: #fff">📷</button>
            }
          </div>
          <div class="flex-1 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="text-xs font-600 block mb-1.5" style="color: #94a3b8; font-weight: 600">HỌ VÀ TÊN</label>
                @if (editing()) {
                  <input class="input-field text-sm" [value]="editName()" (input)="updateEditName($event)" />
                } @else {
                  <div class="font-600 text-sm" style="font-weight: 600; color: #1e293b">{{ appState.appUser().name }}</div>
                }
              </div>
              <div>
                <label class="text-xs font-600 block mb-1.5" style="color: #94a3b8; font-weight: 600">EMAIL</label>
                <div class="text-sm" style="color: #64748b">{{ appState.appUser().email }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats row -->
      <div class="grid grid-cols-3 gap-4">
        @for (s of userStats(); track s.label) {
          <div class="card p-4 text-center">
            <div class="text-2xl mb-1">{{ s.emoji }}</div>
            <div class="font-800 text-base" [style.color]="s.color" style="font-weight: 800">{{ s.value }}</div>
            <div class="text-xs" style="color: #94a3b8">{{ s.label }}</div>
          </div>
        }
      </div>

      <!-- Interests -->
      <div class="card p-6">
        <h2 class="font-700 text-base mb-4" style="font-weight: 700; color: #1e293b">Sở thích</h2>
        <div class="flex flex-wrap gap-2">
          @for (i of allInterests; track i) {
            <span class="badge" style="background: #E2F0F9; color: #286FB4">{{ i }}</span>
          }
        </div>
      </div>

      <!-- Goals -->
      <div class="card p-6">
        <h2 class="font-700 text-base mb-4" style="font-weight: 700; color: #1e293b">Mục tiêu học tập</h2>
        <div class="space-y-2">
          @for (g of appState.appUser().goals; track g) {
            <div class="flex items-center gap-2">
              <span style="color: #286FB4">✓</span>
              <span class="text-sm" style="color: #374151">{{ g }}</span>
            </div>
          }
        </div>
      </div>

      <!-- Logout Button -->
      <div class="card p-6">
        <button
          class="w-full py-3 rounded-xl font-600 text-sm text-center cursor-pointer transition-all"
          style="background: #FFF5F5; color: #DF4C73; font-weight: 600; border: 1.5px solid #fecdd3"
          (click)="appState.logout()"
        >
          Đăng xuất
        </button>
      </div>
    </div>
  `
})
export class ProfileComponent {
  readonly ALL_INTERESTS = USER_INTERESTS;
  readonly ALL_GOALS = USER_GOALS;
  readonly appState = inject(AppStateService);

  readonly editing = signal(false);
  readonly saved = signal(false);

  readonly editName = signal(this.appState.appUser().name);
  readonly allInterests = USER_INTERESTS;
  readonly allGoals = USER_GOALS;

  readonly userStats = computed(() => [
    { label: "Level hiện tại", value: this.appState.appUser().level, emoji: "🎓", color: "#286FB4" },
    { label: "Tổng XP", value: `${this.appState.appUser().xp.toLocaleString()} XP`, emoji: "⭐", color: "#f59e0b" },
    { label: "Streak", value: `${this.appState.appUser().streak} ngày`, emoji: "🔥", color: "#ea580c" }
  ]);

  updateEditName(event: Event): void {
    this.editName.set((event.target as HTMLInputElement).value);
  }

  cancelEdit(): void {
    this.editName.set(this.appState.appUser().name);
    this.editing.set(false);
  }

  saveProfile(): void {
    const updatedUser: AppUser = {
      ...this.appState.appUser(),
      name: this.editName().trim() || this.appState.appUser().name
    };
    this.appState.setUser(updatedUser);
    this.editing.set(false);
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 3000);
  }
}
