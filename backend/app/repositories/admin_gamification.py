from sqlalchemy import func, literal, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.admin_cursor import decode_cursor, encode_cursor
from app.models.admin_gamification_schemas import AdminXpFilters, AdminXpPage, AdminXpTransaction
from app.models.auth import User
from app.models.gamification import BadgeDefinition, MissionDefinition, XpRule, XpTransaction


class AdminGamificationRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_rule(self, key: str) -> XpRule | None:
        return (
            await self.db.scalars(select(XpRule).where(XpRule.key == key).with_for_update())
        ).one_or_none()

    async def get_mission(self, key: str) -> MissionDefinition | None:
        return (
            await self.db.scalars(
                select(MissionDefinition).where(MissionDefinition.key == key).with_for_update()
            )
        ).one_or_none()

    async def get_badge(self, key: str) -> BadgeDefinition | None:
        stmt = select(BadgeDefinition).where(BadgeDefinition.key == key).with_for_update()
        return (await self.db.scalars(stmt)).one_or_none()

    async def transactions(self, filters: AdminXpFilters) -> AdminXpPage:
        tx = XpTransaction
        query = select(tx, User.email).join(User, User.id == tx.user_id)
        if filters.learner:
            query = query.where(
                func.lower(User.email).contains(filters.learner.lower(), autoescape=True)
                | func.lower(User.full_name).contains(filters.learner.lower(), autoescape=True)
            )
        if filters.rule_key:
            query = query.where(tx.rule_key == filters.rule_key)
        if filters.idempotency_key:
            query = query.where(tx.idempotency_key == filters.idempotency_key)
        if filters.from_date:
            query = query.where(tx.created_at >= filters.from_date)
        if filters.to_date:
            query = query.where(tx.created_at < filters.to_date)
        if filters.cursor:
            at, item_id, _ = decode_cursor(filters.cursor)
            query = query.where(
                tuple_(tx.created_at, tx.id) < tuple_(literal(at), literal(item_id))
            )
        rows = (
            await self.db.execute(
                query.order_by(tx.created_at.desc(), tx.id.desc()).limit(filters.limit + 1)
            )
        ).all()
        items = [
            AdminXpTransaction(
                id=entry.id,
                user_id=entry.user_id,
                email=email,
                rule_key=entry.rule_key,
                amount=entry.amount,
                source_type=entry.source_type,
                source_id=entry.source_id,
                idempotency_key=entry.idempotency_key,
                description=entry.description,
                created_at=entry.created_at,
            )
            for entry, email in rows[: filters.limit]
        ]
        last = items[-1] if len(rows) > filters.limit else None
        return AdminXpPage(
            items=items, next_cursor=encode_cursor(last.created_at, last.id) if last else None
        )
