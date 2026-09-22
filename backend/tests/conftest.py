import os
from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import Settings, get_settings
from app.main import app
from app.models.base import Base


def get_test_settings() -> Settings:
    return Settings(
        APP_NAME="Talk-With-Me Test API",
        APP_VERSION="0.1.0-test",
        ENVIRONMENT="test",
        DEBUG=True,
        POSTGRES_HOST=os.getenv("POSTGRES_HOST", "localhost"),
        POSTGRES_PORT=int(os.getenv("POSTGRES_PORT", "5432")),
        POSTGRES_USER=os.getenv("POSTGRES_USER", "postgres"),
        POSTGRES_PASSWORD=os.getenv("POSTGRES_PASSWORD", "postgres"),
        POSTGRES_DB=os.getenv("POSTGRES_DB", "talkwithme_test"),
        REDIS_HOST=os.getenv("REDIS_HOST", "localhost"),
        REDIS_PORT=int(os.getenv("REDIS_PORT", "6379")),
        REDIS_PASSWORD=os.getenv("REDIS_PASSWORD", ""),
        REDIS_DB=int(os.getenv("REDIS_DB", "1")),
    )


@pytest.fixture(scope="session")
def test_settings() -> Settings:
    return get_test_settings()


@pytest_asyncio.fixture
async def async_client(test_settings: Settings) -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides[get_settings] = lambda: test_settings
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def mock_db_session() -> AsyncMock:
    mock_session = AsyncMock(spec=AsyncSession)
    mock_result = MagicMock()
    mock_result.scalar.return_value = 1
    mock_session.execute.return_value = mock_result
    return mock_session


@pytest.fixture
def mock_redis_client() -> AsyncMock:
    mock_redis = AsyncMock()
    mock_redis.ping = AsyncMock(return_value=True)
    return mock_redis


# Integration test fixtures for real database/redis
@pytest_asyncio.fixture(scope="session")
async def test_db_engine(test_settings: Settings) -> AsyncGenerator[AsyncEngine, None]:
    engine = create_async_engine(
        test_settings.DATABASE_URL,
        future=True,
        echo=False,
    )
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        yield engine
    finally:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()


@pytest_asyncio.fixture
async def real_db_session(test_db_engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    session_factory = async_sessionmaker(
        bind=test_db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )
    async with session_factory() as session:
        yield session
        await session.rollback()
