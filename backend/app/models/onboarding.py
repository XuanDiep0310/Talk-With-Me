"""
SQLAlchemy ORM models for onboarding: placement tests, answers, and level history.

Tables:
  placement_tests   — one placement test session per user per attempt
  placement_answers — individual voice answers within a placement test
  level_history     — immutable audit log of every level change
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class PlacementTest(Base, TimestampMixin):
    """One placement test session created per user during onboarding."""

    __tablename__ = "placement_tests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # CREATED | IN_PROGRESS | COMPLETED | FAILED
    status: Mapped[str] = mapped_column(String(20), default="CREATED", nullable=False)
    # Estimated level result; null until test completes
    estimated_level: Mapped[str | None] = mapped_column(String(5), nullable=True)
    # True when data was insufficient and A1 was used as fallback
    is_insufficient_data: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Computed features stored as JSON text for auditability
    features_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    answers: Mapped[list["PlacementAnswer"]] = relationship(
        back_populates="test", cascade="all, delete-orphan"
    )


class PlacementAnswer(Base, TimestampMixin):
    """A single voice answer for one question in a placement test."""

    __tablename__ = "placement_answers"
    __table_args__ = (
        UniqueConstraint("test_id", "request_id", name="uq_placement_answer_idempotency"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    test_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("placement_tests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Idempotency key (client-generated UUID) prevents duplicate submission
    request_id: Mapped[str] = mapped_column(String(36), nullable=False)
    # Index of the question in the test question list (0-based)
    question_index: Mapped[int] = mapped_column(Integer, nullable=False)
    # STT transcript of user's answer
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Aggregate STT confidence score (0.0–1.0); null if STT failed
    stt_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Total seconds the user spoke
    speaking_duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Seconds from question end to user starting to speak
    response_latency_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Word count derived from transcript
    word_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    test: Mapped["PlacementTest"] = relationship(back_populates="answers")


class LevelHistory(Base):
    """Immutable audit log of every level assignment. Level never degrades (AGENTS.md §8 rule 4)."""

    __tablename__ = "level_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Level value assigned: A1, A2, B1, B2, C1
    level: Mapped[str] = mapped_column(String(5), nullable=False)
    # How level was assigned: PLACEMENT | SELF | DEFAULT
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    # Optional: link to the placement test that triggered this change
    placement_test_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("placement_tests.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
