import { Injectable, signal, computed, inject, effect } from "@angular/core";
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
  LearningActivity,
  SkillProgress,
  Achievement,
  Mission,
  XpHistoryEntry,
} from "../models/app.models";
import {
  MOCK_USER,
  MOCK_SETTINGS,
  MOCK_AI_COACH_TOPIC_GROUPS,
  ROOMS,
  MOCK_ROOM_HOST_AVATAR,
  MOCK_SKILL_PROGRESS,
  MOCK_PROGRESS_SESSION_HISTORY,
  MOCK_ACHIEVEMENTS,
  MOCK_DAILY_MISSIONS,
  MOCK_XP_HISTORY,
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
const LEGACY_SETTINGS_STORAGE_KEY = "talk-with-me.settings";
const TOPIC_STORAGE_KEY = "talk-with-me.selected-topic";
const SESSIONS_STORAGE_KEY = "talk-with-me.ai-sessions";
const SESSION_DRAFT_KEY = "talk-with-me.ai-session-draft";
const ACTIVITIES_STORAGE_KEY = "talk-with-me.learning-activities";
const SKILLS_STORAGE_KEY = "talk-with-me.skill-progress";
const ACHIEVEMENTS_STORAGE_KEY = "talk-with-me.achievements";
const MISSIONS_STORAGE_KEY = "talk-with-me.daily-missions";
const XP_HISTORY_STORAGE_KEY = "talk-with-me.xp-history";
const STREAK_DATE_STORAGE_KEY = "talk-with-me.last-learning-date";
const SCENARIO_STORAGE_KEY = "talk-with-me.selected-scenario";
const SCENARIO_COMPLETIONS_KEY = "talk-with-me.completed-scenario-ids";
const ROOM_STORAGE_KEY = "talk-with-me.selected-room";
const ROOM_ACTIVITY_KEY = "talk-with-me.community-activity";
const ROOMS_STORAGE_KEY = "talk-with-me.community-rooms";
const JOINED_ROOM_STORAGE_KEY = "talk-with-me.joined-room-id";

export interface AiCoachSessionDraft {
  topic: string;
  startedAt: number;
  elapsed: number;
  transcript: { id: number; speaker: "User" | "AI"; text: string; time: string }[];
  turn: number;
}

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateKeyAfter(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function getStoredSettings(): Settings {
  if (typeof window === "undefined") return { ...MOCK_SETTINGS };
  try {
    const value = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
      ?? window.localStorage.getItem(LEGACY_SETTINGS_STORAGE_KEY);
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
  private joinedRoomId: number | null = readStored(JOINED_ROOM_STORAGE_KEY, null);

  readonly currentPage = signal<AppPage>(getInitialPage());
  readonly user = signal<User | null>(getStoredUser());
  readonly totalXp = signal(this.user()?.xp ?? MOCK_USER.xp);
  readonly currentStreak = signal(this.user()?.streak ?? MOCK_USER.streak);
  readonly lastLearningDate = signal(readStored(STREAK_DATE_STORAGE_KEY, localDateKey()));
  readonly learningActivities = signal<LearningActivity[]>(readStored(ACTIVITIES_STORAGE_KEY, MOCK_PROGRESS_SESSION_HISTORY.map((session, index) => ({
    id: `seed-${index}`,
    type: session.type === "AI Coach" ? "AI_COACH" : session.type === "Tình huống" ? "SCENARIO" : "COMMUNITY",
    title: session.topic,
    topic: session.topic,
    completedAt: "",
    date: session.date,
    duration: session.duration,
    score: session.score,
    emoji: session.emoji,
    xp: 0,
    status: "completed",
  }))));
  readonly skillProgress = signal<SkillProgress[]>(readStored(SKILLS_STORAGE_KEY, MOCK_SKILL_PROGRESS.map((skill) => ({ ...skill, history: [...skill.history] }))));
  readonly achievements = signal<Achievement[]>(readStored(ACHIEVEMENTS_STORAGE_KEY, MOCK_ACHIEVEMENTS.map((achievement) => ({ ...achievement }))));
  readonly dailyMissions = signal<Mission[]>(readStored(MISSIONS_STORAGE_KEY, MOCK_DAILY_MISSIONS.map((mission) => ({ ...mission }))));
  readonly xpHistory = signal<XpHistoryEntry[]>(readStored(XP_HISTORY_STORAGE_KEY, MOCK_XP_HISTORY.map((entry) => ({ ...entry }))));
  readonly settings = signal<Settings>(getStoredSettings());
  readonly selectedTopicId = signal<string | null>(readStored(TOPIC_STORAGE_KEY, null));
  readonly completedAiCoachSessions = signal<AiCoachCompletedSession[]>(readStored(SESSIONS_STORAGE_KEY, []));
  readonly aiSessionDraft = signal<AiCoachSessionDraft | null>(readStored(SESSION_DRAFT_KEY, null));
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
  readonly selectedScenario = signal<Scenario | null>(readStored(SCENARIO_STORAGE_KEY, null));
  readonly roleplayResult = signal<RoleplayResult | null>(null);
  readonly completedScenarioIds = signal<string[]>(readStored(SCENARIO_COMPLETIONS_KEY, []));
  readonly selectedRoom = signal<CommunityRoom | null>(readStored(ROOM_STORAGE_KEY, null));
  readonly communityActivity = signal<string[]>(readStored(ROOM_ACTIVITY_KEY, []));
  readonly communityRooms = signal<RoomListing[]>(readStored(ROOMS_STORAGE_KEY, ROOMS.map((room) => ({ ...room }))));

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
    const xp = this.totalXp();
    const currentLevelXp = xp % 1000;
    return Math.round((currentLevelXp / 1000) * 100);
  });

  constructor() {
    effect(() => {
      if (typeof document !== "undefined") {
        const theme = this.settings().theme;
        document.documentElement.classList.toggle("theme-dark", theme === "dark" || (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches === true));
      }
    });
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
    this.totalXp.set(authenticatedUser.xp);
    this.currentStreak.set(authenticatedUser.streak);
    this.persistUser(authenticatedUser);
    this.go("dashboard");
  }

  register(user: User): void {
    this.user.set(user);
    this.totalXp.set(user.xp);
    this.currentStreak.set(user.streak);
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
    this.totalXp.set(user.xp);
    this.currentStreak.set(user.streak);
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
        window.localStorage.setItem(LEGACY_SETTINGS_STORAGE_KEY, JSON.stringify(next));
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
    if (typeof window !== "undefined") window.localStorage.setItem(TOPIC_STORAGE_KEY, topicId);
    this.go("ai-coach-session");
  }

  saveAiSessionDraft(draft: AiCoachSessionDraft | null): void {
    this.aiSessionDraft.set(draft);
    if (typeof window === "undefined") return;
    try {
      if (draft) window.localStorage.setItem(SESSION_DRAFT_KEY, JSON.stringify(draft));
      else window.localStorage.removeItem(SESSION_DRAFT_KEY);
    } catch {
      // Session continuity is best-effort when browser storage is unavailable.
    }
  }

  completeAiCoachSession(session: AiCoachCompletedSession): void {
    if (this.completedAiCoachSessions().some((item) => item.id === session.id)) return;
    this.completedAiCoachSessions.update((sessions) => [session, ...sessions]);
    this.persistStorage(SESSIONS_STORAGE_KEY, this.completedAiCoachSessions());
    this.recordActivity({
      id: session.id,
      type: "AI_COACH",
      title: session.topic,
      topic: session.topic,
      completedAt: session.completedAt,
      date: "Hôm nay",
      duration: session.duration,
      score: session.overallScore,
      emoji: session.emoji,
      xp: session.xp,
      status: "completed",
      skillUpdates: session.skills,
    });
    this.saveAiSessionDraft(null);
  }

  selectScenario(scenario: Scenario): void {
    this.selectedScenario.set(scenario);
    this.persistStorage(SCENARIO_STORAGE_KEY, scenario);
    this.roleplayResult.set(null);
    this.go("scenario-detail");
  }

  completeRoleplay(result: RoleplayResult): void {
    this.roleplayResult.set(result);
    if (result.status === "PASS") {
      this.completedScenarioIds.update(ids => ids.includes(result.scenarioId) ? ids : [...ids, result.scenarioId]);
      this.persistStorage(SCENARIO_COMPLETIONS_KEY, this.completedScenarioIds());
      const scenario = this.selectedScenario();
      this.recordActivity({
        id: `scenario-${result.scenarioId}-${result.completedAt}`,
        type: "SCENARIO",
        title: result.scenarioTitle,
        topic: result.scenarioTitle,
        completedAt: result.completedAt,
        date: "Hôm nay",
        duration: "",
        score: result.totalTasks ? Math.round((result.passCount / result.totalTasks) * 100) : 0,
        emoji: "🎭",
        xp: result.xp,
        status: "completed",
        skillUpdates: scenario ? [{ label: "Fluency", score: result.totalTasks ? Math.round((result.passCount / result.totalTasks) * 100) : 0 }] : undefined,
      });
    }
  }

  recordActivity(activity: LearningActivity): void {
    if (activity.status !== "completed" || this.learningActivities().some((item) => item.id === activity.id)) return;
    const today = localDateKey();
    this.learningActivities.update((items) => [activity, ...items]);
    this.persistStorage(ACTIVITIES_STORAGE_KEY, this.learningActivities());
    if (activity.xp > 0) {
      this.totalXp.update((xp) => xp + activity.xp);
      this.xpHistory.update((items) => [{ date: "Hôm nay", xp: activity.xp, source: activity.title }, ...items]);
      this.persistStorage(XP_HISTORY_STORAGE_KEY, this.xpHistory());
      this.user.update((user) => user ? { ...user, xp: user.xp + activity.xp } : user);
    }

    const lastDate = this.lastLearningDate();
    if (lastDate !== today) {
      this.currentStreak.set(dateKeyAfter(lastDate, 1) === today ? this.currentStreak() + 1 : 1);
      this.lastLearningDate.set(today);
      this.persistStorage(STREAK_DATE_STORAGE_KEY, today);
      this.user.update((user) => user ? { ...user, streak: this.currentStreak() } : user);
    }

    if (activity.skillUpdates?.length) {
      this.skillProgress.update((skills) => skills.map((skill) => {
        const update = activity.skillUpdates?.find((item) => {
          const label = item.label.toLowerCase();
          const skillLabel = skill.label.toLowerCase();
          return label === skillLabel || (label === "pronunciation" && skillLabel.startsWith("ph"));
        });
        return update ? { ...skill, prev: skill.current, current: update.score, history: [...skill.history, update.score] } : skill;
      }));
    }

    this.dailyMissions.update((missions) => missions.map((mission) => {
      const matchesActivity =
        (activity.type === "AI_COACH" && mission.id === 1) ||
        (activity.type === "SCENARIO" && mission.id === 2) ||
        (activity.type === "COMMUNITY" && mission.id === 3) ||
        mission.id === 4;
      return matchesActivity ? { ...mission, done: true } : mission;
    }));

    this.achievements.update((badges) => badges.map((badge) => {
      let progress = badge.progress ?? 0;
      if (badge.id === 4) progress = this.skillProgress().find((skill) => skill.label === "Fluency")?.current ?? progress;
      if (badge.id === 5 && activity.type === "SCENARIO") progress = Math.min(badge.total ?? progress + 1, progress + 1);
      if (badge.id === 7) progress = this.currentStreak();
      if (badge.id === 8) progress = Math.min(badge.total ?? progress + activity.xp, progress + activity.xp);
      const earned = badge.earned || (badge.total !== undefined && progress >= badge.total && [4, 5, 7, 8].includes(badge.id));
      return {
        ...badge,
        progress,
        earned,
        date: earned && !badge.earned ? new Date().toLocaleDateString() : badge.date,
      };
    }));
    this.persistStorage(SKILLS_STORAGE_KEY, this.skillProgress());
    this.persistStorage(ACHIEVEMENTS_STORAGE_KEY, this.achievements());
    this.persistStorage(MISSIONS_STORAGE_KEY, this.dailyMissions());
    if (this.user()) this.persistUser(this.user()!);
  }

  joinRoom(roomId: number): boolean {
    const room = this.communityRooms().find((item) => item.id === roomId);
    if (!room || !room.active || room.members >= room.max) return false;
    const updatedRoom = { ...room, members: Math.min(room.members + 1, room.max) };
    this.communityRooms.update((rooms) =>
      rooms.map((item) => item.id === roomId ? updatedRoom : item),
    );
    this.persistStorage(ROOMS_STORAGE_KEY, this.communityRooms());
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
    this.persistStorage(ROOM_STORAGE_KEY, this.selectedRoom());
    const joinedAt = new Date().toISOString();
    this.communityActivity.update((items) => [...items, joinedAt]);
    this.persistStorage(ROOM_ACTIVITY_KEY, this.communityActivity());
    this.recordActivity({
      id: `community-${updatedRoom.id}-${joinedAt}`,
      type: "COMMUNITY",
      title: updatedRoom.title,
      topic: updatedRoom.topic,
      completedAt: joinedAt,
      date: "Hôm nay",
      duration: "",
      score: 0,
      emoji: updatedRoom.emoji,
      xp: 0,
      status: "completed",
    });
    this.joinedRoomId = updatedRoom.id;
    this.persistStorage(JOINED_ROOM_STORAGE_KEY, this.joinedRoomId);
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
        this.persistStorage(ROOMS_STORAGE_KEY, this.communityRooms());
      }
    }
    this.joinedRoomId = null;
    if (typeof window !== "undefined") window.localStorage.removeItem(JOINED_ROOM_STORAGE_KEY);
    this.selectedRoom.set(null);
    if (typeof window !== "undefined") window.localStorage.removeItem(ROOM_STORAGE_KEY);
    void this.go("community");
  }

  createCommunityRoom(room: Omit<RoomListing, "id">): void {
    const id = Math.max(0, ...this.communityRooms().map((item) => item.id)) + 1;
    this.communityRooms.update((rooms) => [{ ...room, id }, ...rooms]);
    this.persistStorage(ROOMS_STORAGE_KEY, this.communityRooms());
  }

  private persistStorage(key: string, value: unknown): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // State remains available in memory when storage is unavailable.
    }
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
