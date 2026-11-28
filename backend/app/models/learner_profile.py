"""SQLAlchemy ORM models for longitudinal learner profiling and CEFR estimation."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.models.base import Base, TimestampMixin


class LearnerSkillProfile(Base, TimestampMixin):
    """Longitudinal multi-session EWMA skill state and calibrated CEFR estimate."""

    __tablename__ = "learner_skill_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    pronunciation_ewma: Mapped[float | None] = mapped_column(Float, nullable=True)
    fluency_ewma: Mapped[float | None] = mapped_column(Float, nullable=True)
    vocabulary_ewma: Mapped[float | None] = mapped_column(Float, nullable=True)
    grammar_ewma: Mapped[float | None] = mapped_column(Float, nullable=True)
    interaction_ewma: Mapped[float | None] = mapped_column(Float, nullable=True)

    scripted_pronunciation_ewma: Mapped[float | None] = mapped_column(Float, nullable=True)
    unscripted_pronunciation_ewma: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_response_latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)

    session_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    scripted_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unscripted_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    estimated_cefr: Mapped[str | None] = mapped_column(String(5), nullable=True)
    cefr_continuous_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    cefr_confidence: Mapped[str] = mapped_column(String(20), default="LOW", nullable=False)
    limiting_dimensions: Mapped[list[str]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=list, nullable=False
    )
    model_version: Mapped[str] = mapped_column(String(30), default="cefr-est-1.0.0", nullable=False)
    last_calibrated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class LearnerCefrSnapshot(Base):
    """Time-series trajectory of calibrated CEFR estimation across placement and sessions."""

    __tablename__ = "learner_cefr_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # PLACEMENT | COACH | ROLEPLAY | DRILL
    source_id: Mapped[str] = mapped_column(String(64), nullable=False)
    raw_vector: Mapped[dict[str, float | None]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=dict, nullable=False
    )
    calibrated_vector: Mapped[dict[str, float | None]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=dict, nullable=False
    )
    estimated_cefr: Mapped[str] = mapped_column(String(5), nullable=False)
    continuous_score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[str] = mapped_column(String(20), nullable=False)
    limiting_dimensions: Mapped[list[str]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=list, nullable=False
    )
    model_version: Mapped[str] = mapped_column(String(30), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class LearnerPhonemeStat(Base):
    """Aggregated phoneme/IPA pronunciation trouble spots per learner."""

    __tablename__ = "learner_phoneme_stats"
    __table_args__ = (UniqueConstraint("user_id", "ipa_phoneme", name="uq_learner_phoneme_stat"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ipa_phoneme: Mapped[str] = mapped_column(String(16), nullable=False)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    avg_accuracy: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
