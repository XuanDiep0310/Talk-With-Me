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
  key?: string;
  skill?: string;
  label: string;
  score?: number | null;
  value?: number | null;
  color: string;
  isReference?: boolean;
}

export interface RecentSessionItem {
  id: string;
  type: 'COACH' | 'ROLEPLAY';
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
  xp?: number;
  totalXp: number;
  streak?: number;
  currentStreak: number;
  level: string;
  nextLevel?: string | null;
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
  xp?: number;
  totalXp: number;
  level?: string;
  currentLevel: string;
  currentStreak: number;
  bestStreak: number;
  badgesEarned?: number;
  badgesEarnedCount: number;
  badgesTotal?: number;
  badgesTotalCount: number;
  advancement: LevelAdvancementInfo;
}

export interface BadgeItem {
  id?: string;
  key: string;
  name: string;
  description: string;
  icon?: string;
  iconEmoji?: string;
  category?: string;
  criteriaType: string;
  target?: number;
  targetValue?: number;
  total?: number;
  earned: boolean;
  awardedAt?: string | null;
  earnedAt?: string | null;
  progress: number;
}

export interface XpHistoryItem {
  id: string;
  amount: number;
  ruleKey: string;
  sourceType: string;
  sourceId: string;
  createdAt: string;
  description?: string;
  sourceDisplay: string;
  category?: string;
  icon?: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  content?: string;
  message?: string;
  read?: boolean;
  isRead?: boolean;
  createdAt: string;
}

export interface PhonemeTroubleSpotItem {
  ipaPhoneme: string;
  attemptCount: number;
  errorCount: number;
  avgAccuracy: number;
}

export interface CefrSnapshotItem {
  sourceType: string;
  estimatedCefr: string;
  continuousScore: number;
  confidence: string;
  createdAt: string;
}

export interface AdaptiveRecommendationItem {
  kind: 'COACH' | 'SCENARIO';
  targetId: string;
  title: string;
  reasonVi: string;
  level: string;
}

export interface LearnerModelResponse {
  estimatedCefr: string;
  continuousScore: number;
  confidence: string;
  modelVersion: string;
  sessionCount: number;
  scriptedCount: number;
  unscriptedCount: number;
  avgResponseLatencyMs?: number | null;
  scriptedPronunciation?: number | null;
  unscriptedPronunciation?: number | null;
  rawDimensions: Record<string, number | null>;
  calibratedDimensions: Record<string, number | null>;
  limitingDimensions: string[];
  explanationVi: string;
  phonemeTroubleSpots: PhonemeTroubleSpotItem[];
  snapshots: CefrSnapshotItem[];
  recommendations: AdaptiveRecommendationItem[];
}
