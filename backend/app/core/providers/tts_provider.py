"""TTS (Text-to-Speech) provider interface: Azure Neural TTS (primary) + Edge-TTS fallback."""

from __future__ import annotations

import asyncio
import io
import logging
import weakref
from typing import Protocol
from xml.sax.saxutils import escape

import httpx

from app.core.config import get_settings
from app.core.exceptions import ProviderUnavailableError

logger = logging.getLogger(__name__)

_ORIGINAL_TTS_ASYNC_CLIENT = httpx.AsyncClient
_TTS_CLIENTS: weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, httpx.AsyncClient] = (
    weakref.WeakKeyDictionary()
)


def _get_tts_http_client() -> tuple[httpx.AsyncClient, bool]:
    """Return (client, should_close). Reuses keep-alive client unless httpx.AsyncClient is mocked."""
    if httpx.AsyncClient is not _ORIGINAL_TTS_ASYNC_CLIENT:
        return httpx.AsyncClient(), True
    loop = asyncio.get_running_loop()
    client = _TTS_CLIENTS.get(loop)
    if client is None or client.is_closed:
        client = httpx.AsyncClient(
            limits=httpx.Limits(max_keepalive_connections=16, max_connections=40),
        )
        _TTS_CLIENTS[loop] = client
    return client, False


class TtsProvider(Protocol):
    """Abstract interface for text-to-speech services."""

    async def synthesize(self, text: str, voice: str = "en-US-JennyNeural") -> bytes: ...

    async def get_audio_url_or_none(
        self, text: str, voice: str = "en-US-JennyNeural"
    ) -> str | None: ...


class AzureSpeechTtsProvider:
    """Official Azure AI Speech Neural TTS via REST API (uses AZURE_SPEECH_KEY + REGION)."""

    DEFAULT_VOICE = "en-US-JennyNeural"

    def __init__(self, key: str, region: str) -> None:
        self.key = key
        self.region = region

    async def synthesize(self, text: str, voice: str = DEFAULT_VOICE) -> bytes:
        cleaned = text.strip() if text else ""
        if not cleaned:
            return b""
        lang = "-".join(voice.split("-")[:2]) if "-" in voice else "en-US"
        ssml = (
            f"<speak version='1.0' xml:lang='{escape(lang)}'>"
            f"<voice xml:lang='{escape(lang)}' name='{escape(voice)}'>"
            f"{escape(cleaned)}"
            f"</voice></speak>"
        )
        url = f"https://{self.region}.tts.speech.microsoft.com/cognitiveservices/v1"
        headers = {
            "Ocp-Apim-Subscription-Key": self.key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
            "User-Agent": "TalkWithMe-Backend",
        }
        client, should_close = _get_tts_http_client()
        try:
            resp = await client.post(
                url, headers=headers, content=ssml.encode("utf-8"), timeout=15.0
            )
            resp.raise_for_status()
            return resp.content
        finally:
            if should_close:
                await client.aclose()

    async def get_audio_url_or_none(
        self,
        text: str,  # noqa: ARG002
        voice: str = DEFAULT_VOICE,  # noqa: ARG002
    ) -> str | None:
        return None


class EdgeTtsProvider:
    """Fallback TTS provider using Microsoft Edge-TTS."""

    DEFAULT_VOICE = "en-US-JennyNeural"

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
        return None


class CompositeTtsProvider:
    """Uses Azure Neural TTS when configured, falling back to Edge-TTS if needed."""

    def __init__(
        self,
        azure_provider: AzureSpeechTtsProvider | None,
        edge_provider: EdgeTtsProvider,
    ) -> None:
        self.azure_provider = azure_provider
        self.edge_provider = edge_provider

    async def synthesize(self, text: str, voice: str = "en-US-JennyNeural") -> bytes:
        if self.azure_provider is not None:
            try:
                audio = await self.azure_provider.synthesize(text, voice=voice)
                if audio:
                    return audio
            except Exception as exc:
                logger.warning("Azure Speech TTS failed (%s); falling back to Edge-TTS.", exc)

        try:
            audio = await self.edge_provider.synthesize(text, voice=voice)
            if audio:
                return audio
        except Exception as exc:
            logger.error("Edge-TTS also failed: %s", exc)
            raise ProviderUnavailableError(
                code="TTS_UNAVAILABLE",
                message="Dịch vụ đọc giọng nói tạm thời không khả dụng.",
            ) from exc

        raise ProviderUnavailableError(
            code="TTS_UNAVAILABLE",
            message="Không tạo được dữ liệu âm thanh.",
        )

    async def get_audio_url_or_none(
        self,
        text: str,  # noqa: ARG002
        voice: str = "en-US-JennyNeural",  # noqa: ARG002
    ) -> str | None:
        return None


def get_tts_provider() -> TtsProvider:
    """Resolve active TTS provider (Azure Neural TTS primary when key is set + Edge fallback)."""
    settings = get_settings()
    azure_provider = (
        AzureSpeechTtsProvider(key=settings.AZURE_SPEECH_KEY, region=settings.AZURE_SPEECH_REGION)
        if settings.AZURE_SPEECH_KEY and settings.AZURE_SPEECH_REGION
        else None
    )
    edge_provider = EdgeTtsProvider()
    if settings.TTS_PROVIDER.lower() == "edge" and azure_provider is None:
        return edge_provider
    return CompositeTtsProvider(azure_provider=azure_provider, edge_provider=edge_provider)
