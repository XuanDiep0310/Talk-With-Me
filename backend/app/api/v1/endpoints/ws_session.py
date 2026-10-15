"""
WebSocket handler for realtime practice sessions (/api/v1/ws/sessions/{session_id}?ticket=).
Supports AI Coach (Sprint 3) and reusable for Scenario Roleplay (Sprint 5) and Voice Rooms.

Features:
  - Ticket-based one-time authentication via Redis.
  - Binary audio streaming proxy to SttProvider (never stored to disk).
  - Live Script streaming (session.state, transcript.partial, transcript.final, ai.speaking, ai.message).
  - Communication-First turn taking: hesitations and filler words (um, uh) do not end user turn.
  - Reconnection resilience: buffers sequence numbers, syncs via lastSeq, transitions to RECONNECTING.
  - Graceful cleanup: terminates background tasks, cleans audio buffers on close.
"""

import asyncio
import contextlib
import json
import logging
import uuid
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.config import get_settings
from app.core.database import async_session_factory
from app.core.providers.llm_provider import get_llm_provider
from app.core.providers.stt_provider import get_stt_provider
from app.core.redis import get_redis_client
from app.models.session import TranscriptSegment
from app.repositories.session import SessionRepository, TranscriptRepository
from app.services.session_state_machine import (
    InvalidSessionStateTransitionError,
    SessionState,
    SessionStateMachine,
)
from app.services.turn_taking_policy import TurnTakingPolicy
from app.services.ws_ticket import WsTicketService

logger = logging.getLogger(__name__)


async def _async_retry(
    coro_fn: Any,
    *args: Any,
    max_attempts: int = 3,
    initial_delay: float = 0.2,
    **kwargs: Any,
) -> Any:
    delay = initial_delay
    last_exc: Exception | None = None
    for attempt in range(max_attempts):
        try:
            return await coro_fn(*args, **kwargs)
        except Exception as exc:
            last_exc = exc
            if attempt == max_attempts - 1:
                break
            await asyncio.sleep(delay)
            delay *= 2
    if last_exc:
        raise last_exc


logger = logging.getLogger(__name__)

router = APIRouter()
settings = get_settings()
turn_policy = TurnTakingPolicy(default_silence_threshold_ms=settings.TURN_TAKING_SILENCE_MS)


async def _handle_timeout_after_disconnect(session_id: uuid.UUID, timeout_seconds: int) -> None:
    """Background task to transition RECONNECTING session to ENDED if timeout expires."""
    await asyncio.sleep(timeout_seconds)
    async with async_session_factory() as db:
        repo = SessionRepository(db)
        sess = await repo.get_by_id(session_id)
        if sess and sess.status == SessionState.RECONNECTING.value:
            try:
                SessionStateMachine.transition(SessionState.RECONNECTING, SessionState.ENDING)
                SessionStateMachine.transition(SessionState.ENDING, SessionState.ENDED)
            except Exception:
                pass
            sess.status = SessionState.ENDED.value
            sess.end_reason = "TIMEOUT"
            await repo.save(sess)
            logger.info("Session %s ended due to reconnection timeout.", session_id)


@router.websocket("/ws/sessions/{session_id}")
async def session_websocket_endpoint(
    websocket: WebSocket,
    session_id: uuid.UUID,
    ticket: str | None = Query(None),
    last_seq: int = Query(0, alias="lastSeq"),
) -> None:
    await websocket.accept()

    # 1. Authenticate one-time ticket
    redis = get_redis_client()
    user_id: uuid.UUID | None = None
    try:
        ticket_service = WsTicketService(redis)
        if ticket:
            user_id = await ticket_service.consume_ticket(ticket)
    finally:
        await redis.aclose()

    if not user_id:
        await websocket.send_json(
            {
                "type": "error",
                "code": "INVALID_WS_TICKET",
                "message": "Invalid or expired WebSocket authentication ticket",
            }
        )
        await websocket.close(code=4003)
        return

    # 2. Verify session ownership and lifecycle state
    async with async_session_factory() as db:
        session_repo = SessionRepository(db)
        transcript_repo = TranscriptRepository(db)
        session = await session_repo.get_by_id(session_id)

        if not session or session.user_id != user_id:
            await websocket.send_json(
                {
                    "type": "error",
                    "code": "SESSION_NOT_FOUND",
                    "message": "Session not found or access denied",
                }
            )
            await websocket.close(code=4004)
            return

        # Transition session to ACTIVE if CREATED or RECONNECTING
        current_status = session.status
        if current_status in (SessionState.CREATED.value, SessionState.RECONNECTING.value):
            try:
                SessionStateMachine.transition(current_status, SessionState.ACTIVE)
                session.status = SessionState.ACTIVE.value
                await session_repo.save(session)
            except InvalidSessionStateTransitionError as exc:
                await websocket.send_json(
                    {
                        "type": "error",
                        "code": "INVALID_STATE",
                        "message": str(exc),
                    }
                )
                await websocket.close(code=4000)
                return

    # Notify client of active session
    await websocket.send_json({"type": "session.state", "state": SessionState.ACTIVE.value})

    # Resync missing transcripts if client provided lastSeq or reconnected
    async with async_session_factory() as db:
        transcript_repo = TranscriptRepository(db)
        missed = await transcript_repo.list_by_session(session_id, after_seq=last_seq)
        for seg in missed:
            await websocket.send_json(
                {
                    "type": "transcript.final",
                    "speaker": seg.speaker,
                    "segmentId": seg.id,
                    "text": seg.text,
                    "confidence": seg.confidence,
                    "seq": seg.seq,
                    "startMs": seg.start_ms,
                    "endMs": seg.end_ms,
                }
            )

    # Providers
    stt_provider = get_stt_provider()
    llm_provider = get_llm_provider()

    # Send initial suggested replies for the opening message
    try:
        async with async_session_factory() as db:
            s_init = await SessionRepository(db).get_by_id(session_id)
            if s_init:
                u_lvl = s_init.level
                t_title = s_init.topic.title if s_init.topic else "Daily Conversation"
                t_min = s_init.topic.min_level if s_init.topic else "A1"
                all_segs = await TranscriptRepository(db).list_by_session(session_id)
                last_q = "Could you start by telling me a little about yourself or your thoughts on this topic?"
                for s_item in reversed(all_segs):
                    if s_item.speaker == "AI":
                        last_q = s_item.text
                        break
                init_suggs = await llm_provider.generate_suggested_replies(
                    history=[],
                    last_ai_message=last_q,
                    user_level=u_lvl,
                    topic_title=t_title,
                    topic_min_level=t_min,
                )
                if init_suggs:
                    await websocket.send_json({"type": "ai.suggestions", "suggestions": init_suggs})
    except Exception as init_err:
        logger.warning("Initial suggestions generation fallback: %s", init_err)

    # Session in-memory state
    audio_buffer = bytearray()
    current_segment_id = str(uuid.uuid4())
    current_user_text = ""
    is_session_active = True

    try:
        while is_session_active:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                logger.info("Client initiated disconnect for session %s", session_id)
                break

            if "bytes" in message and message["bytes"]:
                raw_bytes = message["bytes"]
                # Rule: accept audio only when session status is ACTIVE
                async with async_session_factory() as db:
                    sess = await SessionRepository(db).get_by_id(session_id)
                    if not sess or sess.status != SessionState.ACTIVE.value:
                        continue

                audio_buffer.extend(raw_bytes)

                # Only emit interim transcript if we have actual partial speech text
                if current_user_text:
                    await websocket.send_json(
                        {
                            "type": "transcript.partial",
                            "speaker": "USER",
                            "segmentId": current_segment_id,
                            "text": f"{current_user_text}...",
                            "startMs": 0,
                        }
                    )

            elif "text" in message and message["text"]:
                data = json.loads(message["text"])
                msg_type = data.get("type", "")

                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})

                elif msg_type == "user.speech_start":
                    current_segment_id = data.get("segmentId") or str(uuid.uuid4())
                    audio_buffer.clear()
                    current_user_text = ""

                elif msg_type in ("user.speech_end", "user.text"):
                    if data.get("segmentId"):
                        current_segment_id = data.get("segmentId")
                    # Extract text: either from STT of audio buffer, or directly from user.text message
                    user_text = ""
                    confidence = 0.95

                    if msg_type == "user.text":
                        user_text = data.get("text", "").strip()
                    elif audio_buffer:
                        # Process audio buffer with retry backoff
                        try:
                            stt_res = await _async_retry(
                                stt_provider.transcribe, bytes(audio_buffer)
                            )
                            user_text = stt_res.transcript.strip()
                            confidence = stt_res.confidence
                        except Exception as exc:
                            logger.warning("STT transcription failed after retries: %s", exc)
                            await websocket.send_json(
                                {
                                    "type": "error",
                                    "code": "STT_TIMEOUT",
                                    "message": "Voice recognition took too long, please try speaking again.",
                                }
                            )
                        audio_buffer.clear()

                    if not user_text:
                        continue

                    # Turn-taking check: If ending with filler, do not close turn
                    if turn_policy.ends_with_filler(user_text):
                        current_user_text = user_text
                        await websocket.send_json(
                            {
                                "type": "transcript.partial",
                                "speaker": "USER",
                                "segmentId": current_segment_id,
                                "text": user_text,
                                "startMs": 0,
                            }
                        )
                        continue

                    # Pre-translate user speech immediately so translation is ready with 0 wait time
                    user_translation = ""
                    with contextlib.suppress(Exception):
                        user_translation = await llm_provider.translate_text(user_text)

                    # 1. Save USER transcript segment (idempotent)
                    user_seq = 1
                    async with async_session_factory() as db:
                        t_repo = TranscriptRepository(db)
                        s_repo = SessionRepository(db)
                        sess = await s_repo.get_by_id(session_id)
                        max_seq = await t_repo.get_max_seq(session_id)
                        user_seq = max_seq + 1

                        user_segment = TranscriptSegment(
                            pk=uuid.uuid4(),
                            id=current_segment_id,
                            session_id=session_id,
                            speaker="USER",
                            user_id=user_id,
                            text=user_text,
                            start_ms=0,
                            end_ms=max(1000, len(user_text.split()) * 350),
                            confidence=confidence,
                            is_final=True,
                            seq=user_seq,
                        )
                        await t_repo.add_segment(user_segment)

                        # Update session spoken duration
                        if sess:
                            sess.spoken_seconds += user_segment.end_ms / 1000.0
                            await s_repo.save(sess)

                    await websocket.send_json(
                        {
                            "type": "transcript.final",
                            "speaker": "USER",
                            "segmentId": current_segment_id,
                            "text": user_text,
                            "translation": user_translation,
                            "confidence": confidence,
                            "seq": user_seq,
                            "startMs": 0,
                            "endMs": user_segment.end_ms,
                        }
                    )

                    # 2. Trigger AI turn
                    await websocket.send_json({"type": "ai.speaking", "isSpeaking": True})

                    ai_reply = ""
                    user_level = "A1"
                    topic_title = "Daily Life"
                    topic_min_level = "A1"
                    try:
                        async with async_session_factory() as db:
                            s_repo = SessionRepository(db)
                            sess = await s_repo.get_by_id(session_id)
                            user_level = sess.level if sess else "A1"
                            topic_title = sess.topic.title if sess and sess.topic else "Daily Life"
                            topic_min_level = sess.topic.min_level if sess and sess.topic else "A1"

                            # Fetch recent dialogue turns for LLM context
                            all_transcripts = await TranscriptRepository(db).list_by_session(
                                session_id
                            )
                            history = [
                                {
                                    "role": "user" if t.speaker == "USER" else "model",
                                    "content": t.text,
                                }
                                for t in all_transcripts[-6:]
                            ]

                        # Call LLM with retry
                        ai_reply = await _async_retry(
                            llm_provider.generate_coach_reply,
                            history,
                            user_text,
                            user_level,
                            topic_title,
                            topic_min_level,
                        )
                    except Exception as err:
                        logger.error("LLM reply generation error: %s", err)
                        ai_reply = "I see! Could you tell me a little bit more about that?"

                    # Pre-generate translation and suggested replies concurrently
                    ai_translation = ""
                    suggestions: list[dict[str, str]] = []
                    try:
                        ai_translation, suggestions = await asyncio.gather(
                            llm_provider.translate_text(ai_reply),
                            llm_provider.generate_suggested_replies(
                                history=history,
                                last_ai_message=ai_reply,
                                user_level=user_level,
                                topic_title=topic_title,
                                topic_min_level=topic_min_level,
                            ),
                        )
                    except Exception as trans_err:
                        logger.warning(
                            "Error pre-generating translation or suggestions: %s", trans_err
                        )

                    # 3. Save AI transcript segment
                    ai_segment_id = str(uuid.uuid4())
                    ai_seq = user_seq + 1
                    async with async_session_factory() as db:
                        t_repo = TranscriptRepository(db)
                        ai_segment = TranscriptSegment(
                            pk=uuid.uuid4(),
                            id=ai_segment_id,
                            session_id=session_id,
                            speaker="AI",
                            user_id=None,
                            text=ai_reply,
                            start_ms=0,
                            end_ms=max(1000, len(ai_reply.split()) * 300),
                            confidence=1.0,
                            is_final=True,
                            seq=ai_seq,
                        )
                        await t_repo.add_segment(ai_segment)

                    await websocket.send_json(
                        {
                            "type": "ai.message",
                            "segmentId": ai_segment_id,
                            "text": ai_reply,
                            "translation": ai_translation,
                            "seq": ai_seq,
                        }
                    )
                    if suggestions:
                        await websocket.send_json(
                            {
                                "type": "ai.suggestions",
                                "suggestions": suggestions,
                            }
                        )
                    await websocket.send_json({"type": "ai.speaking", "isSpeaking": False})

                    # Reset for next turn
                    current_segment_id = str(uuid.uuid4())
                    current_user_text = ""

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for session %s", session_id)
    except Exception as exc:
        logger.error("Unexpected WebSocket error for session %s: %s", session_id, exc)
    finally:
        # Reconnection resilience: transition to RECONNECTING if session was ACTIVE
        async with async_session_factory() as db:
            s_repo = SessionRepository(db)
            sess = await s_repo.get_by_id(session_id)
            if sess and sess.status == SessionState.ACTIVE.value:
                try:
                    SessionStateMachine.transition(SessionState.ACTIVE, SessionState.RECONNECTING)
                    sess.status = SessionState.RECONNECTING.value
                    await s_repo.save(sess)
                    # Launch background timeout
                    asyncio.create_task(
                        _handle_timeout_after_disconnect(
                            session_id, settings.SESSION_RECONNECT_TIMEOUT_SECONDS
                        )
                    )
                except Exception as err:
                    logger.warning("Could not transition to RECONNECTING: %s", err)

        # Cleanup memory buffer
        audio_buffer.clear()
