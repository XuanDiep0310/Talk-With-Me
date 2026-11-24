"""Persist measured speech features and Session QA labels."""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "0013_session_qa"
down_revision = "0012_mission_terms"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sessions", sa.Column("speech_features_version", sa.Integer()))
    op.add_column(
        "sessions", sa.Column("qa_labels", JSONB(), nullable=False, server_default="[]")
    )
    for name, kind in (
        ("speech_source", sa.String(25)),
        ("speech_ms", sa.Integer()),
        ("speech_span_ms", sa.Integer()),
        ("long_pause_count", sa.Integer()),
        ("long_pause_ms", sa.Integer()),
        ("word_count", sa.Integer()),
        ("filler_count", sa.Integer()),
        ("response_latency_ms", sa.Integer()),
    ):
        op.add_column("transcript_segments", sa.Column(name, kind))


def downgrade() -> None:
    for name in (
        "response_latency_ms", "filler_count", "word_count", "long_pause_ms", "long_pause_count",
        "speech_span_ms", "speech_ms", "speech_source",
    ):
        op.drop_column("transcript_segments", name)
    op.drop_column("sessions", "qa_labels")
    op.drop_column("sessions", "speech_features_version")
