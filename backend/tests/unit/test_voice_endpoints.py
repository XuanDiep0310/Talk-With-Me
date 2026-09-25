import base64
import json
from unittest.mock import AsyncMock

import pytest
from fastapi import WebSocket, WebSocketDisconnect
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_tts_service
from app.api.v1.endpoints.voice import voice_websocket_endpoint
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
    messages_to_receive = [
        json.dumps({"type": "ping"}),
        "invalid json text",
        json.dumps({"type": "generate_tts", "text": ""}),
        json.dumps({"type": "unknown_type"}),
        json.dumps({"type": "generate_tts", "text": "trigger_error"}),
        json.dumps({"type": "generate_tts", "text": "Hello WS", "voice": "vi-VN-HoaiMyNeural"}),
    ]
    sent_messages = []

    mock_ws = AsyncMock(spec=WebSocket)

    async def mock_receive_text():
        if messages_to_receive:
            return messages_to_receive.pop(0)
        raise WebSocketDisconnect()

    mock_ws.receive_text.side_effect = mock_receive_text

    async def mock_send_json(data):
        sent_messages.append(data)

    mock_ws.send_json.side_effect = mock_send_json

    def mock_gen_audio(text: str, voice: str = "") -> bytes:
        _ = voice
        if text == "trigger_error":
            raise RuntimeError("TTS synthesis failure")
        return b"fake_mp3_binary_data"

    mock_tts_service.generate_audio_bytes.side_effect = mock_gen_audio

    await voice_websocket_endpoint(websocket=mock_ws, tts_service=mock_tts_service)

    mock_ws.accept.assert_awaited_once()
    assert sent_messages[0] == {"type": "pong"}
    assert sent_messages[1] == {"type": "error", "message": "Invalid JSON format"}
    assert sent_messages[2] == {"type": "error", "message": "Text parameter is required"}
    assert sent_messages[3] == {"type": "error", "message": "Unknown message type: unknown_type"}
    assert "TTS synthesis failed" in sent_messages[4]["message"]
    assert sent_messages[5]["type"] == "audio_response"
    assert sent_messages[5]["text"] == "Hello WS"
    assert base64.b64decode(sent_messages[5]["audio_b64"]) == b"fake_mp3_binary_data"
