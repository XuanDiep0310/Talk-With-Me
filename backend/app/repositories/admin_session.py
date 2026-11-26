import uuid
from collections.abc import Sequence
from typing import cast

from sqlalchemy import Select, func, literal, or_, select, tuple_, type_coerce
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.admin_cursor import decode_cursor
from app.models.admin_session_schemas import AdminSessionFilters
from app.models.auth import User
from app.models.scenario import RoleplayEvaluation, Scenario
from app.models.scoring import SessionFeedback
from app.models.session import CoachTopic, Session, TranscriptSegment

SessionRow = tuple[Session, str, str, str | None, SessionFeedback | None]


class AdminSessionRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.title = func.coalesce(
            Session.topic_snapshot["title"].as_string(), CoachTopic.title, Scenario.title_vi
        )

    def summary_query(self) -> Select[SessionRow]:
        return (
            select(Session, User.email, User.full_name, self.title, SessionFeedback)
            .join(User, User.id == Session.user_id)
            .outerjoin(CoachTopic, CoachTopic.id == Session.topic_id)
            .outerjoin(Scenario, Scenario.id == Session.scenario_id)
            .outerjoin(SessionFeedback, SessionFeedback.session_id == Session.id)
        )

    async def list(self, filters: AdminSessionFilters) -> list[SessionRow]:
        query = self.summary_query()
        if filters.type:
            query = query.where(Session.type == filters.type)
        if filters.status:
            query = query.where(Session.status == filters.status.value)
        if filters.user_id:
            query = query.where(Session.user_id == filters.user_id)
        if filters.q:
            query = query.where(
                or_(
                    User.email.icontains(filters.q, autoescape=True),
                    User.full_name.icontains(filters.q, autoescape=True),
                    self.title.icontains(filters.q, autoescape=True),
                    Scenario.title_en.icontains(filters.q, autoescape=True),
                )
            )
        if filters.from_date:
            query = query.where(Session.created_at >= filters.from_date)
        if filters.to_date:
            query = query.where(Session.created_at < filters.to_date)
        if filters.min_score is not None:
            query = query.where(SessionFeedback.overall_score >= filters.min_score)
        if filters.max_score is not None:
            query = query.where(SessionFeedback.overall_score <= filters.max_score)
        if filters.label:
            if self.db.get_bind().dialect.name == "postgresql":
                query = query.where(type_coerce(Session.qa_labels, JSONB).contains([filters.label]))
            else:
                labels = func.json_each(Session.qa_labels).table_valued(
                    "value", joins_implicitly=True
                )
                query = query.where(
                    select(1).select_from(labels).where(labels.c.value == filters.label).exists()
                )
        if filters.cursor:
            at, item_id, _ = decode_cursor(filters.cursor)
            query = query.where(
                tuple_(Session.created_at, Session.id) < tuple_(literal(at), literal(item_id))
            )
        rows = (
            await self.db.execute(
                query.order_by(Session.created_at.desc(), Session.id.desc()).limit(
                    filters.limit + 1
                )
            )
        ).all()
        return [cast(SessionRow, tuple(row)) for row in rows]

    async def summary(self, session_id: uuid.UUID) -> SessionRow | None:
        row = (
            await self.db.execute(self.summary_query().where(Session.id == session_id))
        ).one_or_none()
        return cast(SessionRow, tuple(row)) if row is not None else None

    async def detail_counts(self, session_id: uuid.UUID) -> tuple[int, float | None]:
        seg = TranscriptSegment
        ordered = (
            select(
                seg.speaker,
                seg.speech_ms,
                func.lag(seg.speaker).over(order_by=(seg.seq, seg.pk)).label("previous"),
            )
            .where(seg.session_id == session_id, seg.is_final.is_(True))
            .subquery()
        )
        turns, speech_ms = (
            await self.db.execute(
                select(
                    func.count().filter(ordered.c.speaker.is_distinct_from(ordered.c.previous)),
                    func.sum(ordered.c.speech_ms),
                )
            )
        ).one()
        return int(turns), speech_ms / 1000 if speech_ms is not None else None

    async def roleplay(self, session_id: uuid.UUID) -> RoleplayEvaluation | None:
        return (
            await self.db.scalars(
                select(RoleplayEvaluation).where(RoleplayEvaluation.session_id == session_id)
            )
        ).one_or_none()

    async def cursor_segment(
        self, session_id: uuid.UUID, pk: uuid.UUID
    ) -> TranscriptSegment | None:
        seg = TranscriptSegment
        return (
            await self.db.scalars(
                select(seg).where(
                    seg.session_id == session_id, seg.pk == pk, seg.is_final.is_(True)
                )
            )
        ).one_or_none()

    async def transcript(
        self, session_id: uuid.UUID, after: TranscriptSegment | None, limit: int
    ) -> Sequence[TranscriptSegment]:
        seg = TranscriptSegment
        query = select(seg).where(seg.session_id == session_id, seg.is_final.is_(True))
        if after:
            query = query.where(
                tuple_(seg.seq, seg.pk) > tuple_(literal(after.seq), literal(after.pk))
            )
        return (await self.db.scalars(query.order_by(seg.seq, seg.pk).limit(limit))).all()
