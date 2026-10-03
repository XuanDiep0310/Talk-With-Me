import { Injectable, signal, computed, inject } from "@angular/core";
import { Router, NavigationEnd } from "@angular/router";
import { filter } from "rxjs/operators";
import {
  AppPage,
  User,
  Scenario,
  CommunityRoom,
  RoomListing,
  Settings,
  AiCoachCompletedSession,
} from "../models/app.models";
import {
  MOCK_USER,
  MOCK_SETTINGS,
  MOCK_AI_COACH_TOPIC_GROUPS,
  ROOMS,
  MOCK_ROOM_HOST_AVATAR,
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
  private joinedRoomId: number | null = null;

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
  readonly roleplayResult = signal<RoleplayResult | null>(null);
  readonly completedScenarioIds = signal<string[]>([]);
  readonly selectedRoom = signal<CommunityRoom | null>(null);
  readonly communityRooms = signal<RoomListing[]>(ROOMS.map((room) => ({ ...room })));

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

  go(page: AppPage): Promise<boolean> {
    this.currentPage.set(page);
    const targetUrl = page === "landing" ? "/" : `/${page}`;
    const navigation = this.router.navigateByUrl(targetUrl);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return navigation;
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
    this.roleplayResult.set(null);
    this.go("scenario-detail");
  }

  completeRoleplay(result: RoleplayResult): void {
    this.roleplayResult.set(result);
    if (result.status === "PASS") {
      this.completedScenarioIds.update(ids => ids.includes(result.scenarioId) ? ids : [...ids, result.scenarioId]);
    }
  }

  joinRoom(roomId: number): boolean {
    const room = this.communityRooms().find((item) => item.id === roomId);
    if (!room || !room.active || room.members >= room.max) return false;
    const updatedRoom = { ...room, members: Math.min(room.members + 1, room.max) };
    this.communityRooms.update((rooms) =>
      rooms.map((item) => item.id === roomId ? updatedRoom : item),
    );
    this.selectedRoom.set({
      id: String(updatedRoom.id),
      name: updatedRoom.title,
      topic: updatedRoom.topic,
      level: updatedRoom.level,
      members: updatedRoom.members,
      maxMembers: updatedRoom.max,
      active: updatedRoom.active,
      host: updatedRoom.host,
      hostAvatar: MOCK_ROOM_HOST_AVATAR,
      tags: [updatedRoom.topic, updatedRoom.level],
    });
    this.joinedRoomId = updatedRoom.id;
    void this.go("community-room");
    return true;
  }

  leaveRoom(): void {
    const roomId = this.joinedRoomId;
    if (roomId !== null) {
      const room = this.communityRooms().find((item) => item.id === roomId);
      if (room) {
        const updatedRoom = { ...room, members: Math.max(0, room.members - 1) };
        this.communityRooms.update((rooms) =>
          rooms.map((item) => item.id === roomId ? updatedRoom : item),
        );
      }
    }
    this.joinedRoomId = null;
    this.selectedRoom.set(null);
    void this.go("community");
  }

  createCommunityRoom(room: Omit<RoomListing, "id">): void {
    const id = Math.max(0, ...this.communityRooms().map((item) => item.id)) + 1;
    this.communityRooms.update((rooms) => [{ ...room, id }, ...rooms]);
  }
}

export interface RoleplayResult {
  scenarioId: string;
  scenarioTitle: string;
  tasks: { id: number; label: string; pass: boolean }[];
  passCount: number;
  totalTasks: number;
  xp: number;
  status: "PASS" | "NOT PASSED";
  completedAt: string;
}
