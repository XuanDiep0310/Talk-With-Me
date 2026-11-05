"""
Pydantic schemas for Scenario Lessons, Chunks, Reflex Drills, Roleplays, and Evaluations.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class BaseScenarioSchema(BaseModel):
    """Base schema configured with camelCase aliasing for frontend API compliance."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class ScenarioChunkSchema(BaseScenarioSchema):
    id: uuid.UUID
    scenario_id: uuid.UUID | None = None
    function_tag: str
    text: str
    meaning_vi: str
    audio_url: str | None = None
    example_sentence: str
    accepted_variations: list[str] = Field(default_factory=list)
    # MCQ distractors for chunk drill phases
    distractors_en: list[str] = Field(default_factory=list)
    distractors_vi: list[str] = Field(default_factory=list)
    sort_order: int


class ScenarioRequirementSchema(BaseScenarioSchema):
    id: uuid.UUID
    description: str
    type: str = "TASK"
    expected_chunk_function: str | None = None
    is_mandatory: bool = True
    sort_order: int


class ScenarioSummarySchema(BaseScenarioSchema):
    id: uuid.UUID
    slug: str
    category: str
    title_vi: str
    title_en: str
    level: str
    estimated_duration_minutes: int
    user_role: str
    ai_role: str
    goals: list[str] = Field(default_factory=list)
    sort_order: int
    status: str = "NOT_STARTED"
    highest_score: float | None = None
    xp_reward: int = 100
    chunks_count: int = 0


class ScenarioCategorySummary(BaseScenarioSchema):
    category: str
    name_vi: str
    total_count: int
    completed_count: int


class ScenarioLibraryResponse(BaseScenarioSchema):
    scenarios: list[ScenarioSummarySchema]
    total_count: int
    completed_count: int
    total_progress_pct: int
    categories: list[ScenarioCategorySummary]
    xp_reward: int = 100


class ScenarioDetailResponse(BaseScenarioSchema):
    id: uuid.UUID
    slug: str
    category: str
    title_vi: str
    title_en: str
    level: str
    estimated_duration_minutes: int
    context: str
    user_role: str
    ai_role: str
    goals: list[str] = Field(default_factory=list)
    sort_order: int
    status: str = "NOT_STARTED"
    highest_score: float | None = None
    xp_reward: int = 100
    requirements: list[ScenarioRequirementSchema] = Field(default_factory=list)
    chunks: list[ScenarioChunkSchema] = Field(default_factory=list)
    practiced_chunks: list[str] = Field(default_factory=list)


class ScenarioChunksResponse(BaseScenarioSchema):
    scenario_id: uuid.UUID
    scenario_title: str
    chunks: list[ScenarioChunkSchema]


class RecordDrillRequest(BaseScenarioSchema):
    chunk_id: uuid.UUID
    is_skipped: bool = False


class RecordDrillResponse(BaseScenarioSchema):
    attempt_id: uuid.UUID
    chunk_id: uuid.UUID
    scenario_id: uuid.UUID
    is_skipped: bool
    practiced_chunks: list[str]
    message: str


class CreateRoleplayRequest(BaseScenarioSchema):
    pass


class RoleplaySessionResponse(BaseScenarioSchema):
    session_id: uuid.UUID
    scenario_id: uuid.UUID
    scenario_title: str
    status: str
    user_role: str
    ai_role: str
    context: str
    opening_message: str
    chunks: list[ScenarioChunkSchema] = Field(default_factory=list)


class RequirementEvaluationItem(BaseScenarioSchema):
    requirement_id: uuid.UUID | str
    description: str
    is_mandatory: bool
    status: str  # PASS | FAIL
    evidence: str
    reason: str


class ChunkUsedWellItem(BaseScenarioSchema):
    chunk_id: uuid.UUID | str
    text: str
    function_tag: str
    matched_utterance: str | None = None
    match_type: str


class ChunkToImproveItem(BaseScenarioSchema):
    chunk_id: uuid.UUID | str
    text: str
    function_tag: str
    meaning_vi: str | None = None
    reason: str


class RoleplayEvaluationResponse(BaseScenarioSchema):
    session_id: uuid.UUID
    scenario_id: uuid.UUID
    scenario_title: str
    status: str  # PENDING | COMPLETED | INSUFFICIENT_DATA | FAILED
    passed: bool
    overall_score: float | None = None
    requirements: list[RequirementEvaluationItem] = Field(default_factory=list)
    chunks_used_well: list[ChunkUsedWellItem] = Field(default_factory=list)
    chunks_to_improve: list[ChunkToImproveItem] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    next_practice: str | None = None
    evaluated_at: datetime | None = None


class ChunkBankItemSchema(BaseScenarioSchema):
    chunk_id: uuid.UUID
    scenario_id: uuid.UUID
    scenario_title: str
    function_tag: str
    text: str
    meaning_vi: str
    example_sentence: str
    status: str  # NEEDS_PRACTICE | MASTERED
    last_reviewed_at: datetime | None = None


class ChunkBankResponse(BaseScenarioSchema):
    total_count: int
    needs_practice_count: int
    mastered_count: int
    items: list[ChunkBankItemSchema]
