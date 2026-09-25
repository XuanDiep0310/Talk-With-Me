import base64
import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import Response

from app.api.deps import get_tts_service
from app.models.voice import TTSRequest, TTSResponse
from app.services.tts import TTSService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["Voice"])


@router.get("/voices", response_model=dict[str, str])
async def list_available_voices(
    tts_service: TTSService = Depends(get_tts_service),
) -> dict[str, str]:
    """Get list of available Edge-TTS voices."""
    return tts_service.AVAILABLE_VOICES


@router.post("/tts", response_model=TTSResponse)
async def generate_tts(
    request: TTSRequest,
    tts_service: TTSService = Depends(get_tts_service),
) -> TTSResponse:
    """REST endpoint to synthesize text to speech returning Base64 MP3."""
    audio_bytes = await tts_service.generate_audio_bytes(text=request.text, voice=request.voice)
    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
    return TTSResponse(
        audio_b64=audio_b64,
        voice=request.voice,
        text=request.text,
        content_type="audio/mpeg",
    )


@router.post("/tts/stream")
async def generate_tts_stream(
    request: TTSRequest,
    tts_service: TTSService = Depends(get_tts_service),
) -> Response:
    """REST endpoint to synthesize text to speech returning direct audio/mpeg Response."""
    audio_bytes = await tts_service.generate_audio_bytes(text=request.text, voice=request.voice)
    return Response(content=audio_bytes, media_type="audio/mpeg")


@router.websocket("/ws")
async def voice_websocket_endpoint(
    websocket: WebSocket,
    tts_service: TTSService = Depends(get_tts_service),
) -> None:
    """WebSocket endpoint for real-time text-to-speech audio streaming.

    Expects JSON input:
      {"type": "generate_tts", "text": "Hello world", "voice": "vi-VN-HoaiMyNeural"}
    Sends JSON output:
      {"type": "audio_response", "audio_b64": "...", "text": "...", "voice": "..."}
    """
    await websocket.accept()
    logger.info("Voice WebSocket connected")
    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                payload: dict[str, Any] = json.loads(raw_data)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON format"})
                continue

            msg_type = payload.get("type", "")
            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            elif msg_type == "generate_tts":
                text = payload.get("text", "")
                voice = payload.get("voice", tts_service.DEFAULT_VOICE)
                if not text:
                    await websocket.send_json(
                        {"type": "error", "message": "Text parameter is required"}
                    )
                    continue
                try:
                    audio_bytes = await tts_service.generate_audio_bytes(text=text, voice=voice)
                    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
                    await websocket.send_json(
                        {
                            "type": "audio_response",
                            "audio_b64": audio_b64,
                            "text": text,
                            "voice": voice,
                            "content_type": "audio/mpeg",
                        }
                    )
                except Exception as exc:
                    await websocket.send_json(
                        {"type": "error", "message": f"TTS synthesis failed: {str(exc)}"}
                    )
            else:
                await websocket.send_json(
                    {"type": "error", "message": f"Unknown message type: {msg_type}"}
                )
    except WebSocketDisconnect:
        logger.info("Voice WebSocket disconnected")
