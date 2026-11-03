"""
TTS (Text-to-Speech) provider interface and implementations.

Supported providers:
  - fake: In-memory simulator for dev and tests. Returns None for audio_url by default,
          prompting the client to use browser speech synthesis.
  - edge: Real synthesis using Microsoft Edge-TTS async stream.
"""

import io
import logging
from typing import Protocol

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class TtsProvider(Protocol):
    """Abstract interface for text-to-speech services."""

    async def synthesize(self, text: str, voice: str = "en-US-AvaNeural") -> bytes:
        """Synthesize text into raw MP3 audio bytes."""
        ...

    async def get_audio_url_or_none(self, text: str, voice: str = "en-US-AvaNeural") -> str | None:
        """Return audio URL if hosted, or None if client should synthesize locally."""
        ...


class FakeTtsProvider:
    """Fake TTS provider for development and testing environments."""

    def __init__(self, mock_audio_url: str | None = None) -> None:
        self.mock_audio_url = mock_audio_url

    async def synthesize(
        self,
        text: str,
        voice: str = "en-US-AvaNeural",  # noqa: ARG002
    ) -> bytes:
        # Return mock MP3 frame header / placeholder bytes
        return b"\xff\xfb\x90d" + text.encode("utf-8")[:128]

    async def get_audio_url_or_none(
        self,
        text: str,  # noqa: ARG002
        voice: str = "en-US-AvaNeural",  # noqa: ARG002
    ) -> str | None:
        return self.mock_audio_url


class EdgeTtsProvider:
    """Production TTS provider using Microsoft Edge-TTS."""

    DEFAULT_VOICE = "en-US-AvaNeural"

    async def synthesize(self, text: str, voice: str = DEFAULT_VOICE) -> bytes:
        import edge_tts

        cleaned = text.strip() if text else ""
        if not cleaned:
            return b""

        communicate = edge_tts.Communicate(text=cleaned, voice=voice)
        buffer = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                buffer.write(chunk["data"])

        return buffer.getvalue()

    async def get_audio_url_or_none(
        self,
        text: str,  # noqa: ARG002
        voice: str = DEFAULT_VOICE,  # noqa: ARG002
    ) -> str | None:
        # By default in MVP, returning None delegates synthesis to browser Web Speech API
        return None


def get_tts_provider() -> TtsProvider:
    """Factory resolving configured TTS provider."""
    settings = get_settings()
    provider_type = getattr(settings, "TTS_PROVIDER", "fake").lower()

    if provider_type == "edge":
        return EdgeTtsProvider()

    return FakeTtsProvider()
