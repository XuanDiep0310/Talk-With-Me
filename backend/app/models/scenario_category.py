"""Editable labels for stable scenario category codes."""

import uuid

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

STARTER_CATEGORIES = {
    "DAILY_LIFE": "Đời sống hằng ngày",
    "SOCIAL": "Giao tiếp xã hội",
    "TRAVEL_SHOPPING": "Du lịch & Mua sắm",
    "WORKPLACE": "Nơi làm việc",
}


class ScenarioCategory(Base):
    __tablename__ = "scenario_categories"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True)
    name_vi: Mapped[str] = mapped_column(String(120))
