import io

import edge_tts

from app.core.exceptions import AppException


class TTSService:
    """Service to handle Microsoft Edge Text-to-Speech generation."""

    DEFAULT_VOICE = "vi-VN-HoaiMyNeural"
    AVAILABLE_VOICES: dict[str, str] = {
        "vi-VN-HoaiMyNeural": "Hoài Mỹ (Nữ - Tiếng Việt)",
        "vi-VN-NamMinhNeural": "Nam Minh (Nam - Tiếng Việt)",
        "en-US-AvaNeural": "Ava (Female - English)",
        "en-US-AndrewNeural": "Andrew (Male - English)",
    }

    async def generate_audio_bytes(self, text: str, voice: str = DEFAULT_VOICE) -> bytes:
        """Generate MP3 audio bytes from given text using Edge-TTS."""
        cleaned_text = text.strip() if text else ""
        if not cleaned_text:
            raise AppException(detail="Text for TTS generation cannot be empty", status_code=400)

        target_voice = voice if voice in self.AVAILABLE_VOICES else self.DEFAULT_VOICE
        try:
            communicate = edge_tts.Communicate(text=cleaned_text, voice=target_voice)
            buffer = io.BytesIO()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    buffer.write(chunk["data"])

            audio_bytes = buffer.getvalue()
            if not audio_bytes:
                raise AppException(detail="Generated audio stream is empty", status_code=500)
            return audio_bytes
        except Exception as e:
            if isinstance(e, AppException):
                raise e
            raise AppException(detail=f"TTS synthesis error: {str(e)}", status_code=500) from e
