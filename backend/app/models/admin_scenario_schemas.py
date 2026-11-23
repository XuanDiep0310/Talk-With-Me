"""HTTP schemas for editing and publishing scenarios."""

import uuid
from datetime import UTC, datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, Field, StringConstraints, field_validator

from app.models.scenario import ScenarioStatus
from app.models.scenario_schemas import BaseScenarioSchema

ScenarioCategory = Annotated[
    str, StringConstraints(pattern=r"^[A-Z0-9]+(?:_[A-Z0-9]+)*$", max_length=50)
]
CefrLevel = Literal["A1", "A2", "B1", "B2", "C1"]
ChunkFunction = Literal["OPENING", "REQUEST", "CLARIFY", "AGREE_DECLINE", "CLOSING"]


def reject_uuid_slug(value: str) -> str:
    try:
        uuid.UUID(value)
    except ValueError:
        return value
    raise ValueError("A slug cannot be a UUID.")


Slug = Annotated[
    str,
    StringConstraints(max_length=100, pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$"),
    AfterValidator(reject_uuid_slug),
]
SearchText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)]
ContentText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)]
Revision = Annotated[int, Field(ge=1)]


class AdminChunkInput(BaseScenarioSchema):
    function_tag: ChunkFunction
    text: ContentText = ""
    meaning_vi: ContentText = ""
    example_sentence: ContentText = ""
    audio_url: str | None = Field(default=None, max_length=500)
    accepted_variations: list[ContentText] = Field(default_factory=list, max_length=20)
    distractors_en: list[ContentText] = Field(default_factory=list, max_length=3)
    distractors_vi: list[ContentText] = Field(default_factory=list, max_length=3)


class AdminRequirementInput(BaseScenarioSchema):
    description: ContentText = ""
    type: Literal["TASK"] = "TASK"
    expected_chunk_function: ChunkFunction | None = None
    is_mandatory: bool = True


class AdminScenarioInput(BaseScenarioSchema):
    slug: Slug
    category: ScenarioCategory = "DAILY_LIFE"
    level: CefrLevel = "A1"
    title_vi: SearchText = ""
    title_en: SearchText = ""
    context: ContentText = ""
    user_role: SearchText = ""
    ai_role: SearchText = ""
    goals: list[ContentText] = Field(default_factory=list, max_length=20)
    estimated_duration_minutes: int = Field(default=10, gt=0, le=2_147_483_647)
    sort_order: int = Field(default=0, ge=0, le=2_147_483_647)
    chunks: list[AdminChunkInput] = Field(default_factory=list, max_length=6)
    requirements: list[AdminRequirementInput] = Field(default_factory=list, max_length=20)


class AdminScenarioUpdate(AdminScenarioInput):
    revision: Revision


class AdminScenarioDuplicate(BaseScenarioSchema):
    slug: Slug


class AdminScenarioStatusUpdate(BaseScenarioSchema):
    status: Literal["PUBLISHED", "ARCHIVED"]
    revision: Revision


class AdminScenarioSummary(BaseScenarioSchema):
    id: uuid.UUID
    slug: str
    title_vi: str
    title_en: str
    category: ScenarioCategory
    level: CefrLevel
    status: ScenarioStatus
    revision: int
    updated_at: datetime

    @field_validator("updated_at")
    @classmethod
    def use_utc_timestamp(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


class AdminChunkDetail(AdminChunkInput):
    id: uuid.UUID


class AdminRequirementDetail(AdminRequirementInput):
    id: uuid.UUID


class AdminScenarioDetail(AdminScenarioSummary):
    context: str
    user_role: str
    ai_role: str
    goals: list[str]
    estimated_duration_minutes: int
    sort_order: int
    chunks: list[AdminChunkDetail]
    requirements: list[AdminRequirementDetail]


class AdminScenarioPage(BaseScenarioSchema):
    items: list[AdminScenarioSummary]
    next_cursor: uuid.UUID | None
    counts: dict[ScenarioStatus, int]


class CategoryName(BaseScenarioSchema):
    name_vi: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class CategoryCreate(CategoryName):
    code: ScenarioCategory


class CategoryDetail(CategoryCreate):
    lesson_count: int


class AdminScenarioError(BaseScenarioSchema):
    code: str
    message: str
    trace_id: str
    details: dict[str, object]
