"""Adaptive Learning Path generator & AI Coach directive builder from Longitudinal Profile."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.speech.ipa import text_to_ipa
from app.models.gamification_schemas import (
    AdaptiveRecommendationSchema,
    CefrSnapshotItemSchema,
    LearnerModelResponse,
    PhonemeTroubleSpotSchema,
)
from app.models.learner_profile import (
    LearnerCefrSnapshot,
    LearnerPhonemeStat,
    LearnerSkillProfile,
)
from app.repositories.scenario import ScenarioRepository
from app.repositories.session import CoachTopicRepository
from app.services.cefr_estimator import DIMENSION_LABELS_VI, estimate_cefr_from_vector
from app.services.topic_ranking import rank_topics

_DIM_TO_COACH_SKILL = {
    "pronunciation": "Pronunciation",
    "fluency": "Fluency",
    "vocabulary": "Vocabulary",
    "grammar": "Grammar",
    "interaction": "Response Speed",
}


class AdaptivePathService:
    """Produces learner CEFR insights, adaptive recommendations, and AI Coach directives."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_coach_directives(self, user_id: uuid.UUID) -> str | None:
        """Build a concise directive injected into Gemini Coach prompt based on measured profile."""
        res = await self.db.execute(
            select(LearnerSkillProfile).where(LearnerSkillProfile.user_id == user_id)
        )
        profile = res.scalar_one_or_none()
        if not profile or not profile.estimated_cefr:
            return None

        dims = {
            "pronunciation": profile.pronunciation_ewma,
            "fluency": profile.fluency_ewma,
            "vocabulary": profile.vocabulary_ewma,
            "grammar": profile.grammar_ewma,
            "interaction": profile.interaction_ewma,
        }
        scored = [(k, v) for k, v in dims.items() if v is not None]
        weakest = min(scored, key=lambda x: x[1])[0] if scored else "fluency"
        hint_map = {
            "grammar": "Naturally model correct verb tenses and connectors in your replies.",
            "vocabulary": "Introduce 1 practical collocation per turn within their CEFR range.",
            "fluency": "Ask short, concrete open questions so the learner can speak comfortably.",
            "interaction": "Encourage follow-up opinions and smooth turn transitions.",
            "pronunciation": "Use clear, everyday rhythm and highlight natural chunk stress.",
        }
        return (
            f"Estimated CEFR {profile.estimated_cefr} ({profile.cefr_continuous_score}/5.0). "
            f"Priority growth dimension: {weakest}. {hint_map.get(weakest, '')}"
        )

    async def get_learner_model(self, user_id: uuid.UUID) -> LearnerModelResponse:
        prof_res = await self.db.execute(
            select(LearnerSkillProfile).where(LearnerSkillProfile.user_id == user_id)
        )
        profile = prof_res.scalar_one_or_none()

        snap_res = await self.db.execute(
            select(LearnerCefrSnapshot)
            .where(LearnerCefrSnapshot.user_id == user_id)
            .order_by(LearnerCefrSnapshot.created_at.asc())
            .limit(20)
        )
        snapshots = list(snap_res.scalars().all())

        ph_res = await self.db.execute(
            select(LearnerPhonemeStat)
            .where(LearnerPhonemeStat.user_id == user_id)
            .order_by(LearnerPhonemeStat.error_count.desc(), LearnerPhonemeStat.avg_accuracy.asc())
            .limit(6)
        )
        phonemes = list(ph_res.scalars().all())

        if profile is None:
            raw_vector: dict[str, float | None] = {
                "pronunciation": None,
                "fluency": None,
                "vocabulary": None,
                "grammar": None,
                "interaction": None,
            }
            est = estimate_cefr_from_vector(raw_vector, unscripted_count=0, scripted_count=0)
            session_count = 0
            scripted_count = 0
            unscripted_count = 0
            avg_latency_ms = None
            scripted_pron = None
            unscripted_pron = None
            model_ver = "cefr-est-1.0.0"
        else:
            raw_vector = {
                "pronunciation": profile.pronunciation_ewma,
                "fluency": profile.fluency_ewma,
                "vocabulary": profile.vocabulary_ewma,
                "grammar": profile.grammar_ewma,
                "interaction": profile.interaction_ewma,
            }
            est = estimate_cefr_from_vector(
                raw_vector,
                unscripted_count=profile.unscripted_count,
                scripted_count=profile.scripted_count,
            )
            session_count = profile.session_count
            scripted_count = profile.scripted_count
            unscripted_count = profile.unscripted_count
            avg_latency_ms = profile.avg_response_latency_ms
            scripted_pron = profile.scripted_pronunciation_ewma
            unscripted_pron = profile.unscripted_pronunciation_ewma
            model_ver = profile.model_version

        weak_keys = list(est.limiting_dimensions)
        if not weak_keys:
            scored = [(k, v) for k, v in raw_vector.items() if v is not None]
            if scored:
                weak_keys = [min(scored, key=lambda x: x[1])[0]]

        # Rank Coach topics using measured weak dimensions
        topic_repo = CoachTopicRepository(self.db)
        await topic_repo.ensure_defaults()
        topics = await topic_repo.list_topics(active_only=True)
        mapped_weak_skills = [_DIM_TO_COACH_SKILL.get(w, w) for w in weak_keys]
        ranked_topics = rank_topics(
            list(topics),
            user_level=est.estimated_cefr,
            user_weak_points=mapped_weak_skills,
        )

        recommendations: list[AdaptiveRecommendationSchema] = []
        if ranked_topics:
            top_topic, _ = ranked_topics[0]
            focus_label = (
                DIMENSION_LABELS_VI.get(weak_keys[0], "Giao tiếp") if weak_keys else "Giao tiếp"
            )
            recommendations.append(
                AdaptiveRecommendationSchema(
                    kind="COACH",
                    target_id=str(top_topic.id),
                    title=top_topic.title,
                    reason_vi=f"Chủ đề AI Coach phù hợp trình độ {est.estimated_cefr} giúp bứt phá '{focus_label}'.",
                    level=top_topic.min_level,
                )
            )

        # Recommend a Scenario targeting recurring phoneme trouble spots or level
        scenarios = list(await ScenarioRepository(self.db).list_scenarios())
        target_ipa = phonemes[0].ipa_phoneme if phonemes else ""
        best_scenario = None
        for sc in scenarios:
            if target_ipa and any(target_ipa in text_to_ipa(c.text) for c in sc.chunks):
                best_scenario = sc
                break
        if best_scenario is None and scenarios:
            best_scenario = min(
                scenarios,
                key=lambda s: abs(_cefr_idx(s.level) - _cefr_idx(est.estimated_cefr)),
            )
        if best_scenario:
            reason = (
                f"Chứa nhiều cụm từ luyện âm /{target_ipa}/ bạn hay gặp lỗi."
                if target_ipa
                else f"Bài học tình huống phù hợp chuẩn {est.estimated_cefr}."
            )
            recommendations.append(
                AdaptiveRecommendationSchema(
                    kind="SCENARIO",
                    target_id=best_scenario.slug,
                    title=best_scenario.title_vi,
                    reason_vi=reason,
                    level=best_scenario.level,
                )
            )

        return LearnerModelResponse(
            estimated_cefr=est.estimated_cefr,
            continuous_score=est.continuous_score,
            confidence=est.confidence,
            model_version=model_ver,
            session_count=session_count,
            scripted_count=scripted_count,
            unscripted_count=unscripted_count,
            avg_response_latency_ms=avg_latency_ms,
            scripted_pronunciation=scripted_pron,
            unscripted_pronunciation=unscripted_pron,
            raw_dimensions=est.raw_vector,
            calibrated_dimensions=est.calibrated_vector,
            limiting_dimensions=est.limiting_dimensions,
            explanation_vi=est.explanation_vi,
            phoneme_trouble_spots=[
                PhonemeTroubleSpotSchema(
                    ipa_phoneme=p.ipa_phoneme,
                    attempt_count=p.attempt_count,
                    error_count=p.error_count,
                    avg_accuracy=p.avg_accuracy,
                )
                for p in phonemes
            ],
            snapshots=[
                CefrSnapshotItemSchema(
                    source_type=s.source_type,
                    estimated_cefr=s.estimated_cefr,
                    continuous_score=s.continuous_score,
                    confidence=s.confidence,
                    created_at=s.created_at,
                )
                for s in snapshots
            ],
            recommendations=recommendations,
        )


def _cefr_idx(level: str) -> int:
    order = {"A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5}
    return order.get((level or "A1").upper(), 1)
