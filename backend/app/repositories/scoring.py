"""
Repository for session feedback, skill scores, and scoring audit persistence.
"""

import uuid
from collections.abc import Sequence

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.scoring import ScoringAudit, SessionFeedback, SessionSkillScore


class ScoringRepository:
    """Repository handling CRUD operations for scoring and feedback data."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_feedback(self, session_id: uuid.UUID) -> SessionFeedback | None:
        """Fetch feedback report for a session with skill scores preloaded."""
        stmt = (
            select(SessionFeedback)
            .options(selectinload(SessionFeedback.skill_scores))
            .where(SessionFeedback.session_id == session_id)
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def create_feedback(self, feedback: SessionFeedback) -> SessionFeedback:
        """Create a new feedback record."""
        self.db.add(feedback)
        await self.db.flush()
        return feedback

    async def get_or_create_pending_feedback(
        self, session_id: uuid.UUID, formula_version: str
    ) -> SessionFeedback:
        """Fetch or create pending feedback safely and idempotently."""
        fb = await self.get_feedback(session_id)
        if fb:
            return fb
        try:
            fb = SessionFeedback(
                session_id=session_id,
                status="PENDING",
                formula_version=formula_version,
                retryable=False,
            )
            self.db.add(fb)
            await self.db.flush()
            return fb
        except Exception:
            # On concurrent conflict, reload existing record
            existing = await self.get_feedback(session_id)
            if existing:
                return existing
            raise

    async def save_feedback(self, feedback: SessionFeedback) -> SessionFeedback:
        """Save updates to an existing feedback record."""
        self.db.add(feedback)
        await self.db.flush()
        return feedback

    async def save_skill_scores(self, scores: list[SessionSkillScore]) -> None:
        """Persist or replace skill scores for a session."""
        if not scores:
            return
        session_id = scores[0].session_id
        # Delete existing skill scores for this session to ensure clean idempotency
        await self.db.execute(
            delete(SessionSkillScore).where(SessionSkillScore.session_id == session_id)
        )
        for s in scores:
            self.db.add(s)
        await self.db.flush()

    async def get_skill_scores(self, session_id: uuid.UUID) -> Sequence[SessionSkillScore]:
        """Fetch all skill scores for a session ordered by skill_name."""
        stmt = (
            select(SessionSkillScore)
            .where(SessionSkillScore.session_id == session_id)
            .order_by(SessionSkillScore.skill_name)
        )
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def record_audit(self, audit: ScoringAudit) -> ScoringAudit:
        """Record an immutable scoring audit entry."""
        self.db.add(audit)
        await self.db.flush()
        return audit
