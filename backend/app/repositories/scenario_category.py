from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scenario import Scenario
from app.models.scenario_category import STARTER_CATEGORIES, ScenarioCategory
from app.models.session import CoachTopic


class ScenarioCategoryRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def ensure_defaults(self) -> None:
        if await self.db.scalar(select(ScenarioCategory.id).limit(1)) is None:
            self.db.add_all(
                [
                    ScenarioCategory(code=code, name_vi=name)
                    for code, name in STARTER_CATEGORIES.items()
                ]
            )
            await self.db.flush()

    async def list_with_counts(self) -> list[tuple[ScenarioCategory, int]]:
        scenario_counts = (
            select(Scenario.category, func.count(Scenario.id).label("cnt"))
            .group_by(Scenario.category)
            .subquery()
        )
        topic_counts = (
            select(CoachTopic.category, func.count(CoachTopic.id).label("cnt"))
            .where(CoachTopic.deleted_at.is_(None))
            .group_by(CoachTopic.category)
            .subquery()
        )
        result = await self.db.execute(
            select(
                ScenarioCategory,
                (
                    func.coalesce(scenario_counts.c.cnt, 0) + func.coalesce(topic_counts.c.cnt, 0)
                ).label("total"),
            )
            .outerjoin(scenario_counts, scenario_counts.c.category == ScenarioCategory.code)
            .outerjoin(topic_counts, topic_counts.c.category == ScenarioCategory.code)
            .order_by(ScenarioCategory.name_vi, ScenarioCategory.code)
        )
        return [(category, int(count)) for category, count in result]

    async def get(self, code: str) -> ScenarioCategory | None:
        result = await self.db.execute(
            select(ScenarioCategory).where(ScenarioCategory.code == code)
        )
        return result.scalar_one_or_none()

    async def count_lessons(self, code: str) -> int:
        scenarios = (
            await self.db.scalar(select(func.count()).where(Scenario.category == code))
        ) or 0
        topics = (
            await self.db.scalar(
                select(func.count()).where(
                    CoachTopic.category == code, CoachTopic.deleted_at.is_(None)
                )
            )
        ) or 0
        return int(scenarios) + int(topics)
