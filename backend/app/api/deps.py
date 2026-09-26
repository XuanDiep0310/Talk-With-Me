from fastapi import Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.redis import get_redis
from app.repositories.health import HealthRepository
from app.services.health import HealthService
from app.services.tts import TTSService


def get_health_repository(
    db_session: AsyncSession = Depends(get_db),
    redis_client: Redis = Depends(get_redis),
) -> HealthRepository:
    return HealthRepository(db_session=db_session, redis_client=redis_client)


def get_health_service(
    repository: HealthRepository = Depends(get_health_repository),
    settings: Settings = Depends(get_settings),
) -> HealthService:
    return HealthService(repository=repository, settings=settings)


def get_tts_service() -> TTSService:
    return TTSService()
