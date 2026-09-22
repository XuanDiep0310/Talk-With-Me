from unittest.mock import AsyncMock, patch

import pytest
from fastapi import status

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.exceptions import AppException, ServiceUnavailableException
from app.core.redis import get_redis, get_redis_client
from app.main import app, lifespan, root


def test_settings_urls() -> None:
    s_no_pw = Settings(REDIS_PASSWORD="")
    assert (
        f"redis://{s_no_pw.REDIS_HOST}:{s_no_pw.REDIS_PORT}/{s_no_pw.REDIS_DB}" == s_no_pw.REDIS_URL
    )

    s_with_pw = Settings(REDIS_PASSWORD="secretpassword")
    assert (
        f"redis://:secretpassword@{s_with_pw.REDIS_HOST}:{s_with_pw.REDIS_PORT}/{s_with_pw.REDIS_DB}"
        == s_with_pw.REDIS_URL
    )

    assert "postgresql+asyncpg://" in s_no_pw.DATABASE_URL
    assert get_settings() is not None


def test_exceptions() -> None:
    app_exc = AppException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bad Request Error")
    assert app_exc.status_code == 400
    assert app_exc.detail == "Bad Request Error"

    service_exc = ServiceUnavailableException(detail="Database down")
    assert service_exc.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert service_exc.detail == "Database down"


@pytest.mark.asyncio
async def test_get_db_generator_success() -> None:
    mock_session = AsyncMock()
    with patch("app.core.database.async_session_factory") as mock_factory:
        mock_factory.return_value.__aenter__.return_value = mock_session
        gen = get_db()
        session = await anext(gen)
        assert session == mock_session
        with pytest.raises(StopAsyncIteration):
            await anext(gen)
        mock_session.commit.assert_awaited_once()
        mock_session.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_db_generator_rollback_on_error() -> None:
    mock_session = AsyncMock()
    mock_session.commit.side_effect = Exception("DB error")
    with patch("app.core.database.async_session_factory") as mock_factory:
        mock_factory.return_value.__aenter__.return_value = mock_session
        gen = get_db()
        session = await anext(gen)
        assert session == mock_session
        with pytest.raises(Exception, match="DB error"):
            await anext(gen)
        mock_session.rollback.assert_awaited_once()
        mock_session.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_redis_generator() -> None:
    mock_client = AsyncMock()
    with patch("app.core.redis.get_redis_client", return_value=mock_client):
        gen = get_redis()
        client = await anext(gen)
        assert client == mock_client
        with pytest.raises(StopAsyncIteration):
            await anext(gen)
        mock_client.aclose.assert_awaited_once()


def test_get_redis_client() -> None:
    client = get_redis_client()
    assert client is not None


@pytest.mark.asyncio
async def test_root_endpoint() -> None:
    res = await root()
    assert "message" in res
    assert "docs" in res


@pytest.mark.asyncio
async def test_lifespan_handler() -> None:
    mock_engine = AsyncMock()
    mock_pool = AsyncMock()
    with patch("app.main.engine", mock_engine), patch("app.main.redis_pool", mock_pool):
        async with lifespan(app):
            pass
        mock_engine.dispose.assert_awaited_once()
        mock_pool.disconnect.assert_awaited_once()
