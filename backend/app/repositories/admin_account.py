import uuid
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func, literal, or_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.admin_cursor import decode_cursor
from app.models.admin_account_schemas import AdminSkillAverage
from app.models.auth import User, UserProfile
from app.models.gamification import UserDailyMission
from app.models.onboarding import PlacementTest
from app.models.scoring import SessionFeedback, SessionSkillScore
from app.models.session import Session


class AdminAccountRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def search(
        self, q: str | None, cursor: str | None, limit: int
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
            .order_by(User.created_at.desc(), User.id.desc())
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
            try:
                legacy_id = uuid.UUID(cursor)
            except ValueError:
                at, account_id, _ = decode_cursor(cursor)
            else:
                created_at = await self.db.scalar(
                    select(User.created_at).where(User.id == legacy_id)
                )
                if created_at is None:
                    return []
                at, account_id = created_at, legacy_id
            stmt = stmt.where(
                tuple_(User.created_at, User.id) < tuple_(literal(at), literal(account_id))
            )
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

    async def get(self, user_id: uuid.UUID) -> User | None:
        return (
            await self.db.scalars(
                select(User)
                .where(User.id == user_id)
                .options(
                    selectinload(User.profile),
                    selectinload(User.identities),
                    selectinload(User.gamification_profile),
                )
            )
        ).one_or_none()

    async def completed_sessions(self, user_id: uuid.UUID) -> int:
        return int(
            await self.db.scalar(
                select(func.count(Session.id)).where(
                    Session.user_id == user_id, Session.ended_at.is_not(None)
                )
            )
            or 0
        )

    async def placements(
        self, user_id: uuid.UUID, cursor: str | None, limit: int
    ) -> Sequence[PlacementTest]:
        test = PlacementTest
        query = select(test).where(test.user_id == user_id)
        if cursor:
            at, item_id, _ = decode_cursor(cursor)
            query = query.where(
                tuple_(test.created_at, test.id) < tuple_(literal(at), literal(item_id))
            )
        return (
            await self.db.scalars(
                query.order_by(test.created_at.desc(), test.id.desc()).limit(limit)
            )
        ).all()

    async def skills(self, user_id: uuid.UUID) -> Sequence[AdminSkillAverage]:
        skill = SessionSkillScore
        rows = await self.db.execute(
            select(
                skill.skill_name,
                SessionFeedback.formula_version,
                func.avg(skill.score),
                func.count(skill.score),
            )
            .join(SessionFeedback, SessionFeedback.session_id == skill.session_id)
            .join(Session, Session.id == skill.session_id)
            .where(
                Session.user_id == user_id,
                SessionFeedback.status == "FEEDBACK_READY",
                skill.score.is_not(None),
            )
            .group_by(skill.skill_name, SessionFeedback.formula_version)
            .order_by(SessionFeedback.formula_version, skill.skill_name)
        )
        return [
            AdminSkillAverage(
                skill=name,
                formula_version=version,
                average=round(float(value), 2),
                sample_count=count,
                is_reference=name == "pronunciation",
            )
            for name, version, value, count in rows
        ]

    async def mission_totals(self, user_id: uuid.UUID) -> tuple[int, int]:
        mission = UserDailyMission
        total, completed = (
            await self.db.execute(
                select(
                    func.count(mission.id),
                    func.count(mission.id).filter(mission.status.in_(["COMPLETED", "CLAIMED"])),
                ).where(mission.user_id == user_id)
            )
        ).one()
        return int(total), int(completed)
