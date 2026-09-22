from app.core.config import Settings
from app.models.health import AppHealthResponse, ServiceHealthResponse
from app.repositories.health import HealthRepository


class HealthService:
    def __init__(self, repository: HealthRepository, settings: Settings):
        self.repository = repository
        self.settings = settings

    def get_app_health(self) -> AppHealthResponse:
        return AppHealthResponse(
            app_name=self.settings.APP_NAME,
            version=self.settings.APP_VERSION,
            environment=self.settings.ENVIRONMENT,
            status="healthy",
        )

    async def check_database_health(self) -> ServiceHealthResponse:
        is_healthy, latency, details = await self.repository.check_database()
        return ServiceHealthResponse(
            service="postgresql",
            status="healthy" if is_healthy else "unhealthy",
            latency_ms=latency,
            details=details,
        )

    async def check_redis_health(self) -> ServiceHealthResponse:
        is_healthy, latency, details = await self.repository.check_redis()
        return ServiceHealthResponse(
            service="redis",
            status="healthy" if is_healthy else "unhealthy",
            latency_ms=latency,
            details=details,
        )
