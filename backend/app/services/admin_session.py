import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.admin_cursor import encode_cursor
from app.models.admin_session_schemas import (
    AdminQaLabels,
    AdminQaNote,
    AdminRoleplayRequirement,
    AdminRoleplayResult,
    AdminSessionDetail,
    AdminSessionFilters,
    AdminSessionPage,
    AdminSessionSummary,
    AdminTranscriptItem,
    AdminTranscriptPage,
)
from app.models.scoring import SessionFeedback
from app.models.scoring_schemas import SessionFeedbackResponse
from app.models.session import Session, TranscriptSegment
from app.repositories.admin_session import AdminSessionRepository
from app.repositories.session import SessionRepository
from app.services.admin_audit import AdminAudit
from app.services.scoring.service import ScoringService


def not_found() -> HTTPException:
    return HTTPException(404, detail={"code": "SESSION_NOT_FOUND", "message": "Session not found."})


def summarize(
    session: Session,
    email: str,
    learner_name: str,
    title: str | None,
    feedback: SessionFeedback | None,
) -> AdminSessionSummary:
    return AdminSessionSummary.model_validate(
        {
            **{
                field: getattr(session, field)
                for field in (
                    "id",
                    "user_id",
                    "type",
                    "status",
                    "created_at",
                    "started_at",
                    "ended_at",
                    "duration_seconds",
                    "qa_labels",
                )
            },
            "email": email,
            "learner_name": learner_name,
            "title": title,
            "overall_score": feedback.overall_score if feedback else None,
            "feedback_status": feedback.status if feedback else None,
        }
    )


def transcript_item(segment: TranscriptSegment) -> AdminTranscriptItem:
    source = segment.speech_source or ("AI" if segment.speaker == "AI" else "LEGACY")
    measured = source == "STT"
    return AdminTranscriptItem(
        pk=segment.pk,
        id=segment.id,
        seq=segment.seq,
        speaker=segment.speaker,
        text=segment.text,
        source=source,
        start_ms=segment.start_ms if measured else None,
        end_ms=segment.end_ms if measured else None,
        confidence=segment.confidence if source in {"STT", "STT_NO_WORD_TIMES"} else None,
        speech_ms=segment.speech_ms,
        long_pause_count=segment.long_pause_count,
        long_pause_ms=segment.long_pause_ms,
        word_count=segment.word_count,
        filler_count=segment.filler_count,
        response_latency_ms=segment.response_latency_ms,
    )


class AdminSessionService:
    def __init__(self, db: AsyncSession, audit: AdminAudit) -> None:
        self.db = db
        self.audit = audit
        self.repo = AdminSessionRepository(db)
        self.session_repo = SessionRepository(db)

    async def list(self, filters: AdminSessionFilters) -> AdminSessionPage:
        rows = await self.repo.list(filters)
        items = [summarize(*row) for row in rows[: filters.limit]]
        last = items[-1] if len(rows) > filters.limit else None
        return AdminSessionPage(
            items=items, next_cursor=encode_cursor(last.created_at, last.id) if last else None
        )

    async def detail(self, session_id: uuid.UUID) -> AdminSessionDetail:
        row = await self.repo.summary(session_id)
        if row is None:
            raise not_found()
        session, email, learner_name, title, feedback = row
        summary = summarize(session, email, learner_name, title, feedback)
        turns, spoken_seconds = await self.repo.detail_counts(session_id)
        evaluation = await self.repo.roleplay(session_id) if summary.type == "ROLEPLAY" else None
        roleplay = None
        if evaluation:
            roleplay = AdminRoleplayResult(
                status=evaluation.status,
                passed=evaluation.passed if evaluation.status == "COMPLETED" else None,
                requirements=[
                    AdminRoleplayRequirement.model_validate(item)
                    for item in evaluation.requirements_evaluation
                ],
            )
        score = None
        if feedback is not None:
            from app.repositories.scoring import ScoringRepository

            loaded = await ScoringRepository(self.db).get_feedback(session_id)
            if loaded is not None:
                score = ScoringService(self.db).feedback_response(loaded)
                if score.error_message and score.status == "FAILED":
                    score.error_message = "Không thể xử lý chấm điểm."
        return AdminSessionDetail(
            **summary.model_dump(),
            turn_count=turns,
            spoken_seconds=spoken_seconds,
            end_reason=session.end_reason,
            feedback=score,
            roleplay=roleplay,
            qa_note=session.qa_note,
            qa_preview=(
                SessionFeedbackResponse.model_validate(session.qa_preview["feedback"])
                if session.qa_preview
                else None
            ),
        )

    async def update_note(self, session_id: uuid.UUID, body: AdminQaNote) -> AdminQaNote:
        session = await self.session_repo.lock(session_id)
        if session is None:
            raise not_found()
        note = body.note or None
        if session.qa_note != note:
            self.audit.record(
                "SESSION_QA_NOTE_UPDATED",
                "SESSION",
                session_id,
                {"hasNote": bool(session.qa_note)},
                {"hasNote": bool(note)},
            )
            session.qa_note = note
            await self.db.commit()
        return AdminQaNote(note=note)

    async def reevaluate(
        self, session_id: uuid.UUID, request_id: uuid.UUID
    ) -> SessionFeedbackResponse:
        session = await self.session_repo.lock(session_id)
        if session is None:
            raise not_found()
        if session.ended_at is None:
            raise HTTPException(
                409,
                detail={
                    "code": "SESSION_NOT_ENDED",
                    "message": "Only ended sessions can be re-evaluated.",
                },
            )
        previous = session.qa_preview
        if previous is not None and previous.get("requestId") == str(request_id):
            return SessionFeedbackResponse.model_validate(previous["feedback"])
        result = await ScoringService(self.db).generate_feedback(session_id, preview=True)
        session.qa_preview = {
            "requestId": str(request_id),
            "feedback": result.model_dump(mode="json", by_alias=True),
        }
        self.audit.record(
            "SESSION_QA_REEVALUATED",
            "SESSION",
            session_id,
            after={
                "status": result.status,
                "formulaVersion": result.formula_version,
                "overallScore": result.overall_score,
            },
        )
        await self.db.commit()
        return result

    async def transcript(
        self, session_id: uuid.UUID, cursor: uuid.UUID | None, limit: int
    ) -> AdminTranscriptPage:
        if await self.db.get(Session, session_id) is None:
            raise not_found()
        after = await self.repo.cursor_segment(session_id, cursor) if cursor else None
        if cursor and after is None:
            raise HTTPException(
                422, detail={"code": "INVALID_CURSOR", "message": "Invalid transcript cursor."}
            )
        rows = await self.repo.transcript(session_id, after, limit + 1)
        items = [transcript_item(segment) for segment in rows[:limit]]
        self.audit.record("SESSION_TRANSCRIPT_VIEWED", "SESSION", session_id)
        await self.db.commit()
        return AdminTranscriptPage(
            items=items, next_cursor=items[-1].pk if len(rows) > limit else None
        )

    async def update_labels(self, session_id: uuid.UUID, body: AdminQaLabels) -> AdminQaLabels:
        session = await self.session_repo.lock(session_id)
        if session is None:
            raise not_found()
        labels = sorted(set(body.labels))
        if labels != session.qa_labels:
            self.audit.record(
                "SESSION_QA_LABELS_UPDATED",
                "SESSION",
                session_id,
                {"labels": session.qa_labels},
                {"labels": labels},
            )
            session.qa_labels = list(labels)
        await self.db.commit()
        return AdminQaLabels(labels=labels)
