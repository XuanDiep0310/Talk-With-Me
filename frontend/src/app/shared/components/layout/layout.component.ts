import { Component, ChangeDetectionStrategy, signal, computed, inject, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AppStateService } from '../../../core/services/app-state.service';
import { AuthService } from '../../../core/services/auth.service';
import { GamificationService } from '../../../core/services/gamification.service';
import { GamificationSummaryResponse, NotificationItem } from '../../../core/models/gamification.models';
import { AppPage } from '../../../core/models/app.models';
import { formatDateTimeDDMMYYYY } from '../../../core/utils/date.utils';
import { resolveAvatarUrl } from '../../../core/utils/avatar.utils';

interface NavItem {
  id: AppPage;
  label: string;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-screen overflow-hidden bg-slate-50">
      <!-- Mobile overlay -->
      @if (sidebarOpen()) {
        <button
          type="button"
          class="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden w-full h-full border-0 cursor-default transition-opacity"
          (click)="toggleSidebar(false)"
          aria-label="Close sidebar"
        ></button>
      }

      <!-- Sidebar -->
      <aside
        id="app-sidebar"
        class="fixed lg:static inset-y-0 left-0 z-50 flex flex-col w-64 shrink-0 transition-transform duration-300 lg:translate-x-0 bg-white border-r border-slate-200/80 shadow-xs"
        [class.translate-x-0]="sidebarOpen()"
        [class.-translate-x-full]="!sidebarOpen()"
      >
        <!-- Logo -->
        <button
          type="button"
          class="flex items-center gap-3.5 px-6 h-16 shrink-0 border-b border-slate-200/80 cursor-pointer w-full text-left bg-transparent group transition-colors"
          (click)="navigate('dashboard')"
        >
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-tr from-blue-700 to-blue-500 text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="8" y1="22" x2="16" y2="22" />
            </svg>
          </div>
          <div class="min-w-0">
            <div class="font-extrabold text-base tracking-tight text-slate-900 leading-tight flex items-center gap-1.5">
              TalkWithMe
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100">AI</span>
            </div>
            <div class="text-xs text-slate-400 mt-0.5 font-medium">Luyện nói phản xạ 1-1</div>
          </div>
        </button>

        <!-- Main Nav -->
        <nav aria-label="Main navigation" class="flex-1 overflow-y-auto px-3.5 py-4 space-y-1">
          <div class="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Luyện tập
          </div>
          @for (item of mainNavItems; track item.id) {
            <button
              class="sidebar-link w-full text-left flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer group"
              [class.active]="appState.currentPage() === item.id"
              [attr.aria-current]="appState.currentPage() === item.id ? 'page' : null"
              (click)="navigate(item.id)"
            >
              <span class="w-5 h-5 flex items-center justify-center shrink-0 transition-transform group-hover:scale-110">
                @switch (item.id) {
                  @case ('dashboard') {
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="3" width="7" height="7" rx="1.5" />
                      <rect x="14" y="3" width="7" height="7" rx="1.5" />
                      <rect x="3" y="14" width="7" height="7" rx="1.5" />
                      <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    </svg>
                  }
                  @case ('ai-coach') {
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="22" />
                    </svg>
                  }
                  @case ('scenarios') {
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      <path d="M8 9h8" />
                      <path d="M8 13h5" />
                    </svg>
                  }
                  @case ('progress') {
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                  }
                  @case ('achievements') {
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                      <path d="M4 22h16" />
                      <path d="M10 14.66V17c0 .55-.45 1-1 1H8v4h8v-4h-1c-.55 0-1-.45-1-1v-2.34" />
                      <path d="M18 4H6v7a6 6 0 0 0 12 0V4z" />
                    </svg>
                  }
                }
              </span>
              <span class="font-medium text-sm">{{ item.label }}</span>
            </button>
          }
          @if (authService.currentUser()?.role === 'ADMIN') {
            <a routerLink="/admin" class="sidebar-link block px-4 py-3 font-medium text-sm">
              Quản trị bài học
            </a>
          }
        </nav>

        <!-- Level & XP Gamification Card (D-02 Level Advancement) -->
        <div class="px-3.5 mx-3 mb-3 p-3.5 rounded-2xl bg-gradient-to-br from-blue-50/80 to-indigo-50/40 border border-blue-100/70 shadow-xs">
          <div class="flex items-center justify-between mb-1.5">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
                Level {{ currentLevel() }}
              </span>
            </div>
            <div class="flex items-center gap-1 text-xs font-semibold text-amber-600">
              <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24" class="text-amber-500">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>{{ totalXp() }} XP</span>
            </div>
          </div>
          <!-- D-02 condition progress -->
          <div class="progress-bar h-2 bg-slate-200/80 rounded-full overflow-hidden mt-2">
            <div
              class="progress-bar-fill h-2 rounded-full transition-all duration-500 bg-gradient-to-r from-blue-600 to-indigo-500"
              [style.width.%]="levelProgressPct()"
            ></div>
          </div>
          <div class="flex justify-between items-center mt-2 text-[11px] text-slate-500 font-medium">
            <span>{{ nextLevelText() }}</span>
            <span class="font-semibold text-blue-600">{{ advancementConditionsMet() }}/{{ advancementConditionsTotal() }} đạt</span>
          </div>
        </div>

        <!-- Bottom nav -->
        <nav aria-label="Account navigation" class="px-3.5 pb-3 space-y-1 border-t border-slate-100 pt-3">
          @for (item of bottomNavItems; track item.id) {
            <button
              class="sidebar-link w-full text-left flex items-center gap-3 px-3.5 py-2 rounded-xl transition-all cursor-pointer group"
              [class.active]="appState.currentPage() === item.id"
              [attr.aria-current]="appState.currentPage() === item.id ? 'page' : null"
              (click)="navigate(item.id)"
            >
              <span class="w-5 h-5 flex items-center justify-center shrink-0 transition-transform group-hover:scale-110">
                @switch (item.id) {
                  @case ('profile') {
                    <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  }
                  @case ('settings') {
                    <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  }
                  @case ('help') {
                    <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  }
                }
              </span>
              <span class="font-medium text-sm">{{ item.label }}</span>
            </button>
          }
        </nav>

        <!-- User profile section -->
        <button
          type="button"
          class="flex items-center gap-3 px-4 py-3.5 cursor-pointer border-t border-slate-100 w-full text-left bg-slate-50/50 hover:bg-slate-100/70 transition-colors"
          (click)="navigate('profile')"
        >
          @if (userAvatar()) {
            <img [src]="userAvatar()!" [alt]="userName()" class="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-blue-100" />
          } @else {
            <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs select-none shrink-0">
              {{ userInitial() }}
            </div>
          }
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold truncate text-slate-800">{{ userName() }}</div>
            <div class="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Level {{ currentLevel() }}
            </div>
          </div>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="text-slate-400 shrink-0">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </aside>

      <!-- Main container -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <!-- Top header bar -->
        <header
          class="flex items-center gap-3.5 px-6 h-16 shrink-0 relative z-20 bg-white border-b border-slate-200/80"
        >
          <button
            type="button"
            class="lg:hidden p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            aria-controls="app-sidebar"
            [attr.aria-expanded]="sidebarOpen()"
            [attr.aria-label]="sidebarOpen() ? 'Close navigation menu' : 'Open navigation menu'"
            (click)="toggleSidebar(!sidebarOpen())"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div class="flex-1"></div>

          <!-- Streak badge with SVG Flame -->
          <div class="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200/60 text-amber-700 shadow-xs select-none">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" class="text-amber-500 animate-pulse">
              <path d="M12 23c-4.97 0-9-4.03-9-9 0-4.66 3.63-8.8 7.39-12.08a1 1 0 0 1 1.48.21C12.82 3.51 14 5.3 14 7.2c0 .99-.32 1.93-.88 2.7 1.41-.66 2.5-1.74 3.06-3.14a1 1 0 0 1 1.77-.18C19.78 9.5 21 12.3 21 14c0 4.97-4.03 9-9 9z" />
            </svg>
            <span class="text-xs font-bold">{{ currentStreak() }} ngày liên tiếp</span>
          </div>

          <!-- Notifications button & dropdown -->
          <div class="relative">
            <button
              type="button"
              class="relative p-2.5 rounded-xl cursor-pointer bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 transition-colors"
              aria-label="Notifications"
              (click)="toggleNotifications()"
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              @if (unreadCount() > 0) {
                <span class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white bg-rose-500 flex items-center justify-center shadow-xs">
                  {{ unreadCount() }}
                </span>
              }
            </button>

            <!-- Backdrop for dropdown -->
            @if (notificationsOpen()) {
              <button
                type="button"
                class="fixed inset-0 z-40 w-full h-full border-0 bg-transparent cursor-default"
                (click)="notificationsOpen.set(false)"
                aria-label="Đóng thông báo"
              ></button>
            }

            <!-- Notifications Dropdown -->
            @if (notificationsOpen()) {
              <div
                class="absolute right-0 mt-2.5 w-80 sm:w-96 rounded-2xl shadow-xl z-50 overflow-hidden border border-slate-200 bg-white animate-in fade-in zoom-in-95 duration-150"
              >
                <div class="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                  <div class="font-bold text-sm text-slate-800">
                    Thông báo @if (unreadCount() > 0) { ({{ unreadCount() }}) }
                  </div>
                  @if (unreadCount() > 0) {
                    <button
                      type="button"
                      class="text-xs font-semibold hover:underline cursor-pointer border-0 bg-transparent text-blue-600"
                      (click)="markAllNotificationsRead()"
                    >
                      Đánh dấu tất cả đã đọc
                    </button>
                  }
                </div>

                <div class="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  @if (notifications().length === 0) {
                    <div class="p-8 text-center text-xs text-slate-400">
                      Không có thông báo mới
                    </div>
                  } @else {
                    @for (item of notifications(); track item.id) {
                      <button
                        type="button"
                        class="w-full text-left p-3.5 hover:bg-slate-50 transition cursor-pointer flex gap-3 items-start border-0 bg-transparent"
                        [class.bg-blue-50]="!(item.read ?? item.isRead)"
                        (click)="markNotificationRead(item)"
                      >
                        <div class="w-2 h-2 rounded-full mt-1.5 shrink-0" [class.bg-blue-600]="!(item.read ?? item.isRead)" [class.bg-transparent]="item.read ?? item.isRead"></div>
                        <div class="flex-1 min-w-0">
                          <div class="text-xs font-semibold truncate text-slate-800">{{ item.title }}</div>
                          <div class="text-xs mt-0.5 text-slate-500 leading-snug line-clamp-2">{{ item.message || item.content }}</div>
                          <div class="text-[10px] mt-1.5 text-slate-400 font-medium">{{ formatNotificationTime(item.createdAt) }}</div>
                        </div>
                      </button>
                    }
                  }
                </div>
              </div>
            }
          </div>

          <!-- Avatar profile link -->
          <button
            type="button"
            class="rounded-full cursor-pointer focus:outline-none p-0 border-0 bg-transparent ring-2 ring-blue-100 hover:ring-blue-300 transition-all"
            (click)="navigate('profile')"
            aria-label="User profile"
          >
            @if (userAvatar()) {
              <img
                [src]="userAvatar()!"
                [alt]="userName()"
                class="w-9 h-9 rounded-full object-cover"
              />
            } @else {
              <div
                class="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm select-none"
              >
                {{ userInitial() }}
              </div>
            }
          </button>
        </header>

        <!-- Dynamic Content Slot -->
        <main class="flex-1 overflow-y-auto">
          <router-outlet></router-outlet>
          <ng-content></ng-content>
        </main>
      </div>
    </div>
  `
})
export class LayoutComponent implements OnInit {
  readonly appState = inject(AppStateService);
  readonly authService = inject(AuthService);
  private readonly gamificationService = inject(GamificationService);

  readonly sidebarOpen = signal(false);
  readonly notificationsOpen = signal(false);
  readonly notifications = signal<NotificationItem[]>([]);
  readonly gamificationSummary = signal<GamificationSummaryResponse | null>(null);

  readonly userName = computed(() => {
    return this.authService.currentUser()?.fullName ?? this.appState.appUser().name ?? 'Người dùng';
  });

  readonly userAvatar = computed(() => {
    return resolveAvatarUrl(this.authService.currentUser()?.avatarUrl);
  });

  readonly userInitial = computed(() => {
    const name = this.userName().trim();
    if (!name) return 'U';
    const parts = name.split(/\s+/);
    return parts[parts.length - 1][0].toUpperCase();
  });

  readonly currentLevel = computed(() => {
    return this.gamificationSummary()?.currentLevel ?? this.authService.currentUser()?.cefrLevel ?? this.appState.appUser().level ?? 'A1';
  });

  readonly totalXp = computed(() => {
    const val = this.gamificationSummary()?.totalXp ?? this.appState.totalXp() ?? 0;
    return Number(val).toLocaleString();
  });

  readonly currentStreak = computed(() => {
    return this.gamificationSummary()?.currentStreak ?? this.appState.currentStreak() ?? 0;
  });

  readonly unreadCount = computed(() => {
    return this.notifications().filter(n => !(n.read ?? n.isRead)).length;
  });

  readonly advancementConditionsTotal = computed(() => {
    const conds = this.gamificationSummary()?.advancement?.conditions;
    return conds && conds.length > 0 ? conds.length : 4;
  });

  readonly advancementConditionsMet = computed(() => {
    const conds = this.gamificationSummary()?.advancement?.conditions;
    return conds ? conds.filter(c => c.met).length : 0;
  });

  readonly levelProgressPct = computed(() => {
    const total = this.advancementConditionsTotal();
    if (!total) return 100;
    return Math.round((this.advancementConditionsMet() / total) * 100);
  });

  readonly nextLevelText = computed(() => {
    const target = this.gamificationSummary()?.advancement?.targetLevel;
    return target ? `Lên Level ${target}` : 'Đạt cấp tối đa';
  });

  readonly mainNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'ai-coach', label: 'AI Coach' },
    { id: 'scenarios', label: 'Tình huống' },
    { id: 'progress', label: 'Tiến độ' },
    { id: 'achievements', label: 'Thành tích' },
  ];

  readonly bottomNavItems: NavItem[] = [
    { id: 'profile', label: 'Hồ sơ' },
    { id: 'settings', label: 'Cài đặt' },
    { id: 'help', label: 'Trợ giúp' },
  ];

  ngOnInit(): void {
    this.refreshGamification();
  }

  refreshGamification(): void {
    if (!this.authService.isAuthenticated()) return;

    this.gamificationService.getGamificationSummary().subscribe({
      next: (summary) => {
        this.gamificationSummary.set(summary);
        const xp = summary.totalXp ?? summary.xp ?? 0;
        const streak = summary.currentStreak ?? summary.currentStreak ?? 0;
        const level = summary.currentLevel ?? summary.level ?? 'A1';
        this.appState.updateGamification(xp, streak, level);
      }
    });

    this.gamificationService.getNotifications().subscribe({
      next: (res) => {
        const mapped = (res.notifications || []).map(n => ({
          ...n,
          read: n.read ?? n.isRead ?? false,
          isRead: n.read ?? n.isRead ?? false,
          message: n.message || n.content || '',
          content: n.message || n.content || '',
        }));
        this.notifications.set(mapped);
      }
    });
  }

  toggleSidebar(open: boolean): void {
    this.sidebarOpen.set(open);
  }

  toggleNotifications(): void {
    this.notificationsOpen.update(v => !v);
  }

  markNotificationRead(item: NotificationItem): void {
    if (item.read || item.isRead) return;
    this.gamificationService.markNotificationRead(item.id).subscribe({
      next: () => {
        this.notifications.update(list =>
          list.map(n => n.id === item.id ? { ...n, read: true, isRead: true } : n)
        );
      }
    });
  }

  markAllNotificationsRead(): void {
    this.gamificationService.markAllNotificationsRead().subscribe({
      next: () => {
        this.notifications.update(list => list.map(n => ({ ...n, read: true, isRead: true })));
      }
    });
  }

  formatNotificationTime(dateStr: string): string {
    return formatDateTimeDDMMYYYY(dateStr);
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    if (this.sidebarOpen()) this.toggleSidebar(false);
    if (this.notificationsOpen()) this.notificationsOpen.set(false);
  }

  navigate(page: AppPage): void {
    this.appState.go(page);
    this.sidebarOpen.set(false);
    this.notificationsOpen.set(false);
  }

  navIcon(page: AppPage): string {
    const icons: Partial<Record<AppPage, string>> = {
      dashboard: '▦', 'ai-coach': '🎙️', scenarios: '🎭', 
      progress: '↗', achievements: '🏆', profile: '♙', settings: '⚙', help: '?', health: '✚'
    };
    return icons[page] ?? '•';
  }
}
