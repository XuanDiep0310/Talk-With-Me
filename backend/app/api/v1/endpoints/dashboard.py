"""
Dashboard endpoint: /dashboard.
Unified overview for UI Screens 12 and 13.
"""

from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_user, get_progress_service
from app.models.auth import User
from app.models.gamification_schemas import DashboardResponse
from app.services.progress import ProgressService

router = APIRouter(tags=["Dashboard"])


@router.get(
    "/dashboard",
    response_model=DashboardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get user dashboard data",
)
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    progress_service: ProgressService = Depends(get_progress_service),
) -> DashboardResponse:
    return await progress_service.get_dashboard(current_user.id)
