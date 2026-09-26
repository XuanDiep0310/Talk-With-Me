import { Injectable, signal, computed, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AppPage, User, Scenario, CommunityRoom } from '../models/app.models';
import { MOCK_USER } from '../data/mock-data';

const VALID_PAGES: AppPage[] = [
  "landing", "login", "register", "onboarding",
  "dashboard", "ai-coach", "ai-coach-session", "ai-coach-report",
  "scenarios", "scenario-detail", "scenario-roleplay", "scenario-result",
  "community", "community-room", "progress", "achievements", "profile", "settings", "help", "health"
];

function getInitialPage(): AppPage {
  if (typeof window === 'undefined') return "landing";
  const path = window.location.pathname.replace(/^\/+/, '').split('/')[0];
  if (!path || path === '') return "landing";
  return VALID_PAGES.includes(path as AppPage) ? (path as AppPage) : "landing";
}

@Injectable({
  providedIn: 'root'
})
export class AppStateService {
  private readonly router = inject(Router);

  readonly currentPage = signal<AppPage>(getInitialPage());
  readonly user = signal<User | null>(MOCK_USER);
  readonly selectedTopic = signal<string>("Giao tiếp hằng ngày");
  readonly selectedScenario = signal<Scenario | null>(null);
  readonly selectedRoom = signal<CommunityRoom | null>(null);

  readonly appUser = computed(() => this.user() || MOCK_USER);
  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly userInitials = computed(() => {
    const name = this.appUser().name;
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  });
  readonly userXpLevelProgress = computed(() => {
    const xp = this.appUser().xp;
    const currentLevelXp = xp % 1000;
    return Math.round((currentLevelXp / 1000) * 100);
  });

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        const path = event.urlAfterRedirects.replace(/^\/+/, '').split('/')[0];
        const page = (!path || path === '') ? 'landing' : path as AppPage;
        if (VALID_PAGES.includes(page)) {
          this.currentPage.set(page);
        }
      });
  }

  go(page: AppPage): void {
    this.currentPage.set(page);
    const targetUrl = page === 'landing' ? '/' : `/${page}`;
    this.router.navigateByUrl(targetUrl);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  login(user?: User): void {
    this.user.set(user || MOCK_USER);
    this.go("dashboard");
  }

  logout(): void {
    this.user.set(null);
    this.go("landing");
  }

  setUser(user: User): void {
    this.user.set(user);
  }

  startAiCoachSession(topic: string): void {
    this.selectedTopic.set(topic);
    this.go("ai-coach-session");
  }

  selectScenario(scenario: Scenario): void {
    this.selectedScenario.set(scenario);
    this.go("scenario-detail");
  }

  joinRoom(room: CommunityRoom): void {
    this.selectedRoom.set(room);
    this.go("community-room");
  }
}
