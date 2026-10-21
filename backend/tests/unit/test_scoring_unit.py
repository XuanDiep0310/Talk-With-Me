"""
Unit tests for scoring metrics, MTLD algorithm, thresholds, boundary cases, and Rule D-10.
High coverage (>= 90%) for the scoring pure functions.
"""

import pytest

from app.services.scoring.metrics import (
    clean_and_tokenize,
    compute_filler_word_score,
    compute_fluency_score,
    compute_listening_score,
    compute_mtld,
    compute_overall_score,
    compute_pause_score,
    compute_pronunciation_score,
    compute_response_speed,
    compute_speech_continuity,
    compute_vocabulary_diversity,
    compute_vocabulary_score,
    detect_filler_words,
    extract_session_turn_metrics,
    is_session_data_sufficient,
)
from tests.unit.test_scoring_fixtures import (
    FLUENT_TRANSCRIPT,
    HESITANT_TRANSCRIPT,
    TOO_SHORT_TRANSCRIPT,
)


class TestSpeechContinuity:
    @pytest.mark.parametrize(
        ("spoken", "span", "target_ratio", "expected_score", "expected_na"),
        [
            (10.0, 10.0, 0.85, 100.0, None),  # 100% speech -> capped at 100
            (8.5, 10.0, 0.85, 100.0, None),  # 85% speech on target 0.85 -> 100
            (5.0, 10.0, 0.85, 58.8, None),  # 50% ratio / 0.85 -> 58.8
            (0.0, 10.0, 0.85, None, "INSUFFICIENT_TURN_DURATION"),
            (5.0, 0.0, 0.85, None, "INSUFFICIENT_TURN_DURATION"),
            (-1.0, 5.0, 0.85, None, "INSUFFICIENT_TURN_DURATION"),
        ],
    )
    def test_continuity_table(
        self,
        spoken: float,
        span: float,
        target_ratio: float,
        expected_score: float | None,
        expected_na: str | None,
    ) -> None:
        score, na_reason = compute_speech_continuity(spoken, span, target_ratio)
        assert score == expected_score
        assert na_reason == expected_na


class TestPauseScore:
    @pytest.mark.parametrize(
        ("pause_count", "spoken_sec", "penalty_per_min", "expected_score", "expected_na"),
        [
            (0, 60.0, 12.0, 100.0, None),  # 0 pauses -> 100
            (2, 60.0, 12.0, 76.0, None),  # 2 pauses / 1 min * 12 = 24 -> 76
            (5, 60.0, 12.0, 40.0, None),  # 5 pauses / 1 min * 12 = 60 -> 40
            (10, 60.0, 12.0, 0.0, None),  # 10 pauses -> clamped at 0
            (1, 30.0, 12.0, 76.0, None),  # 1 pause / 0.5 min = 2/min * 12 = 24 -> 76
            (0, 2.0, 12.0, None, "INSUFFICIENT_SPEECH_DURATION"),  # < 3s spoken
        ],
    )
    def test_pause_table(
        self,
        pause_count: int,
        spoken_sec: float,
        penalty_per_min: float,
        expected_score: float | None,
        expected_na: str | None,
    ) -> None:
        score, na_reason = compute_pause_score(pause_count, spoken_sec, penalty_per_min)
        assert score == expected_score
        assert na_reason == expected_na


class TestFillerWordScore:
    @pytest.mark.parametrize(
        ("filler_count", "total_words", "penalty_per_100", "expected_score", "expected_na"),
        [
            (0, 100, 8.0, 100.0, None),  # 0 fillers -> 100
            (2, 100, 8.0, 84.0, None),  # 2% * 8 = 16 -> 84
            (5, 100, 8.0, 60.0, None),  # 5% * 8 = 40 -> 60
            (15, 100, 8.0, 0.0, None),  # 15% * 8 = 120 -> clamped at 0
            (1, 50, 8.0, 84.0, None),  # 2% -> 84
            (0, 2, 8.0, None, "INSUFFICIENT_WORDS"),  # < 3 words
        ],
    )
    def test_filler_table(
        self,
        filler_count: int,
        total_words: int,
        penalty_per_100: float,
        expected_score: float | None,
        expected_na: str | None,
    ) -> None:
        score, na_reason = compute_filler_word_score(filler_count, total_words, penalty_per_100)
        assert score == expected_score
        assert na_reason == expected_na


class TestFillerWordDetection:
    def test_detect_fillers(self) -> None:
        text = "Um I think you know like we should go to the park uh yesterday."
        count, found = detect_filler_words(text)
        assert count == 4
        assert "um" in found
        assert "you know" in found
        assert "like" in found
        assert "uh" in found

    def test_clean_and_tokenize(self) -> None:
        tokens = clean_and_tokenize("Hello, World! It's a sunny day...")
        assert tokens == ["hello", "world", "it's", "a", "sunny", "day"]


class TestFluencySynthesis:
    def test_all_components_present(self) -> None:
        # 0.45 * 90 + 0.35 * 80 + 0.20 * 70 = 40.5 + 28.0 + 14.0 = 82.5
        score, components, na = compute_fluency_score(90.0, 80.0, 70.0)
        assert score == 82.5
        assert na is None
        assert components["speech_continuity"] == 90.0

    def test_one_component_missing(self) -> None:
        # continuity=90, pause=None, filler=70
        # remaining weights: 0.45, 0.20 -> sum 0.65
        # weighted: (90 * 0.45 + 70 * 0.20) / 0.65 = (40.5 + 14.0) / 0.65 = 54.5 / 0.65 = 83.8
        score, components, na = compute_fluency_score(90.0, None, 70.0)
        assert score == 83.8
        assert na is None
        assert components["pause_score"] is None

    def test_all_components_missing(self) -> None:
        score, _components, na = compute_fluency_score(None, None, None)
        assert score is None
        assert na == "ALL_COMPONENTS_MISSING"


class TestListeningScore:
    def test_both_present(self) -> None:
        # 0.70 * 80 + 0.30 * 90 = 56.0 + 27.0 = 83.0
        score, components, na = compute_listening_score(80.0, 90.0)
        assert score == 83.0
        assert na is None
        assert components["response_relevance"] == 80.0

    def test_one_missing(self) -> None:
        score, components, na = compute_listening_score(85.0, None)
        assert score == 85.0
        assert na is None

    def test_both_missing(self) -> None:
        score, _components, na = compute_listening_score(None, None)
        assert score is None
        assert na == "NO_AI_PROMPT_FOUND"


class TestMtldAndVocabulary:
    def test_mtld_monotonicity_diverse_vs_repetitive(self) -> None:
        """
        Monotonicity test per sprint instructions:
        Diverse text must yield higher MTLD than repetitive text.
        Do not assert absolute numbers without benchmark reference.
        """
        diverse_text = (
            "The ancient architectural marvels located across Europe showcase "
            "exquisite craftsmanship, magnificent marble sculptures, intricate stained glass, "
            "and brilliant engineering techniques developed throughout several centuries."
        )
        repetitive_text = (
            "The house is nice and the house is good and the house is big and "
            "the house is nice and the house is good and the house is big."
        )

        diverse_tokens = clean_and_tokenize(diverse_text)
        repetitive_tokens = clean_and_tokenize(repetitive_text)

        mtld_diverse = compute_mtld(diverse_tokens)
        mtld_repetitive = compute_mtld(repetitive_tokens)

        assert mtld_diverse > mtld_repetitive

    def test_vocabulary_diversity_too_short(self) -> None:
        score, mtld, na = compute_vocabulary_diversity(["hello", "world"], min_words=10)
        assert score is None
        assert mtld is None
        assert na == "TEXT_TOO_SHORT_FOR_MTLD"

    def test_vocabulary_score_synthesis(self) -> None:
        # 0.40 * 75 + 0.60 * 85 = 30.0 + 51.0 = 81.0
        score, components, na = compute_vocabulary_score(75.0, 85.0)
        assert score == 81.0
        assert na is None

        # When diversity is None (text too short)
        score_no_div, _, _ = compute_vocabulary_score(None, 85.0)
        assert score_no_div == 85.0


class TestResponseSpeed:
    @pytest.mark.parametrize(
        ("latency", "expected_score", "expected_na"),
        [
            (0.5, 100.0, None),  # <= 2.0s grace period -> 100
            (1.5, 100.0, None),  # <= 2.0s -> 100
            (2.0, 100.0, None),  # Boundary: T = 2.0s -> 100.0 exactly
            (3.0, 88.0, None),  # 100 - 12 * 1 = 88.0
            (5.0, 64.0, None),  # 100 - 12 * 3 = 64.0
            (10.333, 0.0, None),  # Boundary: T = 10.333s -> ~0.0
            (11.0, 0.0, None),  # > 10.333s -> clamped at 0.0
            (None, None, "NO_INTERACTIVE_TURNS"),
            (-1.0, None, "NO_INTERACTIVE_TURNS"),
        ],
    )
    def test_response_speed_boundary(
        self,
        latency: float | None,
        expected_score: float | None,
        expected_na: str | None,
    ) -> None:
        score, _components, na = compute_response_speed(latency)
        assert score == expected_score
        assert na == expected_na


class TestPronunciationScore:
    def test_valid_confidences(self) -> None:
        confidences = [0.95, 0.90, 0.85]
        score, components, na = compute_pronunciation_score(confidences)
        assert score == 90.0
        assert na is None
        assert components["average_confidence"] == 0.9

    def test_empty_confidences(self) -> None:
        score, _components, na = compute_pronunciation_score([])
        assert score is None
        assert na == "NO_STT_CONFIDENCE_DATA"


class TestOverallScoreDecisionD10:
    """
    Test Rule D-10:
    - 5 valid: exact weighted sum, partial = False
    - 4 valid (1 N/A): re-weighted sum, partial = True
    - <= 3 valid (>= 2 N/A): Overall is None (N/A), partial = False
    """

    def test_all_five_valid(self) -> None:
        # F: 80 (0.25) = 20
        # L: 70 (0.20) = 14
        # V: 75 (0.20) = 15
        # S: 100 (0.15) = 15
        # P: 90 (0.20) = 18
        # Sum = 20 + 14 + 15 + 15 + 18 = 82.0
        score, partial = compute_overall_score(80.0, 70.0, 75.0, 100.0, 90.0)
        assert score == 82.0
        assert partial is False

    def test_exactly_one_missing_pronunciation_na(self) -> None:
        # Pronunciation missing (0.20)
        # Remaining weights sum: 0.25 + 0.20 + 0.20 + 0.15 = 0.80
        # All remaining scores are 80.0
        # Weighted avg: 80.0, partial = True
        score, partial = compute_overall_score(80.0, 80.0, 80.0, 80.0, None)
        assert score == 80.0
        assert partial is True

    def test_exactly_one_missing_speed_na(self) -> None:
        # Speed missing (0.15)
        # Remaining sum: 0.85
        # All remaining are 90.0
        score, partial = compute_overall_score(90.0, 90.0, 90.0, None, 90.0)
        assert score == 90.0
        assert partial is True

    def test_two_missing_yields_na(self) -> None:
        # Missing Speed and Pronunciation (2 missing) -> Overall is None
        score, partial = compute_overall_score(85.0, 85.0, 85.0, None, None)
        assert score is None
        assert partial is False

    def test_three_missing_yields_na(self) -> None:
        score, partial = compute_overall_score(85.0, 85.0, None, None, None)
        assert score is None
        assert partial is False


class TestDataSufficiency:
    def test_sufficient(self) -> None:
        assert is_session_data_sufficient(total_words=10, user_turns=2, spoken_seconds=8.0) is True

    @pytest.mark.parametrize(
        ("words", "turns", "spoken"),
        [
            (4, 2, 8.0),  # words < 5
            (10, 0, 8.0),  # turns < 1
            (10, 2, 4.9),  # spoken < 5.0
        ],
    )
    def test_insufficient(self, words: int, turns: int, spoken: float) -> None:
        assert is_session_data_sufficient(words, turns, spoken) is False


class TestTranscriptFixtures:
    def test_fluent_transcript_metrics(self) -> None:
        metrics = extract_session_turn_metrics(FLUENT_TRANSCRIPT)
        assert metrics["total_words"] > 30
        assert metrics["filler_count"] == 0
        assert metrics["long_pause_count"] == 0
        assert metrics["average_latency_seconds"] is not None
        assert metrics["average_latency_seconds"] <= 2.0  # (1.5s + 1.8s) / 2 = 1.65s <= 2.0s

        continuity, _ = compute_speech_continuity(
            metrics["spoken_seconds"], metrics["turn_span_seconds"]
        )
        assert continuity is not None and continuity >= 85.0

        pause, _ = compute_pause_score(metrics["long_pause_count"], metrics["spoken_seconds"])
        assert pause == 100.0

        filler, _ = compute_filler_word_score(metrics["filler_count"], metrics["total_words"])
        assert filler == 100.0

    def test_hesitant_transcript_metrics(self) -> None:
        metrics = extract_session_turn_metrics(HESITANT_TRANSCRIPT)
        assert metrics["filler_count"] >= 3  # um, well, you know, uh, like
        assert metrics["long_pause_count"] >= 1  # 3500ms pause
        assert metrics["average_latency_seconds"] is not None
        assert metrics["average_latency_seconds"] > 5.0  # 6.0s latency

        speed, _, _ = compute_response_speed(metrics["average_latency_seconds"])
        assert speed is not None and speed <= 60.0

        filler, _ = compute_filler_word_score(metrics["filler_count"], metrics["total_words"])
        assert filler is not None and filler < 100.0

    def test_too_short_transcript_fails_sufficiency(self) -> None:
        metrics = extract_session_turn_metrics(TOO_SHORT_TRANSCRIPT)
        assert metrics["total_words"] < 5
        assert metrics["spoken_seconds"] < 5.0
        assert (
            is_session_data_sufficient(
                total_words=metrics["total_words"],
                user_turns=metrics["user_turns"],
                spoken_seconds=metrics["spoken_seconds"],
            )
            is False
        )
