from unittest.mock import AsyncMock, MagicMock

from app.api.deps import get_health_repository, get_health_service
from app.core.config import Settings
from app.repositories.health import HealthRepository
from app.services.health import HealthService


def test_get_health_repository() -> None:
    mock_db = AsyncMock()
    mock_redis = AsyncMock()
    repo = get_health_repository(db_session=mock_db, redis_client=mock_redis)
    assert isinstance(repo, HealthRepository)
    assert repo.db == mock_db
    assert repo.redis == mock_redis


def test_get_health_service() -> None:
    mock_repo = MagicMock(spec=HealthRepository)
    settings = Settings()
    service = get_health_service(repository=mock_repo, settings=settings)
    assert isinstance(service, HealthService)
    assert service.repository == mock_repo
    assert service.settings == settings
