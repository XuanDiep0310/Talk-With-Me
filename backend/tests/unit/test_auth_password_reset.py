import secrets
import uuid
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.core.clock import SystemClock
from app.core.config import Settings
from app.core.security import (
    hash_refresh_token,
    validate_password_strength,
    verify_password,
)
from app.models.auth import PasswordResetToken
from app.models.schemas import ForgotPasswordRequest, ResetPasswordRequest
from app.services.auth import AuthService


def test_fp_schema_valid() -> None:
    req = ForgotPasswordRequest(email="User.Test@Example.COM  ")
    assert req.email == "user.test@example.com"


def test_fp_schema_invalid() -> None:
    invalid_cases = [
        "not-an-email",
        "user@",
        "@domain.com",
        "user@.com",
        "user name@example.com",
    ]
    for c in invalid_cases:
        with pytest.raises(ValidationError):
            ForgotPasswordRequest(email=c)


def test_fp_schema_empty() -> None:
    with pytest.raises(ValidationError):
        ForgotPasswordRequest(email="")


def test_rp_schema_valid() -> None:
    req = ResetPasswordRequest(token="test_token_123", newPassword="ValidPassword123!")
    assert req.token == "test_token_123"
    assert req.new_password == "ValidPassword123!"


def test_rp_schema_short_password() -> None:
    with pytest.raises(ValidationError) as exc_info:
        ResetPasswordRequest(token="test_token", newPassword="12345")
    err_str = str(exc_info.value)
    assert "at least 6 characters" in err_str or "string_too_short" in err_str


def test_password_strength_reset() -> None:
    for pw in ["123456", "password", "111111", "000000", "admin123"]:
        valid, _ = validate_password_strength(pw, min_length=6)
        assert not valid, f"Weak password {pw} was accepted"
    valid, _ = validate_password_strength("StrongPass#2026", min_length=6)
    assert valid


def test_reset_token_security() -> None:
    raw1 = secrets.token_urlsafe(32)
    raw2 = secrets.token_urlsafe(32)
    assert raw1 != raw2
    assert len(raw1) >= 42

    h1 = hash_refresh_token(raw1)
    h2 = hash_refresh_token(raw1)
    assert h1 == h2
    assert len(h1) == 64


@pytest.mark.asyncio
async def test_forgot_password_service_known_user() -> None:
    settings = Settings(FRONTEND_URL="http://localhost:4200")
    clock = SystemClock()
    session = AsyncMock()
    redis = AsyncMock()
    email_sender = AsyncMock()
    google_verifier = AsyncMock()

    service = AuthService(session, redis, settings, email_sender, google_verifier, clock)

    user_id = uuid.uuid4()
    mock_user = MagicMock()
    mock_user.id = user_id
    mock_user.email = "registered@example.com"

    service._user_repo.get_by_email = AsyncMock(return_value=mock_user)
    service._auth_repo.create_password_reset_token = AsyncMock()

    await service.forgot_password("registered@example.com", origin="http://localhost:4200")

    service._auth_repo.create_password_reset_token.assert_called_once()
    token_kwargs = service._auth_repo.create_password_reset_token.call_args.kwargs
    assert token_kwargs["user_id"] == user_id
    assert token_kwargs["expires_at"] > clock.now()
    duration = token_kwargs["expires_at"] - clock.now()
    assert abs(duration.total_seconds() - 3600) < 5

    email_sender.send_password_reset.assert_called_once()
    email_kwargs = email_sender.send_password_reset.call_args.kwargs
    assert email_kwargs["email"] == "registered@example.com"
    assert email_kwargs["reset_url"].startswith("http://localhost:4200/reset-password?token=")


@pytest.mark.asyncio
async def test_forgot_password_service_unknown_user() -> None:
    settings = Settings(FRONTEND_URL="http://localhost:4200")
    clock = SystemClock()
    session = AsyncMock()
    redis = AsyncMock()
    email_sender = AsyncMock()
    google_verifier = AsyncMock()

    service = AuthService(session, redis, settings, email_sender, google_verifier, clock)

    service._user_repo.get_by_email = AsyncMock(return_value=None)
    service._auth_repo.create_password_reset_token = AsyncMock()

    # Must return cleanly without sending email or creating reset token (OWASP anti user-enumeration)
    await service.forgot_password("unknown@example.com")

    service._auth_repo.create_password_reset_token.assert_not_called()
    email_sender.send_password_reset.assert_not_called()


@pytest.mark.asyncio
async def test_reset_password_service_invalid_token() -> None:
    settings = Settings(PASSWORD_MIN_LENGTH=6)
    clock = SystemClock()
    session = AsyncMock()
    redis = AsyncMock()
    email_sender = AsyncMock()
    google_verifier = AsyncMock()

    service = AuthService(session, redis, settings, email_sender, google_verifier, clock)
    service._auth_repo.get_password_reset_token = AsyncMock(return_value=None)

    with pytest.raises(HTTPException) as exc_info:
        await service.reset_password("unknown_token", "NewPassword123!")
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "INVALID_TOKEN"


@pytest.mark.asyncio
async def test_reset_password_service_used_token() -> None:
    settings = Settings(PASSWORD_MIN_LENGTH=6)
    fixed_now = datetime(2026, 11, 23, 12, 0, 0)
    mock_clock = MagicMock()
    mock_clock.now.return_value = fixed_now

    session = AsyncMock()
    redis = AsyncMock()
    email_sender = AsyncMock()
    google_verifier = AsyncMock()

    service = AuthService(session, redis, settings, email_sender, google_verifier, mock_clock)

    user_id = uuid.uuid4()
    token_str = "valid_token_sample"
    token_h = hash_refresh_token(token_str)

    used_token = PasswordResetToken(
        id=uuid.uuid4(),
        user_id=user_id,
        token_hash=token_h,
        expires_at=fixed_now + timedelta(minutes=30),
        used=True,
        created_at=fixed_now - timedelta(minutes=10),
    )
    service._auth_repo.get_password_reset_token = AsyncMock(return_value=used_token)

    with pytest.raises(HTTPException) as exc_info:
        await service.reset_password(token_str, "NewPassword123!")
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "TOKEN_ALREADY_USED"


@pytest.mark.asyncio
async def test_reset_password_service_expired_token() -> None:
    settings = Settings(PASSWORD_MIN_LENGTH=6)
    fixed_now = datetime(2026, 11, 23, 12, 0, 0)
    mock_clock = MagicMock()
    mock_clock.now.return_value = fixed_now

    session = AsyncMock()
    redis = AsyncMock()
    email_sender = AsyncMock()
    google_verifier = AsyncMock()

    service = AuthService(session, redis, settings, email_sender, google_verifier, mock_clock)

    user_id = uuid.uuid4()
    token_str = "valid_token_sample"
    token_h = hash_refresh_token(token_str)

    expired_token = PasswordResetToken(
        id=uuid.uuid4(),
        user_id=user_id,
        token_hash=token_h,
        expires_at=fixed_now - timedelta(seconds=1),
        used=False,
        created_at=fixed_now - timedelta(hours=2),
    )
    service._auth_repo.get_password_reset_token = AsyncMock(return_value=expired_token)

    with pytest.raises(HTTPException) as exc_info:
        await service.reset_password(token_str, "NewPassword123!")
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "TOKEN_EXPIRED"


@pytest.mark.asyncio
async def test_reset_password_service_weak_password() -> None:
    settings = Settings(PASSWORD_MIN_LENGTH=6)
    fixed_now = datetime(2026, 11, 23, 12, 0, 0)
    mock_clock = MagicMock()
    mock_clock.now.return_value = fixed_now

    session = AsyncMock()
    redis = AsyncMock()
    email_sender = AsyncMock()
    google_verifier = AsyncMock()

    service = AuthService(session, redis, settings, email_sender, google_verifier, mock_clock)

    user_id = uuid.uuid4()
    token_str = "valid_token_sample"
    token_h = hash_refresh_token(token_str)

    valid_token = PasswordResetToken(
        id=uuid.uuid4(),
        user_id=user_id,
        token_hash=token_h,
        expires_at=fixed_now + timedelta(minutes=30),
        used=False,
        created_at=fixed_now,
    )
    service._auth_repo.get_password_reset_token = AsyncMock(return_value=valid_token)

    with pytest.raises(HTTPException) as exc_info:
        await service.reset_password(token_str, "123456")
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "PASSWORD_TOO_WEAK"


@pytest.mark.asyncio
async def test_reset_password_service_success() -> None:
    settings = Settings(PASSWORD_MIN_LENGTH=6)
    fixed_now = datetime(2026, 11, 23, 12, 0, 0)
    mock_clock = MagicMock()
    mock_clock.now.return_value = fixed_now

    session = AsyncMock()
    redis = AsyncMock()
    email_sender = AsyncMock()
    google_verifier = AsyncMock()

    service = AuthService(session, redis, settings, email_sender, google_verifier, mock_clock)

    user_id = uuid.uuid4()
    token_str = "valid_token_sample"
    token_h = hash_refresh_token(token_str)

    valid_token = PasswordResetToken(
        id=uuid.uuid4(),
        user_id=user_id,
        token_hash=token_h,
        expires_at=fixed_now + timedelta(minutes=30),
        used=False,
        created_at=fixed_now,
    )

    service._auth_repo.get_password_reset_token = AsyncMock(return_value=valid_token)
    service._user_repo.update = AsyncMock()
    service._auth_repo.mark_reset_token_used = AsyncMock()
    service._auth_repo.revoke_all_user_tokens = AsyncMock()

    await service.reset_password(token_str, "NewSecurePassword123!")

    service._user_repo.update.assert_called_once()
    update_kwargs = service._user_repo.update.call_args
    updated_hash = update_kwargs.kwargs["password_hash"]
    assert verify_password("NewSecurePassword123!", updated_hash)

    service._auth_repo.mark_reset_token_used.assert_called_once_with(token_h)
    service._auth_repo.revoke_all_user_tokens.assert_called_once_with(user_id)
