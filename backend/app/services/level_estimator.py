"""Two-stage Placement Level Estimator (Scripted Pronunciation + Unscripted Communication).

Pure deterministic functions combining Stage 1 (Scripted acoustic intelligibility) and
Stage 2 (Unscripted acoustic fluency + Gemini semantic rubric + response speed) through
the calibrated CEFR Estimation Model.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from app.services.cefr_estimator import CefrEstimation, estimate_cefr_from_vector
from app.services.scoring.metrics import (
    clean_and_tokenize,
    compute_response_speed,
    compute_vocabulary_diversity,
)

if TYPE_CHECKING:
    from app.core.providers.llm_provider import LlmLevelEvaluation


@dataclass(frozen=True)
class PlacementFeatures:
    """Aggregated Stage 1 + Stage 2 features for placement estimation."""

    total_words: int
    avg_words_per_answer: float
    avg_stt_confidence: float
    avg_speaking_duration: float
    avg_response_latency: float
    answer_count: int
    stage1_count: int = 0
    stage1_accuracy: float | None = None
    stage1_prosody: float | None = None
    stage1_fluency: float | None = None
    stage2_accuracy: float | None = None
    stage2_fluency: float | None = None
    stage2_prosody: float | None = None
    mtld_diversity: float | None = None


@dataclass(frozen=True)
class LevelEstimate:
    """Final two-stage placement level estimate."""

    level: str
    score: float  # Normalized [0, 1] representation of continuous CEFR band
    continuous_band: float
    needs_reassessment: bool
    is_insufficient_data: bool
    features: PlacementFeatures
    dimension_scores: dict[str, float | None] = field(default_factory=dict)
    cefr_estimation: CefrEstimation | None = None


def _count_words(text: str) -> int:
    return len(re.findall(r"\S+", text))


def compute_features(
    transcripts: list[str],
    confidences: list[float],
    speaking_durations: list[float],
    response_latencies: list[float],
    *,
    stage1_accuracies: list[float] | None = None,
    stage1_prosodies: list[float] | None = None,
    stage1_fluencies: list[float] | None = None,
    stage2_accuracies: list[float] | None = None,
    stage2_fluencies: list[float] | None = None,
    stage2_prosodies: list[float] | None = None,
) -> PlacementFeatures:
    """Aggregate Stage 2 transcripts/latencies plus optional Stage 1 & 2 Azure acoustics."""
    n = len(transcripts)
    word_counts = [_count_words(t) for t in transcripts]
    total_words = sum(word_counts)
    tokens = clean_and_tokenize(" ".join(transcripts))
    diversity, _, _ = compute_vocabulary_diversity(tokens, min_words=10)

    def _avg(vals: list[float] | None) -> float | None:
        if not vals:
            return None
        return round(sum(vals) / len(vals), 1)

    return PlacementFeatures(
        total_words=total_words,
        avg_words_per_answer=round(total_words / n, 2) if n else 0.0,
        avg_stt_confidence=round(sum(confidences) / n, 3) if n and confidences else 0.0,
        avg_speaking_duration=round(sum(speaking_durations) / n, 2)
        if n and speaking_durations
        else 0.0,
        avg_response_latency=round(sum(response_latencies) / n, 2)
        if n and response_latencies
        else 0.0,
        answer_count=n,
        stage1_count=len(stage1_accuracies or []),
        stage1_accuracy=_avg(stage1_accuracies),
        stage1_prosody=_avg(stage1_prosodies),
        stage1_fluency=_avg(stage1_fluencies),
        stage2_accuracy=_avg(stage2_accuracies),
        stage2_fluency=_avg(stage2_fluencies),
        stage2_prosody=_avg(stage2_prosodies),
        mtld_diversity=diversity,
    )


def estimate_level(
    features: PlacementFeatures,
    *,
    llm_eval: LlmLevelEvaluation | None = None,
    min_answers: int = 2,
    min_words: int = 25,
) -> LevelEstimate:
    """Estimate initial CEFR level fusing Stage 1 Scripted + Stage 2 Unscripted data."""
    is_insufficient = features.answer_count < min_answers or features.total_words < min_words
    if is_insufficient:
        return LevelEstimate(
            level="A1",
            score=0.0,
            continuous_band=1.0,
            needs_reassessment=True,
            is_insufficient_data=True,
            features=features,
            dimension_scores={},
            cefr_estimation=None,
        )

    # 1. Pronunciation from Accuracy + Prosody (Unscripted 65% + Scripted 35%, never PronScore)
    def _pron(acc: float | None, pro: float | None) -> float | None:
        if acc is None:
            return None
        return round(0.70 * acc + 0.30 * pro, 1) if pro is not None else round(acc, 1)

    p1 = _pron(features.stage1_accuracy, features.stage1_prosody)
    p2 = _pron(features.stage2_accuracy, features.stage2_prosody)
    if p1 is not None and p2 is not None:
        pron_score: float | None = round(0.35 * p1 + 0.65 * p2, 1)
    else:
        pron_score = p2 if p2 is not None else p1

    # 2. Fluency from Stage 2 unscripted Fluency (with Stage 1 anchor if needed)
    if features.stage2_fluency is not None and features.stage1_fluency is not None:
        fluency_score: float | None = round(
            0.75 * features.stage2_fluency + 0.25 * features.stage1_fluency, 1
        )
    elif features.stage2_fluency is not None:
        fluency_score = features.stage2_fluency
    elif features.stage1_fluency is not None:
        fluency_score = features.stage1_fluency
    else:
        # Utterance richness proxy only when acoustic fluency unavailable
        fluency_score = round(min(90.0, 25.0 + features.avg_words_per_answer * 1.1), 1)

    # 3. Vocabulary, Grammar, Interaction from Gemini + MTLD + Response Speed
    speed_score, _, _ = compute_response_speed(features.avg_response_latency)
    if llm_eval is not None:
        vocab_score: float | None = (
            round(0.35 * features.mtld_diversity + 0.65 * llm_eval.vocabulary_score, 1)
            if features.mtld_diversity is not None
            else round(llm_eval.vocabulary_score, 1)
        )
        grammar_score: float | None = round(llm_eval.grammar_score, 1)
        interaction_score: float | None = (
            round(0.75 * llm_eval.interaction_score + 0.25 * speed_score, 1)
            if speed_score is not None
            else round(llm_eval.interaction_score, 1)
        )
    else:
        vocab_score = features.mtld_diversity
        grammar_score = None
        interaction_score = speed_score

    raw_vector: dict[str, float | None] = {
        "pronunciation": pron_score,
        "fluency": fluency_score,
        "vocabulary": vocab_score,
        "grammar": grammar_score,
        "interaction": interaction_score,
    }
    cefr_est = estimate_cefr_from_vector(
        raw_vector,
        unscripted_count=1,
        scripted_count=1 if features.stage1_count > 0 else 0,
    )

    normalized_0_1 = round((cefr_est.continuous_score - 1.0) / 4.0, 4)
    return LevelEstimate(
        level=cefr_est.estimated_cefr,
        score=normalized_0_1,
        continuous_band=cefr_est.continuous_score,
        needs_reassessment=False,
        is_insufficient_data=False,
        features=features,
        dimension_scores=raw_vector,
        cefr_estimation=cefr_est,
    )
