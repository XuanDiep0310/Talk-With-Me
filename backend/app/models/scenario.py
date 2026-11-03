"""
SQLAlchemy ORM models for Scenario Lessons, Chunks, Reflex Drills, and Roleplay Evaluations.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.auth import User
    from app.models.session import Session


class Scenario(Base, TimestampMixin):
    """Scenario catalog entry (e.g. Daily Life, Social Talk, Travel & Shopping, Workplace)."""

    __tablename__ = "scenarios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    # DAILY_LIFE | SOCIAL | TRAVEL_SHOPPING | WORKPLACE
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    title_vi: Mapped[str] = mapped_column(String(255), nullable=False)
    title_en: Mapped[str] = mapped_column(String(255), nullable=False)
    # A1 | A2 | B1 | B2 | C1
    level: Mapped[str] = mapped_column(String(10), nullable=False, default="A1", index=True)
    estimated_duration_minutes: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    context: Mapped[str] = mapped_column(Text, nullable=False)
    user_role: Mapped[str] = mapped_column(String(255), nullable=False)
    ai_role: Mapped[str] = mapped_column(String(255), nullable=False)
    goals: Mapped[list[str]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=list, nullable=False
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    requirements: Mapped[list[ScenarioRequirement]] = relationship(
        "ScenarioRequirement",
        back_populates="scenario",
        cascade="all, delete-orphan",
        order_by="ScenarioRequirement.sort_order",
    )
    chunks: Mapped[list[ScenarioChunk]] = relationship(
        "ScenarioChunk",
        back_populates="scenario",
        cascade="all, delete-orphan",
        order_by="ScenarioChunk.sort_order",
    )
    progress_records: Mapped[list[UserScenarioProgress]] = relationship(
        "UserScenarioProgress",
        back_populates="scenario",
        cascade="all, delete-orphan",
    )


class ScenarioRequirement(Base, TimestampMixin):
    """Specific task requirement/milestone for scenario completion."""

    __tablename__ = "scenario_requirements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scenario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scenarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(50), default="TASK", nullable=False)
    # Expected communicative function tag: OPENING | REQUEST | CLARIFY | AGREE_DECLINE | CLOSING
    expected_chunk_function: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    scenario: Mapped[Scenario] = relationship("Scenario", back_populates="requirements")


class ScenarioChunk(Base, TimestampMixin):
    """Functional language chunk taught in scenario (Useful Expressions / Chunking method)."""

    __tablename__ = "scenario_chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scenario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scenarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # OPENING | REQUEST | CLARIFY | AGREE_DECLINE | CLOSING
    function_tag: Mapped[str] = mapped_column(String(50), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    meaning_vi: Mapped[str] = mapped_column(Text, nullable=False)
    audio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    example_sentence: Mapped[str] = mapped_column(Text, nullable=False)
    accepted_variations: Mapped[list[str]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=list, nullable=False
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    scenario: Mapped[Scenario] = relationship("Scenario", back_populates="chunks")


class UserScenarioProgress(Base, TimestampMixin):
    """User progress and completion tracking for a scenario."""

    __tablename__ = "user_scenario_progress"
    __table_args__ = (UniqueConstraint("user_id", "scenario_id", name="uq_user_scenario_progress"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scenario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scenarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # NOT_STARTED | IN_PROGRESS | COMPLETED
    status: Mapped[str] = mapped_column(
        String(30), default="NOT_STARTED", nullable=False, index=True
    )
    highest_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    practiced_chunks: Mapped[list[str]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=list, nullable=False
    )
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship("User")
    scenario: Mapped[Scenario] = relationship("Scenario", back_populates="progress_records")


class DrillAttempt(Base, TimestampMixin):
    """Log of a chunk drill attempt (hear and repeat before roleplay; ungraded)."""

    __tablename__ = "drill_attempts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scenario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scenarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scenario_chunks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_skipped: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    chunk: Mapped[ScenarioChunk] = relationship("ScenarioChunk")
    scenario: Mapped[Scenario] = relationship("Scenario")


class ChunkBank(Base, TimestampMixin):
    """User personal chunk bank for spaced practice and mastery."""

    __tablename__ = "chunk_bank"
    __table_args__ = (UniqueConstraint("user_id", "chunk_id", name="uq_user_chunk_bank"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scenario_chunks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # NEEDS_PRACTICE | MASTERED
    status: Mapped[str] = mapped_column(
        String(30), default="NEEDS_PRACTICE", nullable=False, index=True
    )
    last_reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped[User] = relationship("User")
    chunk: Mapped[ScenarioChunk] = relationship("ScenarioChunk")


class RoleplayEvaluation(Base, TimestampMixin):
    """Post-roleplay mission evaluation (PASS/FAIL requirements, chunk usage, feedback)."""

    __tablename__ = "roleplay_evaluations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    scenario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scenarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # PENDING | COMPLETED | INSUFFICIENT_DATA | FAILED
    status: Mapped[str] = mapped_column(String(30), default="PENDING", nullable=False, index=True)
    passed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requirements_evaluation: Mapped[list[dict]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=list, nullable=False
    )
    chunks_used_well: Mapped[list[dict]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=list, nullable=False
    )
    chunks_to_improve: Mapped[list[dict]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=list, nullable=False
    )
    strengths: Mapped[list[str]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=list, nullable=False
    )
    improvements: Mapped[list[str]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=list, nullable=False
    )
    next_practice: Mapped[str | None] = mapped_column(Text, nullable=True)
    evaluated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    session: Mapped[Session] = relationship("Session")
    scenario: Mapped[Scenario] = relationship("Scenario")
