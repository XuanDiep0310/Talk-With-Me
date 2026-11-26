"""Enable Coach topic management and capture topic context on new sessions."""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "0011_admin_coach_topics"
down_revision = "0010_admin_accounts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sessions", sa.Column("topic_snapshot", JSONB(), nullable=True))
    op.create_table(
        "admin_audit_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("target_type", sa.String(40), nullable=False),
        sa.Column("target_id", sa.String(100), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("before", JSONB()),
        sa.Column("after", JSONB()),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("trace_id", sa.String(255), nullable=False),
    )
    op.create_index("ix_admin_audit_events_occurred_at", "admin_audit_events", ["occurred_at"])
    op.create_index("ix_admin_audit_events_trace_id", "admin_audit_events", ["trace_id"])


def downgrade() -> None:
    op.drop_table("admin_audit_events")
    op.drop_column("sessions", "topic_snapshot")
