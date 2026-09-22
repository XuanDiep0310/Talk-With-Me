from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.base import Base
from app.repositories.base import BaseRepository
from app.repositories.health import HealthRepository


def test_base_repository_init() -> None:
    mock_session = AsyncMock()
    repo = BaseRepository[Base](session=mock_session)
    assert repo.session == mock_session


@pytest.mark.asyncio
async def test_health_repository_database_unexpected_value() -> None:
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar.return_value = 0  # Unexpected value != 1
    mock_session.execute.return_value = mock_result

    repo = HealthRepository(db_session=mock_session, redis_client=AsyncMock())
    is_healthy, latency, details = await repo.check_database()
    assert is_healthy is False
    assert details == "Unexpected query result"
    assert latency >= 0


@pytest.mark.asyncio
async def test_health_repository_redis_ping_false() -> None:
    mock_redis = AsyncMock()
    mock_redis.ping = AsyncMock(return_value=False)

    repo = HealthRepository(db_session=AsyncMock(), redis_client=mock_redis)
    is_healthy, latency, details = await repo.check_redis()
    assert is_healthy is False
    assert details == "Redis ping failed"
    assert latency >= 0
