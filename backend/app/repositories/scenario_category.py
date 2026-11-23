from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scenario import Scenario
from app.models.scenario_category import ScenarioCategory


class ScenarioCategoryRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_with_counts(self) -> list[tuple[ScenarioCategory, int]]:
        result = await self.db.execute(
            select(ScenarioCategory, func.count(Scenario.id))
            .outerjoin(Scenario, Scenario.category == ScenarioCategory.code)
            .group_by(ScenarioCategory.id)
            .order_by(ScenarioCategory.name_vi, ScenarioCategory.code)
        )
        return [(category, count) for category, count in result]

    async def get(self, code: str) -> ScenarioCategory | None:
        result = await self.db.execute(
            select(ScenarioCategory).where(ScenarioCategory.code == code)
        )
        return result.scalar_one_or_none()

    async def count_lessons(self, code: str) -> int:
        return (await self.db.scalar(select(func.count()).where(Scenario.category == code))) or 0
