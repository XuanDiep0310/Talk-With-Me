"""
Gamification endpoints: /gamification/summary, /missions/today, /missions/{id}/claim,
/badges, /xp-history, /notifications.
UI Screen 25 and Header/Sidebar real-time indicators.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user, get_gamification_service
from app.models.auth import User
from app.models.gamification_schemas import (
    BadgesListResponse,
    ClaimMissionResponse,
    DailyMissionsTodayResponse,
    GamificationSummaryResponse,
    NotificationsListResponse,
    XpHistoryResponse,
)
from app.services.gamification import GamificationService

router = APIRouter(tags=["Gamification"])


@router.get(
    "/gamification/summary",
    response_model=GamificationSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get user gamification summary, XP, streak, and level conditions (D-02)",
)
async def get_gamification_summary(
    current_user: User = Depends(get_current_user),
    gamification_service: GamificationService = Depends(get_gamification_service),
) -> GamificationSummaryResponse:
    return await gamification_service.get_summary(current_user.id)


@router.get(
    "/missions/today",
    response_model=DailyMissionsTodayResponse,
    status_code=status.HTTP_200_OK,
    summary="Get today's 4 daily missions",
)
async def get_today_missions(
    current_user: User = Depends(get_current_user),
    gamification_service: GamificationService = Depends(get_gamification_service),
) -> DailyMissionsTodayResponse:
    return await gamification_service.get_today_missions(current_user.id)


@router.post(
    "/missions/{mission_id}/claim",
    response_model=ClaimMissionResponse,
    status_code=status.HTTP_200_OK,
    summary="Claim completed daily mission reward (+50 XP)",
)
@router.post(
    "/gamification/missions/{mission_id}/claim",
    response_model=ClaimMissionResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def claim_mission(
    mission_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    gamification_service: GamificationService = Depends(get_gamification_service),
) -> ClaimMissionResponse:
    try:
        return await gamification_service.claim_mission(current_user.id, mission_id)
    except ValueError as err:
        code = str(err)
        if code == "MISSION_NOT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "MISSION_NOT_FOUND",
                    "message": "Nhiệm vụ không tồn tại.",
                    "details": {},
                },
            ) from err
        if code == "MISSION_ALREADY_CLAIMED":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "MISSION_ALREADY_CLAIMED",
                    "message": "Nhiệm vụ này đã được nhận thưởng trước đó.",
                    "details": {},
                },
            ) from err
        if code == "MISSION_NOT_COMPLETED":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "MISSION_NOT_COMPLETED",
                    "message": "Nhiệm vụ chưa hoàn thành mục tiêu.",
                    "details": {},
                },
            ) from err
        raise


@router.get(
    "/badges",
    response_model=BadgesListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get all achievement badges and user progress",
)
async def get_badges(
    current_user: User = Depends(get_current_user),
    gamification_service: GamificationService = Depends(get_gamification_service),
) -> BadgesListResponse:
    return await gamification_service.get_badges_list(current_user.id)


@router.get(
    "/xp-history",
    response_model=XpHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get XP transactions ledger history",
)
async def get_xp_history(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    gamification_service: GamificationService = Depends(get_gamification_service),
) -> XpHistoryResponse:
    return await gamification_service.get_xp_history(current_user.id, limit=limit, offset=offset)


@router.get(
    "/notifications",
    response_model=NotificationsListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get user notifications",
)
async def get_notifications(
    limit: int = Query(50, ge=1, le=100),
    unread_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    gamification_service: GamificationService = Depends(get_gamification_service),
) -> NotificationsListResponse:
    return await gamification_service.get_notifications(
        current_user.id, limit=limit, unread_only=unread_only
    )


@router.patch(
    "/notifications/{notification_id}/read",
    status_code=status.HTTP_200_OK,
    summary="Mark a notification as read",
)
async def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    gamification_service: GamificationService = Depends(get_gamification_service),
) -> dict[str, Any]:
    success = await gamification_service.mark_notification_read(notification_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "NOTIFICATION_NOT_FOUND",
                "message": "Thông báo không tồn tại.",
                "details": {},
            },
        )
    return {"success": True, "id": str(notification_id), "read": True}


@router.patch(
    "/notifications/read-all",
    status_code=status.HTTP_200_OK,
    summary="Mark all notifications as read",
)
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    gamification_service: GamificationService = Depends(get_gamification_service),
) -> dict[str, Any]:
    count = await gamification_service.mark_all_notifications_read(current_user.id)
    return {"success": True, "updatedCount": count}
