"""
User profile and settings endpoints: /me, /me/avatar, /me/settings, /me/change-password.
All routes require authentication via get_current_user.
"""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api.deps import get_current_user, get_user_service
from app.models.auth import User
from app.models.schemas import (
    AvatarUploadResponse,
    ChangePasswordRequest,
    MeResponse,
    SettingsResponse,
    UpdateMeRequest,
    UpdateSettingsRequest,
)
from app.services.user import UserService

router = APIRouter(prefix="/me", tags=["Users"])


@router.get(
    "",
    response_model=MeResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current user profile",
)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> MeResponse:
    return MeResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        avatar_url=current_user.avatar_url,
        created_at=current_user.created_at,
    )


@router.patch(
    "",
    response_model=MeResponse,
    status_code=status.HTTP_200_OK,
    summary="Update current user profile",
)
async def update_me(
    body: UpdateMeRequest,
    current_user: User = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
) -> MeResponse:
    updated = await user_service.update_me(
        user_id=current_user.id,
        full_name=body.full_name,
        avatar_url=body.avatar_url,
    )
    return MeResponse(
        id=updated.id,
        email=updated.email,
        full_name=updated.full_name,
        avatar_url=updated.avatar_url,
        created_at=updated.created_at,
    )


@router.post(
    "/avatar",
    response_model=AvatarUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload user avatar image (JPEG, PNG, WebP, max 2MB)",
)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
) -> AvatarUploadResponse:
    content_type = file.content_type or "application/octet-stream"
    data = await file.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "EMPTY_FILE",
                "message": "Uploaded file is empty.",
                "details": {},
            },
        )
    url = await user_service.upload_avatar(
        user_id=current_user.id,
        data=data,
        content_type=content_type,
    )
    return AvatarUploadResponse(avatar_url=url)


@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
    summary="Change user password",
)
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
) -> dict[str, str]:
    await user_service.change_password(
        user_id=current_user.id,
        old_password=body.old_password,
        new_password=body.new_password,
    )
    return {"message": "Mật khẩu đã được thay đổi thành công."}


@router.get(
    "/settings",
    response_model=SettingsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current user settings",
)
async def get_settings(
    current_user: User = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
) -> SettingsResponse:
    settings = await user_service.get_settings(current_user.id)
    return SettingsResponse(
        notifications_enabled=settings.notifications_enabled,
        daily_reminder_enabled=settings.daily_reminder_enabled,
        ai_voice=settings.ai_voice,
        speech_speed=settings.speech_speed,
        theme=settings.theme,
        timezone="Asia/Ho_Chi_Minh",
    )


@router.patch(
    "/settings",
    response_model=SettingsResponse,
    status_code=status.HTTP_200_OK,
    summary="Update current user settings",
)
async def update_settings(
    body: UpdateSettingsRequest,
    current_user: User = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
) -> SettingsResponse:
    patch = body.model_dump(exclude_unset=True)
    updated = await user_service.update_settings(
        user_id=current_user.id,
        patch=patch,
    )
    return SettingsResponse(
        notifications_enabled=updated.notifications_enabled,
        daily_reminder_enabled=updated.daily_reminder_enabled,
        ai_voice=updated.ai_voice,
        speech_speed=updated.speech_speed,
        theme=updated.theme,
        timezone="Asia/Ho_Chi_Minh",
    )
