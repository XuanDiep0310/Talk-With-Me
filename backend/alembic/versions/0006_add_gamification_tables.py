"""add_gamification_tables

Revision ID: 0006_add_gamification_tables
Revises: 0005_add_scenario_tables
Create Date: 2026-11-04 12:00:00.000000

Changes:
- NEW: xp_rules (configurable XP reward definitions)
- NEW: xp_transactions (immutable XP ledger, source of truth)
- NEW: gamification_profiles (cached XP, streak counters, last active date)
- NEW: mission_definitions (daily mission catalog)
- NEW: user_daily_missions (per-user daily missions instance)
- NEW: badge_definitions (achievement badge catalog)
- NEW: user_badges (badges earned by users)
- NEW: notifications (gamification and system notifications)
- ALTER: level_history (add from_level, reason, session_id)
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006_add_gamification_tables"
down_revision: str | None = "0005_add_scenario_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. xp_rules
    op.create_table(
        "xp_rules",
        sa.Column("key", sa.String(50), primary_key=True),
        sa.Column("xp_amount", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # 2. xp_transactions
    op.create_table(
        "xp_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("rule_key", sa.String(50), nullable=False),
        sa.Column("source_type", sa.String(50), nullable=False),
        sa.Column("source_id", sa.String(100), nullable=False),
        sa.Column("idempotency_key", sa.String(150), nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_xp_transactions_user_id", "xp_transactions", ["user_id"])
    op.create_index(
        "ix_xp_transactions_idempotency_key", "xp_transactions", ["idempotency_key"], unique=True
    )

    # 3. gamification_profiles
    op.create_table(
        "gamification_profiles",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("total_xp", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("current_streak", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("best_streak", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("last_active_date", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # 4. mission_definitions
    op.create_table(
        "mission_definitions",
        sa.Column("key", sa.String(50), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("xp_reward", sa.Integer(), nullable=False, server_default=sa.text("50")),
        sa.Column("condition_type", sa.String(50), nullable=False),
        sa.Column("target_count", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column(
            "params",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # 5. user_daily_missions
    op.create_table(
        "user_daily_missions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("mission_date", sa.Date(), nullable=False),
        sa.Column(
            "mission_key",
            sa.String(50),
            sa.ForeignKey("mission_definitions.key", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(30), nullable=False, server_default=sa.text("'IN_PROGRESS'")),
        sa.Column("progress", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("target", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("user_id", "mission_date", "mission_key", name="uq_user_daily_mission"),
    )
    op.create_index("ix_user_daily_missions_user_id", "user_daily_missions", ["user_id"])
    op.create_index("ix_user_daily_missions_mission_date", "user_daily_missions", ["mission_date"])

    # 6. badge_definitions
    op.create_table(
        "badge_definitions",
        sa.Column("key", sa.String(50), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("icon_emoji", sa.String(10), nullable=False),
        sa.Column("category", sa.String(50), nullable=False, server_default=sa.text("'GENERAL'")),
        sa.Column("criteria_type", sa.String(50), nullable=False),
        sa.Column("target_value", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column(
            "params",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # 7. user_badges
    op.create_table(
        "user_badges",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "badge_key",
            sa.String(50),
            sa.ForeignKey("badge_definitions.key", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "awarded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.UniqueConstraint("user_id", "badge_key", name="uq_user_badge"),
    )
    op.create_index("ix_user_badges_user_id", "user_badges", ["user_id"])

    # 8. notifications
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_type", "notifications", ["type"])
    op.create_index("ix_notifications_is_read", "notifications", ["is_read"])

    # 9. Alter level_history to support promotion tracking
    op.add_column("level_history", sa.Column("from_level", sa.String(5), nullable=True))
    op.add_column("level_history", sa.Column("reason", sa.Text(), nullable=True))
    op.add_column(
        "level_history",
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    # 9. Revert level_history columns
    op.drop_column("level_history", "session_id")
    op.drop_column("level_history", "reason")
    op.drop_column("level_history", "from_level")

    # 8. notifications
    op.drop_index("ix_notifications_is_read", table_name="notifications")
    op.drop_index("ix_notifications_type", table_name="notifications")
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")

    # 7. user_badges
    op.drop_index("ix_user_badges_user_id", table_name="user_badges")
    op.drop_table("user_badges")

    # 6. badge_definitions
    op.drop_table("badge_definitions")

    # 5. user_daily_missions
    op.drop_index("ix_user_daily_missions_mission_date", table_name="user_daily_missions")
    op.drop_index("ix_user_daily_missions_user_id", table_name="user_daily_missions")
    op.drop_table("user_daily_missions")

    # 4. mission_definitions
    op.drop_table("mission_definitions")

    # 3. gamification_profiles
    op.drop_table("gamification_profiles")

    # 2. xp_transactions
    op.drop_index("ix_xp_transactions_idempotency_key", table_name="xp_transactions")
    op.drop_index("ix_xp_transactions_user_id", table_name="xp_transactions")
    op.drop_table("xp_transactions")

    # 1. xp_rules
    op.drop_table("xp_rules")
