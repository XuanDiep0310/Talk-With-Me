"""
Repositories for Coach Topics, Sessions, and Transcripts.
"""

import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auth import User
from app.models.session import CoachTopic, Session, TranscriptSegment
from app.seeds.coach_topics import COACH_TOPICS_SEED


class CoachTopicRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_topics(
        self, q: str | None = None, active_only: bool = True
    ) -> Sequence[CoachTopic]:
        stmt = select(CoachTopic)
        if active_only:
            stmt = stmt.where(CoachTopic.is_active == True)  # noqa: E712
        if q and q.strip():
            query_str = f"%{q.strip().lower()}%"
            stmt = stmt.where(
                func.lower(CoachTopic.title).like(query_str)
                | func.lower(CoachTopic.description).like(query_str)
                | func.lower(CoachTopic.category).like(query_str)
            )
        stmt = stmt.order_by(
            CoachTopic.sort_order.asc(), CoachTopic.created_at.asc(), CoachTopic.id.asc()
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_by_id(self, topic_id: uuid.UUID) -> CoachTopic | None:
        return await self.db.get(CoachTopic, topic_id)

    async def get_locked(self, topic_id: uuid.UUID) -> CoachTopic | None:
        return (
            await self.db.scalars(
                select(CoachTopic).where(CoachTopic.id == topic_id).with_for_update()
            )
        ).one_or_none()

    async def list_admin(
        self, q: str | None, category: str | None, min_level: str | None, active: bool | None
    ) -> Sequence[CoachTopic]:
        stmt = select(CoachTopic)
        if q:
            stmt = stmt.where(func.lower(CoachTopic.title).contains(q.lower(), autoescape=True))
        if category:
            stmt = stmt.where(CoachTopic.category == category)
        if min_level:
            stmt = stmt.where(CoachTopic.min_level == min_level)
        if active is not None:
            stmt = stmt.where(CoachTopic.is_active == active)
        return (
            await self.db.scalars(
                stmt.order_by(CoachTopic.sort_order, CoachTopic.created_at, CoachTopic.id)
            )
        ).all()

    async def ensure_defaults(self) -> None:
        seed_ids = [uuid.UUID(item["id"]) for item in COACH_TOPICS_SEED]
        existing = set(
            await self.db.scalars(select(CoachTopic.id).where(CoachTopic.id.in_(seed_ids)))
        )
        missing = [
            {**item, "id": uuid.UUID(item["id"])}
            for item in COACH_TOPICS_SEED
            if uuid.UUID(item["id"]) not in existing
        ]
        if missing:
            insert = pg_insert if self.db.get_bind().dialect.name == "postgresql" else sqlite_insert
            await self.db.execute(
                insert(CoachTopic).values(missing).on_conflict_do_nothing(index_elements=["id"])
            )
            await self.db.commit()


class SessionRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, session: Session) -> Session:
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def get_by_id(self, session_id: uuid.UUID) -> Session | None:
        stmt = (
            select(Session)
            .where(Session.id == session_id)
            .options(selectinload(Session.topic), selectinload(Session.transcripts))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id_and_user(self, session_id: uuid.UUID, user_id: uuid.UUID) -> Session | None:
        stmt = (
            select(Session)
            .where(Session.id == session_id, Session.user_id == user_id)
            .options(selectinload(Session.topic), selectinload(Session.transcripts))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def lock(self, session_id: uuid.UUID, user_id: uuid.UUID | None = None) -> Session | None:
        stmt = select(Session).where(Session.id == session_id).with_for_update()
        if user_id is not None:
            stmt = stmt.where(Session.user_id == user_id)
        return (await self.db.scalars(stmt.execution_options(populate_existing=True))).one_or_none()

    async def save(self, session: Session) -> Session:
        await self.db.commit()
        await self.db.refresh(session)
        return session


class TranscriptRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_session_and_segment_id(
        self, session_id: uuid.UUID, segment_id: str
    ) -> TranscriptSegment | None:
        stmt = select(TranscriptSegment).where(
            TranscriptSegment.session_id == session_id,
            TranscriptSegment.id == segment_id,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_max_seq(self, session_id: uuid.UUID) -> int:
        stmt = select(func.max(TranscriptSegment.seq)).where(
            TranscriptSegment.session_id == session_id
        )
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def add_segment(self, segment: TranscriptSegment) -> TranscriptSegment:
        # Check idempotency: unique on (session_id, id)
        existing = await self.get_by_session_and_segment_id(segment.session_id, segment.id)
        if existing is not None:
            return existing

        if segment.seq <= 0:
            max_seq = await self.get_max_seq(segment.session_id)
            segment.seq = max_seq + 1

        self.db.add(segment)
        await self.db.commit()
        await self.db.refresh(segment)
        return segment

    async def add_active_segment(
        self, segment: TranscriptSegment, user_id: uuid.UUID, *, auth_version: int | None = None
    ) -> tuple[TranscriptSegment | None, bool]:
        """Serialize sequence allocation and the accumulated speaking duration for a session."""
        stmt = select(Session).where(Session.id == segment.session_id, Session.user_id == user_id)
        if auth_version is not None:
            stmt = stmt.where(
                select(User.id)
                .where(
                    User.id == user_id, User.auth_version == auth_version, User.is_active.is_(True)
                )
                .exists()
            )
        session = (
            await self.db.scalars(stmt.with_for_update().execution_options(populate_existing=True))
        ).one_or_none()
        if session is None:
            return None, False
        existing = await self.get_by_session_and_segment_id(session.id, segment.id)
        if existing is not None:
            await self.db.commit()
            return existing, False
        if session.status != "ACTIVE":
            return None, False

        segment.seq = 1 + await self.get_max_seq(session.id)
        self.db.add(segment)
        if segment.speech_ms is not None and segment.speaker == "USER":
            session.spoken_seconds += segment.speech_ms / 1000
        await self.db.commit()
        await self.db.refresh(segment)
        return segment, True

    async def list_by_session(
        self, session_id: uuid.UUID, after_seq: int = 0
    ) -> Sequence[TranscriptSegment]:
        stmt = (
            select(TranscriptSegment)
            .where(TranscriptSegment.session_id == session_id, TranscriptSegment.seq > after_seq)
            .order_by(TranscriptSegment.seq.asc())
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
