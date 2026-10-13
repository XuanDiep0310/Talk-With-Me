"""Integration coverage for per-user settings endpoints."""

import pytest
from httpx import AsyncClient


async def _register_user(
    client: AsyncClient,
    email: str = "settings@example.com",
    full_name: str = "Settings User",
) -> str:
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
    return response.json()["accessToken"]


@pytest.mark.asyncio
async def test_get_settings_returns_authenticated_users_defaults(client: AsyncClient) -> None:
    token = await _register_user(client)

    response = await client.get("/api/v1/me/settings", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == {
        "notificationsEnabled": True,
        "dailyReminderEnabled": True,
        "aiVoice": "female",
        "speechSpeed": "normal",
        "theme": "system",
        "timezone": "Asia/Ho_Chi_Minh",
    }


@pytest.mark.asyncio
async def test_get_and_patch_settings_reject_missing_authentication(client: AsyncClient) -> None:
    get_response = await client.get("/api/v1/me/settings")
    patch_response = await client.patch("/api/v1/me/settings", json={"aiVoice": "male"})

    assert get_response.status_code == 401
    assert get_response.json()["code"] == "UNAUTHORIZED"
    assert patch_response.status_code == 401
    assert patch_response.json()["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_patch_one_setting_preserves_unsubmitted_fields_and_persists(
    client: AsyncClient,
) -> None:
    token = await _register_user(client)
    headers = {"Authorization": f"Bearer {token}"}

    update = await client.patch("/api/v1/me/settings", headers=headers, json={"aiVoice": "male"})
    read_back = await client.get("/api/v1/me/settings", headers=headers)

    assert update.status_code == 200
    assert read_back.status_code == 200
    assert read_back.json() == {
        "notificationsEnabled": True,
        "dailyReminderEnabled": True,
        "aiVoice": "male",
        "speechSpeed": "normal",
        "theme": "system",
        "timezone": "Asia/Ho_Chi_Minh",
    }


@pytest.mark.asyncio
async def test_patch_multiple_settings_persists_all_supported_values(
    client: AsyncClient,
) -> None:
    token = await _register_user(client)
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "notificationsEnabled": False,
        "dailyReminderEnabled": False,
        "aiVoice": "male",
        "speechSpeed": "fast",
        "theme": "dark",
    }

    update = await client.patch("/api/v1/me/settings", headers=headers, json=payload)
    read_back = await client.get("/api/v1/me/settings", headers=headers)

    assert update.status_code == 200
    assert read_back.status_code == 200
    assert read_back.json() == {**payload, "timezone": "Asia/Ho_Chi_Minh"}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"aiVoice": "robot"},
        {"speechSpeed": "very-fast"},
        {"theme": "blue"},
        {"notificationsEnabled": []},
    ],
)
async def test_patch_rejects_invalid_enum_or_type_without_mutation(
    client: AsyncClient, payload: dict[str, object]
) -> None:
    token = await _register_user(client)
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.patch("/api/v1/me/settings", headers=headers, json=payload)

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
    current = await client.get("/api/v1/me/settings", headers=headers)
    assert current.json()["aiVoice"] == "female"
    assert current.json()["speechSpeed"] == "normal"
    assert current.json()["theme"] == "system"
    assert current.json()["notificationsEnabled"] is True


@pytest.mark.asyncio
async def test_empty_and_null_patch_preserve_current_settings(client: AsyncClient) -> None:
    token = await _register_user(client)
    headers = {"Authorization": f"Bearer {token}"}
    empty_patch = await client.patch("/api/v1/me/settings", headers=headers, json={})
    null_patch = await client.patch("/api/v1/me/settings", headers=headers, json={"aiVoice": None})

    assert empty_patch.status_code == 200
    assert null_patch.status_code == 200
    assert null_patch.json()["aiVoice"] == "female"
    assert null_patch.json()["speechSpeed"] == "normal"


@pytest.mark.asyncio
async def test_unknown_setting_field_is_ignored_by_current_schema(client: AsyncClient) -> None:
    token = await _register_user(client)
    headers = {"Authorization": f"Bearer {token}"}
    response = await client.patch(
        "/api/v1/me/settings",
        headers=headers,
        json={"unsupportedSetting": "ignored", "aiVoice": "male"},
    )

    assert response.status_code == 200
    assert "unsupportedSetting" not in response.json()
    assert response.json()["aiVoice"] == "male"


@pytest.mark.asyncio
async def test_settings_are_isolated_between_users(client: AsyncClient) -> None:
    token_a = await _register_user(client, "settings-a@example.com", "User A")
    token_b = await _register_user(client, "settings-b@example.com", "User B")

    update_a = await client.patch(
        "/api/v1/me/settings",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"aiVoice": "male", "theme": "dark"},
    )
    read_b = await client.get("/api/v1/me/settings", headers={"Authorization": f"Bearer {token_b}"})

    assert update_a.status_code == 200
    assert update_a.json()["aiVoice"] == "male"
    assert read_b.status_code == 200
    assert read_b.json()["aiVoice"] == "female"
    assert read_b.json()["theme"] == "system"


@pytest.mark.asyncio
async def test_timezone_is_returned_as_fixed_value_by_current_implementation(
    client: AsyncClient,
) -> None:
    token = await _register_user(client)
    headers = {"Authorization": f"Bearer {token}"}
    response = await client.get("/api/v1/me/settings", headers=headers)

    assert response.status_code == 200
    assert response.json()["timezone"] == "Asia/Ho_Chi_Minh"


@pytest.mark.asyncio
async def test_timezone_patch_schema_field_fails_against_settings_model(
    client: AsyncClient,
) -> None:
    """The request schema accepts timezone, but UserSettings has no timezone column."""
    token = await _register_user(client)
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.patch(
        "/api/v1/me/settings",
        headers=headers,
        json={"timezone": "America/New_York"},
    )

    assert response.status_code == 500
    assert response.json()["code"] == "INTERNAL_SERVER_ERROR"
    current = await client.get("/api/v1/me/settings", headers=headers)
    assert current.status_code == 200
    assert current.json()["timezone"] == "Asia/Ho_Chi_Minh"
