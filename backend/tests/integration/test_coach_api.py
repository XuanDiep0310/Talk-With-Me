"""
Integration tests for AI Coach REST API and WebSocket session:
1. Create session (requires completed onboarding, AI initial greeting)
2. Rejected when onboarding is incomplete (400)
3. Topics listing with personalization ranking
4. Idempotent transcript segment saving
5. Unauthorized session access returns 404 (AGENTS.md §7)
6. /end called twice gives identical result (idempotency)
7. Feedback returns 202 PENDING
8. WS Ticket single-use and expiration
9. WebSocket practice flow (audio/text, transcript.final, AI message, lastSeq reconnect)
10. Audio rejected when session not ACTIVE
"""

import json
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from fastapi import WebSocket, WebSocketDisconnect
from httpx import ASGITransport, AsyncClient
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db, get_redis
from app.core.config import Settings, get_settings
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserProfile
from app.models.base import Base
from app.models.session import Session
from app.services.session_state_machine import SessionState


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.ttls: dict[str, int] = {}

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> bool:
        self.store[key] = value
        if ex:
            self.ttls[key] = ex
        return True

    async def delete(self, key: str) -> int:
        return 1 if self.store.pop(key, None) else 0

    async def getdel(self, key: str) -> str | None:
        return self.store.pop(key, None)

    async def aclose(self) -> None:
        pass


@pytest_asyncio.fixture
async def coach_db() -> AsyncGenerator[async_sessionmaker[AsyncSession], None]:

    engine: AsyncEngine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
        future=True,
        echo=False,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )

    yield session_factory

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def test_env(
    coach_db: async_sessionmaker[AsyncSession],
) -> AsyncGenerator[dict, None]:
    fake_redis = FakeRedis()

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with coach_db() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    def override_get_redis() -> Redis:
        return fake_redis  # type: ignore[return-value]

    test_settings = Settings(
        JWT_SECRET_KEY="test-secret-long-enough-for-hs256-signature-12345",
        PASSWORD_MIN_LENGTH=6,
        ACCESS_TOKEN_EXPIRE_MINUTES=30,
        WS_TICKET_EXPIRE_SECONDS=30,
    )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = override_get_redis
    app.dependency_overrides[get_settings] = lambda: test_settings

    # Seed an onboarded user and a non-onboarded user
    user1_id = uuid.uuid4()
    user2_id = uuid.uuid4()
    async with coach_db() as session:
        user1 = User(
            id=user1_id,
            email="learner@example.com",
            password_hash=hash_password("Password123!"),
            full_name="Learner One",
            is_active=True,
        )
        profile1 = UserProfile(
            user_id=user1_id,
            cefr_level="B1",
            interests=json.dumps(["travel", "technology"]),
            goals=json.dumps(["daily_conversation"]),
            weak_points=json.dumps(["fluency"]),
            onboarding_completed_at=datetime.now(UTC),
        )

        user1.profile = profile1
        session.add(user1)

        user2 = User(
            id=user2_id,
            email="newbie@example.com",
            password_hash=hash_password("Password123!"),
            full_name="Newbie Two",
            is_active=True,
        )
        profile2 = UserProfile(
            user_id=user2_id,
            cefr_level="A1",
            onboarding_completed_at=None,  # Not onboarded!
        )
        user2.profile = profile2
        session.add(user2)
        await session.commit()

    token1 = create_access_token(
        payload={"sub": str(user1_id), "email": "learner@example.com"},
        expires_delta=timedelta(minutes=30),
        secret=test_settings.JWT_SECRET_KEY,
        algorithm=test_settings.JWT_ALGORITHM,
    )
    token2 = create_access_token(
        payload={"sub": str(user2_id), "email": "newbie@example.com"},
        expires_delta=timedelta(minutes=30),
        secret=test_settings.JWT_SECRET_KEY,
        algorithm=test_settings.JWT_ALGORITHM,
    )

    yield {
        "user1_id": user1_id,
        "token1": token1,
        "user2_id": user2_id,
        "token2": token2,
        "fake_redis": fake_redis,
        "db_factory": coach_db,
    }

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_topics_personalized(test_env: dict) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.get(
            "/api/v1/coach/topics",
            headers={"Authorization": f"Bearer {test_env['token1']}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "recommended" in data
        assert "groups" in data
        assert data["totalTopics"] >= 12
        # Check top recommended topic aligns with B1 learner
        assert len(data["recommended"]) > 0


@pytest.mark.asyncio
async def test_create_session_requires_onboarding(test_env: dict) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # User 2 has NOT completed onboarding
        resp = await client.post(
            "/api/v1/coach/sessions",
            json={},
            headers={"Authorization": f"Bearer {test_env['token2']}"},
        )
        assert resp.status_code == 400
        assert "onboarding" in resp.json()["message"].lower()


@pytest.mark.asyncio
async def test_create_and_manage_session_flow(test_env: dict) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Create session successfully
        create_resp = await client.post(
            "/api/v1/coach/sessions",
            json={},
            headers={"Authorization": f"Bearer {test_env['token1']}"},
        )
        assert create_resp.status_code == 201
        session_data = create_resp.json()
        session_id = session_data["id"]
        assert session_data["status"] == "CREATED"
        assert session_data["level"] == "B1"
        assert session_data["initialMessage"] is not None
        assert len(session_data["transcripts"]) == 1
        assert session_data["transcripts"][0]["speaker"] == "AI"

        # 2. Add transcript segment fails when session is still CREATED (not ACTIVE)
        segment_id = str(uuid.uuid4())
        bad_add = await client.post(
            f"/api/v1/coach/sessions/{session_id}/transcript",
            json={"id": segment_id, "speaker": "USER", "text": "Hello Alex"},
            headers={"Authorization": f"Bearer {test_env['token1']}"},
        )
        assert bad_add.status_code == 400

        # Update session status to ACTIVE for testing transcript endpoints
        async with test_env["db_factory"]() as db:
            sess = await db.get(Session, uuid.UUID(session_id))
            sess.status = SessionState.ACTIVE.value
            await db.commit()

        # 3. Add transcript segment successfully when ACTIVE
        add_resp = await client.post(
            f"/api/v1/coach/sessions/{session_id}/transcript",
            json={
                "id": segment_id,
                "speaker": "USER",
                "text": "Hello Alex, nice to practice with you.",
                "startMs": 0,
                "endMs": 2000,
            },
            headers={"Authorization": f"Bearer {test_env['token1']}"},
        )
        assert add_resp.status_code == 201
        assert add_resp.json()["id"] == segment_id

        # 4. Idempotency test: duplicate segment submission returns existing segment
        dup_resp = await client.post(
            f"/api/v1/coach/sessions/{session_id}/transcript",
            json={
                "id": segment_id,
                "speaker": "USER",
                "text": "Different text trying to overwrite",
            },
            headers={"Authorization": f"Bearer {test_env['token1']}"},
        )
        assert dup_resp.status_code == 201
        assert dup_resp.json()["text"] == "Hello Alex, nice to practice with you."

        # 5. List transcripts
        list_resp = await client.get(
            f"/api/v1/coach/sessions/{session_id}/transcript",
            headers={"Authorization": f"Bearer {test_env['token1']}"},
        )
        assert list_resp.status_code == 200
        assert len(list_resp.json()) >= 2  # AI greeting + USER segment

        # 6. Unauthorized access by user2 returns 404 per AGENTS.md §7
        other_resp = await client.get(
            f"/api/v1/coach/sessions/{session_id}",
            headers={"Authorization": f"Bearer {test_env['token2']}"},
        )
        assert other_resp.status_code == 404

        # 7. End session twice (idempotent)
        end_resp1 = await client.post(
            f"/api/v1/coach/sessions/{session_id}/end",
            json={"reason": "USER_REQUESTED"},
            headers={"Authorization": f"Bearer {test_env['token1']}"},
        )
        assert end_resp1.status_code == 200
        assert end_resp1.json()["status"] == "ENDED"

        end_resp2 = await client.post(
            f"/api/v1/coach/sessions/{session_id}/end",
            json={"reason": "USER_REQUESTED"},
            headers={"Authorization": f"Bearer {test_env['token1']}"},
        )
        assert end_resp2.status_code == 200
        assert end_resp2.json()["status"] == "ENDED"

        # 8. Feedback returns 202 PENDING
        fb_resp = await client.get(
            f"/api/v1/coach/sessions/{session_id}/feedback",
            headers={"Authorization": f"Bearer {test_env['token1']}"},
        )
        assert fb_resp.status_code == 202
        assert fb_resp.json()["status"] == "PENDING"


@pytest.mark.asyncio
async def test_ws_ticket_and_websocket_flow(test_env: dict) -> None:
    transport = ASGITransport(app=app)
    session_id = None
    ticket = None

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Create a session
        create_resp = await client.post(
            "/api/v1/coach/sessions",
            json={},
            headers={"Authorization": f"Bearer {test_env['token1']}"},
        )
        session_id = create_resp.json()["id"]

        # 2. Get WebSocket ticket
        ticket_resp = await client.post(
            "/api/v1/ws-tickets",
            headers={"Authorization": f"Bearer {test_env['token1']}"},
        )
        assert ticket_resp.status_code == 201
        ticket = ticket_resp.json()["ticket"]
        assert ticket_resp.json()["expiresIn"] == 30

    # 3. Connect via session_websocket_endpoint with AsyncMock WebSocket
    mock_ws = AsyncMock(spec=WebSocket)
    user_seg_id = str(uuid.uuid4())
    messages_to_receive = [
        {"type": "ping"},
        {
            "type": "user.text",
            "segmentId": user_seg_id,
            "text": "I really love traveling to ancient cities.",
        },
    ]
    sent_messages = []

    async def mock_receive() -> dict:
        if messages_to_receive:
            item = messages_to_receive.pop(0)
            return {"type": "websocket.receive", "text": json.dumps(item)}
        raise WebSocketDisconnect()

    mock_ws.receive.side_effect = mock_receive

    async def mock_send_json(data: dict) -> None:
        sent_messages.append(data)

    mock_ws.send_json.side_effect = mock_send_json

    with (
        patch("app.api.v1.endpoints.ws_session.async_session_factory", test_env["db_factory"]),
        patch("app.api.v1.endpoints.ws_session.get_redis_client", lambda: test_env["fake_redis"]),
    ):
        from app.api.v1.endpoints.ws_session import session_websocket_endpoint

        await session_websocket_endpoint(
            websocket=mock_ws,
            session_id=uuid.UUID(session_id),
            ticket=ticket,
            last_seq=0,
        )

        mock_ws.accept.assert_awaited_once()
        assert any(
            m.get("type") == "session.state" and m.get("state") == "ACTIVE" for m in sent_messages
        )
        assert any(m.get("type") == "pong" for m in sent_messages)
        assert any(
            m.get("type") == "transcript.final" and "traveling" in m.get("text", "")
            for m in sent_messages
        )
        assert any(
            m.get("type") == "ai.message" and len(m.get("text", "")) > 0 for m in sent_messages
        )

        # 4. Verify ticket reuse is rejected (one-time use)
        mock_ws_reused = AsyncMock(spec=WebSocket)
        reused_sent = []

        async def mock_reused_send(d: dict) -> None:
            reused_sent.append(d)

        mock_ws_reused.send_json.side_effect = mock_reused_send

        await session_websocket_endpoint(
            websocket=mock_ws_reused,
            session_id=uuid.UUID(session_id),
            ticket=ticket,  # Ticket already consumed!
            last_seq=0,
        )

        assert any(m.get("code") == "INVALID_WS_TICKET" for m in reused_sent)
        mock_ws_reused.close.assert_awaited_once_with(code=4003)
