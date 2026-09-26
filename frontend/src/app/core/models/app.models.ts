export type AppPage =
  | "landing" | "login" | "register" | "onboarding"
  | "dashboard" | "ai-coach" | "ai-coach-session" | "ai-coach-report"
  | "scenarios" | "scenario-detail" | "scenario-roleplay" | "scenario-result"
  | "community" | "community-room"
  | "progress" | "achievements" | "profile" | "settings" | "help"
  | "health";

export interface AppUser {
  name: string;
  email: string;
  level: string;
  xp: number;
  streak: number;
  avatar: string;
  interests: string[];
  goals: string[];
  weaknesses: string[];
}

export type SessionKind = "ai-coach" | "scenario" | "community";

export interface PracticeSession {
  topic: string;
  date: string;
  duration: string;
  score: number;
  type: SessionKind | string;
}

export interface Achievement {
  id: number;
  emoji: string;
  name: string;
  desc: string;
  earned: boolean;
  date?: string;
  progress?: number;
  total?: number;
}

export interface UserSettings {
  notifications: boolean;
  dailyReminder: boolean;
  aiVoice: "female" | "male" | "neutral";
  aiSpeed: "slow" | "normal" | "fast";
  theme: "light" | "dark" | "system";
}

export interface ScenarioListItem {
  id: number; title: string; desc: string; level: string; duration: string;
  emoji: string; done: boolean; xp: number;
}

export interface ScenarioGroup {
  id: string; label: string; emoji: string; scenarios: ScenarioListItem[];
}

export interface CommunityRoomListItem {
  id: number; title: string; topic: string; level: string; members: number;
  max: number; active: boolean; emoji: string; host: string; duration: string;
}

export interface AchievementMission {
  id: number; label: string; xp: number; done: boolean; icon: string;
}

export interface Scenario {
  id: string;
  title: string;
  category: string;
  level: string;
  duration: string;
  description: string;
  objectives: string[];
  vocabulary: { word: string; meaning: string }[];
  image: string;
}

export interface CommunityRoom {
  id: string;
  name: string;
  topic: string;
  level: string;
  members: number;
  maxMembers: number;
  host: string;
  hostAvatar: string;
  tags: string[];
}
