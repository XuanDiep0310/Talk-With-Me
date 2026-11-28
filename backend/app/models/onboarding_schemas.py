"""Pydantic v2 schemas for two-stage onboarding and placement endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

from app.models.pronunciation_schemas import PronunciationAssessResponse
from app.seeds.onboarding_catalog import (
    GOAL_KEYS,
    INTEREST_KEYS,
    WEAK_POINT_KEYS,
)


class _CamelModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
    )


class OptionItemSchema(_CamelModel):
    key: str
    label: str


class ScriptedPlacementPromptSchema(_CamelModel):
    id: str
    target_band: str
    text: str
    translation: str
    ipa: str
    focus_phonemes: list[str] = Field(default_factory=list)


class TieredQuestionSchema(_CamelModel):
    id: str
    tier: int
    tier_label: str
    text: str
    translation: str


class OnboardingOptionsResponse(_CamelModel):
    interests: list[OptionItemSchema]
    goals: list[OptionItemSchema]
    weak_points: list[OptionItemSchema]
    cefr_levels: list[str]
    placement_questions: list[str]
    scripted_prompts: list[ScriptedPlacementPromptSchema] = Field(default_factory=list)
    tiered_questions: list[TieredQuestionSchema] = Field(default_factory=list)


class UpdatePreferencesRequest(_CamelModel):
    interests: list[str] = Field(..., min_length=1)
    goals: list[str] = Field(..., min_length=1)
    weak_points: list[str] = Field(..., min_length=1)

    @model_validator(mode="after")
    def validate_keys(self) -> UpdatePreferencesRequest:
        _check_keys(self.interests, INTEREST_KEYS, "interests")
        _check_keys(self.goals, GOAL_KEYS, "goals")
        _check_keys(self.weak_points, WEAK_POINT_KEYS, "weakPoints")
        return self


class PreferencesResponse(_CamelModel):
    interests: list[str]
    goals: list[str]
    weak_points: list[str]


class PlacementTestResponse(_CamelModel):
    id: uuid.UUID
    user_id: uuid.UUID
    status: str
    current_stage: int = 1
    questions: list[str]
    scripted_prompts: list[ScriptedPlacementPromptSchema] = Field(default_factory=list)
    created_at: datetime
    initial_tier: int = 1
    initial_tier_label: str = "Cơ bản (A1–A2)"
    initial_question: str = (
        "Can you introduce yourself and tell me what you like to do in your free time?"
    )
    initial_question_translation: str = (
        "Bạn có thể giới thiệu bản thân và cho biết bạn thích làm gì vào thời gian rảnh không?"
    )


class SubmitAnswerRequest(_CamelModel):
    request_id: str = Field(..., min_length=1, max_length=36)
    stage: int = Field(default=2, ge=1, le=2)
    prompt_id: str | None = Field(default=None, max_length=30)
    question_index: int = Field(..., ge=0)
    transcript: str | None = Field(default=None, max_length=5000)
    stt_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    accuracy_score: float | None = Field(default=None, ge=0.0, le=100.0)
    fluency_score: float | None = Field(default=None, ge=0.0, le=100.0)
    prosody_score: float | None = Field(default=None, ge=0.0, le=100.0)
    completeness_score: float | None = Field(default=None, ge=0.0, le=100.0)
    speaking_duration_seconds: float | None = Field(default=None, ge=0.0)
    response_latency_seconds: float | None = Field(default=None, ge=0.0)


class AnswerResponse(_CamelModel):
    id: uuid.UUID
    test_id: uuid.UUID
    request_id: str
    stage: int = 2
    prompt_id: str | None = None
    question_index: int
    transcript: str | None
    word_count: int | None
    created_at: datetime
    current_tier: int = 1
    current_tier_label: str = "Cơ bản (A1–A2)"
    next_question: str | None = None
    next_question_index: int | None = None
    next_tier: int | None = None
    next_tier_label: str | None = None
    next_question_translation: str | None = None
    is_converged: bool = False
    can_finish_early: bool = False
    total_answered: int = 1
    current_estimated_level: str = "A1"
    pronunciation: PronunciationAssessResponse | None = None
    next_stage: int = 2
    stage1_completed: bool = False


class PlacementCompleteResponse(_CamelModel):
    test_id: uuid.UUID
    estimated_level: str
    is_insufficient_data: bool
    needs_reassessment: bool
    score: float
    continuous_band: float = 1.0
    dimension_scores: dict[str, float | None] = Field(default_factory=dict)
    limiting_dimensions: list[str] = Field(default_factory=list)
    explanation_vi: str = ""


class SetLevelRequest(_CamelModel):
    level: str = Field(..., description="CEFR level: A1, A2, B1, B2, C1")
    source: str = Field(..., pattern="^(PLACEMENT|SELF|DEFAULT)$")


class LevelResponse(_CamelModel):
    cefr_level: str
    level_source: str
    needs_reassessment: bool


class OnboardingCompleteResponse(_CamelModel):
    onboarding_completed_at: datetime
    cefr_level: str
    level_source: str
    needs_reassessment: bool
    interests: list[str]
    goals: list[str]
    weak_points: list[str]


def _check_keys(values: list[str], valid: frozenset[str], field: str) -> None:
    invalid = [v for v in values if v not in valid]
    if invalid:
        raise ValueError(f"Invalid {field} keys: {invalid}")
