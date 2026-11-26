import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_auth_service, get_db, require_admin
from app.models.admin_account_schemas import (
    AdminAccountDetail,
    AdminAccountPage,
    AdminAccountUpdate,
    AdminLevelAdjustment,
    AdminOverview,
    AdminPlacementPage,
    AdminXpAdjustment,
)
from app.models.admin_scenario_schemas import ADMIN_ACCESS_RESPONSES, AdminScenarioError, SearchText
from app.models.auth import User
from app.services.admin_account import AdminAccountService
from app.services.auth import AuthService

router = APIRouter(prefix="/admin", tags=["Admin Accounts"], responses=ADMIN_ACCESS_RESPONSES)


def get_account_service(
    request: Request, actor: User = Depends(require_admin), db: AsyncSession = Depends(get_db)
) -> AdminAccountService:
    return AdminAccountService(db, actor.id, request.state.trace_id)


Accounts = Annotated[AdminAccountService, Depends(get_account_service)]


@router.get("/users")
async def list_accounts(
    accounts: Accounts,
    q: SearchText | None = None,
    cursor: Annotated[str | None, Query(max_length=512)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
) -> AdminAccountPage:
    return await accounts.list(q, cursor, limit)


@router.patch(
    "/users/{id}",
    status_code=204,
    responses={
        404: {"model": AdminScenarioError, "description": "Account not found"},
        409: {"model": AdminScenarioError, "description": "Account change conflict"},
    },
)
async def update_account(id: uuid.UUID, body: AdminAccountUpdate, accounts: Accounts) -> None:
    await accounts.update(id, body)


@router.get("/overview")
async def get_overview(accounts: Accounts) -> AdminOverview:
    return await accounts.overview()


@router.get("/users/{id}")
async def get_account(id: uuid.UUID, accounts: Accounts, response: Response) -> AdminAccountDetail:
    response.headers["Cache-Control"] = "no-store"
    return await accounts.detail(id)


@router.get("/users/{id}/placements")
async def placements(
    id: uuid.UUID,
    accounts: Accounts,
    cursor: Annotated[str | None, Query(max_length=512)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> AdminPlacementPage:
    return await accounts.placements(id, cursor, limit)


@router.post("/users/{id}/force-logout", status_code=204)
async def force_logout(id: uuid.UUID, accounts: Accounts) -> None:
    await accounts.force_logout(id)


@router.patch(
    "/users/{id}/level",
    status_code=204,
    responses={
        409: {"model": AdminScenarioError, "description": "Learning profile is unavailable"}
    },
)
async def adjust_level(id: uuid.UUID, body: AdminLevelAdjustment, accounts: Accounts) -> None:
    await accounts.adjust_level(id, body)


@router.post(
    "/users/{id}/xp-adjustments",
    status_code=204,
    responses={409: {"model": AdminScenarioError, "description": "XP adjustment conflict"}},
)
async def adjust_xp(id: uuid.UUID, body: AdminXpAdjustment, accounts: Accounts) -> None:
    await accounts.adjust_xp(id, body)


@router.post(
    "/users/{id}/password-reset",
    status_code=204,
    responses={409: {"model": AdminScenarioError, "description": "Password reset is unavailable"}},
)
async def send_password_reset(
    id: uuid.UUID, accounts: Accounts, auth: Annotated[AuthService, Depends(get_auth_service)]
) -> None:
    await accounts.send_reset(id, auth)
