"""
Level estimator: pure function that combines acoustic/textual features
with an optional LLM signal to estimate a CEFR level.

Design principles:
- Pure function: no DB calls, no side effects, fully unit-testable.
- Thresholds come from Settings (configurable, not hard-coded).
- If data is insufficient (< min_answers or < min_words), returns A1
  with needs_reassessment=True instead of guessing (AGENTS.md §8 rule 1).
- LLM evaluation is a secondary signal weighted at 30%. Feature score is primary (70%).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.core.providers.llm_provider import LlmLevelEvaluation

# CEFR level order for score → level mapping
_LEVELS = ["A1", "A2", "B1", "B2", "C1"]
_LEVEL_INDEX: dict[str, int] = {lv: i for i, lv in enumerate(_LEVELS)}


@dataclass(frozen=True)
class PlacementFeatures:
    """Computed features from a set of placement answers."""

    total_words: int
    avg_words_per_answer: float
    avg_stt_confidence: float
    avg_speaking_duration: float
    avg_response_latency: float
    answer_count: int


@dataclass(frozen=True)
class LevelEstimate:
    """Result of the level estimation algorithm."""

    level: str  # CEFR level: A1–C1
    score: float  # Internal normalized score 0.0–1.0
    needs_reassessment: bool  # True when fallback A1 was used due to insufficient data
    is_insufficient_data: bool  # True when answer/word thresholds were not met
    features: PlacementFeatures


def _count_words(text: str) -> int:
    """Count whitespace-separated word tokens in text."""
    return len(re.findall(r"\S+", text))


def compute_features(
    transcripts: list[str],
    confidences: list[float],
    speaking_durations: list[float],
    response_latencies: list[float],
) -> PlacementFeatures:
    """
    Aggregate per-answer metrics into a single feature vector.

    All lists must have the same length (one entry per answer).
    Missing values (None) should be replaced by 0.0 by the caller.
    """
    n = len(transcripts)
    if n == 0:
        return PlacementFeatures(
            total_words=0,
            avg_words_per_answer=0.0,
            avg_stt_confidence=0.0,
            avg_speaking_duration=0.0,
            avg_response_latency=0.0,
            answer_count=0,
        )

    word_counts = [_count_words(t) for t in transcripts]
    total_words = sum(word_counts)

    return PlacementFeatures(
        total_words=total_words,
        avg_words_per_answer=total_words / n,
        avg_stt_confidence=sum(confidences) / n if confidences else 0.0,
        avg_speaking_duration=sum(speaking_durations) / n if speaking_durations else 0.0,
        avg_response_latency=sum(response_latencies) / n if response_latencies else 0.0,
        answer_count=n,
    )


def _feature_score(features: PlacementFeatures) -> float:
    """
    Compute a normalized [0, 1] score from features.

    Sub-scores:
      - Fluency (avg words/answer):  target 100 words = score 1.0
      - Confidence (STT score):      direct, already 0–1
      - Speed (response latency):    ≤1 s = 1.0, ≥8 s = 0.0 (inverted)
    Weights:
      - Fluency: 50%, Confidence: 30%, Speed: 20%
    """
    fluency = min(features.avg_words_per_answer / 100.0, 1.0)
    confidence = min(features.avg_stt_confidence, 1.0)
    # Lower latency is better; 1 s = 1.0, 8 s = 0.0
    latency = max(0.0, 1.0 - (features.avg_response_latency - 1.0) / 7.0)
    return 0.50 * fluency + 0.30 * confidence + 0.20 * latency


def _score_to_level(
    score: float,
    *,
    a2_threshold: float,
    b1_threshold: float,
    b2_threshold: float,
    c1_threshold: float,
) -> str:
    """Map a [0,1] score to a CEFR level string using configurable thresholds."""
    if score >= c1_threshold:
        return "C1"
    if score >= b2_threshold:
        return "B2"
    if score >= b1_threshold:
        return "B1"
    if score >= a2_threshold:
        return "A2"
    return "A1"


def estimate_level(
    features: PlacementFeatures,
    *,
    llm_eval: LlmLevelEvaluation | None = None,
    min_answers: int = 3,
    min_words: int = 30,
    a2_threshold: float = 0.20,
    b1_threshold: float = 0.40,
    b2_threshold: float = 0.60,
    c1_threshold: float = 0.80,
) -> LevelEstimate:
    """
    Estimate CEFR level from features and optional LLM evaluation.

    If data is insufficient (< min_answers or < min_words):
      - Returns A1 with needs_reassessment=True, is_insufficient_data=True.
      - Does NOT use LLM signal (AGENTS.md §8 rule 1: no guessing).

    Otherwise:
      - Primary score: feature-based (70% weight).
      - Secondary score: LLM suggestion (30% weight), only when provided.
      - Blended score → level via configurable thresholds.
    """
    is_insufficient = (
        features.answer_count < min_answers or features.total_words < min_words
    )

    if is_insufficient:
        return LevelEstimate(
            level="A1",
            score=0.0,
            needs_reassessment=True,
            is_insufficient_data=True,
            features=features,
        )

    feature_score = _feature_score(features)

    if llm_eval is not None:
        llm_level_index = _LEVEL_INDEX.get(llm_eval.suggested_level, 0)
        llm_normalized = llm_level_index / (len(_LEVELS) - 1)
        # Blend: 70% feature heuristic, 30% LLM signal
        blended_score = 0.70 * feature_score + 0.30 * llm_normalized
    else:
        blended_score = feature_score

    level = _score_to_level(
        blended_score,
        a2_threshold=a2_threshold,
        b1_threshold=b1_threshold,
        b2_threshold=b2_threshold,
        c1_threshold=c1_threshold,
    )

    return LevelEstimate(
        level=level,
        score=blended_score,
        needs_reassessment=False,
        is_insufficient_data=False,
        features=features,
    )
