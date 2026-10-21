"""
Pydantic schemas for post-session scoring, feedback APIs, and structured LLM evaluation.
"""

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


class PostSessionLlmEvaluation(BaseScoringSchema):
    """Structured LLM output for qualitative assessment and comprehension/context scores."""

    response_relevance: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Relevance of user reply to AI question (0-100)",
    )
    task_completion: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Fulfillment of the communicative task (0-100)",
    )
    context_relevance: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Contextual appropriateness of vocabulary (0-100)",
    )
    strengths: list[str] = Field(
        ...,
        min_length=2,
        max_length=3,
        description="2-3 specific communication strengths in Vietnamese",
    )
    improvements: list[str] = Field(
        ...,
        min_length=1,
        max_length=3,
        description="Up to 3 constructive areas for improvement in Vietnamese",
    )
    next_practice: str = Field(
        ...,
        min_length=5,
        description="Actionable next practice recommendation in Vietnamese",
    )


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
    formula_version: str = "1.0.0"
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
