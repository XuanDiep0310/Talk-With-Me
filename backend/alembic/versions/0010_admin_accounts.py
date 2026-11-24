"""Record administrative account changes and invalidate locked access tokens."""

import sqlalchemy as sa

from alembic import op

revision = "0010_admin_accounts"
down_revision = "0009_scenario_categories"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("auth_version", sa.Integer(), server_default="0", nullable=False)
    )
    op.create_table(
        "account_admin_audit",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("target_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("previous_role", sa.String(10), nullable=False),
        sa.Column("new_role", sa.String(10), nullable=False),
        sa.Column("previous_active", sa.Boolean(), nullable=False),
        sa.Column("new_active", sa.Boolean(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("trace_id", sa.Text(), nullable=False),
    )
    op.create_index("ix_account_admin_audit_actor_id", "account_admin_audit", ["actor_id"])
    op.create_index("ix_account_admin_audit_target_id", "account_admin_audit", ["target_id"])


def downgrade() -> None:
    op.drop_table("account_admin_audit")
    op.drop_column("users", "auth_version")
