"""
SQLAlchemy ORM models for Gamification, XP Ledger, Daily Missions, Badges, and Notifications.

Tables:
  xp_rules              — configured XP rewards per activity
  xp_transactions       — immutable XP ledger (source of truth)
  gamification_profiles — cached total XP, streak counters, and last active date
  mission_definitions   — catalog of daily missions
  user_daily_missions   — user daily mission progress and claim status
  badge_definitions     — catalog of achievement badges
  user_badges           — badges awarded to users
  notifications         — system / gamification notifications
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.auth import User


class XpRule(Base, TimestampMixin):
    """Configurable XP rules for learning activities (D-01)."""

    __tablename__ = "xp_rules"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    xp_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)


class XpTransaction(Base):
    """Immutable ledger of all XP grants (AGENTS.md §8 rule 5). Source of truth for total XP."""

    __tablename__ = "xp_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    rule_key: Mapped[str] = mapped_column(String(50), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_id: Mapped[str] = mapped_column(String(100), nullable=False)
    # Unique idempotency key formatted as <rule>:<source_id>
    idempotency_key: Mapped[str] = mapped_column(
        String(150), unique=True, nullable=False, index=True
    )
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class GamificationProfile(Base, TimestampMixin):
    """Cached gamification stats per user."""

    __tablename__ = "gamification_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    total_xp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    current_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    best_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_active_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    user: Mapped[User] = relationship(back_populates="gamification_profile")


class MissionDefinition(Base, TimestampMixin):
    """Catalog of daily missions."""

    __tablename__ = "mission_definitions"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    xp_reward: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    # COACH_SESSION | SCENARIO_LESSON | ROOM_SESSION | STREAK
    condition_type: Mapped[str] = mapped_column(String(50), nullable=False)
    target_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    params: Mapped[dict] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=dict, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class UserDailyMission(Base, TimestampMixin):
    """Per-user daily mission instance and status."""

    __tablename__ = "user_daily_missions"
    __table_args__ = (
        UniqueConstraint("user_id", "mission_date", "mission_key", name="uq_user_daily_mission"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    mission_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    mission_key: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("mission_definitions.key", ondelete="CASCADE"),
        nullable=False,
    )
    # IN_PROGRESS | COMPLETED | CLAIMED
    status: Mapped[str] = mapped_column(String(30), default="IN_PROGRESS", nullable=False)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    target: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    mission: Mapped[MissionDefinition] = relationship()


class BadgeDefinition(Base, TimestampMixin):
    """Catalog of badges/achievements."""

    __tablename__ = "badge_definitions"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    icon_emoji: Mapped[str] = mapped_column(String(10), nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="GENERAL", nullable=False)
    # SESSIONS_COUNT | STREAK_DAYS | CEFR_LEVEL | FLUENCY_SCORE | SCENARIOS_COMPLETED | ROOMS_COUNT
    criteria_type: Mapped[str] = mapped_column(String(50), nullable=False)
    target_value: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    params: Mapped[dict] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=dict, nullable=False
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class UserBadge(Base):
    """Badges awarded to users."""

    __tablename__ = "user_badges"
    __table_args__ = (UniqueConstraint("user_id", "badge_key", name="uq_user_badge"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    badge_key: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("badge_definitions.key", ondelete="CASCADE"),
        nullable=False,
    )
    awarded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    metadata_: Mapped[dict] = mapped_column(
        "metadata", JSON().with_variant(JSONB, "postgresql"), default=dict, nullable=False
    )

    badge: Mapped[BadgeDefinition] = relationship()


class Notification(Base):
    """User notifications for level up, badges, streak, missions."""

    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # LEVEL_UP | BADGE_UNLOCKED | STREAK | MISSION_COMPLETED | SYSTEM
    type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
