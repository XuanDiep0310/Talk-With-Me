import uuid
from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import User, UserProfile
from app.models.session import Session


class AdminAccountRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(
        self, q: str | None, cursor: uuid.UUID | None, limit: int
    ) -> list[tuple[User, str | None, int]]:
        count = (
            select(func.count(Session.id))
            .where(Session.user_id == User.id, Session.ended_at.is_not(None))
            .correlate(User)
            .scalar_subquery()
        )
        stmt = (
            select(User, UserProfile.cefr_level, count)
            .outerjoin(UserProfile, UserProfile.user_id == User.id)
            .order_by(User.id)
            .limit(limit)
        )
        if q:
            stmt = stmt.where(
                or_(
                    User.email.icontains(q, autoescape=True),
                    User.full_name.icontains(q, autoescape=True),
                )
            )
        if cursor:
            stmt = stmt.where(User.id > cursor)
        return [(user, level, completed) for user, level, completed in await self.db.execute(stmt)]

    async def lock_management_accounts(
        self, actor: uuid.UUID, target: uuid.UUID
    ) -> dict[uuid.UUID, User]:
        stmt = (
            select(User)
            .where(or_(User.id.in_([actor, target]), User.role == "ADMIN"))
            .order_by(User.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        return {account.id: account for account in await self.db.scalars(stmt)}

    async def totals(self, since: datetime) -> tuple[int, int, int, int, int]:
        users = (
            await self.db.execute(
                select(
                    func.count(User.id),
                    func.count(User.id).filter(User.is_active.is_(True)),
                    func.count(User.id).filter(User.created_at >= since),
                )
            )
        ).one()
        sessions = (
            await self.db.execute(
                select(
                    func.count(Session.ended_at),
                    func.count(Session.ended_at).filter(Session.ended_at >= since),
                )
            )
        ).one()
        return (users[0], users[1], users[2], sessions[0], sessions[1])
