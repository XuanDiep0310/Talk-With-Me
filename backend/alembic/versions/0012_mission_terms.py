"""Freeze daily mission terms at issuance and allow inheriting the XP default."""

import sqlalchemy as sa

from alembic import op

revision = "0012_mission_terms"
down_revision = "0011_admin_coach_topics"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_daily_missions", sa.Column("title_snapshot", sa.String(255)))
    op.add_column("user_daily_missions", sa.Column("xp_reward_snapshot", sa.Integer()))
    op.execute("""
        UPDATE user_daily_missions AS m
        SET title_snapshot = d.title, xp_reward_snapshot = d.xp_reward
        FROM mission_definitions AS d
        WHERE d.key = m.mission_key
    """)
    op.alter_column("user_daily_missions", "title_snapshot", nullable=False)
    op.alter_column("user_daily_missions", "xp_reward_snapshot", nullable=False)
    op.alter_column("mission_definitions", "xp_reward", nullable=True)
    op.alter_column("mission_definitions", "xp_reward", server_default=None)
    op.execute("""
        UPDATE mission_definitions SET xp_reward = NULL
        WHERE key IN ('coach_session', 'new_scenario', 'maintain_streak') AND xp_reward = 50
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE mission_definitions SET xp_reward = COALESCE(
            (SELECT xp_amount FROM xp_rules WHERE key = 'DAILY_MISSION'), 50
        ) WHERE xp_reward IS NULL
    """)
    op.alter_column("mission_definitions", "xp_reward", nullable=False, server_default="50")
    op.drop_column("user_daily_missions", "xp_reward_snapshot")
    op.drop_column("user_daily_missions", "title_snapshot")
