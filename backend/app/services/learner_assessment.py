"""Service managing Longitudinal Learner Profile, Phoneme Stats, and CEFR Snapshots."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock, get_clock
from app.core.config import get_settings
from app.core.events import DrillAssessed, FeedbackGenerated, event_bus
from app.models.learner_profile import (
    LearnerCefrSnapshot,
    LearnerPhonemeStat,
    LearnerSkillProfile,
)
from app.services.cefr_estimator import (
    estimate_cefr_from_vector,
    merge_pronunciation_modalities,
    update_ewma,
)

logger = logging.getLogger(__name__)

ALPHA_UNSCRIPTED = 0.35
ALPHA_SCRIPTED = 0.20


class LearnerAssessmentService:
    """Updates longitudinal learner state after Placement, Coach/Roleplay sessions, and Drills."""

    def __init__(self, db: AsyncSession, clock: Clock | None = None) -> None:
        self.db = db
        self.clock = clock or get_clock()
        self.settings = get_settings()

    async def get_or_create_profile(self, user_id: uuid.UUID) -> LearnerSkillProfile:
        res = await self.db.execute(
            select(LearnerSkillProfile).where(LearnerSkillProfile.user_id == user_id)
        )
        profile = res.scalar_one_or_none()
        if profile is None:
            now = self.clock.now()
            profile = LearnerSkillProfile(
                user_id=user_id,
                limiting_dimensions=[],
                model_version=self.settings.CEFR_MODEL_VERSION,
                created_at=now,
                updated_at=now,
            )
            self.db.add(profile)
            await self.db.flush()
        return profile

    async def record_phoneme_observations(
        self,
        user_id: uuid.UUID,
        phoneme_errors: list[dict[str, Any]],
    ) -> None:
        if not phoneme_errors:
            return
        now = self.clock.now()
        existing_rows = (
            (
                await self.db.execute(
                    select(LearnerPhonemeStat).where(LearnerPhonemeStat.user_id == user_id)
                )
            )
            .scalars()
            .all()
        )
        by_ipa: dict[str, LearnerPhonemeStat] = {row.ipa_phoneme: row for row in existing_rows}

        for err in phoneme_errors:
            ipa = str(err.get("ipa") or "").strip()[:16]
            if not ipa:
                continue
            acc = float(err.get("accuracy", 0.0))
            is_err = 1 if acc < 70.0 else 0
            stat = by_ipa.get(ipa)
            if stat is None:
                stat = LearnerPhonemeStat(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    ipa_phoneme=ipa,
                    attempt_count=1,
                    error_count=is_err,
                    avg_accuracy=round(acc, 1),
                    last_seen_at=now,
                )
                self.db.add(stat)
                by_ipa[ipa] = stat
            else:
                total = stat.attempt_count + 1
                stat.avg_accuracy = round((stat.avg_accuracy * stat.attempt_count + acc) / total, 1)
                stat.attempt_count = total
                stat.error_count += is_err
                stat.last_seen_at = now

    async def initialize_from_placement(
        self,
        *,
        user_id: uuid.UUID,
        test_id: uuid.UUID,
        dimension_scores: dict[str, float | None],
        stage1_pronunciation: float | None = None,
        stage2_pronunciation: float | None = None,
        avg_latency_ms: float | None = None,
        phoneme_errors: list[dict[str, Any]] | None = None,
    ) -> LearnerSkillProfile:
        profile = await self.get_or_create_profile(user_id)
        now = self.clock.now()

        profile.scripted_pronunciation_ewma = stage1_pronunciation
        profile.unscripted_pronunciation_ewma = stage2_pronunciation
        profile.pronunciation_ewma = dimension_scores.get("pronunciation")
        profile.fluency_ewma = dimension_scores.get("fluency")
        profile.vocabulary_ewma = dimension_scores.get("vocabulary")
        profile.grammar_ewma = dimension_scores.get("grammar")
        profile.interaction_ewma = dimension_scores.get("interaction")
        profile.avg_response_latency_ms = avg_latency_ms
        profile.scripted_count = 1 if stage1_pronunciation is not None else 0
        profile.unscripted_count = 1
        profile.session_count = 1

        est = estimate_cefr_from_vector(
            self._current_vector(profile),
            unscripted_count=profile.unscripted_count,
            scripted_count=profile.scripted_count,
        )
        self._apply_estimation(profile, est, now)
        self._append_snapshot(
            user_id=user_id,
            source_type="PLACEMENT",
            source_id=str(test_id),
            est=est,
            now=now,
        )
        if phoneme_errors:
            await self.record_phoneme_observations(user_id, phoneme_errors)
        await self.db.flush()
        return profile

    async def update_from_session(self, event: FeedbackGenerated) -> LearnerSkillProfile | None:
        if event.status != "FEEDBACK_READY":
            return None

        profile = await self.get_or_create_profile(event.user_id)
        now = self.clock.now()
        scores = event.skill_scores

        new_pron = scores.get("pronunciation")
        if new_pron is not None:
            profile.unscripted_pronunciation_ewma = update_ewma(
                profile.unscripted_pronunciation_ewma, new_pron, ALPHA_UNSCRIPTED
            )
        profile.pronunciation_ewma = merge_pronunciation_modalities(
            profile.scripted_pronunciation_ewma, profile.unscripted_pronunciation_ewma
        )
        profile.fluency_ewma = update_ewma(
            profile.fluency_ewma, scores.get("fluency"), ALPHA_UNSCRIPTED
        )
        profile.vocabulary_ewma = update_ewma(
            profile.vocabulary_ewma, scores.get("vocabulary"), ALPHA_UNSCRIPTED
        )
        profile.grammar_ewma = update_ewma(
            profile.grammar_ewma, scores.get("grammar"), ALPHA_UNSCRIPTED
        )
        profile.interaction_ewma = update_ewma(
            profile.interaction_ewma, scores.get("interaction"), ALPHA_UNSCRIPTED
        )

        if event.average_latency_ms is not None:
            profile.avg_response_latency_ms = update_ewma(
                profile.avg_response_latency_ms, event.average_latency_ms, ALPHA_UNSCRIPTED
            )

        profile.unscripted_count += 1
        profile.session_count += 1

        est = estimate_cefr_from_vector(
            self._current_vector(profile),
            unscripted_count=profile.unscripted_count,
            scripted_count=profile.scripted_count,
        )
        self._apply_estimation(profile, est, now)
        self._append_snapshot(
            user_id=event.user_id,
            source_type="COACH",
            source_id=str(event.session_id),
            est=est,
            now=now,
        )
        if event.phoneme_errors:
            await self.record_phoneme_observations(event.user_id, event.phoneme_errors)
        await self.db.flush()
        return profile

    async def update_from_drill(self, event: DrillAssessed) -> LearnerSkillProfile:
        profile = await self.get_or_create_profile(event.user_id)
        now = self.clock.now()

        pron_val = (
            round(0.70 * event.accuracy_score + 0.30 * event.prosody_score, 1)
            if event.prosody_score is not None
            else round(event.accuracy_score, 1)
        )
        profile.scripted_pronunciation_ewma = update_ewma(
            profile.scripted_pronunciation_ewma, pron_val, ALPHA_SCRIPTED
        )
        profile.pronunciation_ewma = merge_pronunciation_modalities(
            profile.scripted_pronunciation_ewma, profile.unscripted_pronunciation_ewma
        )
        profile.scripted_count += 1

        est = estimate_cefr_from_vector(
            self._current_vector(profile),
            unscripted_count=profile.unscripted_count,
            scripted_count=profile.scripted_count,
        )
        self._apply_estimation(profile, est, now)
        if event.phoneme_errors:
            await self.record_phoneme_observations(event.user_id, event.phoneme_errors)
        await self.db.flush()
        return profile

    @staticmethod
    def _current_vector(profile: LearnerSkillProfile) -> dict[str, float | None]:
        return {
            "pronunciation": profile.pronunciation_ewma,
            "fluency": profile.fluency_ewma,
            "vocabulary": profile.vocabulary_ewma,
            "grammar": profile.grammar_ewma,
            "interaction": profile.interaction_ewma,
        }

    def _apply_estimation(self, profile: LearnerSkillProfile, est: Any, now: Any) -> None:
        profile.estimated_cefr = est.estimated_cefr
        profile.cefr_continuous_score = est.continuous_score
        profile.cefr_confidence = est.confidence
        profile.limiting_dimensions = list(est.limiting_dimensions)
        profile.model_version = self.settings.CEFR_MODEL_VERSION
        profile.last_calibrated_at = now

    def _append_snapshot(
        self,
        *,
        user_id: uuid.UUID,
        source_type: str,
        source_id: str,
        est: Any,
        now: Any,
    ) -> None:
        self.db.add(
            LearnerCefrSnapshot(
                id=uuid.uuid4(),
                user_id=user_id,
                source_type=source_type,
                source_id=source_id,
                raw_vector=dict(est.raw_vector),
                calibrated_vector=dict(est.calibrated_vector),
                estimated_cefr=est.estimated_cefr,
                continuous_score=est.continuous_score,
                confidence=est.confidence,
                limiting_dimensions=list(est.limiting_dimensions),
                model_version=self.settings.CEFR_MODEL_VERSION,
                created_at=now,
            )
        )


def register_learner_assessment_listeners() -> None:
    """Subscribe longitudinal assessment updates to FeedbackGenerated and DrillAssessed events."""
    from app.core.database import async_session_factory

    async def _on_feedback(event: FeedbackGenerated) -> None:
        async with async_session_factory() as db:
            svc = LearnerAssessmentService(db)
            await svc.update_from_session(event)
            await db.commit()

    async def _on_drill(event: DrillAssessed) -> None:
        async with async_session_factory() as db:
            svc = LearnerAssessmentService(db)
            await svc.update_from_drill(event)
            await db.commit()

    event_bus.subscribe(FeedbackGenerated, _on_feedback)
    event_bus.subscribe(DrillAssessed, _on_drill)
