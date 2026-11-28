"""Onboarding and Two-Stage Placement Service (Stage 1 Scripted + Stage 2 Unscripted)."""

from __future__ import annotations

import contextlib
import json
import uuid
from typing import TYPE_CHECKING, Any

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock, system_clock
from app.core.config import Settings
from app.core.speech.ipa import text_to_ipa
from app.core.speech.syllable_mapper import build_pronunciation_breakdown
from app.models.auth import UserProfile
from app.models.onboarding import PlacementAnswer, PlacementTest
from app.models.pronunciation_schemas import (
    PhonemeScoreSchema,
    PronunciationAssessResponse,
    SyllableScoreSchema,
    WordPronunciationSchema,
)
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
    SCRIPTED_PLACEMENT_PROMPTS,
    TIERED_PLACEMENT_QUESTIONS,
    WEAK_POINT_KEYS,
    PlacementQuestionItem,
    ScriptedPlacementPrompt,
)
from app.services.learner_assessment import LearnerAssessmentService
from app.services.level_estimator import (
    LevelEstimate,
    compute_features,
    estimate_level,
)
from app.services.speech_features import extract_phoneme_errors

if TYPE_CHECKING:
    from app.core.providers.llm_provider import LlmProvider
    from app.core.providers.speech_assessment_provider import SpeechAssessmentProvider


class OnboardingService:
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
        return await self.get_profile_or_404(user_id)

    async def complete_onboarding(self, user_id: uuid.UUID) -> UserProfile:
        profile = await self.get_profile_or_404(user_id)
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
        await self._profile_repo.complete_onboarding(
            user_id=user_id, completed_at=self._clock.now()
        )
        return await self.get_profile_or_404(user_id)


class PlacementService:
    """Two-stage placement test: Stage 1 (Scripted pronunciation) + Stage 2 (Unscripted AI Q&A)."""

    def __init__(
        self,
        session: AsyncSession,
        settings: Settings,
        llm_provider: LlmProvider,
        speech_provider: SpeechAssessmentProvider | None = None,
        clock: Clock = system_clock,
    ) -> None:
        self._session = session
        self._test_repo = PlacementTestRepository(session)
        self._answer_repo = PlacementAnswerRepository(session)
        self._level_history_repo = LevelHistoryRepository(session)
        self._profile_repo = OnboardingProfileRepository(session)
        self._settings = settings
        self._llm = llm_provider
        self._speech = speech_provider
        self._clock = clock

    def get_questions(self) -> list[str]:
        return PLACEMENT_QUESTIONS

    def get_scripted_prompts(self) -> list[ScriptedPlacementPrompt]:
        return SCRIPTED_PLACEMENT_PROMPTS

    def get_initial_question(self) -> PlacementQuestionItem:
        return TIERED_PLACEMENT_QUESTIONS[0]

    def compute_adaptive_next_step(
        self,
        current_question_index: int,
        answers: list[PlacementAnswer],
    ) -> dict[str, Any]:
        stage2_answers = [a for a in answers if a.stage == 2]
        stage1_answers = [a for a in answers if a.stage == 1]
        total_answered = len(stage2_answers)

        if 0 <= current_question_index < len(TIERED_PLACEMENT_QUESTIONS):
            current_item = TIERED_PLACEMENT_QUESTIONS[current_question_index]
            current_tier = current_item["tier"]
            current_tier_label = current_item["tier_label"]
        else:
            current_tier = 1 if current_question_index == 0 else 2
            current_tier_label = "Cơ bản (A1–A2)" if current_tier == 1 else "Trung cấp (B1–B2)"

        last_answer = stage2_answers[-1] if stage2_answers else None
        words = last_answer.word_count if last_answer and last_answer.word_count is not None else 0
        duration = (
            last_answer.speaking_duration_seconds
            if last_answer and last_answer.speaking_duration_seconds is not None
            else 0.0
        )
        fluency_ok = (
            (last_answer.fluency_score is None or last_answer.fluency_score >= 72.0)
            if last_answer
            else False
        )
        latency = (
            last_answer.response_latency_seconds
            if last_answer and last_answer.response_latency_seconds is not None
            else 2.0
        )

        is_strong = words >= 15 and duration >= 4.0 and fluency_ok and latency <= 4.5
        is_weak = words < 8 or duration < 2.5 or latency > 6.5

        if is_strong:
            next_tier = min(3, current_tier + 1)
        elif is_weak:
            next_tier = max(1, current_tier - 1)
        else:
            next_tier = 2 if current_tier == 1 and words >= 10 else current_tier

        answered_indices = {a.question_index for a in stage2_answers}
        available = [
            (idx, q)
            for idx, q in enumerate(TIERED_PLACEMENT_QUESTIONS)
            if q["tier"] == next_tier and idx not in answered_indices
        ] or [
            (idx, q)
            for idx, q in enumerate(TIERED_PLACEMENT_QUESTIONS)
            if idx not in answered_indices
        ]

        # Intermediate acoustic estimate without calling LLM mid-test
        running_est = "A1"
        if stage2_answers:
            avg_w = sum(a.word_count or 0 for a in stage2_answers) / len(stage2_answers)
            if avg_w >= 35:
                running_est = "B2"
            elif avg_w >= 18:
                running_est = "B1"
            elif avg_w >= 9:
                running_est = "A2"

        can_finish_early = total_answered >= self._settings.PLACEMENT_MIN_ANSWERS
        is_converged = (
            total_answered >= 5
            or not available
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
        if not is_converged and available:
            next_q_idx, next_q_item = available[0]

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
            "current_estimated_level": running_est,
            "stage1_completed": len(stage1_answers) >= self._settings.PLACEMENT_MIN_STAGE1_PROMPTS,
        }

    async def create_test(self, user_id: uuid.UUID) -> PlacementTest:
        test = await self._test_repo.create(user_id=user_id)
        await self._test_repo.update_status(test.id, "IN_PROGRESS")
        return test

    async def _require_in_progress_test(
        self, test_id: uuid.UUID, user_id: uuid.UUID
    ) -> PlacementTest:
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
        *,
        stage: int = 2,
        prompt_id: str | None = None,
        accuracy_score: float | None = None,
        fluency_score: float | None = None,
        prosody_score: float | None = None,
        completeness_score: float | None = None,
    ) -> tuple[PlacementAnswer, dict[str, Any]]:
        await self._require_in_progress_test(test_id, user_id)
        existing = await self._answer_repo.get_by_request_id(test_id, request_id)
        if existing is not None:
            all_answers = await self._answer_repo.list_by_test(test_id)
            return existing, self.compute_adaptive_next_step(question_index, all_answers)

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
            stage=stage,
            prompt_id=prompt_id,
            accuracy_score=accuracy_score,
            fluency_score=fluency_score,
            prosody_score=prosody_score,
            completeness_score=completeness_score,
        )
        all_answers = await self._answer_repo.list_by_test(test_id)
        return created, self.compute_adaptive_next_step(question_index, all_answers)

    async def submit_audio_answer(
        self,
        *,
        test_id: uuid.UUID,
        user_id: uuid.UUID,
        request_id: str,
        stage: int,
        question_index: int,
        audio_bytes: bytes,
        mime_type: str,
        prompt_id: str | None = None,
        response_latency_seconds: float | None = None,
    ) -> tuple[PlacementAnswer, dict[str, Any]]:
        await self._require_in_progress_test(test_id, user_id)
        existing = await self._answer_repo.get_by_request_id(test_id, request_id)
        if existing is not None:
            all_answers = await self._answer_repo.list_by_test(test_id)
            meta = self.compute_adaptive_next_step(question_index, all_answers)
            meta["next_stage"] = 2 if meta["stage1_completed"] or stage == 2 else 1
            return existing, meta

        if self._speech is None:
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "SPEECH_ASSESSMENT_UNAVAILABLE",
                    "message": "Speech provider is not configured.",
                },
            )

        reference_text = ""
        if stage == 1:
            prompt = _resolve_scripted_prompt(prompt_id, question_index)
            reference_text = prompt["text"]
            prompt_id = prompt["id"]

        result = await self._speech.assess(
            audio_bytes,
            reference_text=reference_text,
            mime_type=mime_type,
        )
        ph_errors = extract_phoneme_errors(result)
        transcript = result.transcript.strip()
        word_count = len(transcript.split()) if transcript else 0

        created = await self._answer_repo.create(
            test_id=test_id,
            request_id=request_id,
            question_index=question_index,
            transcript=transcript,
            stt_confidence=result.measured_confidence or result.confidence,
            speaking_duration_seconds=result.speaking_duration_seconds,
            response_latency_seconds=response_latency_seconds,
            word_count=word_count if transcript else None,
            stage=stage,
            prompt_id=prompt_id,
            accuracy_score=result.accuracy_score,
            fluency_score=result.fluency_score,
            prosody_score=result.prosody_score,
            completeness_score=result.completeness_score,
            phoneme_errors_json=json.dumps(ph_errors) if ph_errors else None,
        )

        all_answers = await self._answer_repo.list_by_test(test_id)
        meta = self.compute_adaptive_next_step(question_index, all_answers)
        stage1_count = sum(1 for a in all_answers if a.stage == 1)
        next_stage = 2 if (stage == 2 or stage1_count >= len(SCRIPTED_PLACEMENT_PROMPTS)) else 1
        await self._test_repo.set_stage(test_id, next_stage)
        meta["next_stage"] = next_stage

        if stage == 1:
            words, display_score, tip = build_pronunciation_breakdown(reference_text, result)
            meta["pronunciation"] = PronunciationAssessResponse(
                transcript=result.transcript,
                reference_text=reference_text,
                mode="scripted",
                provider=result.provider,
                display_score=display_score,
                accuracy_score=result.accuracy_score,
                fluency_score=result.fluency_score,
                prosody_score=result.prosody_score,
                completeness_score=result.completeness_score,
                ipa=text_to_ipa(reference_text),
                words=[
                    WordPronunciationSchema(
                        word=w.word,
                        accuracy_score=w.accuracy_score,
                        error_type=w.error_type,
                        ipa=w.ipa,
                        status=w.status,
                        syllables=[
                            SyllableScoreSchema(
                                text=s.text, accuracy_score=s.accuracy_score, status=s.status
                            )
                            for s in w.syllables
                        ],
                        phonemes=[
                            PhonemeScoreSchema(
                                ipa=p.ipa, accuracy_score=p.accuracy_score, heard_as=p.heard_as
                            )
                            for p in w.phonemes
                        ],
                    )
                    for w in words
                ],
                coaching_tip_vi=tip,
                passed=(display_score is not None and display_score >= 60.0),
            )
        return created, meta

    async def complete_test(
        self,
        test_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> tuple[PlacementTest, LevelEstimate]:
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
        stage1 = [a for a in answers if a.stage == 1]
        stage2 = [a for a in answers if a.stage == 2]

        transcripts = [a.transcript or "" for a in stage2]
        confidences = [a.stt_confidence or 0.0 for a in stage2]
        durations = [a.speaking_duration_seconds or 0.0 for a in stage2]
        latencies = [a.response_latency_seconds or 0.0 for a in stage2]

        features = compute_features(
            transcripts,
            confidences,
            durations,
            latencies,
            stage1_accuracies=[a.accuracy_score for a in stage1 if a.accuracy_score is not None],
            stage1_prosodies=[a.prosody_score for a in stage1 if a.prosody_score is not None],
            stage1_fluencies=[a.fluency_score for a in stage1 if a.fluency_score is not None],
            stage2_accuracies=[a.accuracy_score for a in stage2 if a.accuracy_score is not None],
            stage2_fluencies=[a.fluency_score for a in stage2 if a.fluency_score is not None],
            stage2_prosodies=[a.prosody_score for a in stage2 if a.prosody_score is not None],
        )

        llm_eval = None
        is_sufficient = (
            features.answer_count >= self._settings.PLACEMENT_MIN_ANSWERS
            and features.total_words >= self._settings.PLACEMENT_MIN_WORDS
        )
        if is_sufficient and transcripts:
            try:
                llm_eval = await self._llm.evaluate_placement(transcripts)
            except Exception:
                llm_eval = None

        estimate = estimate_level(
            features,
            llm_eval=llm_eval,
            min_answers=self._settings.PLACEMENT_MIN_ANSWERS,
            min_words=self._settings.PLACEMENT_MIN_WORDS,
        )

        now = self._clock.now()
        stage1_summary = {
            "count": features.stage1_count,
            "accuracy": features.stage1_accuracy,
            "prosody": features.stage1_prosody,
            "fluency": features.stage1_fluency,
        }
        stage2_summary = {
            "count": features.answer_count,
            "total_words": features.total_words,
            "accuracy": features.stage2_accuracy,
            "fluency": features.stage2_fluency,
            "prosody": features.stage2_prosody,
            "avg_response_latency": features.avg_response_latency,
        }
        features_dict = {
            "total_words": features.total_words,
            "avg_words_per_answer": features.avg_words_per_answer,
            "avg_stt_confidence": features.avg_stt_confidence,
            "avg_speaking_duration": features.avg_speaking_duration,
            "avg_response_latency": features.avg_response_latency,
            "answer_count": features.answer_count,
            "mtld_diversity": features.mtld_diversity,
        }

        await self._test_repo.complete(
            test_id=test_id,
            estimated_level=estimate.level,
            is_insufficient_data=estimate.is_insufficient_data,
            features_json=json.dumps(features_dict),
            stage1_summary_json=json.dumps(stage1_summary),
            stage2_summary_json=json.dumps(stage2_summary),
            dimension_scores_json=json.dumps(estimate.dimension_scores),
            completed_at=now,
        )

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

        # Initialize Longitudinal Learner Profile from Placement prior when sufficient
        if not estimate.is_insufficient_data:
            ph_errors: list[dict[str, Any]] = []
            for a in answers:
                if a.phoneme_errors_json:
                    with contextlib.suppress(Exception):
                        ph_errors.extend(json.loads(a.phoneme_errors_json))
            stage1_pron = (
                round(0.70 * features.stage1_accuracy + 0.30 * features.stage1_prosody, 1)
                if features.stage1_accuracy is not None and features.stage1_prosody is not None
                else features.stage1_accuracy
            )
            stage2_pron = (
                round(0.70 * features.stage2_accuracy + 0.30 * features.stage2_prosody, 1)
                if features.stage2_accuracy is not None and features.stage2_prosody is not None
                else features.stage2_accuracy
            )
            await LearnerAssessmentService(
                self._session, clock=self._clock
            ).initialize_from_placement(
                user_id=user_id,
                test_id=test_id,
                dimension_scores=estimate.dimension_scores,
                stage1_pronunciation=stage1_pron,
                stage2_pronunciation=stage2_pron,
                avg_latency_ms=round(features.avg_response_latency * 1000.0, 1)
                if features.avg_response_latency
                else None,
                phoneme_errors=ph_errors,
            )

        refreshed = await self._test_repo.get_by_id(test_id)
        if refreshed is None:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "PLACEMENT_TEST_NOT_FOUND",
                    "message": "Placement test not found.",
                    "details": {},
                },
            )
        return refreshed, estimate


def _resolve_scripted_prompt(prompt_id: str | None, question_index: int) -> ScriptedPlacementPrompt:
    if prompt_id:
        for item in SCRIPTED_PLACEMENT_PROMPTS:
            if item["id"] == prompt_id:
                return item
    idx = max(0, min(question_index, len(SCRIPTED_PLACEMENT_PROMPTS) - 1))
    return SCRIPTED_PLACEMENT_PROMPTS[idx]


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
