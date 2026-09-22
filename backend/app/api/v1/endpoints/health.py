from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from app.api.deps import get_health_service
from app.core.config import Settings, get_settings
from app.models.health import AppHealthResponse, ServiceHealthResponse
from app.services.health import HealthService

router = APIRouter(prefix="/health", tags=["Health"])


@router.get(
    "",
    response_model=AppHealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Application Health Check",
)
async def get_app_health(
    settings: Settings = Depends(get_settings),
) -> AppHealthResponse:
    return AppHealthResponse(
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        status="healthy",
    )


@router.get(
    "/database",
    response_model=ServiceHealthResponse,
    summary="Database Connection Health Check",
)
async def get_database_health(
    health_service: HealthService = Depends(get_health_service),
) -> JSONResponse:
    health = await health_service.check_database_health()
    status_code = (
        status.HTTP_200_OK if health.status == "healthy" else status.HTTP_503_SERVICE_UNAVAILABLE
    )
    return JSONResponse(status_code=status_code, content=health.model_dump(mode="json"))


@router.get(
    "/redis",
    response_model=ServiceHealthResponse,
    summary="Redis Cache Health Check",
)
async def get_redis_health(
    health_service: HealthService = Depends(get_health_service),
) -> JSONResponse:
    health = await health_service.check_redis_health()
    status_code = (
        status.HTTP_200_OK if health.status == "healthy" else status.HTTP_503_SERVICE_UNAVAILABLE
    )
    return JSONResponse(status_code=status_code, content=health.model_dump(mode="json"))
