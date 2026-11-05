import { Component, ChangeDetectionStrategy, signal, computed, inject, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AppStateService } from '../../../core/services/app-state.service';
import { AuthService } from '../../../core/services/auth.service';
import { GamificationService } from '../../../core/services/gamification.service';
import { GamificationSummaryResponse, NotificationItem } from '../../../core/models/gamification.models';
import { AppPage } from '../../../core/models/app.models';

interface NavItem {
  id: AppPage;
  label: string;
  iconSvg: string;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-screen overflow-hidden" style="background: #F0F6FB">
      <!-- Mobile overlay -->
      @if (sidebarOpen()) {
        <button
          type="button"
          class="fixed inset-0 z-40 bg-black/30 lg:hidden w-full h-full border-0 cursor-default"
          (click)="toggleSidebar(false)"
          aria-label="Close sidebar"
        ></button>
      }

      <!-- Sidebar -->
      <aside
        id="app-sidebar"
        class="fixed lg:static inset-y-0 left-0 z-50 flex flex-col w-60 shrink-0 transition-transform duration-300 lg:translate-x-0"
        [class.translate-x-0]="sidebarOpen()"
        [class.-translate-x-full]="!sidebarOpen()"
        style="background: #fff; border-right: 1px solid #E2F0F9"
      >
        <!-- Logo -->
        <button
          type="button"
          class="flex items-center gap-3 px-5 py-5 border-b cursor-pointer w-full text-left bg-transparent"
          style="border-color: #E2F0F9"
          (click)="navigate('dashboard')"
        >
          <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background: #286FB4">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2.5">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
            </svg>
          </div>
          <div>
            <div class="font-800 text-base leading-tight" style="color: #286FB4; font-weight: 800">TalkWithMe</div>
            <div class="text-xs" style="color: #94a3b8">AI English Coach</div>
          </div>
        </button>

        <!-- Main Nav -->
        <nav aria-label="Main navigation" class="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          @for (item of mainNavItems; track item.id) {
            <button
              class="sidebar-link w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all cursor-pointer"
              [class.active]="appState.currentPage() === item.id"
              [attr.aria-current]="appState.currentPage() === item.id ? 'page' : null"
              (click)="navigate(item.id)"
            >
              <span aria-hidden="true">{{ navIcon(item.id) }}</span>
              <span>{{ item.label }}</span>
            </button>
          }
        </nav>

        <!-- Level & XP bar (D-02 Level Advancement) -->
        <div class="px-4 py-3 mx-3 mb-3 rounded-xl" style="background: #E2F0F9">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-700" style="color: #286FB4; font-weight: 700">
              Level {{ currentLevel() }}
            </span>
            <span class="text-xs font-600" style="color: #64748b">{{ totalXp() }} XP</span>
          </div>
          <!-- D-02 condition progress -->
          <div class="progress-bar h-2 bg-slate-200 rounded-full overflow-hidden mt-1.5">
            <div
              class="progress-bar-fill h-2 rounded-full transition-all duration-500"
              [style.width.%]="levelProgressPct()"
              style="background: #286FB4"
            ></div>
          </div>
          <div class="flex justify-between items-center mt-1.5 text-[11px]" style="color: #64748b">
            <span>{{ nextLevelText() }}</span>
            <span class="font-600">{{ advancementConditionsMet() }}/{{ advancementConditionsTotal() }} đạt</span>
          </div>
        </div>

        <!-- Bottom nav -->
        <nav aria-label="Account navigation" class="px-3 pb-4 space-y-1 border-t pt-3" style="border-color: #E2F0F9">
          @for (item of bottomNavItems; track item.id) {
            <button
              class="sidebar-link w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all cursor-pointer"
              [class.active]="appState.currentPage() === item.id"
              [attr.aria-current]="appState.currentPage() === item.id ? 'page' : null"
              (click)="navigate(item.id)"
            >
              <span aria-hidden="true">{{ navIcon(item.id) }}</span>
              <span>{{ item.label }}</span>
            </button>
          }
        </nav>

        <!-- User section ở góc dưới bên trái -->
        <button
          type="button"
          class="flex items-center gap-3 px-4 py-4 cursor-pointer border-t w-full text-left bg-transparent"
          style="border-color: #E2F0F9"
          (click)="navigate('profile')"
        >
          @if (userAvatar()) {
            <img [src]="userAvatar()!" [alt]="userName()" class="w-9 h-9 rounded-full object-cover shrink-0" />
          } @else {
            <div class="w-9 h-9 rounded-full bg-[#286FB4] text-white flex items-center justify-center font-700 text-sm shadow-sm select-none shrink-0">
              {{ userInitial() }}
            </div>
          }
          <div class="flex-1 min-w-0">
            <div class="text-sm font-600 truncate" style="color: #1e293b; font-weight: 600">{{ userName() }}</div>
            <div class="text-xs" style="color: #94a3b8">Học viên tích cực</div>
          </div>
        </button>
      </aside>

      <!-- Main container -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <!-- Top header bar -->
        <header
          class="flex items-center gap-4 px-5 py-4 shrink-0 relative z-20"
          style="background: #fff; border-bottom: 1px solid #E2F0F9"
        >
          <button
            type="button"
            class="lg:hidden p-2 rounded-lg"
            style="color: #286FB4; background: #E2F0F9"
            aria-controls="app-sidebar"
            [attr.aria-expanded]="sidebarOpen()"
            [attr.aria-label]="sidebarOpen() ? 'Close navigation menu' : 'Open navigation menu'"
            (click)="toggleSidebar(!sidebarOpen())"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div class="flex-1"></div>

          <!-- Streak badge -->
          <div class="flex items-center gap-2 px-3 py-2 rounded-xl select-none" style="background: #FFF5E5">
            <span class="text-base">🔥</span>
            <span class="text-sm font-700" style="color: #ea580c; font-weight: 700">{{ currentStreak() }} ngày</span>
          </div>

          <!-- Notifications button & dropdown -->
          <div class="relative">
            <button
              type="button"
              class="relative p-2 rounded-xl cursor-pointer"
              style="background: #E2F0F9; color: #286FB4"
              aria-label="Notifications"
              (click)="toggleNotifications()"
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              @if (unreadCount() > 0) {
                <span class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style="background: #DF4C73">
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
                class="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl shadow-xl z-50 overflow-hidden border"
                style="background: #fff; border-color: #E2F0F9"
              >
                <div class="p-3.5 border-b flex items-center justify-between" style="border-color: #E2F0F9">
                  <div class="font-700 text-sm" style="color: #1e293b; font-weight: 700">
                    Thông báo @if (unreadCount() > 0) { ({{ unreadCount() }}) }
                  </div>
                  @if (unreadCount() > 0) {
                    <button
                      type="button"
                      class="text-xs font-600 hover:underline cursor-pointer border-0 bg-transparent"
                      style="color: #286FB4"
                      (click)="markAllNotificationsRead()"
                    >
                      Đánh dấu tất cả đã đọc
                    </button>
                  }
                </div>

                <div class="max-h-80 overflow-y-auto divide-y" style="border-color: #F1F5F9">
                  @if (notifications().length === 0) {
                    <div class="p-6 text-center text-xs text-slate-400">
                      Không có thông báo nào
                    </div>
                  } @else {
                    @for (item of notifications(); track item.id) {
                      <button
                        type="button"
                        class="w-full text-left p-3 hover:bg-slate-50 transition cursor-pointer flex gap-3 items-start border-0 bg-transparent"
                        [class.bg-blue-50]="!item.read"
                        (click)="markNotificationRead(item)"
                      >
                        <div class="w-2 h-2 rounded-full mt-1.5 shrink-0" [style.background]="item.read ? 'transparent' : '#DF4C73'"></div>
                        <div class="flex-1 min-w-0">
                          <div class="text-xs font-600 truncate" style="color: #1e293b">{{ item.title }}</div>
                          <div class="text-xs mt-0.5 text-slate-600 leading-snug line-clamp-2">{{ item.message }}</div>
                          <div class="text-[10px] mt-1 text-slate-400">{{ formatNotificationTime(item.createdAt) }}</div>
                        </div>
                      </button>
                    }
                  }
                </div>
              </div>
            }
          </div>

          <!-- Avatar ở góc trên bên phải -->
          <button
            type="button"
            class="rounded-full cursor-pointer focus:outline-none p-0 border-0 bg-transparent"
            (click)="navigate('profile')"
            aria-label="User profile"
          >
            @if (userAvatar()) {
              <img
                [src]="userAvatar()!"
                [alt]="userName()"
                class="w-9 h-9 rounded-full object-cover"
                style="outline: 2px solid #B0DDE4"
              />
            } @else {
              <div
                class="w-9 h-9 rounded-full bg-[#286FB4] text-white flex items-center justify-center font-700 text-sm shadow-sm select-none"
                style="outline: 2px solid #B0DDE4"
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
    const raw = this.authService.currentUser()?.avatarUrl;
    if (raw) {
      if (raw.startsWith('http')) return raw;
      if (raw.startsWith('/')) return `http://localhost:8000${raw}`;
      return raw;
    }
    return null;
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
    return this.notifications().filter(n => !n.read).length;
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
    {
      id: "dashboard",
      label: "Dashboard",
      iconSvg: `<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`
    },
    {
      id: "ai-coach",
      label: "AI Coach",
      iconSvg: `<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M8 16s0-4 4-4 4 4 4 4"/><path d="M17 11a5 5 0 0 1 0 6M7 11a5 5 0 0 0 0 6"/></svg>`
    },
    {
      id: "scenarios",
      label: "Tình huống",
      iconSvg: `<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
    },
    {
      id: "community",
      label: "Phòng cộng đồng",
      iconSvg: `<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
    },
    {
      id: "progress",
      label: "Tiến độ",
      iconSvg: `<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`
    },
    {
      id: "achievements",
      label: "Thành tích",
      iconSvg: `<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/></svg>`
    }
  ];

  readonly bottomNavItems: NavItem[] = [
    {
      id: "profile",
      label: "Hồ sơ",
      iconSvg: `<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
    },
    {
      id: "settings",
      label: "Cài đặt",
      iconSvg: `<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
    },
    {
      id: "help",
      label: "Trợ giúp",
      iconSvg: `<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
    }
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
        this.notifications.set(res.notifications);
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
    if (item.read) return;
    this.gamificationService.markNotificationRead(item.id).subscribe({
      next: () => {
        this.notifications.update(list => list.map(n => n.id === item.id ? { ...n, read: true } : n));
      }
    });
  }

  markAllNotificationsRead(): void {
    this.gamificationService.markAllNotificationsRead().subscribe({
      next: () => {
        this.notifications.update(list => list.map(n => ({ ...n, read: true })));
      }
    });
  }

  formatNotificationTime(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
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
      dashboard: '▦', 'ai-coach': '🎙️', scenarios: '🎭', community: '👥',
      progress: '↗', achievements: '🏆', profile: '♙', settings: '⚙', help: '?', health: '✚'
    };
    return icons[page] ?? '•';
  }
}
