"""Admin-only scenario editor endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.core.providers.llm_provider import LlmProvider, get_llm_provider
from app.models.admin_editor_schemas import (
    GenerateDistractorsRequest,
    GenerateDistractorsResponse,
    GenerateScenarioRequest,
)
from app.models.admin_scenario_schemas import (
    AdminScenarioDetail,
    AdminScenarioDuplicate,
    AdminScenarioError,
    AdminScenarioInput,
    AdminScenarioPage,
    AdminScenarioStatusUpdate,
    AdminScenarioUpdate,
    CefrLevel,
    ScenarioCategory,
    SearchText,
)
from app.models.auth import User
from app.models.scenario import ScenarioStatus
from app.services.admin_editor import AdminEditorService
from app.services.admin_scenario import AdminScenarioService

router = APIRouter(
    prefix="/admin/scenarios",
    tags=["Admin Scenarios"],
    responses={
        401: {"model": AdminScenarioError, "description": "Authentication required"},
        403: {"model": AdminScenarioError, "description": "Administrator access required"},
        422: {"model": AdminScenarioError, "description": "Invalid request or scenario content"},
    },
)
NOT_FOUND: dict[int | str, dict[str, object]] = {
    404: {"model": AdminScenarioError, "description": "Scenario not found"}
}
CONFLICT: dict[int | str, dict[str, object]] = {
    409: {"model": AdminScenarioError, "description": "Scenario conflict"}
}


def get_admin_scenario_service(
    request: Request,
    actor: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminScenarioService:
    return AdminScenarioService(db=db, actor_id=actor.id, trace_id=request.state.trace_id)


Editor = Annotated[AdminScenarioService, Depends(get_admin_scenario_service)]
Provider = Annotated[LlmProvider, Depends(get_llm_provider)]


@router.get("")
async def admin_list_scenarios(
    editor: Editor,
    category: ScenarioCategory | None = None,
    level: CefrLevel | None = None,
    status: ScenarioStatus | None = None,
    q: SearchText | None = None,
    cursor: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
) -> AdminScenarioPage:
    return await editor.list_page(category, level, status, q, cursor, limit)


@router.post("", status_code=201, responses=CONFLICT)
async def admin_create_scenario(body: AdminScenarioInput, editor: Editor) -> AdminScenarioDetail:
    return await editor.create(body)


@router.post(
    "/generate",
    dependencies=[Depends(require_admin)],
    responses={502: {"model": AdminScenarioError, "description": "AI output unavailable"}},
)
async def generate_scenario(
    body: GenerateScenarioRequest, provider: Provider
) -> AdminScenarioInput:
    return await AdminEditorService(provider).generate_lesson(body)


@router.post(
    "/generate-distractors",
    dependencies=[Depends(require_admin)],
    responses={502: {"model": AdminScenarioError, "description": "AI output unavailable"}},
)
async def generate_distractors(
    body: GenerateDistractorsRequest, provider: Provider
) -> GenerateDistractorsResponse:
    return await AdminEditorService(provider).generate_distractors(body)


@router.get("/{id}", responses=NOT_FOUND)
async def admin_get_scenario(id: uuid.UUID, editor: Editor) -> AdminScenarioDetail:
    return await editor.get(id)


@router.put("/{id}", responses={**NOT_FOUND, **CONFLICT})
async def admin_update_scenario(
    id: uuid.UUID, body: AdminScenarioUpdate, editor: Editor
) -> AdminScenarioDetail:
    return await editor.update(id, body)


@router.post("/{id}/duplicate", status_code=201, responses={**NOT_FOUND, **CONFLICT})
async def admin_duplicate_scenario(
    id: uuid.UUID, body: AdminScenarioDuplicate, editor: Editor
) -> AdminScenarioDetail:
    return await editor.duplicate(id, body.slug)


@router.patch("/{id}/status", responses={**NOT_FOUND, **CONFLICT})
async def admin_set_scenario_status(
    id: uuid.UUID, body: AdminScenarioStatusUpdate, editor: Editor
) -> AdminScenarioDetail:
    return await editor.change_status(id, body)


@router.delete("/{id}", status_code=204, responses={**NOT_FOUND, **CONFLICT})
async def admin_delete_scenario(id: uuid.UUID, editor: Editor) -> None:
    await editor.delete(id)
