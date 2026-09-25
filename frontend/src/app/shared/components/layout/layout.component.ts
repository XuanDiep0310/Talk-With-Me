import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AppStateService } from '../../../core/services/app-state.service';
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
        <div
          class="fixed inset-0 z-40 bg-black/30 lg:hidden"
          (click)="toggleSidebar(false)"
        ></div>
      }

      <!-- Sidebar -->
      <aside
        class="fixed lg:static inset-y-0 left-0 z-50 flex flex-col w-60 shrink-0 transition-transform duration-300 lg:translate-x-0"
        [class.translate-x-0]="sidebarOpen()"
        [class.-translate-x-full]="!sidebarOpen()"
        style="background: #fff; border-right: 1px solid #E2F0F9"
      >
        <!-- Logo -->
        <div class="flex items-center gap-3 px-5 py-5 border-b cursor-pointer" style="border-color: #E2F0F9" (click)="navigate('dashboard')">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background: #286FB4">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2.5">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
            </svg>
          </div>
          <div>
            <div class="font-800 text-base leading-tight" style="color: #286FB4; font-weight: 800">TalkWithMe</div>
            <div class="text-xs" style="color: #94a3b8">AI English Coach</div>
          </div>
        </div>

        <!-- Main Nav -->
        <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          @for (item of mainNavItems; track item.id) {
            <button
              class="sidebar-link w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all cursor-pointer"
              [class.active]="appState.currentPage() === item.id"
              (click)="navigate(item.id)"
            >
              <span [innerHTML]="item.iconSvg"></span>
              <span>{{ item.label }}</span>
            </button>
          }
        </nav>

        <!-- XP bar -->
        <div class="px-4 py-3 mx-3 mb-3 rounded-xl" style="background: #E2F0F9">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-600" style="color: #286FB4; font-weight: 600">
              {{ appState.appUser().level }}
            </span>
            <span class="text-xs" style="color: #64748b">{{ appState.appUser().xp }} XP</span>
          </div>
          <div class="progress-bar h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              class="progress-bar-fill h-2 rounded-full transition-all duration-500"
              [style.width.%]="appState.userXpLevelProgress()"
              style="background: #286FB4"
            ></div>
          </div>
        </div>

        <!-- Bottom nav -->
        <div class="px-3 pb-4 space-y-1 border-t pt-3" style="border-color: #E2F0F9">
          @for (item of bottomNavItems; track item.id) {
            <button
              class="sidebar-link w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all cursor-pointer"
              [class.active]="appState.currentPage() === item.id"
              (click)="navigate(item.id)"
            >
              <span [innerHTML]="item.iconSvg"></span>
              <span>{{ item.label }}</span>
            </button>
          }
        </div>

        <!-- User section -->
        <div
          class="flex items-center gap-3 px-4 py-4 cursor-pointer border-t"
          style="border-color: #E2F0F9"
          (click)="navigate('profile')"
        >
          <img [src]="appState.appUser().avatar" [alt]="appState.appUser().name" class="w-9 h-9 rounded-full object-cover" />
          <div class="flex-1 min-w-0">
            <div class="text-sm font-600 truncate" style="color: #1e293b; font-weight: 600">{{ appState.appUser().name }}</div>
            <div class="text-xs" style="color: #94a3b8">Học viên tích cực</div>
          </div>
        </div>
      </aside>

      <!-- Main container -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <!-- Top header bar -->
        <header
          class="flex items-center gap-4 px-5 py-4 shrink-0"
          style="background: #fff; border-bottom: 1px solid #E2F0F9"
        >
          <button
            class="lg:hidden p-2 rounded-lg"
            style="color: #286FB4; background: #E2F0F9"
            (click)="toggleSidebar(true)"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div class="flex-1"></div>

          <!-- Streak badge -->
          <div class="flex items-center gap-2 px-3 py-2 rounded-xl" style="background: #FFF5E5">
            <span class="text-base">🔥</span>
            <span class="text-sm font-700" style="color: #ea580c; font-weight: 700">{{ appState.appUser().streak }} ngày</span>
          </div>

          <!-- Notifications button -->
          <button class="relative p-2 rounded-xl cursor-pointer" style="background: #E2F0F9; color: #286FB4">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span class="absolute top-1 right-1 w-2 h-2 rounded-full" style="background: #DF4C73"></span>
          </button>

          <img
            [src]="appState.appUser().avatar"
            [alt]="appState.appUser().name"
            class="w-9 h-9 rounded-full object-cover cursor-pointer"
            style="outline: 2px solid #B0DDE4"
            (click)="navigate('profile')"
          />
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
export class LayoutComponent {
  readonly appState = inject(AppStateService);
  readonly sidebarOpen = signal(false);

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
    },
    {
      id: "health",
      label: "Hệ thống (Health)",
      iconSvg: `<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`
    }
  ];

  toggleSidebar(open: boolean): void {
    this.sidebarOpen.set(open);
  }

  navigate(page: AppPage): void {
    this.appState.go(page);
    this.sidebarOpen.set(false);
  }
}
