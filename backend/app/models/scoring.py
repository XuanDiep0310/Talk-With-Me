"""
SQLAlchemy ORM models for session feedback, skill scores, and scoring audit.

Tables:
  session_feedback     — aggregate feedback and qualitative review for completed sessions
  session_skill_scores — detailed component scores for each of the 5 core skills
  scoring_audit        — immutable audit trace for every scoring execution
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.session import Session



class SessionFeedback(Base, TimestampMixin):
    """Post-session communication feedback report."""

    __tablename__ = "session_feedback"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    # PENDING | FEEDBACK_READY | INSUFFICIENT_DATA | FAILED
    status: Mapped[str] = mapped_column(String(30), default="PENDING", nullable=False, index=True)
    formula_version: Mapped[str] = mapped_column(String(20), default="1.0.0", nullable=False)
    overall_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    partial: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    strengths: Mapped[list[str]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=list, nullable=False
    )
    improvements: Mapped[list[str]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=list, nullable=False
    )
    next_practice: Mapped[str | None] = mapped_column(Text, nullable=True)
    retryable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    session: Mapped[Session] = relationship("Session", back_populates="feedback")
    skill_scores: Mapped[list[SessionSkillScore]] = relationship(
        "SessionSkillScore",
        back_populates="feedback",
        cascade="all, delete-orphan",
        order_by="SessionSkillScore.skill_name",
    )


class SessionSkillScore(Base, TimestampMixin):
    """Detailed score for each of the 5 core communication skills."""

    __tablename__ = "session_skill_scores"
    __table_args__ = (
        UniqueConstraint("session_id", "skill_name", name="uq_session_skill_score_name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("session_feedback.session_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # fluency | listening | vocabulary | response_speed | pronunciation
    skill_name: Mapped[str] = mapped_column(String(50), nullable=False)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    components: Mapped[dict] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=dict, nullable=False
    )
    na_reason: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_reference: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    feedback: Mapped[SessionFeedback] = relationship(
        "SessionFeedback", back_populates="skill_scores"
    )


class ScoringAudit(Base):
    """Immutable audit log of scoring inputs and calculation trace."""

    __tablename__ = "scoring_audit"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    input_summary: Mapped[dict] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), nullable=False
    )
    formula_version: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
