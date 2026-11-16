"""remove_community_room

Revision ID: 0007_remove_room_column
Revises: a5cf87a5ccad
Create Date: 2026-11-16 14:35:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0007_remove_room_column"
down_revision: str | None = "a5cf87a5ccad"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Drop room_id column on sessions
    op.drop_column("sessions", "room_id")

    # 2. Clean up legacy community room rows from gamification tables
    op.execute("DELETE FROM user_daily_missions WHERE mission_key = 'room_session'")
    op.execute("DELETE FROM mission_definitions WHERE key = 'room_session'")
    op.execute("DELETE FROM user_badges WHERE badge_key IN ('community_first', 'community_star')")
    op.execute("DELETE FROM badge_definitions WHERE key IN ('community_first', 'community_star')")
    op.execute("DELETE FROM xp_rules WHERE key = 'ROOM_SESSION'")
    op.execute(
        "DELETE FROM xp_transactions WHERE rule_key = 'ROOM_SESSION' OR source_type = 'ROOM_SESSION'"
    )


def downgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column("room_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
