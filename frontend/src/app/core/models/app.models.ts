export type AppPage =
  | "landing" | "login" | "register" | "onboarding"
  | "dashboard" | "ai-coach" | "ai-coach-session" | "ai-coach-report"
  | "scenarios" | "scenario-detail" | "scenario-roleplay" | "scenario-result"
  | "community" | "community-room"
  | "progress" | "achievements" | "profile" | "settings" | "help"
  | "health";

export interface User {
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

/** Backward-compatible alias for existing feature code. */
export type AppUser = User;

export interface Session {
  topic: string;
  date: string;
  duration: string;
  score: number;
  type: string;
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

export interface Mission {
  id: number;
  label: string;
  xp: number;
  done: boolean;
  icon: string;
}

export interface XpHistoryEntry {
  date: string;
  xp: number;
  source: string;
}

export type AppTheme = 'light' | 'dark' | 'system';

export interface Settings {
  notifications: boolean;
  dailyReminder: boolean;
  aiVoice: string;
  aiSpeed: string;
  theme: AppTheme;
}

export interface ThemeOption {
  val: AppTheme;
  label: string;
}

export interface ConversationLine {
  id: number;
  speaker: string;
  text: string;
  translation?: string;
  time: string;
  final?: boolean;
  detectedChunk?: string;
}

export interface CommunityRoomMember {
  name: string;
  emoji: string;
  color: string;
  speaking: boolean;
}

export interface UsefulPhrase {
  en: string;
  vi: string;
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

export interface ScenarioCatalogItem {
  id: number;
  title: string;
  desc: string;
  level: string;
  duration: string;
  emoji: string;
  done: boolean;
  xp: number;
}

export interface ScenarioGroup {
  id: string;
  label: string;
  emoji: string;
  scenarios: ScenarioCatalogItem[];
}

export interface RoomListing {
  id: number;
  title: string;
  topic: string;
  level: string;
  members: number;
  max: number;
  active: boolean;
  emoji: string;
  host: string;
  duration: string;
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

export interface SkillProgress {
  label: string;
  current: number;
  prev: number;
  color: string;
  desc: string;
  history: number[];
}

export interface ProgressSessionHistory {
  date: string;
  topic: string;
  type: string;
  duration: string;
  score: number;
  emoji: string;
}

export interface LevelRequirement {
  level: string;
  done: boolean;
  current?: boolean;
  sessions: number;
  scenarios: number;
  minFluency: number;
  progress?: { sessions: number; scenarios: number; fluency: number } | null;
}

export interface ScenarioChunk {
  id: string;
  label: string;
  function: string;
  chunk: string;
  meaning: string;
  example: string;
  exampleVi: string;
  color: string;
  bg: string;
}

export interface ScenarioTaskResult {
  id: string;
  label: string;
  pass: boolean;
  feedback: string;
}

export interface AiCoachTopic {
  label: string;
  desc: string;
  emoji: string;
  level: string;
}

export interface AiCoachTopicGroup {
  group: string;
  emoji: string;
  topics: AiCoachTopic[];
}

export interface DashboardSkill {
  label: string;
  value: number;
  color: string;
}

export interface DashboardShortcut {
  id: AppPage;
  label: string;
  desc: string;
  emoji: string;
  color: string;
  bg: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface QuickGuide {
  emoji: string;
  title: string;
  steps: string[];
}

export interface LoginFeature {
  emoji: string;
  label: string;
}

export interface AiCoachSkillMetric {
  label: string;
  score: number;
  prev: number;
  color: string;
  desc: string;
}

export interface RecommendedExercise {
  title: string;
  type: string;
  emoji: string;
  mins: number;
}

export interface SummaryMetric {
  val: string;
  label: string;
}
