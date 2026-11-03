"""add_scenario_tables

Revision ID: 0005_add_scenario_tables
Revises: 0004_add_scoring_feedback
Create Date: 2026-10-27 09:00:00.000000

Changes:
- NEW: scenarios (scenario catalog)
- NEW: scenario_requirements (tasks and evaluation milestones)
- NEW: scenario_chunks (functional phrases / chunks)
- NEW: user_scenario_progress (user scenario status and highest score)
- NEW: drill_attempts (ungraded chunk practice drill attempts)
- NEW: chunk_bank (user personal chunk vocabulary bank)
- NEW: roleplay_evaluations (post-roleplay structured evaluation and requirement results)
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005_add_scenario_tables"
down_revision: str | None = "0004_add_scoring_feedback"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. scenarios table
    op.create_table(
        "scenarios",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("title_vi", sa.String(255), nullable=False),
        sa.Column("title_en", sa.String(255), nullable=False),
        sa.Column("level", sa.String(10), nullable=False, server_default="A1"),
        sa.Column("estimated_duration_minutes", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("context", sa.Text(), nullable=False),
        sa.Column("user_role", sa.String(255), nullable=False),
        sa.Column("ai_role", sa.String(255), nullable=False),
        sa.Column("goals", sa.JSON(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_scenarios_slug", "scenarios", ["slug"])
    op.create_index("ix_scenarios_category", "scenarios", ["category"])
    op.create_index("ix_scenarios_level", "scenarios", ["level"])

    # 2. scenario_requirements table
    op.create_table(
        "scenario_requirements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "scenario_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("scenarios.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("type", sa.String(50), nullable=False, server_default="TASK"),
        sa.Column("expected_chunk_function", sa.String(50), nullable=True),
        sa.Column("is_mandatory", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_scenario_requirements_scenario_id", "scenario_requirements", ["scenario_id"]
    )

    # 3. scenario_chunks table
    op.create_table(
        "scenario_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "scenario_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("scenarios.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("function_tag", sa.String(50), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("meaning_vi", sa.Text(), nullable=False),
        sa.Column("audio_url", sa.String(500), nullable=True),
        sa.Column("example_sentence", sa.Text(), nullable=False),
        sa.Column("accepted_variations", sa.JSON(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_scenario_chunks_scenario_id", "scenario_chunks", ["scenario_id"])

    # 4. user_scenario_progress table
    op.create_table(
        "user_scenario_progress",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "scenario_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("scenarios.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(30), nullable=False, server_default="NOT_STARTED"),
        sa.Column("highest_score", sa.Float(), nullable=True),
        sa.Column("practiced_chunks", sa.JSON(), nullable=False),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("user_id", "scenario_id", name="uq_user_scenario_progress"),
    )
    op.create_index("ix_user_scenario_progress_user_id", "user_scenario_progress", ["user_id"])
    op.create_index(
        "ix_user_scenario_progress_scenario_id", "user_scenario_progress", ["scenario_id"]
    )
    op.create_index("ix_user_scenario_progress_status", "user_scenario_progress", ["status"])

    # 5. drill_attempts table
    op.create_table(
        "drill_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "scenario_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("scenarios.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "chunk_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("scenario_chunks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("is_skipped", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_drill_attempts_user_id", "drill_attempts", ["user_id"])
    op.create_index("ix_drill_attempts_scenario_id", "drill_attempts", ["scenario_id"])
    op.create_index("ix_drill_attempts_chunk_id", "drill_attempts", ["chunk_id"])

    # 6. chunk_bank table
    op.create_table(
        "chunk_bank",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "chunk_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("scenario_chunks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(30), nullable=False, server_default="NEEDS_PRACTICE"),
        sa.Column("last_reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("user_id", "chunk_id", name="uq_user_chunk_bank"),
    )
    op.create_index("ix_chunk_bank_user_id", "chunk_bank", ["user_id"])
    op.create_index("ix_chunk_bank_chunk_id", "chunk_bank", ["chunk_id"])
    op.create_index("ix_chunk_bank_status", "chunk_bank", ["status"])

    # 7. roleplay_evaluations table
    op.create_table(
        "roleplay_evaluations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "scenario_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("scenarios.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(30), nullable=False, server_default="PENDING"),
        sa.Column("passed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("requirements_evaluation", sa.JSON(), nullable=False),
        sa.Column("chunks_used_well", sa.JSON(), nullable=False),
        sa.Column("chunks_to_improve", sa.JSON(), nullable=False),
        sa.Column("strengths", sa.JSON(), nullable=False),
        sa.Column("improvements", sa.JSON(), nullable=False),
        sa.Column("next_practice", sa.Text(), nullable=True),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_roleplay_evaluations_session_id", "roleplay_evaluations", ["session_id"])
    op.create_index("ix_roleplay_evaluations_scenario_id", "roleplay_evaluations", ["scenario_id"])
    op.create_index("ix_roleplay_evaluations_user_id", "roleplay_evaluations", ["user_id"])
    op.create_index("ix_roleplay_evaluations_status", "roleplay_evaluations", ["status"])


def downgrade() -> None:
    op.drop_table("roleplay_evaluations")
    op.drop_table("chunk_bank")
    op.drop_table("drill_attempts")
    op.drop_table("user_scenario_progress")
    op.drop_table("scenario_chunks")
    op.drop_table("scenario_requirements")
    op.drop_table("scenarios")
