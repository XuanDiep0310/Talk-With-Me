from unittest.mock import AsyncMock

import pytest

from app.core.config import Settings
from app.repositories.health import HealthRepository
from app.services.health import HealthService


@pytest.mark.asyncio
async def test_get_app_health(test_settings: Settings) -> None:
    repo = HealthRepository(db_session=AsyncMock(), redis_client=AsyncMock())
    service = HealthService(repository=repo, settings=test_settings)

    health = service.get_app_health()
    assert health.app_name == test_settings.APP_NAME
    assert health.version == test_settings.APP_VERSION
    assert health.status == "healthy"
    assert health.environment == test_settings.ENVIRONMENT


@pytest.mark.asyncio
async def test_check_database_health_success(
    test_settings: Settings, mock_db_session: AsyncMock
) -> None:
    repo = HealthRepository(db_session=mock_db_session, redis_client=AsyncMock())
    service = HealthService(repository=repo, settings=test_settings)

    health = await service.check_database_health()
    assert health.service == "postgresql"
    assert health.status == "healthy"
    assert health.latency_ms is not None
    assert health.details == "Database connection active"


@pytest.mark.asyncio
async def test_check_database_health_failure(test_settings: Settings) -> None:
    failing_db = AsyncMock()
    failing_db.execute.side_effect = Exception("Connection refused")
    repo = HealthRepository(db_session=failing_db, redis_client=AsyncMock())
    service = HealthService(repository=repo, settings=test_settings)

    health = await service.check_database_health()
    assert health.service == "postgresql"
    assert health.status == "unhealthy"
    assert "Connection refused" in (health.details or "")


@pytest.mark.asyncio
async def test_check_redis_health_success(
    test_settings: Settings, mock_redis_client: AsyncMock
) -> None:
    repo = HealthRepository(db_session=AsyncMock(), redis_client=mock_redis_client)
    service = HealthService(repository=repo, settings=test_settings)

    health = await service.check_redis_health()
    assert health.service == "redis"
    assert health.status == "healthy"
    assert health.latency_ms is not None
    assert health.details == "Redis connection active"


@pytest.mark.asyncio
async def test_check_redis_health_failure(test_settings: Settings) -> None:
    failing_redis = AsyncMock()
    failing_redis.ping.side_effect = Exception("Redis unavailable")
    repo = HealthRepository(db_session=AsyncMock(), redis_client=failing_redis)
    service = HealthService(repository=repo, settings=test_settings)

    health = await service.check_redis_health()
    assert health.service == "redis"
    assert health.status == "unhealthy"
    assert "Redis unavailable" in (health.details or "")
