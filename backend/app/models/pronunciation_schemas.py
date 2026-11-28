"""Pydantic schemas for syllable/phoneme pronunciation assessment."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class _CamelSchema(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SyllableScoreSchema(_CamelSchema):
    text: str
    accuracy_score: float
    status: str  # good | fair | poor


class PhonemeScoreSchema(_CamelSchema):
    ipa: str
    accuracy_score: float
    heard_as: str | None = None


class WordPronunciationSchema(_CamelSchema):
    word: str
    accuracy_score: float
    error_type: str
    ipa: str
    status: str  # good | fair | poor
    syllables: list[SyllableScoreSchema] = Field(default_factory=list)
    phonemes: list[PhonemeScoreSchema] = Field(default_factory=list)


class PronunciationAssessResponse(_CamelSchema):
    transcript: str
    reference_text: str
    mode: str
    provider: str
    display_score: float | None = None
    accuracy_score: float | None = None
    fluency_score: float | None = None
    prosody_score: float | None = None
    completeness_score: float | None = None
    ipa: str
    words: list[WordPronunciationSchema] = Field(default_factory=list)
    coaching_tip_vi: str
    passed: bool = False


class IpaResponse(_CamelSchema):
    text: str
    ipa: str
