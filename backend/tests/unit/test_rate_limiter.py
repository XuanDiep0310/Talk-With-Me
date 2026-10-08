"""Unit tests for login rate limiter logic."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.core.config import Settings
from app.services.auth import AuthService


@pytest.fixture
def test_settings() -> Settings:
    return Settings(
        LOGIN_MAX_ATTEMPTS=3,
        LOGIN_LOCKOUT_MINUTES=5,
    )


async def test_rate_limit_passes_under_threshold(test_settings: Settings) -> None:
    mock_redis = AsyncMock()
    mock_redis.get.return_value = "2"  # 2 attempts so far, max is 3

    service = AuthService(
        session=AsyncMock(),
        redis=mock_redis,
        settings=test_settings,
        email_sender=AsyncMock(),
        google_verifier=AsyncMock(),
    )

    # Should not raise
    await service._check_rate_limit("user@example.com", "127.0.0.1")
    mock_redis.get.assert_called_once_with("rate_limit:login:user@example.com:127.0.0.1")


async def test_rate_limit_blocks_at_or_above_threshold(test_settings: Settings) -> None:
    mock_redis = AsyncMock()
    mock_redis.get.return_value = "3"  # Reached max attempts
    mock_redis.ttl.return_value = 240

    service = AuthService(
        session=AsyncMock(),
        redis=mock_redis,
        settings=test_settings,
        email_sender=AsyncMock(),
        google_verifier=AsyncMock(),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service._check_rate_limit("user@example.com", "127.0.0.1")

    assert exc_info.value.status_code == 429
    detail = exc_info.value.detail
    assert detail["code"] == "TOO_MANY_REQUESTS"
    assert detail["details"]["retryAfter"] == 240


async def test_increment_sets_expiry_pipeline(test_settings: Settings) -> None:
    mock_redis = AsyncMock()
    mock_pipe = AsyncMock()
    mock_redis.pipeline = MagicMock(return_value=mock_pipe)

    service = AuthService(
        session=AsyncMock(),
        redis=mock_redis,
        settings=test_settings,
        email_sender=AsyncMock(),
        google_verifier=AsyncMock(),
    )

    await service._increment_rate_limit("user@example.com", "127.0.0.1")
    mock_pipe.incr.assert_called_once_with("rate_limit:login:user@example.com:127.0.0.1")
    mock_pipe.expire.assert_called_once_with(
        "rate_limit:login:user@example.com:127.0.0.1", 5 * 60
    )
    mock_pipe.execute.assert_called_once()
