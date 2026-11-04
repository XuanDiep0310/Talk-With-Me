export interface DailyMissionItem {
  id: string;
  missionKey: string;
  title: string;
  xp: number;
  conditionType: string;
  status: 'PENDING' | 'COMPLETED' | 'CLAIMED';
  progress: number;
  target: number;
  isClaimed: boolean;
}

export interface SkillSummaryItem {
  key: string;
  label: string;
  score: number | null;
  color: string;
  isReference: boolean;
}

export interface RecentSessionItem {
  id: string;
  type: 'COACH' | 'ROLEPLAY' | 'ROOM';
  topic: string;
  date: string;
  durationSeconds: number;
  durationDisplay: string;
  score: number | null;
}

export interface MotivationalCard {
  title: string;
  message: string;
  targetLevel: string;
  actionText: string;
  actionTarget: string;
}

export interface DashboardResponse {
  greeting: string;
  overallScore: number | null;
  totalXp: number;
  currentStreak: number;
  level: string;
  todayMissions: DailyMissionItem[];
  missionsCompletedCount: number;
  missionsTotalCount: number;
  missionsProgressPct: number;
  skills: SkillSummaryItem[];
  recentSessions: RecentSessionItem[];
  motivationalCard: MotivationalCard;
}

export interface ProgressSummaryResponse {
  overallScore: number | null;
  scoreChange30d: number | null;
  totalSessions: number;
  totalPracticeMinutes: number;
  totalScenariosCompleted: number;
  currentStreak: number;
  totalXp: number;
  currentLevel: string;
}

export interface ProgressSkillItem {
  key: string;
  label: string;
  desc: string;
  current: number | null;
  prev: number | null;
  diff: number | null;
  status: 'Tốt' | 'Đang phát triển' | 'Cần cải thiện';
  color: string;
  isReference: boolean;
}

export interface ProgressSkillsResponse {
  skills: ProgressSkillItem[];
  formulaVersion: string;
}

export interface ProgressHistoryItem {
  id: string;
  type: string;
  topic: string;
  date: string;
  durationDisplay: string;
  score: number | null;
  status: string;
}

export interface ProgressHistoryResponse {
  items: ProgressHistoryItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface LevelAdvancementCondition {
  type: string;
  label: string;
  target: number;
  current: number;
  met: boolean;
  unit: string;
}

export interface LevelAdvancementInfo {
  targetLevel: string | null;
  conditions: LevelAdvancementCondition[];
  allMet: boolean;
}

export interface GamificationSummaryResponse {
  totalXp: number;
  currentLevel: string;
  currentStreak: number;
  bestStreak: number;
  badgesEarnedCount: number;
  badgesTotalCount: number;
  advancement: LevelAdvancementInfo;
}

export interface BadgeItem {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  criteriaType: string;
  target: number;
  earned: boolean;
  awardedAt: string | null;
  progress: number;
}

export interface XpHistoryItem {
  id: string;
  amount: number;
  ruleKey: string;
  sourceType: string;
  sourceId: string;
  createdAt: string;
  sourceDisplay: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}
