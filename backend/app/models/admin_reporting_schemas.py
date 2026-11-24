import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import AwareDatetime, Field, model_validator

from app.models.scenario_schemas import BaseScenarioSchema

AnalyticsRange = Literal["7d", "30d"]


class AnalyticsDay(BaseScenarioSchema):
    day: date
    coach_sessions: int
    roleplay_sessions: int
    active_learners: int
    is_partial: bool


class AnalyticsMeasurement(BaseScenarioSchema):
    average: float | None
    sample_count: int


class AnalyticsSkill(AnalyticsMeasurement):
    skill: str
    formula_version: str
    is_reference: bool


class AnalyticsScenario(BaseScenarioSchema):
    id: uuid.UUID
    title: str
    attempts: int
    evaluated_attempts: int
    failed_attempts: int
    failure_rate: float | None


class AdminAnalytics(BaseScenarioSchema):
    range: AnalyticsRange
    generated_at: datetime
    timezone: str
    active_today: int
    active_last_seven_days: int
    days: list[AnalyticsDay]
    cefr: dict[str, int]
    speaking_minutes: AnalyticsMeasurement
    stt_confidence: AnalyticsMeasurement
    skills: list[AnalyticsSkill]
    feedback_statuses: dict[str, int]
    popular_scenarios: list[AnalyticsScenario]
    difficult_scenarios: list[AnalyticsScenario]


class AdminAuditFilters(BaseScenarioSchema):
    from_date: AwareDatetime | None = None
    to_date: AwareDatetime | None = None
    action: str | None = Field(default=None, max_length=50)
    target_type: str | None = Field(default=None, max_length=40)
    trace_id: str | None = Field(default=None, max_length=255)
    cursor: str | None = Field(default=None, max_length=512)
    limit: int = Field(default=25, ge=1, le=100)

    @model_validator(mode="after")
    def validate_range(self) -> "AdminAuditFilters":
        if self.from_date and self.to_date and self.from_date >= self.to_date:
            raise ValueError("Date range must be increasing.")
        return self


class AdminAuditItem(BaseScenarioSchema):
    id: uuid.UUID
    source: str
    actor_id: uuid.UUID | None
    actor_email: str | None
    target_type: str
    target_id: str
    action: str
    before: dict[str, object] | None
    after: dict[str, object] | None
    occurred_at: datetime
    trace_id: str


class AdminAuditPage(BaseScenarioSchema):
    items: list[AdminAuditItem]
    next_cursor: str | None = None
