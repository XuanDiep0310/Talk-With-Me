import { Injectable, signal, computed, inject } from "@angular/core";
import { Router, NavigationEnd } from "@angular/router";
import { filter } from "rxjs/operators";
import {
  AppPage,
  User,
  Scenario,
  CommunityRoom,
  Settings,
  AiCoachCompletedSession,
} from "../models/app.models";
import {
  MOCK_USER,
  MOCK_SETTINGS,
  MOCK_AI_COACH_TOPIC_GROUPS,
} from "../data/mock-data";

const VALID_PAGES: AppPage[] = [
  "landing",
  "login",
  "register",
  "onboarding",
  "dashboard",
  "ai-coach",
  "ai-coach-session",
  "ai-coach-report",
  "scenarios",
  "scenario-detail",
  "scenario-roleplay",
  "scenario-result",
  "community",
  "community-room",
  "progress",
  "achievements",
  "profile",
  "settings",
  "help",
  "health",
];
const AUTH_STORAGE_KEY = "talk-with-me.mock-user";
const SETTINGS_STORAGE_KEY = "talk-with-me.mock-settings";

function getStoredSettings(): Settings {
  if (typeof window === "undefined") return { ...MOCK_SETTINGS };
  try {
    const value = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!value) return { ...MOCK_SETTINGS };
    const parsed = JSON.parse(value) as Partial<Settings>;
    return {
      notifications:
        typeof parsed.notifications === "boolean"
          ? parsed.notifications
          : MOCK_SETTINGS.notifications,
      dailyReminder:
        typeof parsed.dailyReminder === "boolean"
          ? parsed.dailyReminder
          : MOCK_SETTINGS.dailyReminder,
      aiVoice: ["female", "male", "neutral"].includes(parsed.aiVoice ?? "")
        ? parsed.aiVoice!
        : MOCK_SETTINGS.aiVoice,
      aiSpeed: ["slow", "normal", "fast"].includes(parsed.aiSpeed ?? "")
        ? parsed.aiSpeed!
        : MOCK_SETTINGS.aiSpeed,
      theme: ["light", "dark", "system"].includes(parsed.theme ?? "")
        ? parsed.theme!
        : MOCK_SETTINGS.theme,
    };
  } catch {
    return { ...MOCK_SETTINGS };
  }
}

function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return value ? (JSON.parse(value) as User) : null;
  } catch {
    return null;
  }
}

function getInitialPage(): AppPage {
  if (typeof window === "undefined") return "landing";
  const path = window.location.pathname.replace(/^\/+/, "").split("/")[0];
  if (!path || path === "") return "landing";
  return VALID_PAGES.includes(path as AppPage) ? (path as AppPage) : "landing";
}

@Injectable({
  providedIn: "root",
})
export class AppStateService {
  private readonly router = inject(Router);

  readonly currentPage = signal<AppPage>(getInitialPage());
  readonly user = signal<User | null>(getStoredUser());
  readonly settings = signal<Settings>(getStoredSettings());
  readonly selectedTopicId = signal<string | null>(null);
  readonly completedAiCoachSessions = signal<AiCoachCompletedSession[]>([]);
  readonly latestAiCoachSession = computed(
    () => this.completedAiCoachSessions()[0] ?? null,
  );
  readonly selectedTopic = computed(() => {
    const selectedId = this.selectedTopicId();
    if (!selectedId) return null;
    return (
      MOCK_AI_COACH_TOPIC_GROUPS.flatMap((group) => group.topics).find(
        (topic) => topic.label === selectedId,
      )?.label ?? null
    );
  });
  readonly selectedScenario = signal<Scenario | null>(null);
  readonly selectedRoom = signal<CommunityRoom | null>(null);

  readonly appUser = computed(() => this.user() || MOCK_USER);
  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly userInitials = computed(() => {
    const name = this.appUser().name;
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  });
  readonly userXpLevelProgress = computed(() => {
    const xp = this.appUser().xp;
    const currentLevelXp = xp % 1000;
    return Math.round((currentLevelXp / 1000) * 100);
  });

  constructor() {
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd,
        ),
      )
      .subscribe((event) => {
        const path = event.urlAfterRedirects.replace(/^\/+/, "").split("/")[0];
        const page = !path || path === "" ? "landing" : (path as AppPage);
        if (VALID_PAGES.includes(page)) {
          this.currentPage.set(page);
        }
      });
  }

  go(page: AppPage): void {
    this.currentPage.set(page);
    const targetUrl = page === "landing" ? "/" : `/${page}`;
    this.router.navigateByUrl(targetUrl);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  login(user?: User): void {
    const authenticatedUser = user || MOCK_USER;
    this.user.set(authenticatedUser);
    this.persistUser(authenticatedUser);
    this.go("dashboard");
  }

  register(user: User): void {
    this.user.set(user);
    this.persistUser(user);
    this.go("onboarding");
  }

  logout(): void {
    this.user.set(null);
    if (typeof window !== "undefined")
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    this.go("landing");
  }

  setUser(user: User): void {
    this.user.set(user);
    this.persistUser(user);
  }

  updateUserProfile(
    profile: Pick<User, "name" | "interests" | "goals" | "avatar">,
  ): void {
    const current = this.user() ?? this.appUser();
    this.setUser({
      ...current,
      ...profile,
      interests: [...profile.interests],
      goals: [...profile.goals],
    });
  }

  updateSettings(patch: Partial<Settings>): void {
    const next = { ...this.settings(), ...patch };
    this.settings.set(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* Storage may be unavailable. */
      }
    }
  }

  private persistUser(user: User): void {
    if (typeof window !== "undefined")
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  }

  startAiCoachSession(topicId: string): void {
    const exists = MOCK_AI_COACH_TOPIC_GROUPS.some((group) =>
      group.topics.some((topic) => topic.label === topicId),
    );
    if (!exists) return;
    this.selectedTopicId.set(topicId);
    this.go("ai-coach-session");
  }

  completeAiCoachSession(session: AiCoachCompletedSession): void {
    this.completedAiCoachSessions.update((sessions) => [session, ...sessions]);
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
