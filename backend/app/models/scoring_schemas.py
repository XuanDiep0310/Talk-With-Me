"""Pydantic schemas for post-session scoring v2.0.0 and structured Gemini evaluation."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class BaseScoringSchema(BaseModel):
    """Base schema configured with camelCase aliasing for frontend API compliance."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class GrammarErrorItem(BaseScoringSchema):
    """Representative grammar correction surfaced after session completion."""

    original: str
    correction: str
    explanation_vi: str
    severity: str = "moderate"  # minor | moderate | major


class PostSessionLlmEvaluation(BaseScoringSchema):
    """Structured Gemini output for semantic assessment (Vocabulary, Grammar, Interaction & Coherence)."""

    vocabulary_score: float = Field(..., ge=0.0, le=100.0)
    vocabulary_cefr_band: str = Field(default="B1", pattern="^(A1|A2|B1|B2|C1)$")
    grammar_score: float = Field(..., ge=0.0, le=100.0)
    grammar_cefr_band: str = Field(default="B1", pattern="^(A1|A2|B1|B2|C1)$")
    grammar_errors: list[GrammarErrorItem] = Field(default_factory=list, max_length=3)
    interaction_score: float = Field(..., ge=0.0, le=100.0)
    coherence_score: float = Field(..., ge=0.0, le=100.0)
    strengths: list[str] = Field(..., min_length=2, max_length=3)
    improvements: list[str] = Field(..., min_length=1, max_length=3)
    next_practice: str = Field(..., min_length=5)


class SkillScoreResponse(BaseScoringSchema):
    """Detailed score report for an individual communication skill."""

    skill_name: str
    label: str
    score: float | None = None
    is_reference: bool = False
    na_reason: str | None = None
    components: dict[str, Any] = Field(default_factory=dict)


class SessionFeedbackResponse(BaseScoringSchema):
    """Post-session feedback report response schema."""

    session_id: uuid.UUID
    status: str  # PENDING | FEEDBACK_READY | INSUFFICIENT_DATA | FAILED
    formula_version: str = "2.0.0"
    overall_score: float | None = None
    partial: bool = False
    retryable: bool = False
    error_message: str | None = None
    skills: list[SkillScoreResponse] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    next_practice: str | None = None
    generated_at: datetime | None = None


class RetryFeedbackResponse(BaseScoringSchema):
    """Response returned when retrying post-session feedback generation."""

    session_id: uuid.UUID
    status: str = "PENDING"
    message: str = "Feedback calculation initiated."
