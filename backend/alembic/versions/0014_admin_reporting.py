"""Index ended practice sessions for PostgreSQL report windows."""

import sqlalchemy as sa

from alembic import op

revision = "0014_admin_reporting"
down_revision = "0013_session_qa"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_sessions_ended_at",
        "sessions",
        ["ended_at"],
        postgresql_where=sa.text("ended_at IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_sessions_ended_at", table_name="sessions")
