"""WebSocket handler for AI Coach (continuous VAD + barge-in) and Roleplay sessions."""

from __future__ import annotations

import asyncio
import base64
import contextlib
import json
import logging
import os
import uuid
from datetime import UTC
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.core.clock import get_clock
from app.core.config import get_settings
from app.core.database import async_session_factory
from app.core.exceptions import ProviderUnavailableError
from app.core.providers.llm_provider import get_llm_provider
from app.core.providers.speech_assessment_provider import get_speech_assessment_provider
from app.core.providers.tts_provider import get_tts_provider
from app.core.redis import get_redis_client
from app.core.ws_manager import session_ws_manager
from app.models.auth import User, UserSettings
from app.models.session import Session, TranscriptSegment
from app.repositories.scenario import ScenarioRepository
from app.repositories.session import SessionRepository, TranscriptRepository
from app.services.adaptive_path import AdaptivePathService
from app.services.session_state_machine import (
    InvalidSessionStateTransitionError,
    SessionState,
    SessionStateMachine,
)
from app.services.speech_features import apply_speech_features
from app.services.turn_taking_policy import TurnTakingPolicy
from app.services.ws_ticket import WsTicketService

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()
turn_policy = TurnTakingPolicy(default_silence_threshold_ms=settings.TURN_TAKING_SILENCE_MS)


async def _async_retry(
    coro_fn: Any, *args: Any, max_attempts: int = 2, initial_delay: float = 0.2, **kwargs: Any
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


async def _handle_timeout_after_disconnect(session_id: uuid.UUID, timeout_seconds: int) -> None:
    await asyncio.sleep(timeout_seconds)
    async with async_session_factory() as db:
        repo = SessionRepository(db)
        sess = await repo.get_by_id(session_id)
        if sess and sess.status == SessionState.RECONNECTING.value:
            with contextlib.suppress(Exception):
                SessionStateMachine.transition(SessionState.RECONNECTING, SessionState.ENDING)
                SessionStateMachine.transition(SessionState.ENDING, SessionState.ENDED)
            sess.status = SessionState.ENDED.value
            sess.end_reason = "TIMEOUT"
            await repo.save(sess)


async def _synthesize_inline_tts(text: str, voice_pref: str = "female") -> str | None:
    """Synthesize short AI Coach reply to Base64 MP3 for zero-lag WS delivery."""
    if not text or settings.ENVIRONMENT == "test" or os.environ.get("PYTEST_CURRENT_TEST"):
        return None
    voice = "en-US-GuyNeural" if voice_pref == "male" else "en-US-JennyNeural"
    try:
        tts = get_tts_provider()
        audio_bytes = await asyncio.wait_for(tts.synthesize(text=text, voice=voice), timeout=4.0)
        if audio_bytes:
            return base64.b64encode(audio_bytes).decode("ascii")
    except Exception as exc:
        logger.debug("Inline WS TTS skipped (%s)", type(exc).__name__)
    return None


@router.websocket("/ws/sessions/{session_id}")
async def session_websocket_endpoint(
    websocket: WebSocket,
    session_id: uuid.UUID,
    ticket: str | None = Query(None),
    last_seq: int = Query(0, alias="lastSeq"),
) -> None:
    await websocket.accept()

    redis = get_redis_client()
    identity: tuple[uuid.UUID, int] | None = None
    try:
        if ticket:
            identity = await WsTicketService(redis).consume_ticket(ticket)
    finally:
        await redis.aclose()

    if identity is None:
        await websocket.send_json(
            {
                "type": "error",
                "code": "INVALID_WS_TICKET",
                "message": "Invalid or expired WebSocket ticket",
            }
        )
        await websocket.close(code=4003)
        return

    user_id, auth_version = identity

    async with async_session_factory() as db:
        session_repo = SessionRepository(db)
        session = await session_repo.get_by_id(session_id)
        active = await db.scalar(
            select(User.is_active).where(User.id == user_id, User.auth_version == auth_version)
        )
        if not active or not session or session.user_id != user_id:
            await websocket.send_json(
                {
                    "type": "error",
                    "code": "SESSION_NOT_FOUND",
                    "message": "Session not found or access denied",
                }
            )
            await websocket.close(code=4004)
            return

        latest_ai_seg = next((s for s in reversed(session.transcripts) if s.speaker == "AI"), None)
        latest_ai_id = latest_ai_seg.id if latest_ai_seg else None
        latest_ai_text = latest_ai_seg.text if latest_ai_seg else ""
        session_type = session.type
        if session.status in (SessionState.CREATED.value, SessionState.RECONNECTING.value):
            try:
                was_created = session.status == SessionState.CREATED.value
                SessionStateMachine.transition(session.status, SessionState.ACTIVE)
                session.status = SessionState.ACTIVE.value
                if was_created:
                    session.started_at = get_clock().now()
                await session_repo.save(session)
            except InvalidSessionStateTransitionError as exc:
                await websocket.send_json(
                    {"type": "error", "code": "INVALID_STATE", "message": str(exc)}
                )
                await websocket.close(code=4000)
                return

        started_at = session.started_at or get_clock().now()
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=UTC)

    session_ws_manager.register(session_id, websocket)

    voice_pref = "female"
    speed_pref = "normal"
    learner_directives: str | None = None
    async with async_session_factory() as db:
        u_settings = (
            await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
        ).scalar_one_or_none()
        if u_settings:
            voice_pref = u_settings.ai_voice or "female"
            speed_pref = u_settings.speech_speed or "normal"
        learner_directives = await AdaptivePathService(db).get_coach_directives(user_id)

    interaction_mode = "continuous" if session_type == "COACH" else "push_to_talk"
    await websocket.send_json(
        {
            "type": "session.state",
            "state": SessionState.ACTIVE.value,
            "interactionMode": interaction_mode,
            "aiVoice": voice_pref,
            "speechSpeed": speed_pref,
        }
    )

    async with async_session_factory() as db:
        missed = await TranscriptRepository(db).list_by_session(session_id, after_seq=last_seq)
        opening_audio_b64: str | None = None
        if interaction_mode == "continuous" and len(missed) == 1 and missed[0].speaker == "AI":
            opening_audio_b64 = await _synthesize_inline_tts(missed[0].text, voice_pref)
        for idx, seg in enumerate(missed):
            payload_msg: dict[str, Any] = {
                "type": "transcript.final",
                "speaker": seg.speaker,
                "segmentId": seg.id,
                "text": seg.text,
                "confidence": seg.confidence,
                "seq": seg.seq,
                "startMs": seg.start_ms,
                "endMs": seg.end_ms,
            }
            if idx == 0 and opening_audio_b64:
                payload_msg["audioB64"] = opening_audio_b64
                payload_msg["audioMimeType"] = "audio/mpeg"
            await websocket.send_json(payload_msg)

    try:
        speech_provider = get_speech_assessment_provider()
        llm_provider = get_llm_provider()
    except ProviderUnavailableError as exc:
        detail: dict[str, Any] = exc.detail if isinstance(exc.detail, dict) else {}
        await websocket.send_json(
            {
                "type": "error",
                "code": detail.get("code", "PROVIDER_UNAVAILABLE"),
                "message": detail.get("message", "Provider unavailable"),
            }
        )
        await websocket.close(code=4005)
        return

    # Non-blocking initial suggestions in background
    async def _send_initial_suggestions() -> None:
        try:
            async with async_session_factory() as db:
                s_init = await SessionRepository(db).get_by_id(session_id)
                if not s_init:
                    return
                t_title = s_init.coach_title("Daily Conversation")
                t_min = s_init.coach_min_level()
                if s_init.type == "ROLEPLAY" and s_init.scenario_id:
                    scen = await ScenarioRepository(db).get_by_id(s_init.scenario_id)
                    if scen:
                        t_title, t_min = scen.title_en, scen.level
                suggs = await llm_provider.generate_suggested_replies(
                    history=[],
                    last_ai_message=latest_ai_text or "Could you introduce yourself?",
                    user_level=s_init.level,
                    topic_title=t_title,
                    topic_min_level=t_min,
                )
                if suggs:
                    await websocket.send_json({"type": "ai.suggestions", "suggestions": suggs})
        except Exception:
            pass

    asyncio.create_task(_send_initial_suggestions())

    audio_buffer = bytearray()
    audio_mime_type = "audio/pcm" if interaction_mode == "continuous" else "audio/webm"
    current_segment_id = str(uuid.uuid4())
    capture_offset_ms: int | None = None
    playback_end_ms: int | None = None
    playback_eligible = latest_ai_id is not None
    interruption_context: dict[str, Any] | None = None
    barge_in_flag = False
    last_partial_bytes = 0
    partial_in_flight = False
    finalized_segments: set[str] = set()

    async def _emit_live_user_partial(
        raw_snap: bytes,
        seg_id: str,
        snap_offset_ms: int,
        snap_mime: str,
    ) -> None:
        nonlocal partial_in_flight
        try:
            fast_stt = getattr(speech_provider, "transcribe_fast", None)
            if callable(fast_stt):
                partial_text = await fast_stt(raw_snap, mime_type=snap_mime)
            else:
                res = await speech_provider.assess(raw_snap, reference_text="", mime_type=snap_mime)
                partial_text = res.transcript.strip()
            if partial_text and seg_id not in finalized_segments and current_segment_id == seg_id:
                await websocket.send_json(
                    {
                        "type": "transcript.partial",
                        "speaker": "USER",
                        "segmentId": seg_id,
                        "text": partial_text,
                        "seq": 999999,
                        "startMs": snap_offset_ms,
                    }
                )
        except Exception:
            pass
        finally:
            partial_in_flight = False

    try:
        while True:
            try:
                message = await asyncio.wait_for(websocket.receive(), timeout=5)
            except TimeoutError:
                message = {}
            async with async_session_factory() as db:
                session_status = await db.scalar(
                    select(Session.status)
                    .join(User, User.id == Session.user_id)
                    .where(
                        Session.id == session_id,
                        User.id == user_id,
                        User.auth_version == auth_version,
                        User.is_active.is_(True),
                    )
                )
            if session_status is None:
                await websocket.close(code=4003)
                break
            if not message:
                continue

            offset_ms = max(0, int((get_clock().now() - started_at).total_seconds() * 1000))
            if message.get("type") == "websocket.disconnect":
                break

            if "bytes" in message and message["bytes"]:
                if session_status != SessionState.ACTIVE.value:
                    audio_buffer.clear()
                    continue
                if capture_offset_ms is None:
                    capture_offset_ms = offset_ms
                audio_buffer.extend(message["bytes"])
                if (
                    interaction_mode == "continuous"
                    and not partial_in_flight
                    and 22_400 <= len(audio_buffer) <= 448_000
                    and (len(audio_buffer) - last_partial_bytes) >= 22_400
                ):
                    last_partial_bytes = len(audio_buffer)
                    partial_in_flight = True
                    asyncio.create_task(
                        _emit_live_user_partial(
                            bytes(audio_buffer),
                            current_segment_id,
                            capture_offset_ms or offset_ms,
                            audio_mime_type,
                        )
                    )
                continue

            if "text" not in message or not message["text"]:
                continue

            data = json.loads(message["text"])
            msg_type = data.get("type", "")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            elif session_status != SessionState.ACTIVE.value:
                audio_buffer.clear()
            elif msg_type == "ai.playback_end":
                if playback_eligible and data.get("segmentId") == latest_ai_id:
                    playback_end_ms = offset_ms
                    playback_eligible = False
            elif msg_type == "user.barge_in":
                barge_in_flag = True
                playback_eligible = False
                playback_end_ms = None
                current_segment_id = data.get("segmentId") or str(uuid.uuid4())
                audio_buffer.clear()
                last_partial_bytes = 0
                capture_offset_ms = offset_ms
                if data.get("mimeType"):
                    audio_mime_type = str(data["mimeType"])
                interruption_context = {
                    "interrupted_text": latest_ai_text,
                    "spoken_ratio": float(data.get("spokenRatio", 0.5)),
                    "interrupted_at_ms": int(data.get("interruptedAtMs", 0)),
                }
                await websocket.send_json(
                    {
                        "type": "ai.interrupted",
                        "interruptedAiSegmentId": data.get("interruptedAiSegmentId"),
                    }
                )
            elif msg_type == "user.speech_start":
                current_segment_id = data.get("segmentId") or str(uuid.uuid4())
                if data.get("mimeType"):
                    audio_mime_type = str(data["mimeType"])
                audio_buffer.clear()
                last_partial_bytes = 0
                capture_offset_ms = offset_ms
            elif msg_type in ("user.speech_end", "user.text"):
                if data.get("segmentId"):
                    current_segment_id = str(data["segmentId"])
                finalized_segments.add(current_segment_id)
                last_partial_bytes = 0
                if data.get("mimeType"):
                    audio_mime_type = str(data["mimeType"])

                user_text = ""
                stt_res = None
                if msg_type == "user.text":
                    audio_buffer.clear()
                    user_text = str(data.get("text", "")).strip()
                elif audio_buffer:
                    raw_audio = bytes(audio_buffer)
                    audio_buffer.clear()
                    try:
                        stt_res = await speech_provider.assess(
                            raw_audio,
                            reference_text="",
                            mime_type=audio_mime_type,
                        )
                        user_text = stt_res.transcript.strip()
                    except ProviderUnavailableError as exc:
                        detail = exc.detail if isinstance(exc.detail, dict) else {}
                        await websocket.send_json(
                            {
                                "type": "error",
                                "code": detail.get("code", "SPEECH_ASSESSMENT_UNAVAILABLE"),
                                "message": detail.get(
                                    "message", "Dịch vụ giọng nói tạm thời không khả dụng."
                                ),
                            }
                        )
                        continue
                    except Exception as exc:
                        logger.warning("Speech assessment failed: %s", type(exc).__name__)
                        await websocket.send_json(
                            {
                                "type": "error",
                                "code": "STT_TIMEOUT",
                                "message": "Không thể nhận diện giọng nói lúc này, vui lòng nói lại.",
                            }
                        )
                        continue

                if not user_text:
                    continue

                continues_turn = turn_policy.ends_with_filler(user_text)
                user_segment = TranscriptSegment(
                    pk=uuid.uuid4(),
                    id=current_segment_id,
                    session_id=session_id,
                    speaker="USER",
                    user_id=user_id,
                    text=user_text,
                    start_ms=capture_offset_ms or 0,
                    end_ms=capture_offset_ms or 0,
                    is_final=True,
                )
                apply_speech_features(
                    user_segment,
                    stt=stt_res,
                    capture_offset_ms=capture_offset_ms,
                    playback_end_ms=playback_end_ms,
                    pause_threshold_ms=settings.PAUSE_THRESHOLD_MS,
                    modality="UNSCRIPTED",
                    is_barge_in=barge_in_flag,
                )
                barge_in_flag = False

                async with async_session_factory() as db:
                    saved, inserted = await TranscriptRepository(db).add_active_segment(
                        user_segment, user_id, auth_version=auth_version
                    )
                if saved is None:
                    continue

                await websocket.send_json(
                    {
                        "type": "transcript.final",
                        "speaker": "USER",
                        "segmentId": saved.id,
                        "text": saved.text,
                        "confidence": saved.confidence,
                        "seq": saved.seq,
                        "startMs": saved.start_ms,
                        "endMs": saved.end_ms,
                        "continuesTurn": continues_turn or not inserted,
                    }
                )
                if not inserted:
                    capture_offset_ms = None
                    continue

                playback_end_ms = None
                playback_eligible = False
                if continues_turn:
                    capture_offset_ms = None
                    current_segment_id = str(uuid.uuid4())
                    continue

                # Critical path: generate AI Coach / Roleplay reply immediately without waiting for translation/scoring
                await websocket.send_json({"type": "ai.speaking", "isSpeaking": True})

                ai_reply = ""
                user_level = "A1"
                topic_title = "Daily Life"
                topic_min_level = "A1"
                history: list[dict[str, str]] = []
                try:
                    async with async_session_factory() as db:
                        sess = await SessionRepository(db).get_by_id(session_id)
                        user_level = sess.level if sess else "A1"
                        topic_title = sess.coach_title("Daily Life") if sess else "Daily Life"
                        topic_min_level = sess.coach_min_level() if sess else "A1"
                        all_transcripts = await TranscriptRepository(db).list_by_session(session_id)
                        history = [
                            {"role": "user" if t.speaker == "USER" else "model", "content": t.text}
                            for t in all_transcripts[:-1][-6:]
                        ]
                        if sess and sess.type == "ROLEPLAY" and sess.scenario_id:
                            scenario = await ScenarioRepository(db).get_by_id(sess.scenario_id)
                            if scenario:
                                topic_title, topic_min_level = scenario.title_en, scenario.level
                                ai_reply = await _async_retry(
                                    llm_provider.generate_roleplay_reply,
                                    history,
                                    user_text,
                                    user_level,
                                    scenario.context,
                                    scenario.ai_role,
                                    scenario.user_role,
                                    scenario.goals or [],
                                    [c.text for c in scenario.chunks],
                                )
                        if not ai_reply:
                            ai_reply = await _async_retry(
                                llm_provider.generate_coach_reply,
                                history,
                                user_text,
                                user_level,
                                topic_title,
                                topic_min_level,
                                interruption_context=interruption_context,
                                learner_directives=learner_directives,
                            )
                            interruption_context = None
                except ProviderUnavailableError as exc:
                    detail = exc.detail if isinstance(exc.detail, dict) else {}
                    await websocket.send_json(
                        {
                            "type": "error",
                            "code": detail.get("code", "AI_SERVICE_UNAVAILABLE"),
                            "message": detail.get("message", "Dịch vụ AI tạm thời không khả dụng."),
                        }
                    )
                    await websocket.send_json({"type": "ai.speaking", "isSpeaking": False})
                    continue

                ai_segment_id = str(uuid.uuid5(session_id, saved.id))
                ai_start_ms = max(0, int((get_clock().now() - started_at).total_seconds() * 1000))
                ai_duration_ms = max(1000, len(ai_reply.split()) * 300)
                async with async_session_factory() as db:
                    ai_segment = TranscriptSegment(
                        pk=uuid.uuid4(),
                        id=ai_segment_id,
                        session_id=session_id,
                        speaker="AI",
                        user_id=None,
                        text=ai_reply,
                        start_ms=ai_start_ms,
                        end_ms=ai_start_ms + ai_duration_ms,
                        is_final=True,
                        speech_source="AI",
                    )
                    stored_ai, _ = await TranscriptRepository(db).add_active_segment(
                        ai_segment, user_id, auth_version=auth_version
                    )
                if stored_ai is None:
                    break

                latest_ai_id = stored_ai.id
                latest_ai_text = ai_reply
                playback_eligible = True

                audio_b64 = await _synthesize_inline_tts(ai_reply, voice_pref)
                ai_payload: dict[str, Any] = {
                    "type": "ai.message",
                    "segmentId": ai_segment_id,
                    "text": ai_reply,
                    "seq": stored_ai.seq,
                    "startMs": stored_ai.start_ms,
                    "endMs": stored_ai.end_ms,
                }
                if audio_b64:
                    ai_payload["audioB64"] = audio_b64
                    ai_payload["audioMimeType"] = "audio/mpeg"

                await websocket.send_json(ai_payload)
                await websocket.send_json({"type": "ai.speaking", "isSpeaking": False})

                # Background non-blocking suggested replies (translations fetched on demand to save LLM quota)
                async def _send_enrichment(
                    a_txt: str,
                    hist: list[dict[str, str]],
                    u_lvl: str,
                    t_ttl: str,
                    t_min: str,
                ) -> None:
                    try:
                        suggs = await llm_provider.generate_suggested_replies(
                            history=hist,
                            last_ai_message=a_txt,
                            user_level=u_lvl,
                            topic_title=t_ttl,
                            topic_min_level=t_min,
                        )
                        if suggs:
                            await websocket.send_json(
                                {"type": "ai.suggestions", "suggestions": suggs}
                            )
                    except Exception:
                        pass

                asyncio.create_task(
                    _send_enrichment(
                        ai_reply,
                        history,
                        user_level,
                        topic_title,
                        topic_min_level,
                    )
                )

                capture_offset_ms = None
                current_segment_id = str(uuid.uuid4())

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for session %s", session_id)
    except Exception as exc:
        logger.error(
            "Unexpected WebSocket error for session %s: %s", session_id, type(exc).__name__
        )
    finally:
        async with async_session_factory() as db:
            s_repo = SessionRepository(db)
            sess = await s_repo.get_by_id(session_id)
            if sess and sess.status == SessionState.ACTIVE.value:
                with contextlib.suppress(Exception):
                    SessionStateMachine.transition(SessionState.ACTIVE, SessionState.RECONNECTING)
                    sess.status = SessionState.RECONNECTING.value
                    await s_repo.save(sess)
                    asyncio.create_task(
                        _handle_timeout_after_disconnect(
                            session_id, settings.SESSION_RECONNECT_TIMEOUT_SECONDS
                        )
                    )
        audio_buffer.clear()
        session_ws_manager.unregister(session_id, websocket)
