from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.api.deps import get_health_repository
from app.main import app
from app.repositories.health import HealthRepository


@pytest.mark.asyncio
async def test_get_app_health_endpoint_unit(async_client: AsyncClient) -> None:
    response = await async_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "app_name" in data


@pytest.mark.asyncio
async def test_get_database_health_endpoint_healthy(
    async_client: AsyncClient, mock_db_session: AsyncMock, mock_redis_client: AsyncMock
) -> None:
    mock_repo = HealthRepository(db_session=mock_db_session, redis_client=mock_redis_client)
    app.dependency_overrides[get_health_repository] = lambda: mock_repo

    response = await async_client.get("/api/v1/health/database")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "postgresql"

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_database_health_endpoint_unhealthy(async_client: AsyncClient) -> None:
    failing_db = AsyncMock()
    failing_db.execute.side_effect = Exception("DB Connection Lost")
    mock_repo = HealthRepository(db_session=failing_db, redis_client=AsyncMock())
    app.dependency_overrides[get_health_repository] = lambda: mock_repo

    response = await async_client.get("/api/v1/health/database")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unhealthy"
    assert data["service"] == "postgresql"
    assert "DB Connection Lost" in data["details"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_redis_health_endpoint_healthy(
    async_client: AsyncClient, mock_db_session: AsyncMock, mock_redis_client: AsyncMock
) -> None:
    mock_repo = HealthRepository(db_session=mock_db_session, redis_client=mock_redis_client)
    app.dependency_overrides[get_health_repository] = lambda: mock_repo

    response = await async_client.get("/api/v1/health/redis")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "redis"

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_redis_health_endpoint_unhealthy(async_client: AsyncClient) -> None:
    failing_redis = AsyncMock()
    failing_redis.ping.side_effect = Exception("Redis connection refused")
    mock_repo = HealthRepository(db_session=AsyncMock(), redis_client=failing_redis)
    app.dependency_overrides[get_health_repository] = lambda: mock_repo

    response = await async_client.get("/api/v1/health/redis")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unhealthy"
    assert data["service"] == "redis"
    assert "Redis connection refused" in data["details"]

    app.dependency_overrides.clear()
