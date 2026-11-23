"""Persistence for the scenario editor."""

import uuid
from collections.abc import Sequence

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.scenario import Scenario, ScenarioStatus


class AdminScenarioRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_page(
        self,
        *,
        category: str | None,
        level: str | None,
        status: ScenarioStatus | None,
        q: str | None,
        cursor: uuid.UUID | None,
        limit: int,
    ) -> Sequence[Scenario]:
        stmt = select(Scenario).order_by(Scenario.id).limit(limit)
        if category:
            stmt = stmt.where(Scenario.category == category)
        if level:
            stmt = stmt.where(Scenario.level == level)
        if status:
            stmt = stmt.where(Scenario.status == status)
        if q:
            stmt = stmt.where(
                or_(
                    Scenario.title_vi.icontains(q, autoescape=True),
                    Scenario.title_en.icontains(q, autoescape=True),
                    Scenario.slug.icontains(q, autoescape=True),
                )
            )
        if cursor:
            stmt = stmt.where(Scenario.id > cursor)
        result = await self.db.scalars(stmt)
        return result.all()

    async def get(self, scenario_id: uuid.UUID, *, lock: bool = False) -> Scenario | None:
        stmt = (
            select(Scenario)
            .where(Scenario.id == scenario_id)
            .options(selectinload(Scenario.chunks), selectinload(Scenario.requirements))
        )
        if lock:
            stmt = stmt.with_for_update()
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
