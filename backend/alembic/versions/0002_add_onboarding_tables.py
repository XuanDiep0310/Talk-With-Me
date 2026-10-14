"""add_onboarding_tables

Revision ID: 0002_add_onboarding_tables
Revises: 0001_create_auth_tables
Create Date: 2026-10-09 09:00:00.000000

Changes:
- user_profiles: add level_source, needs_reassessment, onboarding_completed_at columns
- NEW: placement_tests table
- NEW: placement_answers table
- NEW: level_history table
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002_add_onboarding_tables"
down_revision: str | None = "0001_create_auth_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Extend user_profiles with onboarding columns
    op.add_column(
        "user_profiles",
        sa.Column("level_source", sa.String(20), nullable=True),
    )
    op.add_column(
        "user_profiles",
        sa.Column(
            "needs_reassessment",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "user_profiles",
        sa.Column("onboarding_completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # 2. placement_tests
    op.create_table(
        "placement_tests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'CREATED'"),
        ),
        sa.Column("estimated_level", sa.String(5), nullable=True),
        sa.Column(
            "is_insufficient_data",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("features_json", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_placement_tests_user_id", "placement_tests", ["user_id"])

    # 3. placement_answers
    op.create_table(
        "placement_answers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "test_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("placement_tests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("request_id", sa.String(36), nullable=False),
        sa.Column("question_index", sa.Integer(), nullable=False),
        sa.Column("transcript", sa.Text(), nullable=True),
        sa.Column("stt_confidence", sa.Float(), nullable=True),
        sa.Column("speaking_duration_seconds", sa.Float(), nullable=True),
        sa.Column("response_latency_seconds", sa.Float(), nullable=True),
        sa.Column("word_count", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("test_id", "request_id", name="uq_placement_answer_idempotency"),
    )
    op.create_index("ix_placement_answers_test_id", "placement_answers", ["test_id"])

    # 4. level_history
    op.create_table(
        "level_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("level", sa.String(5), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column(
            "placement_test_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("placement_tests.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_level_history_user_id", "level_history", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_level_history_user_id", table_name="level_history")
    op.drop_table("level_history")

    op.drop_index("ix_placement_answers_test_id", table_name="placement_answers")
    op.drop_table("placement_answers")

    op.drop_index("ix_placement_tests_user_id", table_name="placement_tests")
    op.drop_table("placement_tests")

    op.drop_column("user_profiles", "onboarding_completed_at")
    op.drop_column("user_profiles", "needs_reassessment")
    op.drop_column("user_profiles", "level_source")
