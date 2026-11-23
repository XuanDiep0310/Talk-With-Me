from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.admin_scenario_schemas import (
    ADMIN_ACCESS_RESPONSES,
    AdminScenarioError,
    CategoryCreate,
    CategoryDetail,
    CategoryName,
    ScenarioCategory,
)
from app.services.admin_category import AdminCategoryService

router = APIRouter(
    prefix="/admin/scenario-categories",
    tags=["Admin Scenario Categories"],
    dependencies=[Depends(require_admin)],
    responses=ADMIN_ACCESS_RESPONSES,
)


def get_category_service(db: AsyncSession = Depends(get_db)) -> AdminCategoryService:
    return AdminCategoryService(db)


Catalog = Annotated[AdminCategoryService, Depends(get_category_service)]


@router.get("")
async def list_categories(catalog: Catalog) -> list[CategoryDetail]:
    return await catalog.list()


@router.post(
    "",
    status_code=201,
    responses={409: {"model": AdminScenarioError, "description": "Category already exists"}},
)
async def create_category(body: CategoryCreate, catalog: Catalog) -> CategoryDetail:
    return await catalog.create(body.code, body.name_vi)


@router.patch(
    "/{code}", responses={404: {"model": AdminScenarioError, "description": "Category not found"}}
)
async def rename_category(
    code: ScenarioCategory, body: CategoryName, catalog: Catalog
) -> CategoryDetail:
    return await catalog.rename(code, body.name_vi)


@router.delete(
    "/{code}",
    status_code=204,
    responses={
        404: {"model": AdminScenarioError, "description": "Category not found"},
        409: {"model": AdminScenarioError, "description": "Category has lessons"},
    },
)
async def delete_category(code: ScenarioCategory, catalog: Catalog) -> None:
    await catalog.delete(code)
