"""Add admin-managed badge status, topic deletion and session QA notes."""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "0015_admin_actions"
down_revision = "0014_admin_reporting"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "badge_definitions",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column("coach_topics", sa.Column("deleted_at", sa.DateTime(timezone=True)))
    op.add_column("sessions", sa.Column("qa_note", sa.Text()))
    op.add_column("sessions", sa.Column("qa_preview", JSONB()))


def downgrade() -> None:
    op.drop_column("sessions", "qa_preview")
    op.drop_column("sessions", "qa_note")
    op.drop_column("coach_topics", "deleted_at")
    op.drop_column("badge_definitions", "is_active")
