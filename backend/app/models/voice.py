from pydantic import BaseModel, Field


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text to synthesize to speech")
    voice: str = Field("vi-VN-HoaiMyNeural", description="Voice identifier")


class TTSResponse(BaseModel):
    audio_b64: str = Field(..., description="Base64 encoded MP3 audio")
    voice: str = Field(..., description="Voice used")
    text: str = Field(..., description="Original text")
    content_type: str = Field("audio/mpeg", description="MIME type")
