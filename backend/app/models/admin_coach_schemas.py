import uuid
from typing import Annotated, Literal

from pydantic import Field, StringConstraints, model_validator

from app.models.admin_scenario_schemas import CefrLevel
from app.models.scenario_schemas import BaseScenarioSchema

Category = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
Description = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)
]
Skill = Literal[
    "Fluency", "Vocabulary", "Response Speed", "Grammar", "Accuracy", "Listening", "Pronunciation"
]
Skills = Annotated[list[Skill], Field(max_length=7)]
SortOrder = Annotated[int, Field(ge=0, le=2_147_483_647)]


class CoachTopicDraft(BaseScenarioSchema):
    category: Category
    title: Title
    description: Description
    min_level: CefrLevel
    target_skills: Skills = Field(default_factory=list)


class AdminCoachTopicInput(CoachTopicDraft):
    is_active: bool = False
    sort_order: SortOrder = 0


class AdminCoachTopicUpdate(BaseScenarioSchema):
    category: Category | None = None
    title: Title | None = None
    description: Description | None = None
    min_level: CefrLevel | None = None
    target_skills: Skills | None = None
    is_active: bool | None = None
    sort_order: SortOrder | None = None

    @model_validator(mode="after")
    def reject_explicit_nulls(self) -> "AdminCoachTopicUpdate":
        if any(getattr(self, key) is None for key in self.model_fields_set):
            raise ValueError("Topic fields cannot be null.")
        return self


class AdminCoachTopic(AdminCoachTopicInput):
    id: uuid.UUID


class GenerateCoachTopic(BaseScenarioSchema):
    idea: Description


class AdminTopicMove(BaseScenarioSchema):
    direction: Literal["up", "down"]
