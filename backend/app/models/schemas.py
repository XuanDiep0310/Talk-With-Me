"""
Pydantic v2 schemas for Auth, User, and Settings endpoints.

All public-facing schemas use camelCase (via alias_generator) per API convention (AGENTS.md §7).
Internal Python code uses snake_case.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pydantic.alias_generators import to_camel


class _CamelModel(BaseModel):
    """Base schema with camelCase aliases and populate-by-name support."""

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
    )


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------


class RegisterRequest(_CamelModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=120)
    password: str = Field(..., min_length=6)
    terms_accepted: bool

    @field_validator("email", mode="before")
    @classmethod
    def lowercase_email(cls, v: str) -> str:
        return v.lower().strip()


class LoginRequest(_CamelModel):
    email: EmailStr
    password: str
    remember_me: bool = False

    @field_validator("email", mode="before")
    @classmethod
    def lowercase_email(cls, v: str) -> str:
        return v.lower().strip()


class GoogleLoginRequest(_CamelModel):
    id_token: str


class ForgotPasswordRequest(_CamelModel):
    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def lowercase_email(cls, v: str) -> str:
        return v.lower().strip()


class ResetPasswordRequest(_CamelModel):
    token: str
    new_password: str = Field(..., min_length=6)


class RefreshRequest(_CamelModel):
    refresh_token: str


class LogoutRequest(_CamelModel):
    refresh_token: str


class TokenResponse(_CamelModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until access token expires


# ---------------------------------------------------------------------------
# User schemas
# ---------------------------------------------------------------------------


class UserResponse(_CamelModel):
    id: uuid.UUID
    email: str
    full_name: str
    avatar_url: str | None = None
    created_at: datetime


class MeResponse(_CamelModel):
    id: uuid.UUID
    email: str
    full_name: str
    avatar_url: str | None = None
    created_at: datetime


class UpdateMeRequest(_CamelModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    avatar_url: str | None = Field(default=None, max_length=500)


# ---------------------------------------------------------------------------
# Settings schemas
# ---------------------------------------------------------------------------


class SettingsResponse(_CamelModel):
    notifications_enabled: bool
    daily_reminder_enabled: bool
    ai_voice: str
    speech_speed: str
    theme: str
    timezone: str


class UpdateSettingsRequest(_CamelModel):
    notifications_enabled: bool | None = Field(default=None)
    daily_reminder_enabled: bool | None = Field(default=None)
    ai_voice: str | None = Field(default=None, pattern="^(female|male)$")
    speech_speed: str | None = Field(default=None, pattern="^(slow|normal|fast)$")
    theme: str | None = Field(default=None, pattern="^(light|dark|system)$")
    timezone: str | None = Field(default=None, max_length=60)


# ---------------------------------------------------------------------------
# Avatar
# ---------------------------------------------------------------------------


class AvatarUploadResponse(_CamelModel):
    avatar_url: str


class ChangePasswordRequest(_CamelModel):
    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)
