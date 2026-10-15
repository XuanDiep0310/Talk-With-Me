"""Shared isolated API fixtures for integration tests."""

import base64
import json
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.api.deps import (
    get_db,
    get_email_sender,
    get_google_verifier,
    get_redis,
    get_storage_provider,
)
from app.core.config import Settings, get_settings
from app.main import app
from app.models.base import Base


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.ttls: dict[str, int] = {}

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def ttl(self, key: str) -> int:
        return self.ttls.get(key, 300)

    async def delete(self, key: str) -> None:
        self.store.pop(key, None)

    async def ping(self) -> bool:
        return True

    def pipeline(self) -> "FakePipeline":
        return FakePipeline(self)


class FakePipeline:
    def __init__(self, redis: FakeRedis) -> None:
        self.redis = redis

    def incr(self, key: str) -> "FakePipeline":
        current = int(self.redis.store.get(key, 0)) + 1
        self.redis.store[key] = str(current)
        return self

    def expire(self, key: str, seconds: int) -> "FakePipeline":
        self.redis.ttls[key] = seconds
        return self

    async def execute(self) -> list[object]:
        return []


class StrictFakeGoogleVerifier:
    """Never fall back to a real Google verifier in integration tests."""

    async def verify(self, id_token: str) -> dict[str, str]:
        if id_token == "invalid-google-token":
            raise ValueError("Invalid fake token")
        decoded = json.loads(base64.urlsafe_b64decode(id_token + "=" * (-len(id_token) % 4)))
        return {
            "sub": str(decoded["sub"]),
            "email": str(decoded["email"]),
            "name": str(decoded.get("name", "")),
            "picture": str(decoded.get("picture", "")),
        }


class FakeStorageProvider:
    def __init__(self) -> None:
        self.saved: list[tuple[str, bytes, str]] = []

    async def save_avatar(self, user_id: str, data: bytes, content_type: str) -> str:
        self.saved.append((user_id, data, content_type))
        return f"/test-avatars/{user_id}.png"


class CapturingEmailSender:
    def __init__(self) -> None:
        self.reset_tokens: list[str] = []
        self.sent_messages: list[tuple[str, str, str]] = []

    async def send_password_reset(self, email: str, token: str, reset_url: str) -> None:
        self.reset_tokens.append(token)
        self.sent_messages.append((email, token, reset_url))


@pytest_asyncio.fixture
async def auth_test_db() -> AsyncGenerator[async_sessionmaker[AsyncSession], None]:
    """Fresh in-memory database per test; no development or production DB access."""
    engine: AsyncEngine = create_async_engine(
        "sqlite+aiosqlite:///:memory:", future=True, echo=False
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )
    yield session_factory

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(
    auth_test_db: async_sessionmaker[AsyncSession],
    fake_storage: FakeStorageProvider,
    fake_email_sender: CapturingEmailSender,
) -> AsyncGenerator[AsyncClient, None]:
    fake_redis = FakeRedis()

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with auth_test_db() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    def override_get_redis() -> Redis:
        return fake_redis  # type: ignore[return-value]

    test_settings = Settings(
        JWT_SECRET_KEY="test-secret-long-enough-for-hs256-signature-12345",
        PASSWORD_MIN_LENGTH=6,
        ACCESS_TOKEN_EXPIRE_MINUTES=30,
        REFRESH_TOKEN_REMEMBER_DAYS=30,
        REFRESH_TOKEN_NO_REMEMBER_DAYS=1,
        GOOGLE_TOKEN_VERIFIER="fake",
        GOOGLE_CLIENT_ID="",
    )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = override_get_redis
    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_google_verifier] = lambda: StrictFakeGoogleVerifier()
    app.dependency_overrides[get_storage_provider] = lambda: fake_storage
    app.dependency_overrides[get_email_sender] = lambda: fake_email_sender

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://testserver") as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def fake_storage() -> FakeStorageProvider:
    return FakeStorageProvider()


@pytest.fixture
def fake_email_sender() -> CapturingEmailSender:
    return CapturingEmailSender()
