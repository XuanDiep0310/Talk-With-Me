import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.admin_scenario_schemas import ADMIN_ACCESS_RESPONSES
from app.models.admin_session_schemas import (
    AdminQaLabels,
    AdminSessionDetail,
    AdminSessionFilters,
    AdminSessionPage,
    AdminTranscriptPage,
)
from app.models.auth import User
from app.models.scoring_schemas import SessionFeedbackResponse
from app.services.admin_audit import AdminAudit
from app.services.admin_session import AdminSessionService
from app.services.scoring.service import ScoringService

router = APIRouter(
    prefix="/admin/sessions", tags=["Admin Sessions"], responses=ADMIN_ACCESS_RESPONSES
)


def get_service(
    request: Request, actor: User = Depends(require_admin), db: AsyncSession = Depends(get_db)
) -> AdminSessionService:
    return AdminSessionService(db, AdminAudit(db, actor.id, request.state.trace_id))


Sessions = Annotated[AdminSessionService, Depends(get_service)]


@router.get("")
async def list_sessions(
    service: Sessions, filters: Annotated[AdminSessionFilters, Query()]
) -> AdminSessionPage:
    return await service.list(filters)


@router.get("/{id}")
async def get_session(id: uuid.UUID, service: Sessions, response: Response) -> AdminSessionDetail:
    response.headers["Cache-Control"] = "no-store"
    return await service.detail(id)


@router.get("/{id}/transcript")
async def get_transcript(
    id: uuid.UUID,
    service: Sessions,
    response: Response,
    cursor: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
) -> AdminTranscriptPage:
    response.headers["Cache-Control"] = "no-store"
    return await service.transcript(id, cursor, limit)


@router.patch("/{id}/qa-labels")
async def update_labels(id: uuid.UUID, body: AdminQaLabels, service: Sessions) -> AdminQaLabels:
    return await service.update_labels(id, body)


@router.post("/{id}/retry-feedback", status_code=202)
async def retry_feedback(id: uuid.UUID, service: Sessions) -> SessionFeedbackResponse:
    return await ScoringService(service.db).retry_feedback(id, user_id=None, audit=service.audit)
