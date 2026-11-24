import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_llm_provider, require_admin
from app.core.providers.llm_provider import LlmProvider
from app.models.admin_coach_schemas import (
    AdminCoachTopic,
    AdminCoachTopicInput,
    AdminCoachTopicUpdate,
    AdminTopicMove,
    CoachTopicDraft,
    GenerateCoachTopic,
)
from app.models.admin_scenario_schemas import (
    ADMIN_ACCESS_RESPONSES,
    AdminScenarioError,
    CefrLevel,
    SearchText,
)
from app.models.auth import User
from app.services.admin_audit import AdminAudit
from app.services.admin_coach import AdminCoachService, generate_coach_topic

router = APIRouter(
    prefix="/admin/coach-topics", tags=["Admin Coach Topics"], responses=ADMIN_ACCESS_RESPONSES
)


def get_topics(
    request: Request, actor: User = Depends(require_admin), db: AsyncSession = Depends(get_db)
) -> AdminCoachService:
    return AdminCoachService(db, AdminAudit(db, actor.id, request.state.trace_id))


Topics = Annotated[AdminCoachService, Depends(get_topics)]


@router.get("")
async def list_topics(
    topics: Topics,
    q: SearchText | None = None,
    category: SearchText | None = None,
    min_level: Annotated[CefrLevel | None, Query(alias="minLevel")] = None,
    is_active: Annotated[bool | None, Query(alias="isActive")] = None,
) -> list[AdminCoachTopic]:
    return await topics.list(q, category, min_level, is_active)


@router.post("", status_code=201)
async def create_topic(body: AdminCoachTopicInput, topics: Topics) -> AdminCoachTopic:
    return await topics.create(body)


@router.post("/generate", dependencies=[Depends(require_admin)])
async def generate(
    body: GenerateCoachTopic, provider: LlmProvider = Depends(get_llm_provider)
) -> CoachTopicDraft:
    return await generate_coach_topic(provider, body)


@router.patch("/{id}")
async def update_topic(
    id: uuid.UUID, body: AdminCoachTopicUpdate, topics: Topics
) -> AdminCoachTopic:
    return await topics.update(id, body)


@router.delete(
    "/{id}",
    status_code=204,
    responses={409: {"model": AdminScenarioError, "description": "Topic is linked to a session"}},
)
async def delete_topic(id: uuid.UUID, topics: Topics) -> None:
    await topics.delete(id)


@router.post("/{id}/move", status_code=204)
async def move_topic(id: uuid.UUID, body: AdminTopicMove, topics: Topics) -> None:
    await topics.move(id, body)
