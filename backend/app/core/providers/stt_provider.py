"""
STT (Speech-to-Text) provider interface and implementations.

In production, replace FakeSttProvider with a real cloud STT service.
All providers implement the SttProvider protocol.
"""

from typing import Protocol


class SttResult:
    """Result from STT transcription."""

    __slots__ = ("transcript", "confidence", "speaking_duration_seconds")

    def __init__(
        self,
        transcript: str,
        confidence: float,
        speaking_duration_seconds: float,
    ) -> None:
        self.transcript = transcript
        self.confidence = confidence  # 0.0–1.0
        self.speaking_duration_seconds = speaking_duration_seconds


class SttProvider(Protocol):
    """Abstract interface for speech-to-text services."""

    async def transcribe(self, audio_bytes: bytes, mime_type: str) -> SttResult:
        """Transcribe audio bytes and return transcript with confidence."""
        ...


class FakeSttProvider:
    """
    Fake STT provider for development and testing (D-08).

    Returns a plausible English response with high confidence.
    Used when STT_PROVIDER=fake (default in dev).
    """

    _FAKE_TRANSCRIPT = (
        "I think traveling is a great way to learn about different cultures. "
        "I really enjoyed my last trip because I got to try new foods and meet interesting people."
    )

    async def transcribe(self, audio_bytes: bytes, mime_type: str) -> SttResult:  # noqa: ARG002
        # Word count based on fake transcript
        word_count = len(self._FAKE_TRANSCRIPT.split())
        # Estimate duration: ~130 words/minute average speaking rate
        duration = word_count / 130 * 60
        return SttResult(
            transcript=self._FAKE_TRANSCRIPT,
            confidence=0.92,
            speaking_duration_seconds=duration,
        )
