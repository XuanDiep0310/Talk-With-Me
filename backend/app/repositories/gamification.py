"""
Gamification repository handling database persistence for XP ledger, streaks,
daily missions, badges, notifications, and level progression audit.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import date, datetime

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auth import UserProfile
from app.models.gamification import (
    BadgeDefinition,
    GamificationProfile,
    MissionDefinition,
    Notification,
    UserBadge,
    UserDailyMission,
    XpRule,
    XpTransaction,
)
from app.models.onboarding import LevelHistory


class GamificationRepository:
    """Data access layer for gamification tables."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # --- Profile & XP ---

    async def get_or_create_profile(self, user_id: uuid.UUID) -> GamificationProfile:
        """Fetch user's gamification profile, creating it if it doesn't exist."""
        profile = await self._session.get(GamificationProfile, user_id)
        if not profile:
            profile = GamificationProfile(
                user_id=user_id,
                total_xp=0,
                current_streak=0,
                best_streak=0,
                last_active_date=None,
            )
            self._session.add(profile)
            await self._session.flush()
        return profile

    async def get_user_profile(self, user_id: uuid.UUID) -> UserProfile | None:
        """Fetch UserProfile to read CEFR level and timezone."""
        return await self._session.get(UserProfile, user_id)

    async def get_rule(self, key: str) -> XpRule | None:
        """Fetch active XP rule by key."""
        stmt = select(XpRule).where(XpRule.key == key, XpRule.is_active == True)  # noqa: E712
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_xp_transaction(
        self,
        user_id: uuid.UUID,
        amount: int,
        rule_key: str,
        source_type: str,
        source_id: str,
        idempotency_key: str,
        description: str | None,
        created_at: datetime,
    ) -> XpTransaction | None:
        """
        Record an immutable XP transaction idempotently.
        If idempotency_key already exists, returns None without altering profile XP.
        If created, adds amount directly to cached GamificationProfile.total_xp.
        """
        # Check if transaction already exists
        stmt = select(XpTransaction).where(XpTransaction.idempotency_key == idempotency_key)
        existing = (await self._session.execute(stmt)).scalar_one_or_none()
        if existing:
            return None

        tx = XpTransaction(
            user_id=user_id,
            amount=amount,
            rule_key=rule_key,
            source_type=source_type,
            source_id=source_id,
            idempotency_key=idempotency_key,
            description=description,
            created_at=created_at,
        )
        self._session.add(tx)

        # Update cached profile
        profile = await self.get_or_create_profile(user_id)
        profile.total_xp += amount

        await self._session.flush()
        return tx

    async def get_xp_sum(self, user_id: uuid.UUID) -> int:
        """Calculate true sum of all XP ledger transactions (for invariant checks)."""
        stmt = select(func.coalesce(func.sum(XpTransaction.amount), 0)).where(
            XpTransaction.user_id == user_id
        )
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def list_xp_transactions(
        self, user_id: uuid.UUID, limit: int = 50, offset: int = 0
    ) -> Sequence[XpTransaction]:
        """List transactions ordered newest first."""
        stmt = (
            select(XpTransaction)
            .where(XpTransaction.user_id == user_id)
            .order_by(XpTransaction.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()

    # --- Daily Missions ---

    async def get_active_mission_definitions(self) -> Sequence[MissionDefinition]:
        """Fetch all active daily mission definitions."""
        stmt = select(MissionDefinition).where(MissionDefinition.is_active == True)  # noqa: E712
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def get_user_missions_for_date(
        self, user_id: uuid.UUID, mission_date: date
    ) -> Sequence[UserDailyMission]:
        """Fetch daily missions for a user on a given local date."""
        stmt = (
            select(UserDailyMission)
            .options(selectinload(UserDailyMission.mission))
            .where(
                UserDailyMission.user_id == user_id,
                UserDailyMission.mission_date == mission_date,
            )
            .order_by(UserDailyMission.created_at.asc())
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def ensure_daily_missions(
        self, user_id: uuid.UUID, mission_date: date
    ) -> Sequence[UserDailyMission]:
        """
        Ensure user has 4 missions generated for mission_date.
        Concurrency-safe via PostgreSQL INSERT ... ON CONFLICT DO NOTHING.
        """
        existing = await self.get_user_missions_for_date(user_id, mission_date)
        if len(existing) >= 4:
            return existing

        definitions = await self.get_active_mission_definitions()
        is_sqlite = bool(self._session.bind and self._session.bind.dialect.name == "sqlite")
        for d in definitions:
            if is_sqlite:
                from sqlalchemy.dialects.sqlite import insert as sqlite_insert

                stmt_sqlite = (
                    sqlite_insert(UserDailyMission)
                    .values(
                        id=uuid.uuid4(),
                        user_id=user_id,
                        mission_date=mission_date,
                        mission_key=d.key,
                        status="IN_PROGRESS",
                        progress=0,
                        target=d.target_count,
                    )
                    .on_conflict_do_nothing()
                )
                await self._session.execute(stmt_sqlite)
            else:
                stmt_pg = (
                    pg_insert(UserDailyMission)
                    .values(
                        id=uuid.uuid4(),
                        user_id=user_id,
                        mission_date=mission_date,
                        mission_key=d.key,
                        status="IN_PROGRESS",
                        progress=0,
                        target=d.target_count,
                    )
                    .on_conflict_do_nothing(
                        constraint="uq_user_daily_mission"
                    )
                )
                await self._session.execute(stmt_pg)

        await self._session.flush()
        return await self.get_user_missions_for_date(user_id, mission_date)

    async def get_user_mission(
        self, mission_id: uuid.UUID, user_id: uuid.UUID
    ) -> UserDailyMission | None:
        """Fetch specific user daily mission."""
        stmt = (
            select(UserDailyMission)
            .options(selectinload(UserDailyMission.mission))
            .where(UserDailyMission.id == mission_id, UserDailyMission.user_id == user_id)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_mission_progress(
        self,
        user_id: uuid.UUID,
        mission_date: date,
        condition_type: str,
        increment: int = 1,
        now: datetime | None = None,
    ) -> list[UserDailyMission]:
        """
        Increment progress for missions matching condition_type for the given date.
        If target reached, mark status as COMPLETED.
        """
        missions = await self.get_user_missions_for_date(user_id, mission_date)
        updated = []
        for m in missions:
            if m.mission.condition_type == condition_type and m.status == "IN_PROGRESS":
                m.progress = min(m.target, m.progress + increment)
                if m.progress >= m.target:
                    m.status = "COMPLETED"
                    m.completed_at = now
                updated.append(m)
        await self._session.flush()
        return updated

    # --- Badges ---

    async def list_badge_definitions(self) -> Sequence[BadgeDefinition]:
        """Fetch all badge definitions in sort order."""
        stmt = select(BadgeDefinition).order_by(BadgeDefinition.sort_order.asc())
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def get_user_badges(self, user_id: uuid.UUID) -> Sequence[UserBadge]:
        """Fetch all badges earned by user."""
        stmt = (
            select(UserBadge)
            .options(selectinload(UserBadge.badge))
            .where(UserBadge.user_id == user_id)
            .order_by(UserBadge.awarded_at.asc())
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def award_badge(
        self,
        user_id: uuid.UUID,
        badge_key: str,
        awarded_at: datetime,
        metadata: dict | None = None,
    ) -> UserBadge | None:
        """
        Award badge to user idempotently.
        Returns UserBadge if newly awarded, None if already earned.
        """
        stmt = select(UserBadge).where(
            UserBadge.user_id == user_id, UserBadge.badge_key == badge_key
        )
        existing = (await self._session.execute(stmt)).scalar_one_or_none()
        if existing:
            return None

        badge = UserBadge(
            user_id=user_id,
            badge_key=badge_key,
            awarded_at=awarded_at,
            metadata_=metadata or {},
        )
        self._session.add(badge)
        await self._session.flush()
        return badge

    # --- Notifications ---

    async def create_notification(
        self,
        user_id: uuid.UUID,
        type_: str,
        title: str,
        content: str,
        created_at: datetime,
    ) -> Notification:
        """Create a notification for user."""
        noti = Notification(
            user_id=user_id,
            type=type_,
            title=title,
            content=content,
            is_read=False,
            created_at=created_at,
        )
        self._session.add(noti)
        await self._session.flush()
        return noti

    async def list_notifications(
        self, user_id: uuid.UUID, limit: int = 50, unread_only: bool = False
    ) -> Sequence[Notification]:
        """List notifications newest first."""
        stmt = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            stmt = stmt.where(Notification.is_read == False)  # noqa: E712
        stmt = stmt.order_by(Notification.created_at.desc()).limit(limit)
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def get_unread_notification_count(self, user_id: uuid.UUID) -> int:
        """Count unread notifications."""
        stmt = select(func.count(Notification.id)).where(
            Notification.user_id == user_id, Notification.is_read == False  # noqa: E712
        )
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def mark_notification_read(
        self, notification_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        """Mark single notification as read."""
        stmt = (
            update(Notification)
            .where(Notification.id == notification_id, Notification.user_id == user_id)
            .values(is_read=True)
        )
        res = await self._session.execute(stmt)
        await self._session.flush()
        count = getattr(res, "rowcount", 0) or 0
        return int(count) > 0

    async def mark_all_notifications_read(self, user_id: uuid.UUID) -> int:
        """Mark all notifications as read for a user."""
        stmt = (
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
            .values(is_read=True)
        )
        res = await self._session.execute(stmt)
        await self._session.flush()
        count = getattr(res, "rowcount", 0) or 0
        return int(count)

    # --- Level History ---

    async def record_level_advancement(
        self,
        user_id: uuid.UUID,
        from_level: str,
        to_level: str,
        reason: str,
        session_id: uuid.UUID | None,
        created_at: datetime,
    ) -> LevelHistory:
        """Record level advancement in level_history table (AGENTS.md §8 rule 4)."""
        history = LevelHistory(
            user_id=user_id,
            level=to_level,
            source="ADVANCEMENT",
            from_level=from_level,
            reason=reason,
            session_id=session_id,
            created_at=created_at,
        )
        self._session.add(history)

        # Update profile cefr_level
        profile = await self.get_user_profile(user_id)
        if profile:
            profile.cefr_level = to_level

        await self._session.flush()
        return history
