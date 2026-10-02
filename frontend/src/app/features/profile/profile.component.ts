import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';
import { MOCK_PROFILE_AVATARS, MOCK_PROFILE_GOALS, MOCK_PROFILE_INTERESTS } from '../../core/data/mock-data';
import { User } from '../../core/models/app.models';

@Component({
  selector: 'app-profile', standalone: true, imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-5 md:p-8 max-w-3xl mx-auto space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-800" style="font-weight:800;color:#1e293b">Hồ sơ cá nhân</h1>
        @if (!editing()) { <button class="btn-secondary cursor-pointer" (click)="startEdit()">✏️ Chỉnh sửa</button> }
        @else { <div class="flex gap-2"><button class="btn-secondary cursor-pointer" (click)="cancelEdit()">Hủy</button><button class="btn-primary cursor-pointer" [disabled]="!draft().name.trim()" (click)="saveProfile()">Lưu thay đổi</button></div> }
      </div>
      @if (saved()) { <div class="p-4 rounded-xl text-sm" style="background:#DCFCE7;color:#166534">✅ Hồ sơ đã được cập nhật!</div> }
      <div class="card p-6">
        <div class="flex items-start gap-6 flex-wrap">
          <img [src]="editing() ? draft().avatar : appState.appUser().avatar" [alt]="appState.appUser().name" class="w-20 h-20 rounded-2xl object-cover" />
          <div class="flex-1 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><span class="text-xs block mb-1.5" style="color:#94a3b8">HỌ VÀ TÊN</span>
                @if (editing()) { <input class="input-field text-sm" [value]="draft().name" (input)="updateName($event)" required maxlength="80" /> }
                @else { <div class="text-sm font-600" style="color:#1e293b">{{ appState.appUser().name }}</div> }
              </div>
              <div><span class="text-xs block mb-1.5" style="color:#94a3b8">EMAIL</span><div class="text-sm" style="color:#64748b">{{ appState.appUser().email }}</div></div>
            </div>
            @if (editing()) { <div><div class="text-xs mb-2" style="color:#94a3b8">CHỌN AVATAR</div><div class="flex gap-2 flex-wrap">
              @for (avatar of avatarOptions; track avatar) { <button type="button" (click)="patchDraft({avatar})" class="rounded-xl cursor-pointer" [style.outline]="draft().avatar === avatar ? '3px solid #286FB4' : 'none'"><img [src]="avatar" alt="Avatar mock" class="w-12 h-12 rounded-xl object-cover" /></button> }
            </div></div> }
          </div>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-4">@for (s of userStats(); track s.label) { <div class="card p-4 text-center"><div class="text-2xl mb-1">{{s.emoji}}</div><div class="font-800 text-base" [style.color]="s.color">{{s.value}}</div><div class="text-xs" style="color:#94a3b8">{{s.label}}</div></div> }</div>
      <div class="card p-6"><h2 class="font-700 text-base mb-4" style="color:#1e293b">Sở thích</h2><div class="flex flex-wrap gap-2">
        @for (i of allInterests; track i) { @if (editing()) { <button type="button" class="badge cursor-pointer" [style.background]="has(draft().interests, i) ? '#286FB4' : '#E2F0F9'" [style.color]="has(draft().interests, i) ? '#fff' : '#286FB4'" (click)="toggle('interests', i)">{{i}}</button> } @else if (has(appState.appUser().interests || [], i)) { <span class="badge" style="background:#E2F0F9;color:#286FB4">{{i}}</span> } }
        @if (!editing() && !(appState.appUser().interests || []).length) { <span class="text-sm" style="color:#94a3b8">Chưa có sở thích</span> }
      </div></div>
      <div class="card p-6"><h2 class="font-700 text-base mb-4" style="color:#1e293b">Mục tiêu học tập</h2><div class="space-y-2">
        @for (g of allGoals; track g) { @if (editing()) { <label class="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" [checked]="has(draft().goals, g)" (change)="toggle('goals', g)" />{{g}}</label> } @else if (has(appState.appUser().goals || [], g)) { <div class="flex items-center gap-2 text-sm"><span style="color:#286FB4">✓</span>{{g}}</div> } }
      </div></div>
      <div class="card p-6"><button class="w-full py-3 rounded-xl text-sm cursor-pointer" style="background:#FFF5F5;color:#DF4C73;border:1.5px solid #fecdd3" (click)="appState.logout()">Đăng xuất</button></div>
    </div>
  `
})
export class ProfileComponent {
  readonly appState = inject(AppStateService);
  readonly editing = signal(false);
  readonly saved = signal(false);
  readonly allInterests = MOCK_PROFILE_INTERESTS;
  readonly allGoals = MOCK_PROFILE_GOALS;
  readonly avatarOptions = MOCK_PROFILE_AVATARS;
  readonly draft = signal<Pick<User, 'name' | 'interests' | 'goals' | 'avatar'>>(this.snapshot());
  readonly userStats = computed(() => [
    { label: 'Level hiện tại', value: this.appState.appUser().level, emoji: '🎓', color: '#286FB4' },
    { label: 'Tổng XP', value: `${this.appState.appUser().xp.toLocaleString()} XP`, emoji: '⭐', color: '#f59e0b' },
    { label: 'Streak', value: `${this.appState.appUser().streak} ngày`, emoji: '🔥', color: '#ea580c' }
  ]);
  private snapshot(): Pick<User, 'name' | 'interests' | 'goals' | 'avatar'> {
    const user = this.appState.appUser();
    return { name: user.name ?? '', interests: [...(user.interests ?? [])], goals: [...(user.goals ?? [])], avatar: user.avatar ?? this.avatarOptions?.[0] ?? '' };
  }
  startEdit(): void { this.draft.set(this.snapshot()); this.saved.set(false); this.editing.set(true); }
  updateName(event: Event): void { this.patchDraft({ name: (event.target as HTMLInputElement).value }); }
  patchDraft(patch: Partial<Pick<User, 'name' | 'interests' | 'goals' | 'avatar'>>): void { this.draft.update(value => ({ ...value, ...patch })); }
  has(values: string[], value: string): boolean { return values.includes(value); }
  toggle(field: 'interests' | 'goals', value: string): void {
    const values = this.draft()[field];
    this.patchDraft({ [field]: values.includes(value) ? values.filter(item => item !== value) : [...values, value] });
  }
  cancelEdit(): void { this.draft.set(this.snapshot()); this.editing.set(false); }
  saveProfile(): void {
    const draft = this.draft();
    const name = draft.name.trim();
    if (!name) return;
    this.appState.updateUserProfile({ ...draft, name });
    this.editing.set(false); this.saved.set(true);
    setTimeout(() => this.saved.set(false), 3000);
  }
}
