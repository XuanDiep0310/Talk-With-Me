"""
Unit tests for the pure level estimation function and feature extraction.

Tests table covering:
- Every CEFR level (A1, A2, B1, B2, C1)
- Insufficient data cases (< min_answers, < min_words, empty transcripts)
- Edge cases (boundary scores, zero latency, high latency, zero words)
- Onboarding options validation (valid vs invalid keys, non-empty rules)
"""

import pytest
from pydantic import ValidationError

from app.core.providers.llm_provider import LlmLevelEvaluation
from app.models.onboarding_schemas import UpdatePreferencesRequest
from app.seeds.onboarding_catalog import (
    CEFR_LEVEL_SET,
    GOAL_KEYS,
    INTEREST_KEYS,
    WEAK_POINT_KEYS,
)
from app.services.level_estimator import (
    PlacementFeatures,
    compute_features,
    estimate_level,
)


class TestComputeFeatures:
    def test_empty_answers_returns_zero_features(self) -> None:
        features = compute_features([], [], [], [])
        assert features.total_words == 0
        assert features.avg_words_per_answer == 0.0
        assert features.avg_stt_confidence == 0.0
        assert features.avg_speaking_duration == 0.0
        assert features.avg_response_latency == 0.0
        assert features.answer_count == 0

    def test_single_answer_computed_accurately(self) -> None:
        transcripts = ["Hello world from test"]
        confidences = [0.9]
        durations = [5.0]
        latencies = [1.5]

        features = compute_features(transcripts, confidences, durations, latencies)
        assert features.total_words == 4
        assert features.avg_words_per_answer == 4.0
        assert features.avg_stt_confidence == 0.9
        assert features.avg_speaking_duration == 5.0
        assert features.avg_response_latency == 1.5
        assert features.answer_count == 1

    def test_multiple_answers_averages_computed(self) -> None:
        transcripts = ["One two three", "Four five"]
        confidences = [0.8, 1.0]
        durations = [3.0, 2.0]
        latencies = [1.0, 2.0]

        features = compute_features(transcripts, confidences, durations, latencies)
        assert features.total_words == 5
        assert features.avg_words_per_answer == 2.5
        assert pytest.approx(features.avg_stt_confidence, 0.01) == 0.9
        assert pytest.approx(features.avg_speaking_duration, 0.01) == 2.5
        assert pytest.approx(features.avg_response_latency, 0.01) == 1.5
        assert features.answer_count == 2


class TestEstimateLevelTable:
    """Parametrized table of test cases for estimate_level."""

    @pytest.mark.parametrize(
        (
            "words_per_answer",
            "total_words",
            "confidence",
            "latency",
            "count",
            "llm_level",
            "expected_level",
        ),
        [
            # High fluency, high confidence, fast latency -> C1
            (120.0, 360, 0.98, 1.0, 3, "C1", "C1"),
            # Good fluency, high confidence, moderate latency -> B2
            (70.0, 210, 0.85, 2.0, 3, "B2", "B2"),
            # Intermediate fluency, moderate confidence -> B1
            (40.0, 120, 0.75, 3.0, 3, "B1", "B1"),
            # Low fluency, low confidence, slow latency -> A2
            (15.0, 45, 0.50, 4.0, 3, "A2", "A2"),
            # Very low fluency, but met minimum word threshold -> A1 or A2
            (11.0, 33, 0.20, 6.0, 3, "A1", "A1"),
        ],
    )
    def test_level_estimation_levels(
        self,
        words_per_answer: float,
        total_words: int,
        confidence: float,
        latency: float,
        count: int,
        llm_level: str,
        expected_level: str,
    ) -> None:
        features = PlacementFeatures(
            total_words=total_words,
            avg_words_per_answer=words_per_answer,
            avg_stt_confidence=confidence,
            avg_speaking_duration=15.0,
            avg_response_latency=latency,
            answer_count=count,
        )
        llm_eval = LlmLevelEvaluation(suggested_level=llm_level, confidence=0.8, reasoning="test")
        result = estimate_level(features, llm_eval=llm_eval)

        assert result.level == expected_level
        assert not result.is_insufficient_data
        assert not result.needs_reassessment

    @pytest.mark.parametrize(
        ("count", "total_words", "scenario"),
        [
            (0, 0, "No answers submitted"),
            (1, 10, "Only 1 answer submitted (< min 3)"),
            (2, 50, "Only 2 answers submitted (< min 3)"),
            (3, 10, "3 answers but word count < 30 threshold"),
            (3, 0, "3 empty answers with 0 words"),
        ],
    )
    def test_insufficient_data_falls_back_to_a1(
        self,
        count: int,
        total_words: int,
        scenario: str,  # noqa: ARG002
    ) -> None:
        features = PlacementFeatures(
            total_words=total_words,
            avg_words_per_answer=total_words / max(count, 1),
            avg_stt_confidence=0.9,
            avg_speaking_duration=10.0,
            avg_response_latency=1.5,
            answer_count=count,
        )
        # Even if LLM says C1, insufficient data MUST yield A1 + needs_reassessment=True
        llm_eval = LlmLevelEvaluation(suggested_level="C1", confidence=0.9, reasoning="high guess")
        result = estimate_level(features, llm_eval=llm_eval)

        assert result.level == "A1"
        assert result.is_insufficient_data is True
        assert result.needs_reassessment is True
        assert result.score == 0.0

    def test_no_llm_eval_relies_solely_on_features(self) -> None:
        features = PlacementFeatures(
            total_words=150,
            avg_words_per_answer=50.0,
            avg_stt_confidence=0.85,
            avg_speaking_duration=12.0,
            avg_response_latency=2.0,
            answer_count=3,
        )
        result = estimate_level(features, llm_eval=None)
        assert result.level in ("B1", "B2")
        assert not result.is_insufficient_data
        assert not result.needs_reassessment


class TestOnboardingValidation:
    def test_valid_preferences_passes_validation(self) -> None:
        req = UpdatePreferencesRequest(
            interests=["travel", "food"],
            goals=["daily_conversation"],
            weakPoints=["pronunciation", "grammar"],
        )
        assert req.interests == ["travel", "food"]
        assert req.goals == ["daily_conversation"]
        assert req.weak_points == ["pronunciation", "grammar"]

    def test_empty_interests_fails(self) -> None:
        with pytest.raises(ValidationError):
            UpdatePreferencesRequest(
                interests=[],
                goals=["daily_conversation"],
                weakPoints=["pronunciation"],
            )

    def test_empty_goals_fails(self) -> None:
        with pytest.raises(ValidationError):
            UpdatePreferencesRequest(
                interests=["travel"],
                goals=[],
                weakPoints=["pronunciation"],
            )

    def test_empty_weak_points_fails(self) -> None:
        with pytest.raises(ValidationError):
            UpdatePreferencesRequest(
                interests=["travel"],
                goals=["daily_conversation"],
                weakPoints=[],
            )

    def test_invalid_interest_key_fails(self) -> None:
        with pytest.raises(ValidationError):
            UpdatePreferencesRequest(
                interests=["unknown_space_travel"],
                goals=["daily_conversation"],
                weakPoints=["pronunciation"],
            )

    def test_invalid_goal_key_fails(self) -> None:
        with pytest.raises(ValidationError):
            UpdatePreferencesRequest(
                interests=["travel"],
                goals=["become_astronaut"],
                weakPoints=["pronunciation"],
            )

    def test_invalid_weak_point_key_fails(self) -> None:
        with pytest.raises(ValidationError):
            UpdatePreferencesRequest(
                interests=["travel"],
                goals=["daily_conversation"],
                weakPoints=["mind_reading"],
            )

    def test_catalog_sets_integrity(self) -> None:
        assert len(INTEREST_KEYS) == 8
        assert len(GOAL_KEYS) == 5
        assert len(WEAK_POINT_KEYS) == 5
        assert {"A1", "A2", "B1", "B2", "C1"} == CEFR_LEVEL_SET
