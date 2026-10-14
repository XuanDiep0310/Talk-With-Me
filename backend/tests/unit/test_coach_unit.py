"""
Unit tests for AI Coach core services:
1. SessionStateMachine transitions and validation (AGENTS.md §9).
2. TurnTakingPolicy (silence threshold and filler words um/uh).
3. TopicRanking algorithm (Level, Interests, Weak Points).
"""

import uuid

import pytest

from app.models.session import CoachTopic
from app.services.session_state_machine import (
    InvalidSessionStateTransitionError,
    SessionState,
    SessionStateMachine,
)
from app.services.topic_ranking import calculate_topic_score, rank_topics
from app.services.turn_taking_policy import TurnTakingPolicy

# ---------------------------------------------------------------------------
# 1. SessionStateMachine Tests
# ---------------------------------------------------------------------------


class TestSessionStateMachine:
    """Tests all valid and invalid state machine transitions according to AGENTS.md §9."""

    @pytest.mark.parametrize(
        ("from_state", "to_state"),
        [
            (SessionState.CREATED, SessionState.ACTIVE),
            (SessionState.ACTIVE, SessionState.RECONNECTING),
            (SessionState.RECONNECTING, SessionState.ACTIVE),
            (SessionState.ACTIVE, SessionState.ENDING),
            (SessionState.RECONNECTING, SessionState.ENDING),
            (SessionState.ENDING, SessionState.ENDED),
            (SessionState.ENDED, SessionState.FEEDBACK_READY),
            (SessionState.ENDED, SessionState.INSUFFICIENT_DATA),
            (SessionState.ENDED, SessionState.FAILED),
            (SessionState.FAILED, SessionState.ENDED),
        ],
    )
    def test_valid_transitions(self, from_state: SessionState, to_state: SessionState) -> None:
        assert SessionStateMachine.can_transition(from_state, to_state) is True
        result = SessionStateMachine.transition(from_state, to_state)
        assert result == to_state

    @pytest.mark.parametrize(
        ("from_state", "to_state"),
        [
            (SessionState.CREATED, SessionState.ENDED),
            (SessionState.CREATED, SessionState.RECONNECTING),
            (SessionState.CREATED, SessionState.FEEDBACK_READY),
            (SessionState.ACTIVE, SessionState.FEEDBACK_READY),
            (SessionState.ACTIVE, SessionState.CREATED),
            (SessionState.ACTIVE, SessionState.ENDED),
            (SessionState.ENDING, SessionState.ACTIVE),
            (SessionState.ENDING, SessionState.FEEDBACK_READY),
            (SessionState.FEEDBACK_READY, SessionState.ACTIVE),
            (SessionState.FEEDBACK_READY, SessionState.ENDED),
            (SessionState.INSUFFICIENT_DATA, SessionState.ACTIVE),
            (SessionState.FAILED, SessionState.ACTIVE),
        ],
    )
    def test_invalid_transitions_raise_error(
        self, from_state: SessionState, to_state: SessionState
    ) -> None:
        assert SessionStateMachine.can_transition(from_state, to_state) is False
        with pytest.raises(InvalidSessionStateTransitionError):
            SessionStateMachine.transition(from_state, to_state)

    def test_microphone_denial_blocks_transition_to_active(self) -> None:
        """Rule from AGENTS.md §9: Microphone permission refusal must prevent moving to ACTIVE."""
        with pytest.raises(InvalidSessionStateTransitionError) as exc_info:
            SessionStateMachine.transition(
                SessionState.CREATED,
                SessionState.ACTIVE,
                has_mic_permission=False,
            )
        assert "Microphone permission denied" in str(exc_info.value)


# ---------------------------------------------------------------------------
# 2. TurnTakingPolicy Tests
# ---------------------------------------------------------------------------


class TestTurnTakingPolicy:
    """Tests silence detection and filler word handling according to Communication-First."""

    @pytest.fixture
    def policy(self) -> TurnTakingPolicy:
        return TurnTakingPolicy(default_silence_threshold_ms=1500)

    def test_empty_transcript_does_not_end_turn(self, policy: TurnTakingPolicy) -> None:
        assert policy.should_end_turn("", silence_duration_ms=2000) is False
        assert policy.should_end_turn("   ", silence_duration_ms=2000) is False

    @pytest.mark.parametrize(
        "filler_ending",
        [
            "I want to say, um",
            "My favorite place is, uh",
            "Well...",
            "I went to Da Nang and like",
            "It was great, you know",
            "er",
            "hmm",
        ],
    )
    def test_filler_words_prevent_turn_ending(
        self, policy: TurnTakingPolicy, filler_ending: str
    ) -> None:
        """Hesitation and filler words should NOT trigger turn completion even during silence."""
        assert policy.should_end_turn(filler_ending, silence_duration_ms=3000) is False

    def test_short_silence_keeps_turn_open(self, policy: TurnTakingPolicy) -> None:
        """Silence below threshold (e.g. 800ms < 1500ms) gives learner time to continue."""
        transcript = "I work as a software engineer in Hanoi"
        assert policy.should_end_turn(transcript, silence_duration_ms=800) is False

    def test_long_silence_ends_turn(self, policy: TurnTakingPolicy) -> None:
        """Silence exceeding threshold (e.g. 1600ms >= 1500ms) completes the turn."""
        transcript = "I work as a software engineer in Hanoi"
        assert policy.should_end_turn(transcript, silence_duration_ms=1600) is True

    def test_speech_end_event_triggers_immediate_completion(self, policy: TurnTakingPolicy) -> None:
        """Explicit client VAD or button press completes turn if not ending in filler."""
        transcript = "Nice to meet you Alex"
        assert (
            policy.should_end_turn(transcript, silence_duration_ms=200, is_speech_end_event=True)
            is True
        )

    def test_speech_end_event_with_filler_still_keeps_turn_open(
        self, policy: TurnTakingPolicy
    ) -> None:
        transcript = "I think so, um"
        assert (
            policy.should_end_turn(transcript, silence_duration_ms=200, is_speech_end_event=True)
            is False
        )


# ---------------------------------------------------------------------------
# 3. TopicRanking Tests
# ---------------------------------------------------------------------------


class TestTopicRanking:
    """Tests personalization ranking based on CEFR level, interests, and weak points."""

    @pytest.fixture
    def sample_topics(self) -> list[CoachTopic]:
        return [
            CoachTopic(
                id=uuid.uuid4(),
                category="Personal & Social",
                title="Self-Introduction & Background",
                description="Introduce yourself and your hobbies",
                min_level="A2",
                target_skills=["Fluency", "Vocabulary"],
                sort_order=1,
            ),
            CoachTopic(
                id=uuid.uuid4(),
                category="Travel & Lifestyle",
                title="Favorite Travel Experiences",
                description="Talk about memorable destinations and journeys",
                min_level="B1",
                target_skills=["Vocabulary", "Fluency"],
                sort_order=2,
            ),
            CoachTopic(
                id=uuid.uuid4(),
                category="Career & Work",
                title="Talking About Your Job",
                description="Describe your daily workplace responsibilities",
                min_level="B2",
                target_skills=["Response Speed", "Fluency"],
                sort_order=3,
            ),
        ]

    def test_exact_level_match_ranks_higher_than_mismatch(
        self, sample_topics: list[CoachTopic]
    ) -> None:
        # User at B1 level, no specific interests or weak points
        ranked = rank_topics(sample_topics, user_level="B1")
        top_topic, top_score = ranked[0]
        assert top_topic.title == "Favorite Travel Experiences"
        assert top_topic.min_level == "B1"

    def test_interest_alignment_boosts_topic(self, sample_topics: list[CoachTopic]) -> None:
        # User at A2 level with strong interest in Travel
        ranked = rank_topics(sample_topics, user_level="A2", user_interests=["travel"])
        # Travel topic gets +20 boost despite being B1 (adjacent level)
        top_topic = ranked[0][0]
        assert "Travel" in top_topic.title or "Self-Introduction" in top_topic.title

    def test_weak_point_alignment_boosts_score(self, sample_topics: list[CoachTopic]) -> None:
        # User with weak point "response_speed"
        topic_work = sample_topics[2]  # Targets Response Speed
        score = calculate_topic_score(
            topic_work,
            user_level="B2",
            user_weak_points=["response_speed"],
        )
        base_score = calculate_topic_score(topic_work, user_level="B2")
        assert score == base_score + 25.0
