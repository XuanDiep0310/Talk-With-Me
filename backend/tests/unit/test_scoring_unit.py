"""
Unit tests for Scoring Engine v2.0.0 metrics, MTLD algorithm, anti-double-counting, and Rule D-10.
"""

import pytest

from app.services.scoring.metrics import (
    clean_and_tokenize,
    compute_filler_word_score,
    compute_fluency_score,
    compute_grammar_score,
    compute_interaction_score,
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
            (10.0, 10.0, 0.85, 100.0, None),
            (8.5, 10.0, 0.85, 100.0, None),
            (5.0, 10.0, 0.85, 58.8, None),
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
            (0, 60.0, 12.0, 100.0, None),
            (2, 60.0, 12.0, 76.0, None),
            (5, 60.0, 12.0, 40.0, None),
            (10, 60.0, 12.0, 0.0, None),
            (1, 30.0, 12.0, 76.0, None),
            (0, 2.0, 12.0, None, "INSUFFICIENT_SPEECH_DURATION"),
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
            (0, 100, 8.0, 100.0, None),
            (2, 100, 8.0, 84.0, None),
            (5, 100, 8.0, 60.0, None),
            (15, 100, 8.0, 0.0, None),
            (1, 50, 8.0, 84.0, None),
            (0, 2, 8.0, None, "INSUFFICIENT_WORDS"),
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
    def test_blends_azure_and_temporal_fluency(self) -> None:
        # Temporal = 0.45*90 + 0.35*80 + 0.20*70 = 82.5; Blended = 0.60*85 + 0.40*82.5 = 84.0
        score, components, na = compute_fluency_score(90.0, 80.0, 70.0, azure_fluency=85.0)
        assert score == 84.0
        assert na is None
        assert components["azure_fluency"] == 85.0
        assert components["temporal_fluency"] == 82.5

    def test_temporal_only_fallback(self) -> None:
        score, components, na = compute_fluency_score(90.0, None, 70.0, azure_fluency=None)
        assert score == 83.8
        assert na is None
        assert components["assessment_source"] == "TEMPORAL_ONLY"

    def test_all_components_missing(self) -> None:
        score, _components, na = compute_fluency_score(None, None, None, azure_fluency=None)
        assert score is None
        assert na == "ALL_FLUENCY_SIGNALS_MISSING"


class TestPronunciationScoreNoFluencyDoubleCount:
    def test_accuracy_plus_prosody_excludes_fluency(self) -> None:
        # 0.70 * 84 + 0.30 * 80 = 58.8 + 24.0 = 82.8
        score, components, na = compute_pronunciation_score([84.0], [80.0])
        assert score == 82.8
        assert na is None
        assert components["accuracy"] == 84.0
        assert components["prosody"] == 80.0
        assert components["assessment_source"] == "AZURE_SPEECH"

    def test_accuracy_only_without_prosody(self) -> None:
        score, components, na = compute_pronunciation_score([80.0, 90.0], None)
        assert score == 85.0
        assert na is None
        assert components["prosody"] is None

    def test_empty_returns_na_never_faked(self) -> None:
        score, _components, na = compute_pronunciation_score([])
        assert score is None
        assert na == "NO_AZURE_PRONUNCIATION_DATA"


class TestMtldVocabularyAndGrammar:
    def test_mtld_monotonicity_diverse_vs_repetitive(self) -> None:
        diverse_text = (
            "The ancient architectural marvels located across Europe showcase "
            "exquisite craftsmanship, magnificent marble sculptures, intricate stained glass, "
            "and brilliant engineering techniques developed throughout several centuries."
        )
        repetitive_text = (
            "The house is nice and the house is good and the house is big and "
            "the house is nice and the house is good and the house is big."
        )
        assert compute_mtld(clean_and_tokenize(diverse_text)) > compute_mtld(
            clean_and_tokenize(repetitive_text)
        )

    def test_vocabulary_diversity_too_short(self) -> None:
        score, mtld, na = compute_vocabulary_diversity(["hello", "world"], min_words=10)
        assert score is None
        assert mtld is None
        assert na == "TEXT_TOO_SHORT_FOR_MTLD"

    def test_vocabulary_score_synthesis(self) -> None:
        score, _, na = compute_vocabulary_score(75.0, 85.0, cefr_band="B2")
        assert score == 81.0
        assert na is None

        score_no_div, _, _ = compute_vocabulary_score(None, 85.0)
        assert score_no_div == 85.0

    def test_grammar_score(self) -> None:
        score, comp, na = compute_grammar_score(
            76.4,
            cefr_band="B1",
            grammar_errors=[{"original": "go", "correction": "went", "explanationVi": "Quá khứ"}],
        )
        assert score == 76.4
        assert na is None
        assert len(comp["grammar_errors"]) == 1

        na_score, _, na_reason = compute_grammar_score(None)
        assert na_score is None
        assert na_reason == "NO_GEMINI_GRAMMAR_DATA"


class TestInteractionAndResponseSpeed:
    @pytest.mark.parametrize(
        ("latency", "expected_score", "expected_na"),
        [
            (0.5, 100.0, None),
            (2.0, 100.0, None),
            (3.0, 88.0, None),
            (5.0, 64.0, None),
            (11.0, 0.0, None),
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

    def test_interaction_blends_semantic_and_latency(self) -> None:
        # Semantic = 0.55*80 + 0.45*80 = 80; Interaction = 0.75*80 + 0.25*100 = 85.0
        score, comp, na = compute_interaction_score(80.0, 80.0, 100.0, average_latency_seconds=1.2)
        assert score == 85.0
        assert na is None
        assert comp["average_latency_seconds"] == 1.2


class TestOverallScoreDecisionD10:
    def test_all_five_valid_equal_weights(self) -> None:
        # (80 + 70 + 75 + 85 + 90) / 5 = 80.0
        score, partial = compute_overall_score(80.0, 70.0, 75.0, 85.0, 90.0)
        assert score == 80.0
        assert partial is False

    def test_one_missing_sets_partial_true(self) -> None:
        score, partial = compute_overall_score(None, 80.0, 80.0, 80.0, 80.0)
        assert score == 80.0
        assert partial is True

    def test_two_missing_yields_na(self) -> None:
        score, partial = compute_overall_score(85.0, 85.0, 85.0, None, None)
        assert score is None
        assert partial is False


class TestDataSufficiencyAndFixtures:
    def test_sufficient(self) -> None:
        assert is_session_data_sufficient(total_words=10, user_turns=2, spoken_seconds=8.0) is True

    @pytest.mark.parametrize(
        ("words", "turns", "spoken"),
        [(4, 2, 8.0), (10, 0, 8.0), (10, 2, 3.9)],
    )
    def test_insufficient(self, words: int, turns: int, spoken: float) -> None:
        assert is_session_data_sufficient(words, turns, spoken) is False

    def test_fluent_transcript_metrics(self) -> None:
        metrics = extract_session_turn_metrics(FLUENT_TRANSCRIPT)
        assert metrics["total_words"] > 30
        assert metrics["filler_count"] == 0
        assert metrics["average_latency_seconds"] is not None
        assert metrics["average_latency_seconds"] <= 2.0

    def test_hesitant_transcript_metrics(self) -> None:
        metrics = extract_session_turn_metrics(HESITANT_TRANSCRIPT)
        assert metrics["filler_count"] >= 3
        assert metrics["long_pause_count"] >= 1
        assert metrics["average_latency_seconds"] > 5.0
        speed, _, _ = compute_response_speed(metrics["average_latency_seconds"])
        assert speed is not None and speed <= 60.0

    def test_too_short_transcript_fails_sufficiency(self) -> None:
        metrics = extract_session_turn_metrics(TOO_SHORT_TRANSCRIPT)
        assert (
            is_session_data_sufficient(
                total_words=metrics["total_words"],
                user_turns=metrics["user_turns"],
                spoken_seconds=metrics["spoken_seconds"],
            )
            is False
        )
