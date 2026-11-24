import uuid
from datetime import datetime

from pydantic import AwareDatetime, model_validator

from app.models.auth import UserRole
from app.models.scenario import ScenarioStatus
from app.models.scenario_schemas import BaseScenarioSchema


class AdminAccountSummary(BaseScenarioSchema):
    id: uuid.UUID
    email: str
    full_name: str
    created_at: AwareDatetime
    cefr_level: str | None
    completed_sessions: int
    role: UserRole
    is_active: bool


class AdminAccountPage(BaseScenarioSchema):
    items: list[AdminAccountSummary]
    next_cursor: uuid.UUID | None


class AdminAccountUpdate(BaseScenarioSchema):
    role: UserRole | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def require_change(self) -> "AdminAccountUpdate":
        if self.role is None and self.is_active is None:
            raise ValueError("Provide a role or account status.")
        return self


class AdminOverview(BaseScenarioSchema):
    total_accounts: int
    active_accounts: int
    new_accounts: int
    completed_sessions: int
    recent_sessions: int
    scenario_counts: dict[ScenarioStatus, int]


class AdminPlacement(BaseScenarioSchema):
    id: uuid.UUID
    status: str
    estimated_level: str | None
    is_insufficient_data: bool
    created_at: datetime
    completed_at: datetime | None


class AdminPlacementPage(BaseScenarioSchema):
    items: list[AdminPlacement]
    next_cursor: str | None = None


class AdminSkillAverage(BaseScenarioSchema):
    skill: str
    formula_version: str
    average: float
    sample_count: int
    is_reference: bool


class AdminEarnedBadge(BaseScenarioSchema):
    key: str
    name: str
    icon_emoji: str
    awarded_at: datetime


class AdminAccountDetail(AdminAccountSummary):
    avatar_url: str | None
    timezone: str | None
    login_methods: list[str]
    goals: list[str]
    weak_points: list[str]
    skills: list[AdminSkillAverage]
    total_xp: int
    current_streak: int
    best_streak: int
    badges: list[AdminEarnedBadge]
    missions_issued: int
    missions_completed: int
