from unittest.mock import patch

import pytest

from app.core.exceptions import AppException, ProviderUnavailableError
from app.core.providers.tts_provider import CompositeTtsProvider, EdgeTtsProvider
from app.services.tts import TTSService


@pytest.mark.asyncio
async def test_tts_service_empty_text():
    service = TTSService(provider=EdgeTtsProvider())
    with pytest.raises(AppException) as exc_info:
        await service.generate_audio_bytes("   ")
    assert exc_info.value.status_code == 400
    assert "cannot be empty" in exc_info.value.detail


@pytest.mark.asyncio
async def test_tts_service_success():
    service = TTSService(provider=EdgeTtsProvider())
    mock_chunk1 = {"type": "audio", "data": b"header_data_"}
    mock_chunk2 = {"type": "audio", "data": b"mp3_audio_payload"}
    mock_chunk3 = {"type": "metadata", "data": "ignore"}

    async def mock_stream():
        yield mock_chunk1
        yield mock_chunk2
        yield mock_chunk3

    with patch("edge_tts.Communicate") as mock_comm_cls:
        instance = mock_comm_cls.return_value
        instance.stream = mock_stream

        result = await service.generate_audio_bytes("Xin chào", voice="vi-VN-HoaiMyNeural")
        assert result == b"header_data_mp3_audio_payload"
        mock_comm_cls.assert_called_once_with(text="Xin chào", voice="vi-VN-HoaiMyNeural")


@pytest.mark.asyncio
async def test_tts_service_fallback_voice():
    service = TTSService(provider=EdgeTtsProvider())

    async def mock_stream():
        yield {"type": "audio", "data": b"dummy_audio"}

    with patch("edge_tts.Communicate") as mock_comm_cls:
        instance = mock_comm_cls.return_value
        instance.stream = mock_stream

        await service.generate_audio_bytes("Hello", voice="unknown_voice_id")
        mock_comm_cls.assert_called_once_with(text="Hello", voice=TTSService.DEFAULT_VOICE)


@pytest.mark.asyncio
async def test_tts_service_empty_result():
    service = TTSService(provider=EdgeTtsProvider())

    async def mock_stream():
        if False:
            yield

    with patch("edge_tts.Communicate") as mock_comm_cls:
        instance = mock_comm_cls.return_value
        instance.stream = mock_stream

        with pytest.raises(AppException) as exc_info:
            await service.generate_audio_bytes("Test")
        assert exc_info.value.status_code == 503
        assert "empty" in exc_info.value.detail


@pytest.mark.asyncio
async def test_tts_service_provider_unavailable():
    service = TTSService(
        provider=CompositeTtsProvider(azure_provider=None, edge_provider=EdgeTtsProvider())
    )

    with patch("edge_tts.Communicate", side_effect=RuntimeError("EdgeTTS network error")):
        with pytest.raises(ProviderUnavailableError) as exc_info:
            await service.generate_audio_bytes("Test")
        assert exc_info.value.status_code == 503
        assert exc_info.value.detail["code"] == "TTS_UNAVAILABLE"
