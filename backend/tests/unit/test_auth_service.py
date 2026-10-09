"""Unit tests for AuthService business logic with mocked dependencies."""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.core.config import Settings
from app.models.auth import RefreshToken
from app.services.auth import AuthService


class FakeClock:
    def __init__(self, current_time: datetime) -> None:
        self._time = current_time

    def now(self) -> datetime:
        return self._time

    def advance(self, **kwargs: object) -> None:
        self._time += timedelta(**kwargs)  # type: ignore[arg-type]


@pytest.fixture
def auth_settings() -> Settings:
    return Settings(
        JWT_SECRET_KEY="test-secret-at-least-32-characters-long",
        PASSWORD_MIN_LENGTH=6,
        ACCESS_TOKEN_EXPIRE_MINUTES=30,
        REFRESH_TOKEN_REMEMBER_DAYS=30,
        REFRESH_TOKEN_NO_REMEMBER_DAYS=1,
    )


async def test_register_without_terms_rejected(auth_settings: Settings) -> None:
    service = AuthService(
        session=AsyncMock(),
        redis=AsyncMock(),
        settings=auth_settings,
        email_sender=AsyncMock(),
        google_verifier=AsyncMock(),
    )

    with pytest.raises(HTTPException) as exc:
        await service.register(
            email="test@example.com",
            full_name="Test User",
            password="securepassword123",
            terms_accepted=False,
        )

    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "TERMS_NOT_ACCEPTED"


async def test_register_password_too_short_rejected(auth_settings: Settings) -> None:
    service = AuthService(
        session=AsyncMock(),
        redis=AsyncMock(),
        settings=auth_settings,
        email_sender=AsyncMock(),
        google_verifier=AsyncMock(),
    )

    with (
        patch.object(service._user_repo, "get_by_email", return_value=None),
        pytest.raises(HTTPException) as exc,
    ):
        await service.register(
            email="test@example.com",
            full_name="Test User",
            password="123",  # < 6 chars
            terms_accepted=True,
        )

    assert exc.value.status_code == 422
    assert exc.value.detail["code"] == "VALIDATION_ERROR"


async def test_refresh_token_not_found(auth_settings: Settings) -> None:
    service = AuthService(
        session=AsyncMock(),
        redis=AsyncMock(),
        settings=auth_settings,
        email_sender=AsyncMock(),
        google_verifier=AsyncMock(),
    )

    with (
        patch.object(service._auth_repo, "get_refresh_token_by_hash", return_value=None),
        pytest.raises(HTTPException) as exc,
    ):
        await service.refresh_tokens("non-existent-token")

    assert exc.value.status_code == 401
    assert exc.value.detail["code"] == "INVALID_TOKEN"


async def test_refresh_reuse_detection_revokes_chain(auth_settings: Settings) -> None:
    clock = FakeClock(datetime(2026, 1, 1, tzinfo=UTC))
    user_id = uuid.uuid4()
    revoked_token = RefreshToken(
        id=uuid.uuid4(),
        user_id=user_id,
        token_hash="already-revoked-hash",
        expires_at=datetime(2026, 2, 1, tzinfo=UTC),
        revoked=True,
        replaced_by_hash="replacement-hash",
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )

    service = AuthService(
        session=AsyncMock(),
        redis=AsyncMock(),
        settings=auth_settings,
        email_sender=AsyncMock(),
        google_verifier=AsyncMock(),
        clock=clock,
    )

    with (
        patch.object(service._auth_repo, "get_refresh_token_by_hash", return_value=revoked_token),
        patch.object(
            service._auth_repo, "revoke_all_user_tokens", new_callable=AsyncMock
        ) as mock_revoke_all,
        pytest.raises(HTTPException) as exc,
    ):
        await service.refresh_tokens("stolen-token")

    assert exc.value.status_code == 401
    assert exc.value.detail["code"] == "TOKEN_REUSE_DETECTED"
    mock_revoke_all.assert_called_once_with(user_id)


async def test_forgot_password_unknown_email_returns_quietly(auth_settings: Settings) -> None:
    email_sender = AsyncMock()
    service = AuthService(
        session=AsyncMock(),
        redis=AsyncMock(),
        settings=auth_settings,
        email_sender=email_sender,
        google_verifier=AsyncMock(),
    )

    with patch.object(service._user_repo, "get_by_email", return_value=None):
        # Must return None and never send email
        await service.forgot_password("unknown@example.com")
        email_sender.send_password_reset.assert_not_called()


async def test_forgot_password_known_email_generates_custom_frontend_url(
    auth_settings: Settings,
) -> None:
    auth_settings.FRONTEND_URL = "https://talkwithmee.vercel.app"
    email_sender = AsyncMock()
    service = AuthService(
        session=AsyncMock(),
        redis=AsyncMock(),
        settings=auth_settings,
        email_sender=email_sender,
        google_verifier=AsyncMock(),
    )

    mock_user = MagicMock()
    mock_user.id = uuid.uuid4()
    mock_user.email = "user@example.com"

    with (
        patch.object(service._user_repo, "get_by_email", return_value=mock_user),
        patch.object(service._auth_repo, "create_password_reset_token", new_callable=AsyncMock),
    ):
        await service.forgot_password("user@example.com")
        email_sender.send_password_reset.assert_called_once()
        call_kwargs = email_sender.send_password_reset.call_args.kwargs
        assert call_kwargs["reset_url"].startswith(
            "https://talkwithmee.vercel.app/reset-password?token="
        )
