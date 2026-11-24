"""Persistence for the scenario editor."""

import uuid
from collections.abc import Sequence

from sqlalchemy import ColumnElement, func, or_, select
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
        stmt = (
            select(Scenario)
            .where(*self._filters(category, level, q))
            .order_by(Scenario.id)
            .limit(limit)
        )
        if status:
            stmt = stmt.where(Scenario.status == status)
        if cursor:
            stmt = stmt.where(Scenario.id > cursor)
        result = await self.db.scalars(stmt)
        return result.all()

    async def status_counts(
        self, category: str | None, level: str | None, q: str | None
    ) -> dict[ScenarioStatus, int]:
        rows = await self.db.execute(
            select(Scenario.status, func.count())
            .where(*self._filters(category, level, q))
            .group_by(Scenario.status)
        )
        counts: dict[ScenarioStatus, int] = {"DRAFT": 0, "PUBLISHED": 0, "ARCHIVED": 0}
        for status, count in rows:
            counts[status] = count
        return counts

    @staticmethod
    def _filters(
        category: str | None, level: str | None, q: str | None
    ) -> list[ColumnElement[bool]]:
        filters: list[ColumnElement[bool]] = []
        if category:
            filters.append(Scenario.category == category)
        if level:
            filters.append(Scenario.level == level)
        if q:
            filters.append(
                or_(
                    Scenario.title_vi.icontains(q, autoescape=True),
                    Scenario.title_en.icontains(q, autoescape=True),
                    Scenario.slug.icontains(q, autoescape=True),
                )
            )
        return filters

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
