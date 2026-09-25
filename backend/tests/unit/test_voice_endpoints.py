import base64
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_tts_service
from app.main import app
from app.services.tts import TTSService


@pytest.fixture
def mock_tts_service():
    service = AsyncMock(spec=TTSService)
    service.DEFAULT_VOICE = "vi-VN-HoaiMyNeural"
    service.AVAILABLE_VOICES = {
        "vi-VN-HoaiMyNeural": "Hoài Mỹ (Nữ - Tiếng Việt)",
        "vi-VN-NamMinhNeural": "Nam Minh (Nam - Tiếng Việt)",
    }
    service.generate_audio_bytes.return_value = b"fake_mp3_binary_data"
    return service


@pytest.mark.asyncio
async def test_list_voices_endpoint(mock_tts_service):
    app.dependency_overrides[get_tts_service] = lambda: mock_tts_service
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/voice/voices")
        assert response.status_code == 200
        data = response.json()
        assert "vi-VN-HoaiMyNeural" in data
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_tts_json_endpoint(mock_tts_service):
    app.dependency_overrides[get_tts_service] = lambda: mock_tts_service
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {"text": "Xin chào thế giới", "voice": "vi-VN-HoaiMyNeural"}
        response = await client.post("/api/v1/voice/tts", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["text"] == "Xin chào thế giới"
        assert data["voice"] == "vi-VN-HoaiMyNeural"
        decoded = base64.b64decode(data["audio_b64"])
        assert decoded == b"fake_mp3_binary_data"
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_tts_stream_endpoint(mock_tts_service):
    app.dependency_overrides[get_tts_service] = lambda: mock_tts_service
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {"text": "Stream test", "voice": "vi-VN-HoaiMyNeural"}
        response = await client.post("/api/v1/voice/tts/stream", json=payload)
        assert response.status_code == 200
        assert response.headers["content-type"] == "audio/mpeg"
        assert response.content == b"fake_mp3_binary_data"
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_voice_websocket_endpoint(mock_tts_service):
    app.dependency_overrides[get_tts_service] = lambda: mock_tts_service
    from fastapi.testclient import TestClient

    with (
        TestClient(app) as test_client,
        test_client.websocket_connect("/api/v1/voice/ws") as websocket,
    ):
        # Test ping
        websocket.send_json({"type": "ping"})
        data = websocket.receive_json()
        assert data == {"type": "pong"}

        # Test invalid JSON
        websocket.send_text("invalid json")
        data = websocket.receive_json()
        assert data["type"] == "error"

        # Test missing text
        websocket.send_json({"type": "generate_tts", "text": ""})
        data = websocket.receive_json()
        assert data["type"] == "error"

        # Test unknown type
        websocket.send_json({"type": "unknown_action"})
        data = websocket.receive_json()
        assert data["type"] == "error"

        # Test valid TTS generation
        websocket.send_json(
            {"type": "generate_tts", "text": "Hello WS", "voice": "vi-VN-HoaiMyNeural"}
        )
        data = websocket.receive_json()
        assert data["type"] == "audio_response"
        assert data["text"] == "Hello WS"
        assert base64.b64decode(data["audio_b64"]) == b"fake_mp3_binary_data"

    app.dependency_overrides.clear()
