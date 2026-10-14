"""
Repositories for Coach Topics, Sessions, and Transcripts.
"""

import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
        stmt = stmt.order_by(CoachTopic.sort_order.asc(), CoachTopic.created_at.asc())
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_by_id(self, topic_id: uuid.UUID) -> CoachTopic | None:
        return await self.db.get(CoachTopic, topic_id)

    async def seed_defaults_if_empty(self) -> None:
        stmt = select(func.count(CoachTopic.id))
        count = (await self.db.execute(stmt)).scalar() or 0
        if count == 0:
            for item in COACH_TOPICS_SEED:
                topic = CoachTopic(
                    id=uuid.UUID(item["id"]),
                    category=item["category"],
                    title=item["title"],
                    description=item["description"],
                    min_level=item["min_level"],
                    target_skills=item["target_skills"],
                    is_active=item["is_active"],
                    sort_order=item["sort_order"],
                )
                self.db.add(topic)
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
