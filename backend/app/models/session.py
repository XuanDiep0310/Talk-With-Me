"""
SQLAlchemy ORM models for shared sessions, transcripts, and coach topics.

Tables:
  sessions             — shared practice sessions (COACH, ROLEPLAY, ROOM)
  transcript_segments  — live script dialogue segments
  coach_topics         — catalog of conversation topics for AI Coach
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
    from app.models.scoring import SessionFeedback



class CoachTopic(Base, TimestampMixin):
    """Catalog of conversation topics available for AI Coach practice."""

    __tablename__ = "coach_topics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    min_level: Mapped[str] = mapped_column(String(10), nullable=False, default="A1")
    # List of skills targeted (e.g. ["Fluency", "Vocabulary"])
    target_skills: Mapped[list[str]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=list
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    sessions: Mapped[list[Session]] = relationship(back_populates="topic")


class Session(Base, TimestampMixin):
    """Shared practice session (COACH, ROLEPLAY, ROOM) across the application."""

    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # COACH | ROLEPLAY | ROOM
    type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    topic_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("coach_topics.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    scenario_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    room_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # CEFR Level at the time of session creation (A1, A2, B1, B2, C1)
    level: Mapped[str] = mapped_column(String(10), nullable=False)
    # CREATED, ACTIVE, RECONNECTING, ENDING, ENDED, FEEDBACK_READY, INSUFFICIENT_DATA, FAILED
    status: Mapped[str] = mapped_column(String(30), default="CREATED", nullable=False, index=True)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    spoken_seconds: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    # USER_REQUESTED, TIMEOUT, DISCONNECTED, ERROR
    end_reason: Mapped[str | None] = mapped_column(String(50), nullable=True)

    topic: Mapped[CoachTopic | None] = relationship(back_populates="sessions")
    transcripts: Mapped[list[TranscriptSegment]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="TranscriptSegment.seq",
    )
    feedback: Mapped[SessionFeedback | None] = relationship(
        "SessionFeedback",
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan",
    )



class TranscriptSegment(Base, TimestampMixin):
    """A single dialogue segment in the session Live Script."""

    __tablename__ = "transcript_segments"
    __table_args__ = (
        UniqueConstraint("session_id", "id", name="uq_transcript_segment_session_id"),
    )

    pk: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Client-generated segment UUID
    id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # USER | AI
    speaker: Mapped[str] = mapped_column(String(20), nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    start_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    end_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_final: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    seq: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    session: Mapped[Session] = relationship(back_populates="transcripts")
