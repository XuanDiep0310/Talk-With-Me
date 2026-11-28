"""Application service for Neural Text-to-Speech synthesis."""

from __future__ import annotations

from app.core.exceptions import AppException
from app.core.providers.tts_provider import TtsProvider, get_tts_provider


class TTSService:
    """Synthesizes speech using the configured TTS provider (Azure Neural TTS / Edge-TTS)."""

    DEFAULT_VOICE = "en-US-JennyNeural"
    AVAILABLE_VOICES: dict[str, str] = {
        "en-US-JennyNeural": "Jenny (Female - US English)",
        "en-US-GuyNeural": "Guy (Male - US English)",
        "en-US-AvaNeural": "Ava (Female - US English)",
        "en-US-AndrewNeural": "Andrew (Male - US English)",
        "vi-VN-HoaiMyNeural": "Hoài Mỹ (Nữ - Tiếng Việt)",
        "vi-VN-NamMinhNeural": "Nam Minh (Nam - Tiếng Việt)",
    }

    def __init__(self, provider: TtsProvider | None = None) -> None:
        self._provider = provider or get_tts_provider()

    async def generate_audio_bytes(self, text: str, voice: str = DEFAULT_VOICE) -> bytes:
        """Generate MP3 audio bytes from given text."""
        cleaned_text = text.strip() if text else ""
        if not cleaned_text:
            raise AppException(detail="Text for TTS generation cannot be empty", status_code=400)

        target_voice = voice if voice in self.AVAILABLE_VOICES else self.DEFAULT_VOICE
        audio_bytes = await self._provider.synthesize(text=cleaned_text, voice=target_voice)
        if not audio_bytes:
            raise AppException(detail="Generated audio stream is empty", status_code=503)
        return audio_bytes
