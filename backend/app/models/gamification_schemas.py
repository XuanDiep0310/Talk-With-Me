"""
Pydantic schemas for Gamification, Daily Missions, Badges, Progress, and Dashboard.
All schemas use camelCase aliases at the API boundary (AGENTS.md §7).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, computed_field
from pydantic.alias_generators import to_camel


class BaseSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# --- XP & Transactions ---


class XpRuleResponse(BaseSchema):
    key: str
    xp_amount: int
    is_active: bool
    description: str | None = None


class XpTransactionResponse(BaseSchema):
    id: uuid.UUID
    amount: int
    rule_key: str
    source_type: str
    source_id: str
    idempotency_key: str
    description: str | None = None
    source_display: str | None = None
    category: str = "Học tập"
    icon: str = "⭐"
    created_at: datetime


class XpHistoryResponse(BaseSchema):
    transactions: list[XpTransactionResponse]
    total_xp: int


# --- Daily Missions ---


class DailyMissionItem(BaseSchema):
    id: uuid.UUID
    mission_key: str
    title: str
    xp_reward: int
    condition_type: str
    progress: int
    target: int
    status: str  # IN_PROGRESS | COMPLETED | CLAIMED
    done: bool = False
    completed_at: datetime | None = None
    claimed_at: datetime | None = None
    icon: str = "🎯"


class DailyMissionsTodayResponse(BaseSchema):
    date: date
    missions: list[DailyMissionItem]
    completed_count: int
    total_count: int
    progress_pct: int


class ClaimMissionResponse(BaseSchema):
    mission_id: uuid.UUID
    claimed: bool
    xp_awarded: int
    new_total_xp: int


# --- Badges ---


class BadgeItem(BaseSchema):
    key: str
    name: str
    description: str
    icon_emoji: str
    category: str
    criteria_type: str
    target_value: int
    sort_order: int
    earned: bool = False
    earned_at: datetime | None = None
    progress: int = 0
    total: int = 1

    @computed_field  # type: ignore[prop-decorator]
    @property
    def id(self) -> str:
        return self.key

    @computed_field  # type: ignore[prop-decorator]
    @property
    def icon(self) -> str:
        return self.icon_emoji

    @computed_field  # type: ignore[prop-decorator]
    @property
    def target(self) -> int:
        return self.target_value

    @computed_field  # type: ignore[prop-decorator]
    @property
    def awarded_at(self) -> datetime | None:
        return self.earned_at


class BadgesListResponse(BaseSchema):
    badges: list[BadgeItem]
    earned_count: int
    total_count: int


# --- Notifications ---


class NotificationItem(BaseSchema):
    id: uuid.UUID
    type: str
    title: str
    content: str
    is_read: bool
    created_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def read(self) -> bool:
        return self.is_read

    @computed_field  # type: ignore[prop-decorator]
    @property
    def message(self) -> str:
        return self.content


class NotificationsListResponse(BaseSchema):
    notifications: list[NotificationItem]
    unread_count: int


# --- Level & Gamification Summary (D-02) ---


class LevelConditionProgress(BaseSchema):
    name: str
    description: str
    current_value: float | int
    required_value: float | int
    unit: str
    is_met: bool


class LevelAdvancementCondition(BaseSchema):
    type: str = "condition"
    label: str
    target: float | int
    current: float | int
    met: bool
    unit: str


class LevelAdvancementInfo(BaseSchema):
    target_level: str | None = None
    conditions: list[LevelAdvancementCondition] = []
    all_met: bool = False


class GamificationSummaryResponse(BaseSchema):
    xp: int
    total_xp: int = 0
    level: str
    current_level: str = "A1"
    next_level: str | None = None
    current_streak: int = 0
    best_streak: int = 0
    badges_earned: int = 0
    badges_earned_count: int = 0
    badges_total: int = 6
    badges_total_count: int = 6
    level_conditions: list[LevelConditionProgress] = []
    level_progress_pct: int = 0
    is_ready_for_promotion: bool = False
    advancement: LevelAdvancementInfo | None = None


# --- Progress & Skills ---


class SkillDetailItem(BaseSchema):
    skill: str
    label: str
    current: float | None = None
    prev: float | None = None
    change: float | None = None
    status_label: str
    color: str
    description: str


class ProgressSkillsResponse(BaseSchema):
    skills: list[SkillDetailItem]


class ProgressSummaryResponse(BaseSchema):
    overall_score: float | None
    change_30_days: float | None
    total_xp: int
    current_streak: int
    level: str
    completed_sessions: int
    completed_scenarios: int


class SessionHistoryItem(BaseSchema):
    id: uuid.UUID
    type: str
    topic: str
    date: str
    duration: str
    score: float | None
    emoji: str


class ProgressHistoryResponse(BaseSchema):
    items: list[SessionHistoryItem]
    next_cursor: str | None = None
    has_more: bool = False


# --- Dashboard ---


class MotivationalCard(BaseSchema):
    title: str
    message: str
    target_level: str | None = None
    remaining_sessions: int | None = None
    score_gap: float | None = None


class DashboardSkillOverview(BaseSchema):
    skill: str
    key: str = ""
    label: str
    value: int | float | None = None
    score: int | float | None = None
    color: str
    is_reference: bool = False


class DashboardRecentSession(BaseSchema):
    id: uuid.UUID
    type: str  # ai-coach | scenario | community
    topic: str
    date: str
    duration: str
    score: int | float


class DashboardResponse(BaseSchema):
    greeting: str
    display_name: str
    overall_score: int | float
    xp: int
    total_xp: int = 0
    streak: int
    current_streak: int = 0
    level: str
    next_level: str | None
    today_missions: list[DailyMissionItem]
    missions_progress_pct: int
    skills: list[DashboardSkillOverview]
    recent_sessions: list[DashboardRecentSession]
    motivational_card: MotivationalCard
