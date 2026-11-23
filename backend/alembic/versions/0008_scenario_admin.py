"""Add admin roles, scenario publishing, and the editorial audit log."""

import sqlalchemy as sa

from alembic import op

revision = "0008_scenario_admin"
down_revision = "0007_remove_room_column"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("role", sa.String(10), server_default="LEARNER", nullable=False)
    )
    op.create_check_constraint("ck_users_role", "users", "role IN ('LEARNER', 'ADMIN')")
    op.add_column(
        "scenarios",
        sa.Column("status", sa.String(10), server_default="PUBLISHED", nullable=False),
    )
    op.add_column(
        "scenarios", sa.Column("revision", sa.Integer(), server_default="1", nullable=False)
    )
    op.create_check_constraint(
        "ck_scenarios_status", "scenarios", "status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')"
    )
    op.create_table(
        "scenario_admin_audit",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("scenario_id", sa.Uuid(), sa.ForeignKey("scenarios.id"), nullable=False),
        sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("trace_id", sa.Text(), nullable=False),
    )
    op.create_index("ix_scenario_admin_audit_scenario_id", "scenario_admin_audit", ["scenario_id"])


def downgrade() -> None:
    op.drop_table("scenario_admin_audit")
    op.drop_constraint("ck_scenarios_status", "scenarios", type_="check")
    op.drop_column("scenarios", "revision")
    op.drop_column("scenarios", "status")
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.drop_column("users", "role")
