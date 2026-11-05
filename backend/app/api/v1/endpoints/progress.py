"""
Progress endpoints: /progress/summary, /progress/skills, /progress/history.
UI Screens 22, 23, 24.
"""

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_current_user, get_progress_service
from app.models.auth import User
from app.models.gamification_schemas import (
    ProgressHistoryResponse,
    ProgressSkillsResponse,
    ProgressSummaryResponse,
)
from app.services.progress import ProgressService

router = APIRouter(prefix="/progress", tags=["Progress"])


@router.get(
    "/summary",
    response_model=ProgressSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get 30-day progress summary and learning stats",
)
async def get_progress_summary(
    current_user: User = Depends(get_current_user),
    progress_service: ProgressService = Depends(get_progress_service),
) -> ProgressSummaryResponse:
    return await progress_service.get_progress_summary(current_user.id)


@router.get(
    "/skills",
    response_model=ProgressSkillsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get communication skill scores with previous comparison",
)
async def get_progress_skills(
    current_user: User = Depends(get_current_user),
    progress_service: ProgressService = Depends(get_progress_service),
) -> ProgressSkillsResponse:
    return await progress_service.get_progress_skills(current_user.id)


@router.get(
    "/history",
    response_model=ProgressHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get paginated session practice history (cursor-based)",
)
async def get_progress_history(
    type: str | None = Query(None, description="Filter by session type (COACH, ROLEPLAY, ROOM)"),
    limit: int = Query(15, ge=1, le=50, description="Items per page"),
    cursor: str | None = Query(None, description="Cursor for pagination"),
    current_user: User = Depends(get_current_user),
    progress_service: ProgressService = Depends(get_progress_service),
) -> ProgressHistoryResponse:
    return await progress_service.get_progress_history(
        user_id=current_user.id,
        type_=type,
        limit=limit,
        cursor=cursor,
    )
