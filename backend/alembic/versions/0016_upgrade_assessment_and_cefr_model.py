"""Add pronunciation metrics, two-stage placement, and longitudinal CEFR profile tables.

Revision ID: 0016_upgrade_assessment_cefr
Revises: 0015_admin_actions
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0016_upgrade_assessment_cefr"
down_revision: str | None = "0015_admin_actions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    json_type = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")

    # 1. Transcript segments acoustic & barge-in columns
    op.add_column(
        "transcript_segments", sa.Column("pronunciation_accuracy", sa.Float(), nullable=True)
    )
    op.add_column(
        "transcript_segments", sa.Column("pronunciation_fluency", sa.Float(), nullable=True)
    )
    op.add_column(
        "transcript_segments", sa.Column("pronunciation_prosody", sa.Float(), nullable=True)
    )
    op.add_column("transcript_segments", sa.Column("phoneme_errors", json_type, nullable=True))
    op.add_column(
        "transcript_segments",
        sa.Column("is_barge_in", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.add_column("transcript_segments", sa.Column("modality", sa.String(length=20), nullable=True))

    # 2. Drill attempts acoustic scores
    op.add_column("drill_attempts", sa.Column("accuracy_score", sa.Float(), nullable=True))
    op.add_column("drill_attempts", sa.Column("fluency_score", sa.Float(), nullable=True))
    op.add_column("drill_attempts", sa.Column("prosody_score", sa.Float(), nullable=True))
    op.add_column("drill_attempts", sa.Column("phoneme_errors", json_type, nullable=True))

    # 3. Placement test two-stage columns
    op.add_column(
        "placement_tests",
        sa.Column("current_stage", sa.Integer(), server_default="1", nullable=False),
    )
    op.add_column("placement_tests", sa.Column("stage1_summary_json", sa.Text(), nullable=True))
    op.add_column("placement_tests", sa.Column("stage2_summary_json", sa.Text(), nullable=True))
    op.add_column("placement_tests", sa.Column("dimension_scores_json", sa.Text(), nullable=True))

    op.add_column(
        "placement_answers",
        sa.Column("stage", sa.Integer(), server_default="2", nullable=False),
    )
    op.add_column("placement_answers", sa.Column("prompt_id", sa.String(length=30), nullable=True))
    op.add_column("placement_answers", sa.Column("accuracy_score", sa.Float(), nullable=True))
    op.add_column("placement_answers", sa.Column("fluency_score", sa.Float(), nullable=True))
    op.add_column("placement_answers", sa.Column("prosody_score", sa.Float(), nullable=True))
    op.add_column("placement_answers", sa.Column("completeness_score", sa.Float(), nullable=True))
    op.add_column("placement_answers", sa.Column("phoneme_errors_json", sa.Text(), nullable=True))

    # 4. Longitudinal learner skill profiles
    op.create_table(
        "learner_skill_profiles",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("pronunciation_ewma", sa.Float(), nullable=True),
        sa.Column("fluency_ewma", sa.Float(), nullable=True),
        sa.Column("vocabulary_ewma", sa.Float(), nullable=True),
        sa.Column("grammar_ewma", sa.Float(), nullable=True),
        sa.Column("interaction_ewma", sa.Float(), nullable=True),
        sa.Column("scripted_pronunciation_ewma", sa.Float(), nullable=True),
        sa.Column("unscripted_pronunciation_ewma", sa.Float(), nullable=True),
        sa.Column("avg_response_latency_ms", sa.Float(), nullable=True),
        sa.Column("session_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("scripted_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("unscripted_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("estimated_cefr", sa.String(length=5), nullable=True),
        sa.Column("cefr_continuous_score", sa.Float(), nullable=True),
        sa.Column("cefr_confidence", sa.String(length=20), server_default="LOW", nullable=False),
        sa.Column("limiting_dimensions", json_type, nullable=False),
        sa.Column(
            "model_version", sa.String(length=30), server_default="cefr-est-1.0.0", nullable=False
        ),
        sa.Column("last_calibrated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    op.create_table(
        "learner_cefr_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_type", sa.String(length=20), nullable=False),
        sa.Column("source_id", sa.String(length=64), nullable=False),
        sa.Column("raw_vector", json_type, nullable=False),
        sa.Column("calibrated_vector", json_type, nullable=False),
        sa.Column("estimated_cefr", sa.String(length=5), nullable=False),
        sa.Column("continuous_score", sa.Float(), nullable=False),
        sa.Column("confidence", sa.String(length=20), nullable=False),
        sa.Column("limiting_dimensions", json_type, nullable=False),
        sa.Column("model_version", sa.String(length=30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_learner_cefr_snapshots_user_id", "learner_cefr_snapshots", ["user_id"])

    op.create_table(
        "learner_phoneme_stats",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ipa_phoneme", sa.String(length=16), nullable=False),
        sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("avg_accuracy", sa.Float(), server_default="0", nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "ipa_phoneme", name="uq_learner_phoneme_stat"),
    )
    op.create_index("ix_learner_phoneme_stats_user_id", "learner_phoneme_stats", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_learner_phoneme_stats_user_id", table_name="learner_phoneme_stats")
    op.drop_table("learner_phoneme_stats")
    op.drop_index("ix_learner_cefr_snapshots_user_id", table_name="learner_cefr_snapshots")
    op.drop_table("learner_cefr_snapshots")
    op.drop_table("learner_skill_profiles")

    for col in (
        "phoneme_errors_json",
        "completeness_score",
        "prosody_score",
        "fluency_score",
        "accuracy_score",
        "prompt_id",
        "stage",
    ):
        op.drop_column("placement_answers", col)

    for col in (
        "dimension_scores_json",
        "stage2_summary_json",
        "stage1_summary_json",
        "current_stage",
    ):
        op.drop_column("placement_tests", col)

    for col in ("phoneme_errors", "prosody_score", "fluency_score", "accuracy_score"):
        op.drop_column("drill_attempts", col)

    for col in (
        "modality",
        "is_barge_in",
        "phoneme_errors",
        "pronunciation_prosody",
        "pronunciation_fluency",
        "pronunciation_accuracy",
    ):
        op.drop_column("transcript_segments", col)
