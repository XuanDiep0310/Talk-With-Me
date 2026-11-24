from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_scenario_schemas import CategoryDetail
from app.models.scenario_category import ScenarioCategory
from app.repositories.scenario_category import ScenarioCategoryRepository


class AdminCategoryService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = ScenarioCategoryRepository(db)

    async def list(self) -> list[CategoryDetail]:
        return [
            CategoryDetail(code=category.code, name_vi=category.name_vi, lesson_count=count)
            for category, count in await self.repo.list_with_counts()
        ]

    async def create(self, code: str, name: str) -> CategoryDetail:
        if await self.repo.get(code):
            raise HTTPException(
                409, detail={"code": "CATEGORY_EXISTS", "message": "Category code already exists."}
            )
        self.db.add(ScenarioCategory(code=code, name_vi=name))
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise HTTPException(
                409, detail={"code": "CATEGORY_EXISTS", "message": "Category code already exists."}
            ) from exc
        return CategoryDetail(code=code, name_vi=name, lesson_count=0)

    async def rename(self, code: str, name: str) -> CategoryDetail:
        category = await self._get(code)
        category.name_vi = name
        count = await self.repo.count_lessons(code)
        await self.db.commit()
        return CategoryDetail(code=code, name_vi=name, lesson_count=count)

    async def delete(self, code: str) -> None:
        category = await self._get(code)
        conflict = HTTPException(
            409, detail={"code": "CATEGORY_IN_USE", "message": "Category contains lessons."}
        )
        if await self.repo.count_lessons(code):
            raise conflict
        await self.db.delete(category)
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise conflict from exc

    async def _get(self, code: str) -> ScenarioCategory:
        category = await self.repo.get(code)
        if category is None:
            raise HTTPException(
                404, detail={"code": "CATEGORY_NOT_FOUND", "message": "Category not found."}
            )
        return category
