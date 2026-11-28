"""Add server_default=now() to learner_skill_profiles timestamps.

Revision ID: 0017_fix_profile_ts
Revises: 0016_upgrade_assessment_cefr
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0017_fix_profile_ts"
down_revision: str | None = "0016_upgrade_assessment_cefr"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "learner_skill_profiles",
        "created_at",
        existing_type=sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        nullable=False,
    )
    op.alter_column(
        "learner_skill_profiles",
        "updated_at",
        existing_type=sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "learner_skill_profiles",
        "updated_at",
        existing_type=sa.DateTime(timezone=True),
        server_default=None,
        nullable=False,
    )
    op.alter_column(
        "learner_skill_profiles",
        "created_at",
        existing_type=sa.DateTime(timezone=True),
        server_default=None,
        nullable=False,
    )
