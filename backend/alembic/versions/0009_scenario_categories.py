"""Persist the editable scenario category catalog."""

import uuid

import sqlalchemy as sa

from alembic import op

revision = "0009_scenario_categories"
down_revision = "0008_scenario_admin"
branch_labels = None
depends_on = None


def upgrade() -> None:
    catalog = op.create_table(
        "scenario_categories",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("code", sa.String(50), nullable=False, unique=True),
        sa.Column("name_vi", sa.String(120), nullable=False),
    )
    names = {
        "DAILY_LIFE": "Đời sống hằng ngày",
        "SOCIAL": "Giao tiếp xã hội",
        "TRAVEL_SHOPPING": "Du lịch & Mua sắm",
        "WORKPLACE": "Nơi làm việc",
    }
    existing = op.get_bind().execute(sa.text("SELECT DISTINCT category FROM scenarios")).scalars()
    for code in existing:
        names.setdefault(code, code)
    op.bulk_insert(
        catalog,
        [{"id": uuid.uuid4(), "code": code, "name_vi": name} for code, name in names.items()],
    )
    op.create_foreign_key(
        "fk_scenarios_category", "scenarios", "scenario_categories", ["category"], ["code"]
    )


def downgrade() -> None:
    op.drop_constraint("fk_scenarios_category", "scenarios", type_="foreignkey")
    op.drop_table("scenario_categories")
