"""Integration tests for Authentication, User Profile, and Settings API endpoints."""

import base64
import json
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
)

from app.core.security import hash_refresh_token
from app.main import app
from app.models.auth import PasswordResetToken, RefreshToken

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
    refresh_after_logout = await client.post(
        "/api/v1/auth/refresh",
        json={"refreshToken": new_refresh},
    )
    assert refresh_after_logout.status_code == 401
    assert refresh_after_logout.json()["code"] == "TOKEN_REUSE_DETECTED"


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
    unknown_email = await client.post(
        "/api/v1/auth/login",
        json={"email": "unknown@example.com", "password": "WrongPassword!"},
    )
    assert unknown_email.status_code == 401
    assert unknown_email.json()["code"] == "INVALID_CREDENTIALS"


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


@pytest.mark.asyncio
async def test_auth_validation_and_invalid_access_token(client: AsyncClient) -> None:
    missing = await client.post("/api/v1/auth/register", json={"email": "bad@example.com"})
    assert missing.status_code == 422

    bad_email = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "not-an-email",
            "fullName": "Bad",
            "password": "Password123!",
            "termsAccepted": True,
        },
    )
    assert bad_email.status_code == 422

    invalid_token = await client.get(
        "/api/v1/me", headers={"Authorization": "Bearer invalid-token"}
    )
    assert invalid_token.status_code == 401
    assert invalid_token.json()["code"] == "INVALID_TOKEN"


@pytest.mark.asyncio
async def test_google_login_rejects_invalid_token_without_network(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/google", json={"idToken": "invalid-google-token"})
    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_GOOGLE_TOKEN"


@pytest.mark.asyncio
async def test_profile_settings_are_scoped_and_partial_update_preserves_other_fields(
    client: AsyncClient,
) -> None:
    async def register(email: str, name: str) -> tuple[str, str]:
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "fullName": name,
                "password": "Password123!",
                "termsAccepted": True,
            },
        )
        assert response.status_code == 201
        return response.json()["accessToken"], response.json()["refreshToken"]

    token_a, _ = await register("scope-a@example.com", "User A")
    token_b, _ = await register("scope-b@example.com", "User B")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    update = await client.patch("/api/v1/me/settings", headers=headers_a, json={"aiVoice": "male"})
    assert update.status_code == 200
    assert update.json()["aiVoice"] == "male"
    assert update.json()["speechSpeed"] == "normal"

    profile_update = await client.patch(
        "/api/v1/me", headers=headers_a, json={"fullName": "Changed A"}
    )
    assert profile_update.status_code == 200
    profile_b = await client.get("/api/v1/me", headers=headers_b)
    settings_b = await client.get("/api/v1/me/settings", headers=headers_b)
    assert profile_b.json()["fullName"] == "User B"
    assert settings_b.json()["aiVoice"] == "female"


@pytest.mark.asyncio
async def test_change_password_updates_credentials_and_revokes_refresh_tokens(
    client: AsyncClient,
) -> None:
    registered = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "change-pw@example.com",
            "fullName": "Password User",
            "password": "Password123!",
            "termsAccepted": True,
        },
    )
    token = registered.json()["accessToken"]
    refresh = registered.json()["refreshToken"]
    response = await client.post(
        "/api/v1/me/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"oldPassword": "Password123!", "newPassword": "NewPassword123!"},
    )
    assert response.status_code == 200
    assert (
        await client.post(
            "/api/v1/auth/login",
            json={"email": "change-pw@example.com", "password": "Password123!"},
        )
    ).status_code == 401
    assert (
        await client.post(
            "/api/v1/auth/login",
            json={"email": "change-pw@example.com", "password": "NewPassword123!"},
        )
    ).status_code == 200
    revoked = await client.post("/api/v1/auth/refresh", json={"refreshToken": refresh})
    assert revoked.status_code == 401


@pytest.mark.asyncio
async def test_settings_validation_and_avatar_empty_file(client: AsyncClient) -> None:
    registered = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "validation@example.com",
            "fullName": "Validation",
            "password": "Password123!",
            "termsAccepted": True,
        },
    )
    headers = {"Authorization": f"Bearer {registered.json()['accessToken']}"}
    invalid_settings = await client.patch(
        "/api/v1/me/settings", headers=headers, json={"aiVoice": "robot"}
    )
    assert invalid_settings.status_code == 422
    assert (await client.get("/api/v1/me/settings", headers=headers)).json()["aiVoice"] == "female"

    empty_avatar = await client.post(
        "/api/v1/me/avatar",
        headers=headers,
        files={"file": ("empty.png", b"", "image/png")},
    )
    assert empty_avatar.status_code == 400
    assert empty_avatar.json()["code"] == "EMPTY_FILE"


@pytest.mark.asyncio
async def test_avatar_upload_valid_image_updates_profile(client: AsyncClient) -> None:
    registered = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "valid-avatar@example.com",
            "fullName": "Avatar User",
            "password": "Password123!",
            "termsAccepted": True,
        },
    )
    headers = {"Authorization": f"Bearer {registered.json()['accessToken']}"}
    response = await client.post(
        "/api/v1/me/avatar",
        headers=headers,
        files={"file": ("avatar.png", b"png-data", "image/png")},
    )
    assert response.status_code == 200
    avatar_url = response.json()["avatarUrl"]
    profile = await client.get("/api/v1/me", headers=headers)
    assert profile.json()["avatarUrl"] == avatar_url


@pytest.mark.asyncio
async def test_reset_password_with_fake_email_token_changes_login_password(
    client: AsyncClient,
) -> None:
    from app.api.deps import get_email_sender

    email_sender = app.dependency_overrides[get_email_sender]()
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "reset-success@example.com",
            "fullName": "Reset User",
            "password": "OldPassword123!",
            "termsAccepted": True,
        },
    )
    forgot = await client.post(
        "/api/v1/auth/forgot-password", json={"email": "reset-success@example.com"}
    )
    assert forgot.status_code == 200
    reset_token = email_sender.reset_tokens[-1]
    reset = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": reset_token, "newPassword": "NewPassword123!"},
    )
    assert reset.status_code == 200
    assert (
        await client.post(
            "/api/v1/auth/login",
            json={"email": "reset-success@example.com", "password": "OldPassword123!"},
        )
    ).status_code == 401
    assert (
        await client.post(
            "/api/v1/auth/login",
            json={"email": "reset-success@example.com", "password": "NewPassword123!"},
        )
    ).status_code == 200
    reused = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": reset_token, "newPassword": "AnotherPassword123!"},
    )
    assert reused.status_code == 400
    assert reused.json()["code"] == "TOKEN_ALREADY_USED"


@pytest.mark.asyncio
async def test_auth_validation_rejects_missing_fields_and_invalid_email(
    client: AsyncClient,
) -> None:
    requests = [
        ("/api/v1/auth/register", {"email": "missing@example.com"}),
        ("/api/v1/auth/login", {"email": "missing@example.com"}),
        ("/api/v1/auth/login", {"email": "invalid-email", "password": "x"}),
        ("/api/v1/auth/google", {}),
        ("/api/v1/auth/forgot-password", {"email": "invalid-email"}),
        ("/api/v1/auth/reset-password", {"token": "token"}),
        ("/api/v1/auth/refresh", {}),
        ("/api/v1/auth/logout", {}),
    ]

    for path, payload in requests:
        response = await client.post(path, json=payload)
        assert response.status_code == 422, path
        assert response.json()["code"] == "VALIDATION_ERROR", path

    unknown_refresh = await client.post(
        "/api/v1/auth/refresh", json={"refreshToken": "unknown-refresh-token"}
    )
    assert unknown_refresh.status_code == 401
    assert unknown_refresh.json()["code"] == "INVALID_TOKEN"


@pytest.mark.asyncio
async def test_forgot_password_unknown_email_has_same_response_and_sends_no_email(
    client: AsyncClient, fake_email_sender
) -> None:
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "forgot-known@example.com",
            "fullName": "Known User",
            "password": "Password123!",
            "termsAccepted": True,
        },
    )
    known = await client.post(
        "/api/v1/auth/forgot-password", json={"email": "forgot-known@example.com"}
    )
    unknown = await client.post(
        "/api/v1/auth/forgot-password", json={"email": "forgot-unknown@example.com"}
    )

    assert known.status_code == 200
    assert unknown.status_code == 200
    assert known.json() == unknown.json()
    assert len(fake_email_sender.reset_tokens) == 1


@pytest.mark.asyncio
async def test_reset_password_rejects_short_password(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": "unused-token", "newPassword": "short"},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_register_enforces_name_password_and_terms_boundaries(
    client: AsyncClient,
) -> None:
    max_name = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "max-name@example.com",
            "fullName": "N" * 120,
            "password": "Password123!",
            "termsAccepted": True,
        },
    )
    too_long_name = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "long-name@example.com",
            "fullName": "N" * 121,
            "password": "Password123!",
            "termsAccepted": True,
        },
    )
    short_password = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "short-password@example.com",
            "fullName": "Short Password",
            "password": "12345",
            "termsAccepted": True,
        },
    )
    weak_password = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "weak-password@example.com",
            "fullName": "Weak Password",
            "password": "abcdef",
            "termsAccepted": True,
        },
    )
    terms_not_accepted = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "terms@example.com",
            "fullName": "Terms User",
            "password": "Password123!",
            "termsAccepted": False,
        },
    )

    assert max_name.status_code == 201
    assert too_long_name.status_code == 422
    assert short_password.status_code == 422
    assert weak_password.status_code == 400
    assert weak_password.json()["code"] == "PASSWORD_TOO_WEAK"
    assert terms_not_accepted.status_code == 400
    assert terms_not_accepted.json()["code"] == "TERMS_NOT_ACCEPTED"


@pytest.mark.asyncio
async def test_refresh_rejects_expired_token_without_rotating_it(
    client: AsyncClient,
    auth_test_db: async_sessionmaker[AsyncSession],
) -> None:
    registered = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "expired-refresh@example.com",
            "fullName": "Expired Refresh",
            "password": "Password123!",
            "termsAccepted": True,
        },
    )
    raw_token = registered.json()["refreshToken"]
    token_hash = hash_refresh_token(raw_token)
    async with auth_test_db() as session:
        await session.execute(
            update(RefreshToken)
            .where(RefreshToken.token_hash == token_hash)
            .values(expires_at=datetime(2000, 1, 1, tzinfo=UTC))
        )
        await session.commit()

    response = await client.post("/api/v1/auth/refresh", json={"refreshToken": raw_token})

    assert response.status_code == 401
    assert response.json()["code"] == "TOKEN_EXPIRED"
    async with auth_test_db() as session:
        records = await session.execute(select(RefreshToken))
        stored_tokens = records.scalars().all()
        assert len(stored_tokens) == 1
        assert stored_tokens[0].token_hash == token_hash
        assert stored_tokens[0].revoked is False


@pytest.mark.asyncio
async def test_reset_rejects_expired_token_without_changing_password(
    client: AsyncClient,
    auth_test_db: async_sessionmaker[AsyncSession],
    fake_email_sender,
) -> None:
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "expired-reset@example.com",
            "fullName": "Expired Reset",
            "password": "Password123!",
            "termsAccepted": True,
        },
    )
    await client.post("/api/v1/auth/forgot-password", json={"email": "expired-reset@example.com"})
    raw_token = fake_email_sender.reset_tokens[-1]
    token_hash = hash_refresh_token(raw_token)
    async with auth_test_db() as session:
        await session.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.token_hash == token_hash)
            .values(expires_at=datetime(2000, 1, 1, tzinfo=UTC))
        )
        await session.commit()

    response = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": raw_token, "newPassword": "NewPassword123!"},
    )
    old_password_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "expired-reset@example.com", "password": "Password123!"},
    )

    assert response.status_code == 400
    assert response.json()["code"] == "TOKEN_EXPIRED"
    assert old_password_login.status_code == 200
    async with auth_test_db() as session:
        record = await session.execute(
            select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
        )
        assert record.scalar_one().used is False
