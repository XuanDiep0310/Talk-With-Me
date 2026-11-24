"""
STT (Speech-to-Text) provider interface and implementations.

Supported providers:
  - fake: In-memory simulation returning plausible transcripts and confidence (default).
  - deepgram: Real-time STT using Deepgram Nova-2 via REST/WebSocket API.
"""

from typing import Protocol

import httpx

from app.core.config import get_settings


class WordTiming:
    """Word-level timing and confidence info."""

    __slots__ = ("word", "start_ms", "end_ms", "confidence")

    def __init__(self, word: str, start_ms: int, end_ms: int, confidence: float) -> None:
        self.word = word
        self.start_ms = start_ms
        self.end_ms = end_ms
        self.confidence = confidence


class SttResult:
    """Result from STT transcription."""

    __slots__ = (
        "transcript",
        "confidence",
        "speaking_duration_seconds",
        "words",
        "is_final",
        "word_times_measured",
        "measured_confidence",
    )

    def __init__(
        self,
        transcript: str,
        confidence: float,
        speaking_duration_seconds: float,
        words: list[WordTiming] | None = None,
        is_final: bool = True,
        word_times_measured: bool = False,
        measured_confidence: float | None = None,
    ) -> None:
        self.transcript = transcript
        self.confidence = confidence  # 0.0–1.0
        self.speaking_duration_seconds = speaking_duration_seconds
        self.words = words or []
        self.is_final = is_final
        self.word_times_measured = word_times_measured
        self.measured_confidence = measured_confidence


class SttProvider(Protocol):
    """Abstract interface for speech-to-text services."""

    async def transcribe(self, audio_bytes: bytes, mime_type: str = "audio/webm") -> SttResult:
        """Transcribe audio bytes and return transcript with confidence."""
        ...


class FakeSttProvider:
    """
    Fake STT provider for development and testing (D-08).

    Returns plausible English responses with high confidence.
    Used when STT_PROVIDER=fake (default in dev).
    """

    _FAKE_RESPONSES = [
        "Hello Alex, I'm glad to practice English with you today.",
        "I usually enjoy traveling to beach cities because the weather is warm and relaxing.",
        "In my free time, I like listening to music and cooking dinner with my family.",
        "My daily work involves planning software projects and communicating with my teammates.",
    ]
    _counter: int = 0

    async def transcribe(self, audio_bytes: bytes, mime_type: str = "audio/webm") -> SttResult:  # noqa: ARG002
        idx = FakeSttProvider._counter % len(self._FAKE_RESPONSES)
        FakeSttProvider._counter += 1
        transcript = self._FAKE_RESPONSES[idx]

        words_list = transcript.split()
        word_count = len(words_list)
        duration = word_count / 130 * 60  # ~130 wpm

        word_timings = [
            WordTiming(
                word=w,
                start_ms=int(i * 350),
                end_ms=int((i + 1) * 350),
                confidence=0.92,
            )
            for i, w in enumerate(words_list)
        ]

        return SttResult(
            transcript=transcript,
            confidence=0.92,
            speaking_duration_seconds=duration,
            words=word_timings,
            is_final=True,
            word_times_measured=True,
            measured_confidence=0.92,
        )


class DeepgramSttProvider:
    """
    Deepgram Nova-2 implementation for Speech-to-Text.
    Activated when STT_PROVIDER=deepgram and DEEPGRAM_API_KEY is configured.
    """

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        self.api_url = "https://api.deepgram.com/v1/listen"

    async def transcribe(self, audio_bytes: bytes, mime_type: str = "audio/webm") -> SttResult:
        if not audio_bytes:
            return SttResult(transcript="", confidence=0.0, speaking_duration_seconds=0.0, words=[])

        params = {
            "model": "nova-2",
            "smart_format": "true",
            "filler_words": "true",
            "punctuate": "true",
            "language": "en",
        }
        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": mime_type or "audio/webm",
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                self.api_url, params=params, headers=headers, content=audio_bytes
            )
            resp.raise_for_status()
            data = resp.json()

        try:
            channel = data["results"]["channels"][0]
            alt = channel["alternatives"][0]
            transcript = alt.get("transcript", "")
            measured_confidence = alt.get("confidence")
            confidence = float(measured_confidence) if measured_confidence is not None else 0.0

            words_data = alt.get("words", [])
            word_timings = [
                WordTiming(
                    word=w.get("word", ""),
                    start_ms=int(w.get("start", 0) * 1000),
                    end_ms=int(w.get("end", 0) * 1000),
                    confidence=float(w.get("confidence", 0.0)),
                )
                for w in words_data
            ]

            duration = 0.0
            if word_timings:
                duration = max(0.0, (word_timings[-1].end_ms - word_timings[0].start_ms) / 1000.0)

            return SttResult(
                transcript=transcript,
                confidence=confidence,
                speaking_duration_seconds=duration,
                words=word_timings,
                is_final=True,
                word_times_measured=True,
                measured_confidence=confidence if measured_confidence is not None else None,
            )
        except (KeyError, IndexError):
            return SttResult(transcript="", confidence=0.0, speaking_duration_seconds=0.0, words=[])


class GroqSttProvider:
    """
    Groq Cloud Whisper implementation for ultra-fast, free-tier Speech-to-Text.
    Whisper Large v3 (whisper-large-v3) with generous free tier (groq.com).
    """

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        self.api_url = "https://api.groq.com/openai/v1/audio/transcriptions"

    async def transcribe(self, audio_bytes: bytes, mime_type: str = "audio/webm") -> SttResult:
        if not audio_bytes:
            return SttResult(transcript="", confidence=0.0, speaking_duration_seconds=0.0, words=[])

        ext = "webm" if "webm" in mime_type else "mp4"
        files = {
            "file": (f"audio.{ext}", audio_bytes, mime_type or "audio/webm"),
        }
        data = {
            "model": "whisper-large-v3",
            "response_format": "verbose_json",
            "timestamp_granularities[]": "word",
            "language": "en",
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(self.api_url, data=data, files=files, headers=headers)
            resp.raise_for_status()
            res_data = resp.json()

        transcript = res_data.get("text", "").strip()
        duration = float(res_data.get("duration", 0.0))
        words = [
            WordTiming(
                word=item.get("word", ""),
                start_ms=round(float(item["start"]) * 1000),
                end_ms=round(float(item["end"]) * 1000),
                confidence=0.0,
            )
            for item in res_data.get("words", [])
            if item.get("start") is not None and item.get("end") is not None
        ]
        return SttResult(
            transcript=transcript,
            confidence=0.0,
            speaking_duration_seconds=duration,
            words=words,
            word_times_measured=True,
        )


def get_stt_provider() -> SttProvider:
    """Factory function resolving active STT provider from settings."""
    settings = get_settings()
    stt_choice = settings.STT_PROVIDER.lower()

    groq_key = getattr(settings, "GROQ_API_KEY", "")
    if stt_choice == "groq" and groq_key:
        return GroqSttProvider(api_key=groq_key)

    deepgram_key = getattr(settings, "DEEPGRAM_API_KEY", "")
    if stt_choice == "deepgram" and deepgram_key:
        return DeepgramSttProvider(api_key=deepgram_key)

    return FakeSttProvider()
