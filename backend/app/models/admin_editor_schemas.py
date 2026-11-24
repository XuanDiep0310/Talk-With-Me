from typing import Annotated

from pydantic import Field, StringConstraints

from app.models.admin_scenario_schemas import CefrLevel, ScenarioCategory
from app.models.scenario_schemas import BaseScenarioSchema

EditorText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
OptionList = Annotated[list[EditorText], Field(min_length=3, max_length=3)]


class GenerateScenarioRequest(BaseScenarioSchema):
    topic: EditorText
    category: ScenarioCategory = "DAILY_LIFE"
    level: CefrLevel
    chunk_count: int = Field(default=5, ge=4, le=6)


class GenerateDistractorsRequest(BaseScenarioSchema):
    text: EditorText
    meaning_vi: EditorText | None = None
    level: CefrLevel


class GenerateDistractorsResponse(BaseScenarioSchema):
    meaning_vi: EditorText
    distractors_en: OptionList
    distractors_vi: OptionList
