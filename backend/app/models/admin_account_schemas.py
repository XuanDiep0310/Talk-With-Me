import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AwareDatetime, Field, StringConstraints, model_validator

from app.models.admin_scenario_schemas import CefrLevel
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
    next_cursor: str | None


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
    goal_labels: list[str]
    weak_point_labels: list[str]
    skills: list[AdminSkillAverage]
    total_xp: int
    current_streak: int
    best_streak: int
    badges: list[AdminEarnedBadge]
    missions_issued: int
    missions_completed: int


AdjustmentReason = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=3, max_length=255)
]


class AdminLevelAdjustment(BaseScenarioSchema):
    level: CefrLevel
    reason: AdjustmentReason


class AdminXpAdjustment(BaseScenarioSchema):
    request_id: uuid.UUID
    amount: Annotated[int, Field(ge=-100_000, le=100_000)]
    reason: AdjustmentReason

    @model_validator(mode="after")
    def validate_amount(self) -> "AdminXpAdjustment":
        if self.amount == 0:
            raise ValueError("An adjustment must change XP.")
        return self
