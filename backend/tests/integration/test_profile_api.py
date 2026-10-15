"""Integration coverage for authenticated profile endpoints."""

import pytest
from httpx import AsyncClient


async def _register_user(
    client: AsyncClient,
    email: str = "profile@example.com",
    full_name: str = "Profile User",
) -> tuple[str, str]:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "fullName": full_name,
            "password": "Password123!",
            "termsAccepted": True,
        },
    )
    assert response.status_code == 201
    return response.json()["accessToken"], response.json()["refreshToken"]


@pytest.mark.asyncio
async def test_get_profile_returns_authenticated_users_data(client: AsyncClient) -> None:
    token, _ = await _register_user(client)

    response = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "profile@example.com"
    assert body["fullName"] == "Profile User"
    assert body["avatarUrl"] is None
    assert body["interests"] == []
    assert body["goals"] == []
    assert body["weakPoints"] == []
    assert "id" in body and "createdAt" in body


@pytest.mark.asyncio
async def test_profile_endpoints_reject_missing_or_invalid_authentication(
    client: AsyncClient,
) -> None:
    missing = await client.get("/api/v1/me")
    invalid = await client.patch(
        "/api/v1/me", headers={"Authorization": "Bearer invalid-token"}, json={"fullName": "New"}
    )
    unauthenticated_upload = await client.post(
        "/api/v1/me/avatar", files={"file": ("avatar.png", b"image", "image/png")}
    )
    unauthenticated_password = await client.post(
        "/api/v1/me/change-password",
        json={"oldPassword": "Password123!", "newPassword": "NewPassword123!"},
    )

    assert missing.status_code == 401
    assert missing.json()["code"] == "UNAUTHORIZED"
    assert invalid.status_code == 401
    assert invalid.json()["code"] == "INVALID_TOKEN"
    assert unauthenticated_upload.status_code == 401
    assert unauthenticated_password.status_code == 401


@pytest.mark.asyncio
async def test_patch_profile_persists_only_submitted_fields(client: AsyncClient) -> None:
    token, _ = await _register_user(client)
    headers = {"Authorization": f"Bearer {token}"}
    avatar_url = "https://cdn.example.test/avatar.png"
    set_avatar = await client.patch("/api/v1/me", headers=headers, json={"avatarUrl": avatar_url})
    assert set_avatar.status_code == 200

    update_name = await client.patch(
        "/api/v1/me", headers=headers, json={"fullName": "  Updated Name  "}
    )
    assert update_name.status_code == 200
    assert update_name.json()["fullName"] == "Updated Name"
    assert update_name.json()["avatarUrl"] == avatar_url

    stored = await client.get("/api/v1/me", headers=headers)
    assert stored.status_code == 200
    assert stored.json()["fullName"] == "Updated Name"
    assert stored.json()["avatarUrl"] == avatar_url


@pytest.mark.asyncio
@pytest.mark.parametrize("full_name", ["", "x" * 121])
async def test_patch_profile_rejects_invalid_name_without_mutation(
    client: AsyncClient, full_name: str
) -> None:
    token, _ = await _register_user(client)
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.patch("/api/v1/me", headers=headers, json={"fullName": full_name})

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
    profile = await client.get("/api/v1/me", headers=headers)
    assert profile.json()["fullName"] == "Profile User"


@pytest.mark.asyncio
async def test_avatar_upload_accepts_supported_image_and_persists_url(
    client: AsyncClient, fake_storage
) -> None:
    token, _ = await _register_user(client)
    headers = {"Authorization": f"Bearer {token}"}
    image_data = b"small-image-payload"

    response = await client.post(
        "/api/v1/me/avatar",
        headers=headers,
        files={"file": ("avatar.png", image_data, "image/png")},
    )

    assert response.status_code == 200
    avatar_url = response.json()["avatarUrl"]
    assert avatar_url.startswith("/test-avatars/")
    assert fake_storage.saved[0][1:] == (image_data, "image/png")
    profile = await client.get("/api/v1/me", headers=headers)
    assert profile.json()["avatarUrl"] == avatar_url


@pytest.mark.asyncio
async def test_avatar_upload_rejects_wrong_mime_and_file_over_two_mib(
    client: AsyncClient,
) -> None:
    token, _ = await _register_user(client)
    headers = {"Authorization": f"Bearer {token}"}
    wrong_mime = await client.post(
        "/api/v1/me/avatar",
        headers=headers,
        files={"file": ("avatar.txt", b"not image", "text/plain")},
    )
    too_large = await client.post(
        "/api/v1/me/avatar",
        headers=headers,
        files={"file": ("large.png", b"x" * (2 * 1024 * 1024 + 1), "image/png")},
    )

    assert wrong_mime.status_code == 400
    assert wrong_mime.json()["code"] == "INVALID_IMAGE_TYPE"
    assert too_large.status_code == 400
    assert too_large.json()["code"] == "FILE_TOO_LARGE"


@pytest.mark.asyncio
async def test_avatar_upload_rejects_missing_and_empty_files(client: AsyncClient) -> None:
    token, _ = await _register_user(client)
    headers = {"Authorization": f"Bearer {token}"}
    missing_file = await client.post("/api/v1/me/avatar", headers=headers, files={})
    empty_file = await client.post(
        "/api/v1/me/avatar",
        headers=headers,
        files={"file": ("empty.png", b"", "image/png")},
    )

    assert missing_file.status_code == 422
    assert missing_file.json()["code"] == "VALIDATION_ERROR"
    assert empty_file.status_code == 400
    assert empty_file.json()["code"] == "EMPTY_FILE"


@pytest.mark.asyncio
async def test_change_password_updates_credentials_and_revokes_refresh_tokens(
    client: AsyncClient,
) -> None:
    token, refresh_token = await _register_user(client, "change-password@example.com")
    response = await client.post(
        "/api/v1/me/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"oldPassword": "Password123!", "newPassword": "NewPassword123!"},
    )

    assert response.status_code == 200
    wrong_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "change-password@example.com", "password": "Password123!"},
    )
    correct_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "change-password@example.com", "password": "NewPassword123!"},
    )
    revoked_refresh = await client.post(
        "/api/v1/auth/refresh", json={"refreshToken": refresh_token}
    )

    assert wrong_login.status_code == 401
    assert correct_login.status_code == 200
    assert revoked_refresh.status_code == 401


@pytest.mark.asyncio
async def test_change_password_rejects_wrong_current_password_without_changing_login(
    client: AsyncClient,
) -> None:
    token, _ = await _register_user(client, "wrong-current@example.com")
    response = await client.post(
        "/api/v1/me/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"oldPassword": "incorrect", "newPassword": "NewPassword123!"},
    )

    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_OLD_PASSWORD"
    same_password = await client.post(
        "/api/v1/me/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"oldPassword": "Password123!", "newPassword": "Password123!"},
    )
    assert same_password.status_code == 400
    assert same_password.json()["code"] == "PASSWORD_SAME_AS_OLD"
    old_password_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "wrong-current@example.com", "password": "Password123!"},
    )
    assert old_password_login.status_code == 200


@pytest.mark.asyncio
async def test_change_password_rejects_short_new_password(client: AsyncClient) -> None:
    token, _ = await _register_user(client, "short-new-password@example.com")
    response = await client.post(
        "/api/v1/me/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"oldPassword": "Password123!", "newPassword": "short"},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
