"""Scoring Engine v2.0.0 orchestration service (Azure Speech Acoustic + Gemini Semantic)."""

from __future__ import annotations

import logging
import uuid
from collections.abc import Sequence

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import get_clock
from app.core.config import get_settings
from app.core.events import FeedbackGenerated, event_bus
from app.core.providers.llm_provider import get_llm_provider
from app.core.ws_manager import session_ws_manager
from app.models.scoring import ScoringAudit, SessionFeedback, SessionSkillScore
from app.models.scoring_schemas import SessionFeedbackResponse, SkillScoreResponse
from app.repositories.scoring import ScoringRepository
from app.repositories.session import SessionRepository
from app.services.admin_audit import AdminAudit
from app.services.scoring.metrics import (
    compute_filler_word_score,
    compute_fluency_score,
    compute_grammar_score,
    compute_interaction_score,
    compute_overall_score,
    compute_pause_score,
    compute_pronunciation_score,
    compute_response_speed,
    compute_speech_continuity,
    compute_vocabulary_diversity,
    compute_vocabulary_score,
    extract_session_turn_metrics,
    is_session_data_sufficient,
)
from app.services.session_state_machine import SessionState, SessionStateMachine

logger = logging.getLogger(__name__)

SKILL_LABELS = {
    "pronunciation": "Phát âm",
    "fluency": "Độ lưu loát",
    "vocabulary": "Vốn từ vựng",
    "grammar": "Ngữ pháp",
    "interaction": "Tương tác & Mạch lạc",
}


class ScoringService:
    """Service handling post-session 5-dimension scoring, feedback generation, and retries."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.scoring_repo = ScoringRepository(db)
        self.session_repo = SessionRepository(db)
        self.settings = get_settings()
        self.clock = get_clock()

    async def get_feedback(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> tuple[int, SessionFeedbackResponse]:
        session = await self.session_repo.get_by_id_and_user(session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

        feedback = await self.scoring_repo.get_feedback(session_id)
        if not feedback or feedback.status == "PENDING":
            return status.HTTP_202_ACCEPTED, SessionFeedbackResponse(
                session_id=session_id,
                status="PENDING",
                formula_version=self.settings.SCORING_FORMULA_VERSION,
            )

        return status.HTTP_200_OK, self.feedback_response(feedback)

    async def generate_feedback(
        self, session_id: uuid.UUID, *, preview: bool = False
    ) -> SessionFeedbackResponse:
        await self.session_repo.lock(session_id)
        session = await self.session_repo.get_by_id(session_id)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

        formula_ver = self.settings.SCORING_FORMULA_VERSION
        if preview:
            feedback = SessionFeedback(
                session_id=session_id,
                status="PENDING",
                formula_version=formula_ver,
                strengths=[],
                improvements=[],
                partial=False,
                retryable=False,
            )
        else:
            feedback = await self.scoring_repo.get_or_create_pending_feedback(
                session_id=session_id, formula_version=formula_ver
            )
            if feedback.status in ("FEEDBACK_READY", "INSUFFICIENT_DATA"):
                return self.feedback_response(feedback)

        transcripts = session.transcripts or []
        metrics = extract_session_turn_metrics(
            transcripts, pause_threshold_ms=self.settings.PAUSE_THRESHOLD_MS
        )
        now = self.clock.now()

        sufficient = is_session_data_sufficient(
            total_words=metrics["total_words"],
            user_turns=metrics["user_turns"],
            spoken_seconds=metrics["spoken_seconds"],
            min_words=self.settings.SCORING_MIN_USER_WORDS,
            min_turns=self.settings.SCORING_MIN_USER_TURNS,
            min_spoken=self.settings.SCORING_MIN_SPOKEN_SECONDS,
        )

        if not sufficient:
            feedback.status = "INSUFFICIENT_DATA"
            feedback.overall_score = None
            feedback.partial = False
            feedback.retryable = False
            feedback.error_message = (
                "Dữ liệu luyện nói chưa đủ ngưỡng tối thiểu "
                f"(cần ít nhất {self.settings.SCORING_MIN_USER_WORDS} từ, "
                f"{self.settings.SCORING_MIN_USER_TURNS} lượt nói, "
                f"và {self.settings.SCORING_MIN_SPOKEN_SECONDS}s phát biểu)."
            )
            feedback.generated_at = now
            skill_records = [
                SessionSkillScore(
                    session_id=session_id,
                    skill_name=skill_key,
                    score=None,
                    components={},
                    na_reason="SESSION_INSUFFICIENT_DATA",
                    is_reference=False,
                )
                for skill_key in SKILL_LABELS
            ]
            if preview:
                return self.feedback_response(feedback, skill_records)
            await self.scoring_repo.save_skill_scores(skill_records)
            await self.scoring_repo.record_audit(
                ScoringAudit(
                    session_id=session_id,
                    input_summary={
                        "metrics": {
                            k: v for k, v in metrics.items() if k not in {"tokens", "all_user_text"}
                        },
                        "reason": "INSUFFICIENT_DATA",
                    },
                    formula_version=formula_ver,
                    created_at=now,
                )
            )
            try:
                SessionStateMachine.transition(session.status, SessionState.INSUFFICIENT_DATA)
                session.status = SessionState.INSUFFICIENT_DATA.value
                await self.session_repo.save(session)
            except Exception:
                pass
            await self.db.commit()
            await session_ws_manager.notify_session(
                session_id,
                {
                    "type": "feedback.ready",
                    "sessionId": str(session_id),
                    "status": "INSUFFICIENT_DATA",
                },
            )
            await event_bus.publish(
                FeedbackGenerated(
                    session_id=session_id,
                    user_id=session.user_id,
                    status="INSUFFICIENT_DATA",
                    overall_score=None,
                    partial=False,
                    skill_scores=dict.fromkeys(SKILL_LABELS),
                )
            )
            reloaded = await self.scoring_repo.get_feedback(session_id)
            return self.feedback_response(reloaded or feedback)

        # 1. Acoustic & Temporal Metrics
        continuity, _ = compute_speech_continuity(
            spoken_seconds=metrics["spoken_seconds"],
            turn_span_seconds=metrics["turn_span_seconds"],
            target_ratio=self.settings.CONTINUITY_TARGET_RATIO,
        )
        pause, _ = compute_pause_score(
            long_pause_count=metrics["long_pause_count"],
            spoken_seconds=metrics["spoken_seconds"],
            penalty_per_min=self.settings.PAUSE_PENALTY_PER_MIN,
        )
        filler, _ = compute_filler_word_score(
            filler_count=metrics["filler_count"],
            total_words=metrics["spoken_word_count"],
            penalty_per_100=self.settings.FILLER_PENALTY_PER_100,
        )
        fluency_score, fluency_components, fluency_na = compute_fluency_score(
            continuity, pause, filler, azure_fluency=metrics["avg_azure_fluency"]
        )
        pron_score, pron_components, pron_na = compute_pronunciation_score(
            accuracies=metrics["accuracies"],
            prosodies=metrics["prosodies"],
        )
        diversity_score, mtld_val, _ = compute_vocabulary_diversity(
            tokens=metrics["tokens"],
            min_words=self.settings.MTLD_MIN_WORDS,
            benchmark=self.settings.MTLD_TARGET_BENCHMARK,
        )
        speed_score, _, _ = compute_response_speed(
            average_latency_seconds=metrics["average_latency_seconds"],
            grace_period=self.settings.SPEED_GRACE_PERIOD_SECONDS,
            penalty_per_sec=self.settings.SPEED_PENALTY_PER_SECOND,
        )

        # 2. Gemini Semantic Assessment (Vocabulary, Grammar, Interaction & Coherence)
        history = [
            {"speaker": s.speaker, "text": s.text}
            for s in sorted(transcripts, key=lambda x: x.seq)
            if s.is_final
        ]
        topic_title = session.coach_title("General English Conversation")

        try:
            llm = get_llm_provider()
            llm_eval = await llm.evaluate_post_session(
                history=history,
                topic_title=topic_title,
                user_level=session.level,
            )
        except Exception as exc:
            logger.error(
                "Gemini post-session evaluation failed for %s: %s", session_id, type(exc).__name__
            )
            feedback.status = "FAILED"
            feedback.retryable = True
            feedback.error_message = (
                "Dịch vụ đánh giá AI tạm thời không khả dụng. Vui lòng thử lại."
            )
            feedback.overall_score = None
            feedback.generated_at = now
            if preview:
                return self.feedback_response(feedback, skill_scores=[])
            await self.scoring_repo.save_feedback(feedback)
            try:
                if session.status == SessionState.ACTIVE.value:
                    SessionStateMachine.transition(SessionState.ACTIVE, SessionState.ENDING)
                    SessionStateMachine.transition(SessionState.ENDING, SessionState.ENDED)
                    session.status = SessionState.ENDED.value
                SessionStateMachine.transition(session.status, SessionState.FAILED)
                session.status = SessionState.FAILED.value
                await self.session_repo.save(session)
            except Exception:
                pass
            await self.db.commit()
            await session_ws_manager.notify_session(
                session_id,
                {
                    "type": "feedback.ready",
                    "sessionId": str(session_id),
                    "status": "FAILED",
                    "retryable": True,
                },
            )
            return self.feedback_response(feedback, skill_scores=[])

        # 3. Synthesize 5 Dimensions
        vocab_score, vocab_components, vocab_na = compute_vocabulary_score(
            diversity=diversity_score,
            gemini_vocabulary=llm_eval.vocabulary_score,
            cefr_band=llm_eval.vocabulary_cefr_band,
        )
        if mtld_val is not None:
            vocab_components["mtld"] = mtld_val

        grammar_score, grammar_components, grammar_na = compute_grammar_score(
            gemini_grammar=llm_eval.grammar_score,
            cefr_band=llm_eval.grammar_cefr_band,
            grammar_errors=[e.model_dump() for e in llm_eval.grammar_errors],
        )

        interaction_score, interaction_components, interaction_na = compute_interaction_score(
            gemini_interaction=llm_eval.interaction_score,
            gemini_coherence=llm_eval.coherence_score,
            response_speed_score=speed_score,
            average_latency_seconds=metrics["average_latency_seconds"],
        )

        overall_score, partial = compute_overall_score(
            pronunciation=pron_score,
            fluency=fluency_score,
            vocabulary=vocab_score,
            grammar=grammar_score,
            interaction=interaction_score,
        )

        skill_records = [
            SessionSkillScore(
                session_id=session_id,
                skill_name="pronunciation",
                score=pron_score,
                components=pron_components,
                na_reason=pron_na,
                is_reference=False,
            ),
            SessionSkillScore(
                session_id=session_id,
                skill_name="fluency",
                score=fluency_score,
                components=fluency_components,
                na_reason=fluency_na,
                is_reference=False,
            ),
            SessionSkillScore(
                session_id=session_id,
                skill_name="vocabulary",
                score=vocab_score,
                components=vocab_components,
                na_reason=vocab_na,
                is_reference=False,
            ),
            SessionSkillScore(
                session_id=session_id,
                skill_name="grammar",
                score=grammar_score,
                components=grammar_components,
                na_reason=grammar_na,
                is_reference=False,
            ),
            SessionSkillScore(
                session_id=session_id,
                skill_name="interaction",
                score=interaction_score,
                components=interaction_components,
                na_reason=interaction_na,
                is_reference=False,
            ),
        ]

        feedback.status = "FEEDBACK_READY"
        feedback.formula_version = formula_ver
        feedback.overall_score = overall_score
        feedback.partial = partial
        feedback.strengths = llm_eval.strengths
        feedback.improvements = llm_eval.improvements
        feedback.next_practice = llm_eval.next_practice
        feedback.retryable = False
        feedback.error_message = None
        feedback.generated_at = now
        if preview:
            return self.feedback_response(feedback, skill_records)

        await self.scoring_repo.save_skill_scores(skill_records)
        await self.scoring_repo.save_feedback(feedback)
        await self.scoring_repo.record_audit(
            ScoringAudit(
                session_id=session_id,
                input_summary={
                    "metrics": {
                        k: v for k, v in metrics.items() if k not in {"tokens", "all_user_text"}
                    },
                    "llm_eval": llm_eval.model_dump(
                        include={
                            "vocabulary_score",
                            "grammar_score",
                            "interaction_score",
                            "coherence_score",
                        }
                    ),
                    "overall_score": overall_score,
                    "partial": partial,
                },
                formula_version=formula_ver,
                created_at=now,
            )
        )

        try:
            if session.status != SessionState.FEEDBACK_READY.value:
                SessionStateMachine.transition(session.status, SessionState.FEEDBACK_READY)
                session.status = SessionState.FEEDBACK_READY.value
                await self.session_repo.save(session)
        except Exception:
            pass

        await self.db.commit()

        await session_ws_manager.notify_session(
            session_id,
            {
                "type": "feedback.ready",
                "sessionId": str(session_id),
                "status": "FEEDBACK_READY",
                "overallScore": overall_score,
            },
        )
        avg_lat_ms = (
            round(metrics["average_latency_seconds"] * 1000.0, 1)
            if metrics["average_latency_seconds"] is not None
            else None
        )
        await event_bus.publish(
            FeedbackGenerated(
                session_id=session_id,
                user_id=session.user_id,
                status="FEEDBACK_READY",
                overall_score=overall_score,
                partial=partial,
                skill_scores={
                    "pronunciation": pron_score,
                    "fluency": fluency_score,
                    "vocabulary": vocab_score,
                    "grammar": grammar_score,
                    "interaction": interaction_score,
                },
                average_latency_ms=avg_lat_ms,
                phoneme_errors=metrics["phoneme_errors"],
                modality="UNSCRIPTED",
            )
        )

        reloaded = await self.scoring_repo.get_feedback(session_id)
        return self.feedback_response(reloaded or feedback)

    async def retry_feedback(
        self,
        session_id: uuid.UUID,
        user_id: uuid.UUID | None,
        *,
        audit: AdminAudit | None = None,
    ) -> SessionFeedbackResponse:
        if user_id is None and audit is None:
            raise ValueError("Retry requires a learner or an administrator.")
        session = await self.session_repo.lock(session_id, user_id)
        if session is None:
            raise HTTPException(
                404, detail={"code": "SESSION_NOT_FOUND", "message": "Session not found."}
            )

        feedback = await self.scoring_repo.get_feedback(session_id)
        if (
            session.status == SessionState.ENDED.value
            and feedback is not None
            and feedback.status == "PENDING"
        ):
            return self.feedback_response(feedback)
        if (
            session.status != SessionState.FAILED.value
            or feedback is None
            or feedback.status != "FAILED"
            or not feedback.retryable
        ):
            raise HTTPException(
                409,
                detail={"code": "FEEDBACK_NOT_RETRYABLE", "message": "Feedback cannot be retried."},
            )

        SessionStateMachine.transition(SessionState.FAILED, SessionState.ENDED)
        session.status = SessionState.ENDED.value
        feedback.status = "PENDING"
        feedback.retryable = False
        feedback.error_message = None
        result = self.feedback_response(feedback)
        if audit is not None:
            audit.record("FEEDBACK_RETRY_REQUESTED", "SESSION", session_id)
        await self.db.commit()

        from app.services.scoring.tasks import enqueue_feedback_job

        try:
            await enqueue_feedback_job(session_id, strict=True)
        except Exception as exc:
            await self.mark_job_failed(session_id)
            raise HTTPException(
                503,
                detail={
                    "code": "FEEDBACK_QUEUE_UNAVAILABLE",
                    "message": "Feedback queue is temporarily unavailable.",
                },
            ) from exc
        return result

    async def mark_job_failed(self, session_id: uuid.UUID) -> None:
        await self.db.rollback()
        session = await self.session_repo.lock(session_id)
        feedback = await self.scoring_repo.get_feedback(session_id)
        if (
            session is not None
            and session.status == SessionState.ENDED.value
            and feedback is not None
            and feedback.status == "PENDING"
        ):
            SessionStateMachine.transition(SessionState.ENDED, SessionState.FAILED)
            session.status = SessionState.FAILED.value
            feedback.status = "FAILED"
            feedback.retryable = True
            feedback.error_message = "Không thể xử lý chấm điểm. Vui lòng thử lại."
            await self.db.commit()

    def feedback_response(
        self,
        feedback: SessionFeedback,
        skill_scores: Sequence[SessionSkillScore] | None = None,
    ) -> SessionFeedbackResponse:
        scores: Sequence[SessionSkillScore]
        if skill_scores is not None:
            scores = skill_scores
        elif "skill_scores" in feedback.__dict__ and feedback.skill_scores is not None:
            scores = feedback.skill_scores
        else:
            scores = []

        skill_responses: list[SkillScoreResponse] = []
        scores_by_name = {s.skill_name: s for s in scores}

        for skill_key, label in SKILL_LABELS.items():
            record = scores_by_name.get(skill_key)
            if record:
                skill_responses.append(
                    SkillScoreResponse(
                        skill_name=skill_key,
                        label=label,
                        score=record.score,
                        is_reference=record.is_reference,
                        na_reason=record.na_reason,
                        components=record.components or {},
                    )
                )
            else:
                skill_responses.append(
                    SkillScoreResponse(
                        skill_name=skill_key,
                        label=label,
                        score=None,
                        is_reference=False,
                        na_reason="NO_DATA",
                        components={},
                    )
                )

        return SessionFeedbackResponse(
            session_id=feedback.session_id,
            status=feedback.status,
            formula_version=feedback.formula_version,
            overall_score=feedback.overall_score,
            partial=feedback.partial,
            retryable=feedback.retryable,
            error_message=feedback.error_message,
            skills=skill_responses,
            strengths=feedback.strengths or [],
            improvements=feedback.improvements or [],
            next_practice=feedback.next_practice,
            generated_at=feedback.generated_at,
        )
