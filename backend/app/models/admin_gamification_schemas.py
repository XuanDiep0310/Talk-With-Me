import uuid
from datetime import datetime
from typing import Annotated

from pydantic import Field, StringConstraints, model_validator

from app.models.scenario_schemas import BaseScenarioSchema

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


class AdminBadge(BaseScenarioSchema):
    key: str
    name: str
    description: str
    icon_emoji: str
    criteria_type: str
    target_value: int


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
    from_date: datetime | None = None
    to_date: datetime | None = None
    cursor: str | None = Field(default=None, max_length=512)
    limit: int = Field(default=25, ge=1, le=100)
