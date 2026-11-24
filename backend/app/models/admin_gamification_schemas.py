import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import AwareDatetime, Field, StringConstraints, model_validator

from app.models.admin_scenario_schemas import CefrLevel
from app.models.scenario_schemas import BaseScenarioSchema

Key = Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9_]{0,49}$")]
MissionCondition = Literal["COACH_SESSION", "SCENARIO_LESSON", "STREAK"]
BadgeCondition = Literal[
    "SESSIONS_COUNT",
    "STREAK_DAYS",
    "SCENARIOS_COMPLETED",
    "FLUENCY_SCORE",
    "SPEED_SCORE",
    "CEFR_LEVEL",
]

Amount = Annotated[int, Field(ge=0, le=100_000)]
Target = Annotated[int, Field(ge=1, le=100_000)]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)]


class AdminXpRule(BaseScenarioSchema):
    key: str
    xp_amount: int
    description: str | None
    is_active: bool


class AdminXpRuleUpdate(BaseScenarioSchema):
    xp_amount: Amount | None = None
    description: Description | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_update(self) -> "AdminXpRuleUpdate":
        if any(
            key in self.model_fields_set and getattr(self, key) is None
            for key in ("xp_amount", "is_active")
        ):
            raise ValueError("Amount and status cannot be null.")
        return self


class AdminMission(BaseScenarioSchema):
    key: str
    title: str
    xp_reward: int | None
    condition_type: str
    target_count: int
    is_active: bool


class AdminMissionUpdate(BaseScenarioSchema):
    title: Title | None = None
    xp_reward: Amount | None = None
    target_count: Target | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_update(self) -> "AdminMissionUpdate":
        if any(
            key in self.model_fields_set and getattr(self, key) is None
            for key in ("title", "target_count", "is_active")
        ):
            raise ValueError("Title, target and status cannot be null.")
        return self


class AdminMissionCreate(BaseScenarioSchema):
    key: Key
    title: Title
    xp_reward: Amount | None = None
    condition_type: MissionCondition
    target_count: Target = 1
    is_active: bool = False


class AdminBadgeInput(BaseScenarioSchema):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    description: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)
    ]
    icon_emoji: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10)
    ]
    criteria_type: BadgeCondition
    target_value: Target = 1
    min_level: CefrLevel | None = None
    is_active: bool = False

    @model_validator(mode="after")
    def validate_criteria(self) -> "AdminBadgeInput":
        if self.criteria_type == "CEFR_LEVEL" and (
            self.min_level is None or self.target_value != 1
        ):
            raise ValueError("A CEFR badge needs a minimum level and target 1.")
        if self.criteria_type != "CEFR_LEVEL" and self.min_level is not None:
            raise ValueError("Minimum level is only valid for CEFR badges.")
        if self.criteria_type in {"FLUENCY_SCORE", "SPEED_SCORE"} and self.target_value > 100:
            raise ValueError("Score targets must be at most 100.")
        return self


class AdminBadgeUpdate(BaseScenarioSchema):
    name: str | None = None
    description: str | None = None
    icon_emoji: str | None = None
    criteria_type: BadgeCondition | None = None
    target_value: Target | None = None
    min_level: CefrLevel | None = None
    is_active: bool | None = None


class AdminBadgeCreate(AdminBadgeInput):
    key: Key


class AdminBadge(BaseScenarioSchema):
    key: str
    name: str
    description: str
    icon_emoji: str
    criteria_type: str
    target_value: int
    min_level: str | None = None
    is_active: bool


class AdminXpTransaction(BaseScenarioSchema):
    id: uuid.UUID
    user_id: uuid.UUID
    email: str
    rule_key: str
    amount: int
    source_type: str
    source_id: str
    idempotency_key: str
    description: str | None
    created_at: datetime


class AdminXpPage(BaseScenarioSchema):
    items: list[AdminXpTransaction]
    next_cursor: str | None = None


class AdminXpFilters(BaseScenarioSchema):
    learner: str | None = Field(default=None, max_length=255)
    rule_key: str | None = Field(default=None, max_length=50)
    idempotency_key: str | None = Field(default=None, max_length=150)
    from_date: AwareDatetime | None = None
    to_date: AwareDatetime | None = None
    cursor: str | None = Field(default=None, max_length=512)
    limit: int = Field(default=25, ge=1, le=100)

    @model_validator(mode="after")
    def validate_range(self) -> "AdminXpFilters":
        if self.from_date and self.to_date and self.from_date >= self.to_date:
            raise ValueError("Date range must be increasing.")
        return self
