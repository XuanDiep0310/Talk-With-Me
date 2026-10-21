"""
Scoring and feedback orchestration service.
Adheres to Communication-First scoring rules, Rule D-10, and zero-fabrication principle.
"""

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
from app.models.scoring_schemas import (
    SessionFeedbackResponse,
    SkillScoreResponse,
)
from app.repositories.scoring import ScoringRepository
from app.repositories.session import SessionRepository
from app.services.scoring.metrics import (
    compute_filler_word_score,
    compute_fluency_score,
    compute_listening_score,
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
    "fluency": "Độ lưu loát",
    "listening": "Mức độ hiểu",
    "vocabulary": "Vốn từ ngữ cảnh",
    "response_speed": "Tốc độ phản xạ",
    "pronunciation": "Độ chuẩn phát âm",
}


class ScoringService:
    """Service handling post-session scoring, feedback generation, and retries."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.scoring_repo = ScoringRepository(db)
        self.session_repo = SessionRepository(db)
        self.settings = get_settings()
        self.clock = get_clock()

    async def get_feedback(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> tuple[int, SessionFeedbackResponse]:
        """
        Retrieve post-session feedback report.
        Returns (202, schema) if PENDING, or (200, schema) if FEEDBACK_READY, INSUFFICIENT_DATA, or FAILED.
        Returns 404 if session not found or unauthorized (AGENTS.md §7).
        """
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

        return status.HTTP_200_OK, self._to_feedback_response(feedback)

    async def generate_feedback(self, session_id: uuid.UUID) -> SessionFeedbackResponse:
        """
        Execute scoring engine for a completed session.
        Idempotent: if already in terminal state (FEEDBACK_READY, INSUFFICIENT_DATA), returns existing report.
        """
        session = await self.session_repo.get_by_id(session_id)
        if not session:
            logger.error("Cannot score non-existent session %s", session_id)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

        existing_feedback = await self.scoring_repo.get_feedback(session_id)
        if existing_feedback and existing_feedback.status in (
            "FEEDBACK_READY",
            "INSUFFICIENT_DATA",
        ):
            return self._to_feedback_response(existing_feedback)

        # 1. Safely get or create feedback record in PENDING status (idempotent)
        feedback = await self.scoring_repo.get_or_create_pending_feedback(
            session_id=session_id,
            formula_version=self.settings.SCORING_FORMULA_VERSION,
        )
        if feedback.status in ("FEEDBACK_READY", "INSUFFICIENT_DATA"):
            return self._to_feedback_response(feedback)

        # 2. Extract conversational turn metrics from transcripts
        transcripts = session.transcripts or []
        metrics = extract_session_turn_metrics(
            transcripts,
            pause_threshold_ms=self.settings.PAUSE_THRESHOLD_MS,
        )

        now = self.clock.now()

        # 3. Check Session-Level Data Sufficiency
        sufficient = is_session_data_sufficient(
            total_words=metrics["total_words"],
            user_turns=metrics["user_turns"],
            spoken_seconds=metrics["spoken_seconds"],
            min_words=self.settings.SCORING_MIN_USER_WORDS,
            min_turns=self.settings.SCORING_MIN_USER_TURNS,
            min_spoken=self.settings.SCORING_MIN_SPOKEN_SECONDS,
        )

        if not sufficient:
            # Below threshold: mark as INSUFFICIENT_DATA without fabricating scores
            logger.info("Session %s has insufficient data for scoring: %s", session_id, metrics)
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

            # Save N/A records for all 5 skills
            skill_records = [
                SessionSkillScore(
                    session_id=session_id,
                    skill_name=skill_key,
                    score=None,
                    components={},
                    na_reason="SESSION_INSUFFICIENT_DATA",
                    is_reference=(skill_key == "pronunciation"),
                )
                for skill_key in SKILL_LABELS
            ]
            await self.scoring_repo.save_skill_scores(skill_records)

            # Record audit
            audit = ScoringAudit(
                session_id=session_id,
                input_summary={
                    "metrics": {k: v for k, v in metrics.items() if k != "tokens"},
                    "reason": "INSUFFICIENT_DATA",
                },
                formula_version=self.settings.SCORING_FORMULA_VERSION,
                created_at=now,
            )
            await self.scoring_repo.record_audit(audit)

            # Transition session lifecycle
            try:
                SessionStateMachine.transition(session.status, SessionState.INSUFFICIENT_DATA)
                session.status = SessionState.INSUFFICIENT_DATA.value
                await self.session_repo.save(session)
            except Exception as e:
                logger.warning("Could not transition session state: %s", e)

            await self.db.commit()

            # Push notification & domain event
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
            return self._to_feedback_response(reloaded or feedback)

        # 4. Compute Pure Metric Components
        # Fluency: Continuity, Pause, Filler
        continuity, cont_na = compute_speech_continuity(
            spoken_seconds=metrics["spoken_seconds"],
            turn_span_seconds=metrics["turn_span_seconds"],
            target_ratio=self.settings.CONTINUITY_TARGET_RATIO,
        )
        pause, pause_na = compute_pause_score(
            long_pause_count=metrics["long_pause_count"],
            spoken_seconds=metrics["spoken_seconds"],
            penalty_per_min=self.settings.PAUSE_PENALTY_PER_MIN,
        )
        filler, filler_na = compute_filler_word_score(
            filler_count=metrics["filler_count"],
            total_words=metrics["total_words"],
            penalty_per_100=self.settings.FILLER_PENALTY_PER_100,
        )
        fluency_score, fluency_components, fluency_na = compute_fluency_score(
            continuity, pause, filler
        )

        # Vocabulary: Diversity via MTLD
        diversity_score, mtld_val, diversity_na = compute_vocabulary_diversity(
            tokens=metrics["tokens"],
            min_words=self.settings.MTLD_MIN_WORDS,
            benchmark=self.settings.MTLD_TARGET_BENCHMARK,
        )

        # Response Speed
        speed_score, speed_components, speed_na = compute_response_speed(
            average_latency_seconds=metrics["average_latency_seconds"],
            grace_period=self.settings.SPEED_GRACE_PERIOD_SECONDS,
            penalty_per_sec=self.settings.SPEED_PENALTY_PER_SECOND,
        )

        # Pronunciation
        pron_score, pron_components, pron_na = compute_pronunciation_score(
            confidences=metrics["confidences"]
        )

        # 5. Call LLM for Qualitative Analysis (Comprehension & Context Relevance)
        llm = get_llm_provider()
        history = [
            {"speaker": s.speaker, "text": s.text} for s in sorted(transcripts, key=lambda x: x.seq)
        ]
        topic_title = session.topic.title if session.topic else "General English Conversation"

        try:
            llm_eval = await llm.evaluate_post_session(
                history=history,
                topic_title=topic_title,
                user_level=session.level,
            )
        except Exception as exc:
            # Per Rule 1: Never fabricate scores on error. Mark FAILED with retryable=True
            logger.error("LLM post-session evaluation failed for session %s: %s", session_id, exc)
            feedback.status = "FAILED"
            feedback.retryable = True
            feedback.error_message = f"Lỗi phân tích hội thoại từ AI: {exc}"
            feedback.overall_score = None
            feedback.generated_at = now
            await self.scoring_repo.save_feedback(feedback)

            try:
                if session.status == SessionState.ACTIVE.value:
                    SessionStateMachine.transition(SessionState.ACTIVE, SessionState.ENDING)
                    SessionStateMachine.transition(SessionState.ENDING, SessionState.ENDED)
                    session.status = SessionState.ENDED.value
                SessionStateMachine.transition(session.status, SessionState.FAILED)
                session.status = SessionState.FAILED.value
                await self.session_repo.save(session)
            except Exception as e:
                logger.warning("Could not transition session to FAILED: %s", e)

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
            return self._to_feedback_response(feedback, skill_scores=[])

        # 6. Synthesize Listening & Vocabulary with LLM results
        listening_score, listening_components, listening_na = compute_listening_score(
            relevance=llm_eval.response_relevance,
            task_completion=llm_eval.task_completion,
        )
        vocab_score, vocab_components, vocab_na = compute_vocabulary_score(
            diversity=diversity_score,
            context_relevance=llm_eval.context_relevance,
        )
        if mtld_val is not None:
            vocab_components["mtld"] = mtld_val

        # 7. Compute Overall Communication Score adhering to D-10
        overall_score, partial = compute_overall_score(
            fluency=fluency_score,
            listening=listening_score,
            vocabulary=vocab_score,
            response_speed=speed_score,
            pronunciation=pron_score,
        )

        # 8. Persist Skill Scores
        skill_records = [
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
                skill_name="listening",
                score=listening_score,
                components=listening_components,
                na_reason=listening_na,
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
                skill_name="response_speed",
                score=speed_score,
                components=speed_components,
                na_reason=speed_na,
                is_reference=False,
            ),
            SessionSkillScore(
                session_id=session_id,
                skill_name="pronunciation",
                score=pron_score,
                components=pron_components,
                na_reason=pron_na,
                is_reference=True,  # Always reference per Rule 2
            ),
        ]
        await self.scoring_repo.save_skill_scores(skill_records)

        # 9. Update SessionFeedback
        feedback.status = "FEEDBACK_READY"
        feedback.overall_score = overall_score
        feedback.partial = partial
        feedback.strengths = llm_eval.strengths
        feedback.improvements = llm_eval.improvements
        feedback.next_practice = llm_eval.next_practice
        feedback.retryable = False
        feedback.error_message = None
        feedback.generated_at = now
        await self.scoring_repo.save_feedback(feedback)

        # 10. Record Scoring Audit
        audit = ScoringAudit(
            session_id=session_id,
            input_summary={
                "metrics": {k: v for k, v in metrics.items() if k != "tokens"},
                "llm_eval": llm_eval.model_dump(),
                "overall_score": overall_score,
                "partial": partial,
            },
            formula_version=self.settings.SCORING_FORMULA_VERSION,
            created_at=now,
        )
        await self.scoring_repo.record_audit(audit)

        # 11. Transition session lifecycle to FEEDBACK_READY
        try:
            if session.status != SessionState.FEEDBACK_READY.value:
                SessionStateMachine.transition(session.status, SessionState.FEEDBACK_READY)
                session.status = SessionState.FEEDBACK_READY.value
                await self.session_repo.save(session)
        except Exception as e:
            logger.warning("Could not transition session state: %s", e)

        await self.db.commit()

        # 12. Push WebSocket event & emit domain event
        await session_ws_manager.notify_session(
            session_id,
            {
                "type": "feedback.ready",
                "sessionId": str(session_id),
                "status": "FEEDBACK_READY",
                "overallScore": overall_score,
            },
        )
        await event_bus.publish(
            FeedbackGenerated(
                session_id=session_id,
                user_id=session.user_id,
                status="FEEDBACK_READY",
                overall_score=overall_score,
                partial=partial,
                skill_scores={
                    "fluency": fluency_score,
                    "listening": listening_score,
                    "vocabulary": vocab_score,
                    "response_speed": speed_score,
                    "pronunciation": pron_score,
                },
            )
        )

        reloaded = await self.scoring_repo.get_feedback(session_id)
        return self._to_feedback_response(reloaded or feedback)

    async def retry_feedback(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> SessionFeedbackResponse:
        """
        Manually retry feedback generation for a failed session.
        Transitions session state back from FAILED to ENDED per AGENTS.md §9.
        """
        session = await self.session_repo.get_by_id_and_user(session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

        feedback = await self.scoring_repo.get_feedback(session_id)
        if not feedback:
            feedback = SessionFeedback(
                session_id=session_id,
                status="PENDING",
                formula_version=self.settings.SCORING_FORMULA_VERSION,
                retryable=False,
            )
            feedback = await self.scoring_repo.create_feedback(feedback)
        else:
            feedback.status = "PENDING"
            feedback.retryable = False
            feedback.error_message = None
            await self.scoring_repo.save_feedback(feedback)

        # Session state machine transition: FAILED -> ENDED
        if session.status == SessionState.FAILED.value:
            try:
                SessionStateMachine.transition(SessionState.FAILED, SessionState.ENDED)
                session.status = SessionState.ENDED.value
                await self.session_repo.save(session)
            except Exception as e:
                logger.warning("Could not transition FAILED to ENDED: %s", e)

        await self.db.commit()

        # Enqueue background feedback job
        from app.services.scoring.tasks import enqueue_feedback_job

        await enqueue_feedback_job(session_id)

        return SessionFeedbackResponse(
            session_id=session_id,
            status="PENDING",
            formula_version=self.settings.SCORING_FORMULA_VERSION,
        )

    def _to_feedback_response(
        self,
        feedback: SessionFeedback,
        skill_scores: Sequence[SessionSkillScore] | None = None,
    ) -> SessionFeedbackResponse:
        """Convert ORM SessionFeedback into API response schema."""
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
                        is_reference=(skill_key == "pronunciation"),
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
