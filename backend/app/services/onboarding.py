"""
Onboarding service: orchestrates the full onboarding flow including
placement test lifecycle, preference saving, level assignment, and
onboarding completion.

Business logic lives here. No raw SQL. Calls repositories and level estimator.
"""

from __future__ import annotations

import json
import uuid
from typing import TYPE_CHECKING, Any

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock, system_clock
from app.core.config import Settings
from app.models.auth import UserProfile
from app.models.onboarding import PlacementAnswer, PlacementTest
from app.repositories.onboarding import (
    LevelHistoryRepository,
    OnboardingProfileRepository,
    PlacementAnswerRepository,
    PlacementTestRepository,
)
from app.seeds.onboarding_catalog import (
    CEFR_LEVEL_SET,
    GOAL_KEYS,
    INTEREST_KEYS,
    LEVEL_SOURCE_PLACEMENT,
    LEVEL_SOURCE_SELF,
    PLACEMENT_QUESTIONS,
    TIERED_PLACEMENT_QUESTIONS,
    WEAK_POINT_KEYS,
    PlacementQuestionItem,
)
from app.services.level_estimator import (
    LevelEstimate,
    _feature_score,
    _score_to_level,
    compute_features,
    estimate_level,
)

if TYPE_CHECKING:
    from app.core.providers.llm_provider import LlmProvider


class OnboardingService:
    """
    Handles the full onboarding journey:
      1. Save preferences (interests, goals, weak_points)
      2. Set level (from placement or self-selection)
      3. Mark onboarding complete
    """

    def __init__(
        self,
        session: AsyncSession,
        settings: Settings,
        clock: Clock = system_clock,
    ) -> None:
        self._profile_repo = OnboardingProfileRepository(session)
        self._level_history_repo = LevelHistoryRepository(session)
        self._settings = settings
        self._clock = clock

    async def get_profile_or_404(self, user_id: uuid.UUID) -> UserProfile:
        profile = await self._profile_repo.get_profile(user_id)
        if profile is None:
            raise HTTPException(
                status_code=404,
                detail={"code": "USER_NOT_FOUND", "message": "Profile not found.", "details": {}},
            )
        return profile

    async def save_preferences(
        self,
        user_id: uuid.UUID,
        interests: list[str],
        goals: list[str],
        weak_points: list[str],
    ) -> None:
        """Validate and save onboarding preferences. At least 1 of each required."""
        _validate_nonempty(interests, "interests")
        _validate_nonempty(goals, "goals")
        _validate_nonempty(weak_points, "weakPoints")

        _validate_keys(interests, INTEREST_KEYS, "interests")
        _validate_keys(goals, GOAL_KEYS, "goals")
        _validate_keys(weak_points, WEAK_POINT_KEYS, "weakPoints")

        await self._profile_repo.update_preferences(
            user_id=user_id,
            interests=interests,
            goals=goals,
            weak_points=weak_points,
        )

    async def set_level_self(self, user_id: uuid.UUID, level: str) -> UserProfile:
        """Self-selected level assignment. Records in level_history."""
        if level not in CEFR_LEVEL_SET:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "INVALID_LEVEL",
                    "message": f"Level must be one of: {', '.join(sorted(CEFR_LEVEL_SET))}",
                    "details": {},
                },
            )
        await self._profile_repo.set_level(
            user_id=user_id,
            level=level,
            source=LEVEL_SOURCE_SELF,
            needs_reassessment=False,
        )
        await self._level_history_repo.record(
            user_id=user_id,
            level=level,
            source=LEVEL_SOURCE_SELF,
            placement_test_id=None,
            created_at=self._clock.now(),
        )
        profile = await self._profile_repo.get_profile(user_id)
        if profile is None:
            raise HTTPException(
                status_code=404,
                detail={"code": "USER_NOT_FOUND", "message": "Profile not found.", "details": {}},
            )
        return profile

    async def complete_onboarding(self, user_id: uuid.UUID) -> UserProfile:
        """
        Mark onboarding as done. Validates prerequisites:
          - Profile must have a level (either from placement or self-selection)
          - Profile must have at least 1 interest, goal, and weak_point

        Idempotent: calling twice is fine (returns existing completed_at).
        """
        profile = await self.get_profile_or_404(user_id)

        # Idempotent: already completed
        if profile.onboarding_completed_at is not None:
            return profile

        if not profile.cefr_level:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "ONBOARDING_LEVEL_MISSING",
                    "message": "Level must be set before completing onboarding.",
                    "details": {},
                },
            )

        interests = json.loads(profile.interests or "[]")
        goals = json.loads(profile.goals or "[]")
        weak_points = json.loads(profile.weak_points or "[]")

        if not interests or not goals or not weak_points:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "ONBOARDING_PREFERENCES_MISSING",
                    "message": "Interests, goals, and skills to improve must be set before completing onboarding.",
                    "details": {},
                },
            )

        now = self._clock.now()
        await self._profile_repo.complete_onboarding(user_id=user_id, completed_at=now)
        updated_profile = await self._profile_repo.get_profile(user_id)
        if updated_profile is None:
            raise HTTPException(
                status_code=404,
                detail={"code": "USER_NOT_FOUND", "message": "Profile not found.", "details": {}},
            )
        return updated_profile


class PlacementService:
    """
    Handles placement test lifecycle with adaptive tier progression (D-25):
      1. Create test (starts at Tier 1: A1-A2)
      2. Submit answers (adaptive difficulty adjustment, early convergence)
      3. Complete -> run estimator -> write level
    """

    def __init__(
        self,
        session: AsyncSession,
        settings: Settings,
        llm_provider: LlmProvider,
        clock: Clock = system_clock,
    ) -> None:
        self._test_repo = PlacementTestRepository(session)
        self._answer_repo = PlacementAnswerRepository(session)
        self._level_history_repo = LevelHistoryRepository(session)
        self._profile_repo = OnboardingProfileRepository(session)
        self._settings = settings
        self._llm = llm_provider
        self._clock = clock

    def get_questions(self) -> list[str]:
        return PLACEMENT_QUESTIONS

    def get_tiered_questions(self) -> list[PlacementQuestionItem]:
        return TIERED_PLACEMENT_QUESTIONS

    def get_initial_question(self) -> PlacementQuestionItem:
        return TIERED_PLACEMENT_QUESTIONS[0]

    def compute_adaptive_next_step(
        self,
        current_question_index: int,
        answers: list[PlacementAnswer],
    ) -> dict[str, Any]:
        """
        Evaluates user's performance and selects the next adaptive question (D-25).
        Returns metadata for progression, next question, convergence, and current estimated level.
        """
        total_answered = len(answers)

        # 1. Determine current tier from question index
        if 0 <= current_question_index < len(TIERED_PLACEMENT_QUESTIONS):
            current_item = TIERED_PLACEMENT_QUESTIONS[current_question_index]
            current_tier = current_item["tier"]
            current_tier_label = current_item["tier_label"]
        else:
            # Fallback mapping if arbitrary 0-based sequential turn is passed
            if current_question_index == 0:
                current_tier = 1
                current_tier_label = "Cơ bản (A1–A2)"
            elif current_question_index == 1:
                current_tier = 2
                current_tier_label = "Trung cấp (B1–B2)"
            else:
                current_tier = 2
                current_tier_label = "Trung cấp (B1–B2)"

        # 2. Analyze the latest answer
        last_answer = answers[-1] if answers else None
        words = last_answer.word_count if last_answer and last_answer.word_count is not None else 0
        duration = (
            last_answer.speaking_duration_seconds
            if last_answer and last_answer.speaking_duration_seconds is not None
            else 0.0
        )
        confidence = (
            last_answer.stt_confidence
            if last_answer and last_answer.stt_confidence is not None
            else 0.8
        )
        latency = (
            last_answer.response_latency_seconds
            if last_answer and last_answer.response_latency_seconds is not None
            else 2.0
        )

        is_strong = words >= 15 and duration >= 5.0 and confidence >= 0.75 and latency <= 4.5
        is_weak = words < 8 or duration < 3.0 or latency > 6.0

        # 3. Determine next tier
        if is_strong:
            next_tier = min(3, current_tier + 1)
        elif is_weak:
            next_tier = max(1, current_tier - 1)
        else:
            next_tier = 2 if current_tier == 1 and words >= 10 else current_tier

        # 4. Find unused questions in next_tier
        answered_indices = {a.question_index for a in answers}

        available_candidates = [
            (idx, q)
            for idx, q in enumerate(TIERED_PLACEMENT_QUESTIONS)
            if q["tier"] == next_tier and idx not in answered_indices
        ]

        if not available_candidates:
            # Fallback to any unanswered question
            available_candidates = [
                (idx, q)
                for idx, q in enumerate(TIERED_PLACEMENT_QUESTIONS)
                if idx not in answered_indices
            ]

        # 5. Compute current estimated level from all answers so far
        transcripts = [a.transcript or "" for a in answers]
        confidences = [a.stt_confidence or 0.0 for a in answers]
        durations = [a.speaking_duration_seconds or 0.0 for a in answers]
        latencies = [a.response_latency_seconds or 0.0 for a in answers]
        features = compute_features(transcripts, confidences, durations, latencies)
        current_score = _feature_score(features)
        current_level = _score_to_level(
            current_score,
            a2_threshold=self._settings.PLACEMENT_A2_THRESHOLD,
            b1_threshold=self._settings.PLACEMENT_B1_THRESHOLD,
            b2_threshold=self._settings.PLACEMENT_B2_THRESHOLD,
            c1_threshold=self._settings.PLACEMENT_C1_THRESHOLD,
        )

        can_finish_early = total_answered >= 3

        # 6. Check convergence
        is_converged = (
            total_answered >= 5
            or not available_candidates
            or (
                total_answered >= 3
                and (
                    (current_tier == 3 and is_strong)
                    or (current_tier == 1 and is_weak)
                    or total_answered >= 4
                )
            )
        )

        next_q_idx: int | None = None
        next_q_item: PlacementQuestionItem | None = None
        if not is_converged and available_candidates:
            next_q_idx, next_q_item = available_candidates[0]

        return {
            "current_tier": current_tier,
            "current_tier_label": current_tier_label,
            "next_question": next_q_item["text"] if next_q_item else None,
            "next_question_index": next_q_idx,
            "next_tier": next_q_item["tier"] if next_q_item else None,
            "next_tier_label": next_q_item["tier_label"] if next_q_item else None,
            "next_question_translation": next_q_item["translation"] if next_q_item else None,
            "is_converged": is_converged,
            "can_finish_early": can_finish_early,
            "total_answered": total_answered,
            "current_estimated_level": current_level,
        }

    async def create_test(self, user_id: uuid.UUID) -> PlacementTest:
        test = await self._test_repo.create(user_id=user_id)
        await self._test_repo.update_status(test.id, "IN_PROGRESS")
        return test

    async def submit_answer(
        self,
        test_id: uuid.UUID,
        user_id: uuid.UUID,
        request_id: str,
        question_index: int,
        transcript: str | None,
        stt_confidence: float | None,
        speaking_duration_seconds: float | None,
        response_latency_seconds: float | None,
    ) -> tuple[PlacementAnswer, dict[str, Any]]:
        # Validate ownership (returns 404 for other user's tests — AGENTS.md §8 rule 7)
        test = await self._test_repo.get_by_id_and_user(test_id, user_id)
        if test is None:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "PLACEMENT_TEST_NOT_FOUND",
                    "message": "Placement test not found.",
                    "details": {},
                },
            )

        if test.status != "IN_PROGRESS":
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "PLACEMENT_TEST_NOT_ACTIVE",
                    "message": "Placement test is not in progress.",
                    "details": {},
                },
            )

        # Idempotency: return existing answer if request_id already exists
        existing = await self._answer_repo.get_by_request_id(test_id, request_id)
        if existing is not None:
            all_answers = await self._answer_repo.list_by_test(test_id)
            meta = self.compute_adaptive_next_step(question_index, all_answers)
            return existing, meta

        word_count = len((transcript or "").split()) if transcript else 0

        created = await self._answer_repo.create(
            test_id=test_id,
            request_id=request_id,
            question_index=question_index,
            transcript=transcript,
            stt_confidence=stt_confidence,
            speaking_duration_seconds=speaking_duration_seconds,
            response_latency_seconds=response_latency_seconds,
            word_count=word_count if transcript else None,
        )

        all_answers = await self._answer_repo.list_by_test(test_id)
        meta = self.compute_adaptive_next_step(question_index, all_answers)
        return created, meta

    async def complete_test(
        self,
        test_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> tuple[PlacementTest, LevelEstimate]:
        """
        Run level estimation, persist results, write level_history.
        Returns (completed_test, level_estimate).
        """
        test = await self._test_repo.get_by_id_and_user(test_id, user_id)
        if test is None:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "PLACEMENT_TEST_NOT_FOUND",
                    "message": "Placement test not found.",
                    "details": {},
                },
            )

        if test.status not in ("IN_PROGRESS", "COMPLETED"):
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "PLACEMENT_TEST_NOT_ACTIVE",
                    "message": "Cannot complete a test that is not in progress.",
                    "details": {},
                },
            )

        answers = await self._answer_repo.list_by_test(test_id)

        transcripts = [a.transcript or "" for a in answers]
        confidences = [a.stt_confidence or 0.0 for a in answers]
        durations = [a.speaking_duration_seconds or 0.0 for a in answers]
        latencies = [a.response_latency_seconds or 0.0 for a in answers]

        features = compute_features(transcripts, confidences, durations, latencies)

        # Get LLM secondary signal (only when data is sufficient)
        llm_eval = None
        is_sufficient = (
            features.answer_count >= self._settings.PLACEMENT_MIN_ANSWERS
            and features.total_words >= self._settings.PLACEMENT_MIN_WORDS
        )
        if is_sufficient and transcripts:
            try:
                llm_eval = await self._llm.evaluate_placement(transcripts)
            except Exception:
                # LLM failure is non-fatal; fall back to feature-only estimate
                llm_eval = None

        estimate = estimate_level(
            features,
            llm_eval=llm_eval,
            min_answers=self._settings.PLACEMENT_MIN_ANSWERS,
            min_words=self._settings.PLACEMENT_MIN_WORDS,
            a2_threshold=self._settings.PLACEMENT_A2_THRESHOLD,
            b1_threshold=self._settings.PLACEMENT_B1_THRESHOLD,
            b2_threshold=self._settings.PLACEMENT_B2_THRESHOLD,
            c1_threshold=self._settings.PLACEMENT_C1_THRESHOLD,
        )

        now = self._clock.now()
        features_dict = {
            "total_words": features.total_words,
            "avg_words_per_answer": features.avg_words_per_answer,
            "avg_stt_confidence": features.avg_stt_confidence,
            "avg_speaking_duration": features.avg_speaking_duration,
            "avg_response_latency": features.avg_response_latency,
            "answer_count": features.answer_count,
        }
        import json as _json

        await self._test_repo.complete(
            test_id=test_id,
            estimated_level=estimate.level,
            is_insufficient_data=estimate.is_insufficient_data,
            features_json=_json.dumps(features_dict),
            completed_at=now,
        )

        # Write level to profile and level_history
        await self._profile_repo.set_level(
            user_id=user_id,
            level=estimate.level,
            source=LEVEL_SOURCE_PLACEMENT,
            needs_reassessment=estimate.needs_reassessment,
        )
        await self._level_history_repo.record(
            user_id=user_id,
            level=estimate.level,
            source=LEVEL_SOURCE_PLACEMENT,
            placement_test_id=test_id,
            created_at=now,
        )

        refreshed_test = await self._test_repo.get_by_id(test_id)
        if refreshed_test is None:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "PLACEMENT_TEST_NOT_FOUND",
                    "message": "Placement test not found.",
                    "details": {},
                },
            )
        return refreshed_test, estimate


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _validate_nonempty(values: list[str], field: str) -> None:
    if not values:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "VALIDATION_ERROR",
                "message": f"At least one {field} must be selected.",
                "details": {"field": field},
            },
        )


def _validate_keys(values: list[str], valid_keys: frozenset[str], field: str) -> None:
    invalid = [v for v in values if v not in valid_keys]
    if invalid:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "VALIDATION_ERROR",
                "message": f"Invalid {field} keys: {invalid}",
                "details": {"field": field, "invalid_keys": invalid},
            },
        )
