import os
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.api.deps import get_health_repository
from app.main import app
from app.repositories.health import HealthRepository


@pytest.mark.asyncio
async def test_get_app_health_endpoint(async_client: AsyncClient) -> None:
    response = await async_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "environment" in data


@pytest.mark.asyncio
async def test_database_health_endpoint_mocked(
    async_client: AsyncClient, mock_db_session: AsyncMock, mock_redis_client: AsyncMock
) -> None:
    # Test with mocked repository
    mock_repo = HealthRepository(db_session=mock_db_session, redis_client=mock_redis_client)
    app.dependency_overrides[get_health_repository] = lambda: mock_repo

    response = await async_client.get("/api/v1/health/database")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "postgresql"
    assert data["status"] == "healthy"

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_redis_health_endpoint_mocked(
    async_client: AsyncClient, mock_db_session: AsyncMock, mock_redis_client: AsyncMock
) -> None:
    mock_repo = HealthRepository(db_session=mock_db_session, redis_client=mock_redis_client)
    app.dependency_overrides[get_health_repository] = lambda: mock_repo

    response = await async_client.get("/api/v1/health/redis")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "redis"
    assert data["status"] == "healthy"

    app.dependency_overrides.clear()


# Real service integration tests (only run if real services are configured/running)
@pytest.mark.integration
@pytest.mark.asyncio
async def test_real_database_and_redis_integration(async_client: AsyncClient) -> None:
    # Check if we have env flag for running against real infrastructure
    if os.getenv("RUN_INTEGRATION_TESTS") != "true":
        pytest.skip("Skipping real infrastructure integration test (RUN_INTEGRATION_TESTS != true)")

    response_db = await async_client.get("/api/v1/health/database")
    assert response_db.status_code == 200
    assert response_db.json()["status"] == "healthy"

    response_redis = await async_client.get("/api/v1/health/redis")
    assert response_redis.status_code == 200
    assert response_redis.json()["status"] == "healthy"
