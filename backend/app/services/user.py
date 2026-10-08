"""
User service: managing user profile, avatar upload, user settings, and password change.
"""

import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.providers.storage_provider import StorageProvider
from app.core.security import hash_password, validate_password_strength, verify_password
from app.models.auth import User, UserSettings
from app.repositories.auth import AuthRepository
from app.repositories.user import UserRepository


class UserService:
    def __init__(
        self,
        session: AsyncSession,
        settings: Settings,
        storage_provider: StorageProvider,
    ) -> None:
        self._user_repo = UserRepository(session)
        self._auth_repo = AuthRepository(session)
        self._settings = settings
        self._storage = storage_provider

    async def get_me(self, user_id: uuid.UUID) -> User:
        user = await self._user_repo.get_by_id(user_id)
        if user is None:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "USER_NOT_FOUND",
                    "message": "User not found.",
                    "details": {},
                },
            )
        return user

    async def update_me(
        self,
        user_id: uuid.UUID,
        full_name: str | None = None,
        avatar_url: str | None = None,
    ) -> User:
        patch: dict[str, object] = {}
        if full_name is not None:
            patch["full_name"] = full_name.strip()
        if avatar_url is not None:
            patch["avatar_url"] = avatar_url

        if not patch:
            return await self.get_me(user_id)

        user = await self._user_repo.update(user_id, **patch)
        if user is None:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "USER_NOT_FOUND",
                    "message": "User not found.",
                    "details": {},
                },
            )
        return user

    async def upload_avatar(
        self,
        user_id: uuid.UUID,
        data: bytes,
        content_type: str,
    ) -> str:
        if content_type not in self._settings.AVATAR_ALLOWED_TYPES:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_IMAGE_TYPE",
                    "message": f"Allowed image types: {', '.join(self._settings.AVATAR_ALLOWED_TYPES)}",
                    "details": {},
                },
            )

        if len(data) > self._settings.AVATAR_MAX_BYTES:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "FILE_TOO_LARGE",
                    "message": f"Avatar image must not exceed {self._settings.AVATAR_MAX_BYTES // (1024 * 1024)} MB.",
                    "details": {},
                },
            )

        url = await self._storage.save_avatar(str(user_id), data, content_type)
        await self._user_repo.update(user_id, avatar_url=url)
        return url

    async def change_password(
        self,
        user_id: uuid.UUID,
        old_password: str,
        new_password: str,
    ) -> None:
        user = await self.get_me(user_id)
        if user.password_hash is not None and not verify_password(old_password, user.password_hash):
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_OLD_PASSWORD",
                    "message": "Mật khẩu hiện tại không chính xác.",
                    "details": {},
                },
            )

        if user.password_hash is not None and old_password == new_password:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "PASSWORD_SAME_AS_OLD",
                    "message": "Mật khẩu mới không được trùng với mật khẩu hiện tại.",
                    "details": {},
                },
            )

        if len(new_password) < self._settings.PASSWORD_MIN_LENGTH:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "VALIDATION_ERROR",
                    "message": f"Mật khẩu mới phải có ít nhất {self._settings.PASSWORD_MIN_LENGTH} ký tự.",
                    "details": {},
                },
            )

        is_valid, error_msg = validate_password_strength(
            new_password, self._settings.PASSWORD_MIN_LENGTH
        )
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "PASSWORD_TOO_WEAK",
                    "message": error_msg or "Mật khẩu không đạt yêu cầu bảo mật.",
                    "details": {},
                },
            )

        new_hash = hash_password(new_password)
        await self._user_repo.update(user_id, password_hash=new_hash)
        await self._auth_repo.revoke_all_user_tokens(user_id)

    async def get_settings(self, user_id: uuid.UUID) -> UserSettings:
        settings = await self._user_repo.get_settings(user_id)
        if settings is None:
            # Fallback if somehow not created on registration
            new_settings = UserSettings(user_id=user_id)
            self._user_repo.session.add(new_settings)
            await self._user_repo.session.flush()
            return new_settings
        return settings

    async def update_settings(
        self,
        user_id: uuid.UUID,
        patch: dict[str, object],
    ) -> UserSettings:
        clean_patch = {k: v for k, v in patch.items() if v is not None}
        if not clean_patch:
            return await self.get_settings(user_id)

        updated = await self._user_repo.update_settings(user_id, **clean_patch)
        if updated is None:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "USER_NOT_FOUND",
                    "message": "User settings not found.",
                    "details": {},
                },
            )
        return updated
