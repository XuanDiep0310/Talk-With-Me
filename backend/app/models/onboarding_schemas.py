"""
Pydantic v2 schemas for onboarding endpoints.

All public-facing schemas use camelCase (via alias_generator) per API convention.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

from app.seeds.onboarding_catalog import (
    GOAL_KEYS,
    INTEREST_KEYS,
    WEAK_POINT_KEYS,
)


class _CamelModel(BaseModel):
    """Base schema with camelCase aliases and populate-by-name support."""

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
    )


# ---------------------------------------------------------------------------
# Onboarding options
# ---------------------------------------------------------------------------


class OptionItemSchema(_CamelModel):
    key: str
    label: str


class OnboardingOptionsResponse(_CamelModel):
    interests: list[OptionItemSchema]
    goals: list[OptionItemSchema]
    weak_points: list[OptionItemSchema]
    cefr_levels: list[str]
    placement_questions: list[str]


# ---------------------------------------------------------------------------
# Preferences
# ---------------------------------------------------------------------------


class UpdatePreferencesRequest(_CamelModel):
    interests: list[str] = Field(..., min_length=1)
    goals: list[str] = Field(..., min_length=1)
    weak_points: list[str] = Field(..., min_length=1)

    @model_validator(mode="after")
    def validate_keys(self) -> "UpdatePreferencesRequest":
        _check_keys(self.interests, INTEREST_KEYS, "interests")
        _check_keys(self.goals, GOAL_KEYS, "goals")
        _check_keys(self.weak_points, WEAK_POINT_KEYS, "weakPoints")
        return self


class PreferencesResponse(_CamelModel):
    interests: list[str]
    goals: list[str]
    weak_points: list[str]


# ---------------------------------------------------------------------------
# Placement Test
# ---------------------------------------------------------------------------


class PlacementTestResponse(_CamelModel):
    id: uuid.UUID
    user_id: uuid.UUID
    status: str
    questions: list[str]
    created_at: datetime


class SubmitAnswerRequest(_CamelModel):
    request_id: str = Field(
        ..., min_length=1, max_length=36, description="Client-generated UUID for idempotency"
    )
    question_index: int = Field(..., ge=0)
    transcript: str | None = Field(default=None, max_length=5000)
    stt_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    speaking_duration_seconds: float | None = Field(default=None, ge=0.0)
    response_latency_seconds: float | None = Field(default=None, ge=0.0)


class AnswerResponse(_CamelModel):
    id: uuid.UUID
    test_id: uuid.UUID
    request_id: str
    question_index: int
    transcript: str | None
    word_count: int | None
    created_at: datetime


class PlacementCompleteResponse(_CamelModel):
    test_id: uuid.UUID
    estimated_level: str
    is_insufficient_data: bool
    needs_reassessment: bool
    # Score is internal; exposed for transparency but labeled as reference
    score: float


# ---------------------------------------------------------------------------
# Level assignment
# ---------------------------------------------------------------------------


class SetLevelRequest(_CamelModel):
    level: str = Field(..., description="CEFR level: A1, A2, B1, B2, C1")
    source: str = Field(
        ...,
        description="How level was determined: PLACEMENT | SELF | DEFAULT",
        pattern="^(PLACEMENT|SELF|DEFAULT)$",
    )


class LevelResponse(_CamelModel):
    cefr_level: str
    level_source: str
    needs_reassessment: bool


# ---------------------------------------------------------------------------
# Onboarding completion
# ---------------------------------------------------------------------------


class OnboardingCompleteResponse(_CamelModel):
    onboarding_completed_at: datetime
    cefr_level: str
    level_source: str
    needs_reassessment: bool
    interests: list[str]
    goals: list[str]
    weak_points: list[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _check_keys(values: list[str], valid: frozenset[str], field: str) -> None:

    invalid = [v for v in values if v not in valid]
    if invalid:
        raise ValueError(f"Invalid {field} keys: {invalid}")
