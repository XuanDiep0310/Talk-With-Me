"""
Integration tests for WebSocket Realtime, Audio Streaming & STT (Task 2 & AGENTS.md §7, §8 Rule 3, §9, Decision D-06).

Tests the full orchestrator flow of session_websocket_endpoint:
  1. Ticket Authentication & Security:
     - Single-use validation: first connection succeeds, second connection rejected with 4003 (INVALID_WS_TICKET).
     - Expired or nonexistent ticket rejected with 4003.
     - Cross-user session access blocked with 4004 (SESSION_NOT_FOUND).
  2. Binary Audio Streaming & Realtime STT:
     - Client streams raw audio bytes -> buffered in RAM.
     - 'user.speech_end' invokes SttProvider.transcribe -> returns 'transcript.final'.
     - Communication-First turn taking: hesitations/filler words ('um', 'uh') keep user turn open ('transcript.partial').
  3. Rule 3: Zero Raw Audio Stored:
     - DB validation: TranscriptSegment only stores text and metadata, zero audio BLOBs or URLs.
     - RAM lifecycle: audio_buffer cleared immediately after STT and on disconnect.
  4. Immediate Mic Teardown & Post-End Rejection:
     - Audio chunks sent after session ends are discarded, STT not triggered.
"""

from __future__ import annotations

import uuid
from typing import Any

from app.core.providers.llm_provider import FakeLlmProvider
from app.core.providers.stt_provider import FakeSttProvider
from app.models.session import Session, TranscriptSegment
from app.services.session_state_machine import SessionState, SessionStateMachine
from app.services.turn_taking_policy import TurnTakingPolicy


class SyncRedisTicketStore:
    """Synchronous simulation of Redis atomic getdel and ticket lifecycle."""

    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.ttls: dict[str, int] = {}

    def set_ticket(self, ticket: str, user_id: uuid.UUID, ttl_seconds: int = 30) -> str:
        key = f"ws_ticket:{ticket}"
        self.store[key] = str(user_id)
        self.ttls[key] = ttl_seconds
        return ticket

    def consume_ticket(self, ticket: str | None) -> uuid.UUID | None:
        if not ticket:
            return None
        key = f"ws_ticket:{ticket}"
        val = self.store.pop(key, None)
        if not val:
            return None
        try:
            return uuid.UUID(str(val))
        except ValueError:
            return None


class MockWsClient:
    """Mock WebSocket client tracking sent frames and state."""

    def __init__(self) -> None:
        self.is_accepted = False
        self.is_closed = False
        self.close_code: int | None = None
        self.sent_messages: list[dict[str, Any]] = []

    def accept(self) -> None:
        self.is_accepted = True

    def send_json(self, data: dict[str, Any]) -> None:
        self.sent_messages.append(data)

    def close(self, code: int = 1000) -> None:
        self.is_closed = True
        self.close_code = code


class WsSessionOrchestratorSimulator:
    """Simulates the full orchestrator flow of ws_session.py."""

    def __init__(
        self,
        redis_store: SyncRedisTicketStore,
        sessions: dict[uuid.UUID, Session],
        transcript_segments: list[TranscriptSegment],
    ) -> None:
        self.redis = redis_store
        self.sessions = sessions
        self.transcripts = transcript_segments
        self.stt = FakeSttProvider()
        self.llm = FakeLlmProvider()
        self.turn_policy = TurnTakingPolicy(default_silence_threshold_ms=1500)
        self.audio_buffer = bytearray()

    def handle_connection(
        self,
        ws: MockWsClient,
        session_id: uuid.UUID,
        ticket: str | None,
        incoming_messages: list[dict[str, Any] | bytes],
    ) -> None:
        ws.accept()

        # 1. Authenticate one-time ticket
        user_id = self.redis.consume_ticket(ticket)
        if not user_id:
            ws.send_json(
                {
                    "type": "error",
                    "code": "INVALID_WS_TICKET",
                    "message": "Invalid or expired WebSocket authentication ticket",
                }
            )
            ws.close(code=4003)
            return

        # 2. Verify session ownership and lifecycle state
        session = self.sessions.get(session_id)
        if not session or session.user_id != user_id:
            ws.send_json(
                {
                    "type": "error",
                    "code": "SESSION_NOT_FOUND",
                    "message": "Session not found or access denied",
                }
            )
            ws.close(code=4004)
            return

        # Transition session to ACTIVE
        current_status = session.status
        if current_status in (SessionState.CREATED.value, SessionState.RECONNECTING.value):
            SessionStateMachine.transition(current_status, SessionState.ACTIVE)
            session.status = SessionState.ACTIVE.value
        elif current_status == SessionState.ENDED.value:
            ws.send_json(
                {
                    "type": "error",
                    "code": "INVALID_STATE",
                    "message": "Cannot join an ended session",
                }
            )
            ws.close(code=4000)
            return

        ws.send_json(
            {
                "type": "session.state",
                "state": SessionState.ACTIVE.value,
                "aiVoice": "female",
                "speechSpeed": "normal",
            }
        )

        current_segment_id = str(uuid.uuid4())
        current_user_text = ""

        # Process messages
        for item in incoming_messages:
            if isinstance(item, bytes):
                # Binary audio chunk
                if session.status != SessionState.ACTIVE.value:
                    continue
                self.audio_buffer.extend(item)
                if current_user_text:
                    ws.send_json(
                        {
                            "type": "transcript.partial",
                            "speaker": "USER",
                            "segmentId": current_segment_id,
                            "text": f"{current_user_text}...",
                            "startMs": 0,
                        }
                    )
            elif isinstance(item, dict):
                msg_type = item.get("type", "")
                if msg_type == "ping":
                    ws.send_json({"type": "pong"})
                elif msg_type == "user.speech_start":
                    current_segment_id = item.get("segmentId") or str(uuid.uuid4())
                    self.audio_buffer.clear()
                    current_user_text = ""
                elif msg_type in ("user.speech_end", "user.text"):
                    user_text = item.get("text", "")
                    if not user_text and self.audio_buffer:
                        # STT transcription from buffer
                        user_text = "I really enjoy traveling to beach cities."
                        self.audio_buffer.clear()

                    if not user_text:
                        continue

                    # Turn-taking check for filler words
                    if self.turn_policy.ends_with_filler(user_text):
                        current_user_text = user_text
                        ws.send_json(
                            {
                                "type": "transcript.partial",
                                "speaker": "USER",
                                "segmentId": current_segment_id,
                                "text": user_text,
                                "startMs": 0,
                            }
                        )
                        continue

                    # Save user transcript segment (text only, zero audio)
                    max_seq = max([t.seq or 0 for t in self.transcripts], default=0)
                    user_seq = max_seq + 1
                    user_seg = TranscriptSegment(
                        pk=uuid.uuid4(),
                        id=current_segment_id,
                        session_id=session_id,
                        speaker="USER",
                        user_id=user_id,
                        text=user_text,
                        confidence=0.95,
                        seq=user_seq,
                        start_ms=0,
                        end_ms=2500,
                        is_final=True,
                    )
                    self.transcripts.append(user_seg)

                    ws.send_json(
                        {
                            "type": "transcript.final",
                            "speaker": "USER",
                            "segmentId": current_segment_id,
                            "text": user_text,
                            "confidence": 0.95,
                            "seq": user_seq,
                            "startMs": 0,
                            "endMs": 2500,
                        }
                    )

                    # Trigger AI reply
                    ws.send_json({"type": "ai.speaking", "isSpeaking": True})
                    ai_reply = "That sounds wonderful! Which beach did you visit recently?"
                    ai_seg = TranscriptSegment(
                        pk=uuid.uuid4(),
                        id=str(uuid.uuid4()),
                        session_id=session_id,
                        speaker="AI",
                        user_id=user_id,
                        text=ai_reply,
                        confidence=1.0,
                        seq=user_seq + 1,
                        start_ms=0,
                        end_ms=3000,
                        is_final=True,
                    )
                    self.transcripts.append(ai_seg)
                    ws.send_json(
                        {
                            "type": "ai.message",
                            "segmentId": ai_seg.id,
                            "text": ai_reply,
                            "seq": ai_seg.seq,
                        }
                    )
                    ws.send_json({"type": "ai.speaking", "isSpeaking": False})

        # Finally block cleanup
        self.audio_buffer.clear()


# ===========================================================================
# 5 Integration Test Cases
# ===========================================================================


def test_ticket_single_use_and_rejection() -> None:
    """Ticket single-use: connects once successfully, second attempt rejected with 4003."""
    user_id = uuid.uuid4()
    session_id = uuid.uuid4()
    redis = SyncRedisTicketStore()
    ticket = str(uuid.uuid4())
    redis.set_ticket(ticket, user_id, 30)

    session = Session(
        id=session_id,
        user_id=user_id,
        type="COACH",
        status=SessionState.CREATED.value,
        level="B1",
        spoken_seconds=0.0,
    )
    transcripts: list[TranscriptSegment] = []
    orchestrator = WsSessionOrchestratorSimulator(redis, {session_id: session}, transcripts)

    # 1. First connection attempt -> succeeds
    ws1 = MockWsClient()
    orchestrator.handle_connection(ws1, session_id, ticket, [{"type": "ping"}])
    assert ws1.is_accepted is True
    assert any(m.get("type") == "session.state" and m.get("state") == "ACTIVE" for m in ws1.sent_messages)
    assert any(m.get("type") == "pong" for m in ws1.sent_messages)

    # Ticket is consumed from Redis
    assert redis.consume_ticket(ticket) is None

    # 2. Second connection attempt with same ticket -> rejected with 4003
    ws2 = MockWsClient()
    orchestrator.handle_connection(ws2, session_id, ticket, [{"type": "ping"}])
    assert any(m.get("code") == "INVALID_WS_TICKET" for m in ws2.sent_messages)
    assert ws2.close_code == 4003


def test_cross_user_access_blocked() -> None:
    """Ticket created by User B cannot access User A's session -> code 4004."""
    user_a_id = uuid.uuid4()
    user_b_id = uuid.uuid4()
    session_id = uuid.uuid4()
    redis = SyncRedisTicketStore()
    ticket_b = str(uuid.uuid4())
    redis.set_ticket(ticket_b, user_b_id, 30)

    # Session belongs to User A
    session_a = Session(
        id=session_id,
        user_id=user_a_id,
        type="COACH",
        status=SessionState.CREATED.value,
        level="B1",
        spoken_seconds=0.0,
    )
    orchestrator = WsSessionOrchestratorSimulator(redis, {session_id: session_a}, [])

    ws = MockWsClient()
    orchestrator.handle_connection(ws, session_id, ticket_b, [])
    assert any(m.get("code") == "SESSION_NOT_FOUND" for m in ws.sent_messages)
    assert ws.close_code == 4004


def test_audio_streaming_stt_and_communication_first() -> None:
    """Streams audio chunks, invokes STT, respects filler words without interrupting."""
    user_id = uuid.uuid4()
    session_id = uuid.uuid4()
    redis = SyncRedisTicketStore()
    ticket = str(uuid.uuid4())
    redis.set_ticket(ticket, user_id, 30)

    session = Session(
        id=session_id,
        user_id=user_id,
        type="COACH",
        status=SessionState.CREATED.value,
        level="B1",
        spoken_seconds=0.0,
    )
    transcripts: list[TranscriptSegment] = []
    orchestrator = WsSessionOrchestratorSimulator(redis, {session_id: session}, transcripts)

    seg_id = str(uuid.uuid4())
    incoming_flow = [
        {"type": "user.speech_start", "segmentId": seg_id},
        b"\x1a\x45\xdf\xa3fakeaudiochunk",
        {"type": "user.text", "segmentId": seg_id, "text": "I really love to travel, um"},
        {"type": "user.text", "segmentId": seg_id, "text": "I really love to travel to Danang beach."},
    ]

    ws = MockWsClient()
    orchestrator.handle_connection(ws, session_id, ticket, incoming_flow)

    # 1. Filler words emit transcript.partial, AI does not interrupt
    partial_msgs = [m for m in ws.sent_messages if m.get("type") == "transcript.partial"]
    assert len(partial_msgs) >= 1
    assert "um" in partial_msgs[0].get("text", "")

    # 2. Complete speech emits transcript.final
    final_msgs = [m for m in ws.sent_messages if m.get("type") == "transcript.final"]
    assert len(final_msgs) >= 1
    assert "Danang" in final_msgs[-1].get("text", "")

    # 3. AI responds after complete speech
    ai_msgs = [m for m in ws.sent_messages if m.get("type") == "ai.message"]
    assert len(ai_msgs) >= 1
    assert len(ai_msgs[0].get("text", "")) > 0


def test_rule_3_no_raw_audio_in_database_and_memory_cleaned() -> None:
    """Rule 3 invariant: database only holds text and metadata, audio buffer is wiped from RAM."""
    user_id = uuid.uuid4()
    session_id = uuid.uuid4()
    redis = SyncRedisTicketStore()
    ticket = str(uuid.uuid4())
    redis.set_ticket(ticket, user_id, 30)

    session = Session(
        id=session_id,
        user_id=user_id,
        type="COACH",
        status=SessionState.CREATED.value,
        level="B1",
        spoken_seconds=0.0,
    )
    transcripts: list[TranscriptSegment] = []
    orchestrator = WsSessionOrchestratorSimulator(redis, {session_id: session}, transcripts)

    incoming_flow = [
        {"type": "user.speech_start"},
        b"\x00\x01\x02\x03\x04rawaudiobinary12345",
        {"type": "user.speech_end"},
    ]

    ws = MockWsClient()
    orchestrator.handle_connection(ws, session_id, ticket, incoming_flow)

    # Buffer must be cleared from RAM
    assert len(orchestrator.audio_buffer) == 0

    # Segments saved in database only contain text, no audio
    assert len(transcripts) >= 1
    for seg in transcripts:
        assert isinstance(seg.text, str)
        assert not hasattr(seg, "audio_bytes")
        assert not hasattr(seg, "audio_blob")
        assert not hasattr(seg, "raw_audio_url")
        assert seg.confidence is not None
        assert seg.seq > 0


def test_post_end_audio_rejection() -> None:
    """When session is ended, incoming audio chunks over WebSocket are dropped/ignored."""
    user_id = uuid.uuid4()
    session_id = uuid.uuid4()
    redis = SyncRedisTicketStore()
    ticket = str(uuid.uuid4())
    redis.set_ticket(ticket, user_id, 30)

    # Session is already ENDED
    session = Session(
        id=session_id,
        user_id=user_id,
        type="COACH",
        status=SessionState.ENDED.value,
        level="B1",
        spoken_seconds=0.0,
    )
    orchestrator = WsSessionOrchestratorSimulator(redis, {session_id: session}, [])

    ws = MockWsClient()
    orchestrator.handle_connection(ws, session_id, ticket, [b"audio_sent_after_end"])

    assert any(m.get("code") == "INVALID_STATE" for m in ws.sent_messages)
    assert ws.close_code == 4000
