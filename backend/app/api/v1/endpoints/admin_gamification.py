from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.admin_gamification_schemas import (
    AdminBadge,
    AdminBadgeCreate,
    AdminBadgeUpdate,
    AdminMission,
    AdminMissionCreate,
    AdminMissionUpdate,
    AdminXpFilters,
    AdminXpPage,
    AdminXpRule,
    AdminXpRuleUpdate,
)
from app.models.admin_scenario_schemas import ADMIN_ACCESS_RESPONSES, AdminScenarioError
from app.models.auth import User
from app.services.admin_audit import AdminAudit
from app.services.admin_gamification import AdminGamificationService

router = APIRouter(
    prefix="/admin/gamification", tags=["Admin Gamification"], responses=ADMIN_ACCESS_RESPONSES
)


def get_service(
    request: Request, actor: User = Depends(require_admin), db: AsyncSession = Depends(get_db)
) -> AdminGamificationService:
    return AdminGamificationService(db, AdminAudit(db, actor.id, request.state.trace_id))


Gamification = Annotated[AdminGamificationService, Depends(get_service)]


@router.get("/xp-rules")
async def rules(service: Gamification) -> list[AdminXpRule]:
    return await service.rules()


@router.patch("/xp-rules/{key}")
async def update_rule(key: str, body: AdminXpRuleUpdate, service: Gamification) -> AdminXpRule:
    return await service.update_rule(key, body)


@router.get("/missions")
async def missions(service: Gamification) -> list[AdminMission]:
    return await service.missions()


@router.patch("/missions/{key}")
async def update_mission(key: str, body: AdminMissionUpdate, service: Gamification) -> AdminMission:
    return await service.update_mission(key, body)


@router.get("/badges")
async def badges(service: Gamification) -> list[AdminBadge]:
    return await service.badges()


@router.get("/transactions")
async def transactions(
    service: Gamification, filters: Annotated[AdminXpFilters, Query()]
) -> AdminXpPage:
    return await service.transactions(filters)


@router.post(
    "/missions",
    status_code=201,
    responses={409: {"model": AdminScenarioError, "description": "Mission key already exists"}},
)
async def create_mission(body: AdminMissionCreate, service: Gamification) -> AdminMission:
    return await service.create_mission(body)


@router.post(
    "/badges",
    status_code=201,
    responses={409: {"model": AdminScenarioError, "description": "Badge key already exists"}},
)
async def create_badge(body: AdminBadgeCreate, service: Gamification) -> AdminBadge:
    return await service.create_badge(body)


@router.patch("/badges/{key}")
async def update_badge(key: str, body: AdminBadgeUpdate, service: Gamification) -> AdminBadge:
    return await service.update_badge(key, body)
