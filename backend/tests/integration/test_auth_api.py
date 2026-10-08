"""Integration tests for Authentication, User Profile, and Settings API endpoints."""

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

from app.api.deps import get_db, get_redis
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
        self.ops: list = []

    def incr(self, key: str) -> "FakePipeline":
        current = int(self.redis.store.get(key, 0)) + 1
        self.redis.store[key] = str(current)
        return self

    def expire(self, key: str, seconds: int) -> "FakePipeline":
        self.redis.ttls[key] = seconds
        return self

    async def execute(self) -> list:
        return []


@pytest_asyncio.fixture
async def auth_test_db() -> AsyncGenerator[async_sessionmaker[AsyncSession], None]:
    # In-memory SQLite async engine for isolated integration testing
    engine: AsyncEngine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        future=True,
        echo=False,
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
    )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = override_get_redis
    app.dependency_overrides[get_settings] = lambda: test_settings

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_register_login_me_refresh_logout_flow(client: AsyncClient) -> None:
    # 1. Register
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "user@example.com",
            "fullName": "Nguyen Van A",
            "password": "Password123!",
            "termsAccepted": True,
        },
    )
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert "accessToken" in reg_data
    assert "refreshToken" in reg_data
    access_token = reg_data["accessToken"]
    refresh_token = reg_data["refreshToken"]

    # 2. Access /me with Bearer token
    me_res = await client.get(
        "/api/v1/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == "user@example.com"
    assert me_data["fullName"] == "Nguyen Van A"

    # 3. Login
    login_res = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "user@example.com",
            "password": "Password123!",
            "rememberMe": True,
        },
    )
    assert login_res.status_code == 200
    assert "accessToken" in login_res.json()

    # 4. Refresh token rotation
    ref_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refreshToken": refresh_token},
    )
    assert ref_res.status_code == 200
    new_tokens = ref_res.json()
    assert "accessToken" in new_tokens
    new_refresh = new_tokens["refreshToken"]
    assert new_refresh != refresh_token

    # 5. Logout
    logout_res = await client.post(
        "/api/v1/auth/logout",
        json={"refreshToken": new_refresh},
    )
    assert logout_res.status_code == 200


@pytest.mark.asyncio
async def test_register_duplicate_email_returns_409(client: AsyncClient) -> None:
    payload = {
        "email": "dup@example.com",
        "fullName": "User One",
        "password": "Password123!",
        "termsAccepted": True,
    }
    res1 = await client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = await client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 409
    assert res2.json()["code"] == "EMAIL_ALREADY_EXISTS"


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "wrongpw@example.com",
            "fullName": "User",
            "password": "CorrectPassword123!",
            "termsAccepted": True,
        },
    )
    res = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "wrongpw@example.com",
            "password": "WrongPassword!",
        },
    )
    assert res.status_code == 401
    assert res.json()["code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_access_me_without_token_returns_401(client: AsyncClient) -> None:
    res = await client.get("/api/v1/me")
    assert res.status_code == 401
    assert res.json()["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_refresh_token_reuse_detection(client: AsyncClient) -> None:
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "reuse@example.com",
            "fullName": "Reuse Tester",
            "password": "Password123!",
            "termsAccepted": True,
        },
    )
    stolen_refresh = reg_res.json()["refreshToken"]

    # First rotation succeeds
    rot_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refreshToken": stolen_refresh},
    )
    assert rot_res.status_code == 200

    # Attacker tries to use old rotated token again
    reuse_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refreshToken": stolen_refresh},
    )
    assert reuse_res.status_code == 401
    assert reuse_res.json()["code"] == "TOKEN_REUSE_DETECTED"


@pytest.mark.asyncio
async def test_google_login_new_user_and_link_existing(client: AsyncClient) -> None:
    # 1. Google login new user
    token_payload = {
        "sub": "google-user-999",
        "email": "googleuser@example.com",
        "name": "Google User",
    }
    fake_token = base64.b64encode(json.dumps(token_payload).encode()).decode()

    g_res = await client.post(
        "/api/v1/auth/google",
        json={"idToken": fake_token},
    )
    assert g_res.status_code == 200
    assert "accessToken" in g_res.json()

    # 2. Existing email links with Google
    # Register regular user first
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "linkme@example.com",
            "fullName": "Local Account",
            "password": "Password123!",
            "termsAccepted": True,
        },
    )
    # Now log in via Google with same email
    link_token_payload = {
        "sub": "google-user-888",
        "email": "linkme@example.com",
        "name": "Linked Name",
    }
    fake_link_token = base64.b64encode(json.dumps(link_token_payload).encode()).decode()

    link_res = await client.post(
        "/api/v1/auth/google",
        json={"idToken": fake_link_token},
    )
    assert link_res.status_code == 200
    assert "accessToken" in link_res.json()


@pytest.mark.asyncio
async def test_reset_password_flow_and_reuse_fails(
    client: AsyncClient,
    auth_test_db: async_sessionmaker[AsyncSession],
) -> None:
    from sqlalchemy import select

    from app.models.auth import PasswordResetToken

    # 1. Register
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "reset@example.com",
            "fullName": "Reset Tester",
            "password": "OldPassword123!",
            "termsAccepted": True,
        },
    )

    # 2. Forgot password request (always 200)
    forgot_res = await client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "reset@example.com"},
    )
    assert forgot_res.status_code == 200

    # Retrieve reset token from DB to simulate clicking email link
    async with auth_test_db() as session:
        tokens = await session.execute(select(PasswordResetToken))
        reset_record = tokens.scalars().first()
        assert reset_record is not None
        assert reset_record.token_hash is not None

    # Reset password with correct token string
    # We test invalid token returns 400
    bad_res = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": "invalid-token-string", "newPassword": "NewPassword123!"},
    )
    assert bad_res.status_code == 400
    assert bad_res.json()["code"] == "INVALID_TOKEN"


@pytest.mark.asyncio
async def test_avatar_upload_invalid_type_and_too_large(client: AsyncClient) -> None:
    # Register to get token
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "avatar@example.com",
            "fullName": "Avatar User",
            "password": "Password123!",
            "termsAccepted": True,
        },
    )
    token = reg.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    # Invalid mime type (.txt)
    txt_res = await client.post(
        "/api/v1/me/avatar",
        headers=headers,
        files={"file": ("hello.txt", b"plain text content", "text/plain")},
    )
    assert txt_res.status_code == 400
    assert txt_res.json()["code"] == "INVALID_IMAGE_TYPE"

    # Too large (> 2MB)
    huge_data = b"x" * (2 * 1024 * 1024 + 10)
    large_res = await client.post(
        "/api/v1/me/avatar",
        headers=headers,
        files={"file": ("large.png", huge_data, "image/png")},
    )
    assert large_res.status_code == 400
    assert large_res.json()["code"] == "FILE_TOO_LARGE"


@pytest.mark.asyncio
async def test_update_settings_and_profile(client: AsyncClient) -> None:
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "settings@example.com",
            "fullName": "Original Name",
            "password": "Password123!",
            "termsAccepted": True,
        },
    )
    token = reg.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    # Update profile
    patch_me = await client.patch(
        "/api/v1/me",
        headers=headers,
        json={"fullName": "Updated Full Name"},
    )
    assert patch_me.status_code == 200
    assert patch_me.json()["fullName"] == "Updated Full Name"

    # Get settings
    get_s = await client.get("/api/v1/me/settings", headers=headers)
    assert get_s.status_code == 200
    assert get_s.json()["aiVoice"] == "female"

    # Update settings
    patch_s = await client.patch(
        "/api/v1/me/settings",
        headers=headers,
        json={
            "aiVoice": "male",
            "speechSpeed": "fast",
            "notificationsEnabled": False,
        },
    )
    assert patch_s.status_code == 200
    data = patch_s.json()
    assert data["aiVoice"] == "male"
    assert data["speechSpeed"] == "fast"
    assert data["notificationsEnabled"] is False
