from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import _BACKEND_DIR, get_settings
from app.core.database import engine
from app.core.errors import register_exception_handlers, register_trace_middleware
from app.core.redis import redis_pool

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    # Ensure upload directory exists
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    yield
    # Shutdown actions: Close DB engine and Redis connection pool
    await engine.dispose()
    await redis_pool.disconnect()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Talk-With-Me REST API service",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json" if settings.DEBUG else None,
    docs_url=f"{settings.API_V1_PREFIX}/docs" if settings.DEBUG else None,
    redoc_url=f"{settings.API_V1_PREFIX}/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# Register trace ID middleware & unified exception handlers
register_trace_middleware(app)
register_exception_handlers(app)

# CORS Middleware
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Static file serving for uploads (avatars, etc.)
upload_path = Path(settings.UPLOAD_DIR)
if not upload_path.is_absolute():
    upload_path = _BACKEND_DIR / upload_path
upload_path.mkdir(parents=True, exist_ok=True)
app.mount(
    f"{settings.API_V1_PREFIX}/static",
    StaticFiles(directory=str(upload_path)),
    name="static",
)

# Include API Router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "docs": f"{settings.API_V1_PREFIX}/docs",
    }
