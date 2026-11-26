import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import AwareDatetime, Field, StringConstraints, model_validator

from app.models.scenario_schemas import BaseScenarioSchema
from app.models.scoring_schemas import SessionFeedbackResponse
from app.services.session_state_machine import SessionState

QaLabel = Literal["STT", "AI_RESPONSE", "SCORING", "UNUSUAL_SCORE"]


class AdminSessionFilters(BaseScenarioSchema):
    type: Literal["COACH", "ROLEPLAY"] | None = None
    status: SessionState | None = None
    user_id: uuid.UUID | None = None
    from_date: AwareDatetime | None = None
    to_date: AwareDatetime | None = None
    min_score: float | None = Field(default=None, ge=0, le=100)
    max_score: float | None = Field(default=None, ge=0, le=100)
    q: str | None = Field(default=None, max_length=255)
    label: QaLabel | None = None
    cursor: str | None = Field(default=None, max_length=512)
    limit: int = Field(default=25, ge=1, le=100)

    @model_validator(mode="after")
    def validate_ranges(self) -> "AdminSessionFilters":
        if self.from_date and self.to_date and self.from_date >= self.to_date:
            raise ValueError("Date range must be increasing.")
        if (
            self.min_score is not None
            and self.max_score is not None
            and self.min_score > self.max_score
        ):
            raise ValueError("Score range must be increasing.")
        return self


class AdminSessionSummary(BaseScenarioSchema):
    id: uuid.UUID
    user_id: uuid.UUID
    email: str
    learner_name: str
    title: str | None
    type: str
    status: str
    created_at: datetime
    started_at: datetime | None
    ended_at: datetime | None
    duration_seconds: float
    overall_score: float | None
    feedback_status: str | None
    qa_labels: list[QaLabel]


class AdminSessionPage(BaseScenarioSchema):
    items: list[AdminSessionSummary]
    next_cursor: str | None = None


class AdminQaLabels(BaseScenarioSchema):
    labels: list[QaLabel] = Field(max_length=4)


class AdminRoleplayRequirement(BaseScenarioSchema):
    requirement_id: str
    description: str
    is_mandatory: bool
    status: str


class AdminRoleplayResult(BaseScenarioSchema):
    status: str
    passed: bool | None
    requirements: list[AdminRoleplayRequirement]


class AdminQaNote(BaseScenarioSchema):
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)] | None


class AdminScorePreviewRequest(BaseScenarioSchema):
    request_id: uuid.UUID


class AdminSessionDetail(AdminSessionSummary):
    spoken_seconds: float | None
    turn_count: int
    end_reason: str | None
    feedback: SessionFeedbackResponse | None
    roleplay: AdminRoleplayResult | None
    qa_note: str | None
    qa_preview: SessionFeedbackResponse | None


class AdminTranscriptItem(BaseScenarioSchema):
    pk: uuid.UUID
    id: str
    seq: int
    speaker: str
    text: str
    source: str
    start_ms: int | None = None
    end_ms: int | None = None
    confidence: float | None = None
    speech_ms: int | None = None
    long_pause_count: int | None = None
    long_pause_ms: int | None = None
    word_count: int | None = None
    filler_count: int | None = None
    response_latency_ms: int | None = None


class AdminTranscriptPage(BaseScenarioSchema):
    items: list[AdminTranscriptItem]
    next_cursor: uuid.UUID | None = None
