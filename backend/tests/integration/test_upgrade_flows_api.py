"""Integration tests for upgraded Pronunciation, Two-Stage Placement, Barge-In WS & Learner Model."""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from fastapi import WebSocket, WebSocketDisconnect
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db, get_llm_provider, get_redis, get_speech_provider
from app.core.config import Settings, get_settings
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserProfile
from app.models.base import Base
from app.models.session import TranscriptSegment
from tests.fakes import FakeLlmProvider, FakeSpeechAssessmentProvider, make_test_wav


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> bool:  # noqa: ARG002
        self.store[key] = value
        return True

    async def delete(self, key: str) -> int:
        return 1 if self.store.pop(key, None) else 0

    async def getdel(self, key: str) -> str | None:
        return self.store.pop(key, None)

    async def aclose(self) -> None:
        pass


@pytest_asyncio.fixture
async def upgrade_env() -> AsyncGenerator[dict, None]:
    engine: AsyncEngine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
        future=True,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    db_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    fake_redis = FakeRedis()
    test_settings = Settings(
        JWT_SECRET_KEY="test-secret-long-enough-for-hs256-signature-12345",
        PLACEMENT_MIN_ANSWERS=2,
        PLACEMENT_MIN_WORDS=12,
        AZURE_SPEECH_KEY="",
        AZURE_SPEECH_REGION="",
    )

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with db_factory() as db:
            try:
                yield db
                await db.commit()
            except Exception:
                await db.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = lambda: fake_redis  # type: ignore[return-value]
    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_llm_provider] = FakeLlmProvider
    app.dependency_overrides[get_speech_provider] = FakeSpeechAssessmentProvider

    user_id = uuid.uuid4()
    async with db_factory() as db:
        u = User(
            id=user_id,
            email="learner_up@example.com",
            password_hash=hash_password("Password123!"),
            full_name="Upgrade Learner",
            is_active=True,
        )
        u.profile = UserProfile(
            user_id=user_id,
            cefr_level="A2",
            interests=json.dumps(["travel"]),
            goals=json.dumps(["daily_conversation"]),
            weak_points=json.dumps(["pronunciation"]),
            onboarding_completed_at=datetime.now(UTC),
        )
        db.add(u)
        await db.commit()

    token = create_access_token(
        payload={"sub": str(user_id), "email": "learner_up@example.com"},
        expires_delta=timedelta(minutes=30),
        secret=test_settings.JWT_SECRET_KEY,
        algorithm=test_settings.JWT_ALGORITHM,
    )
    yield {"db_factory": db_factory, "fake_redis": fake_redis, "user_id": user_id, "token": token}
    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.mark.asyncio
async def test_pronunciation_assess_and_503_without_fake(upgrade_env: dict) -> None:
    headers = {"Authorization": f"Bearer {upgrade_env['token']}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ipa_res = await client.get(
            "/api/v1/pronunciation/ipa",
            params={"text": "How long have you been working there"},
            headers=headers,
        )
        assert ipa_res.status_code == 200
        assert ipa_res.json()["ipa"]

        wav = make_test_wav(duration_sec=0.4)
        res = await client.post(
            "/api/v1/pronunciation/assess",
            headers=headers,
            files={"audio": ("speech.wav", wav, "audio/wav")},
            data={"reference_text": "How long have you been working there", "mode": "scripted"},
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["displayScore"] is not None
        assert data["accuracyScore"] == 84.0
        working = next(w for w in data["words"] if w["word"].lower() == "working")
        assert [s["text"] for s in working["syllables"]] == ["wor", "king"]
        assert working["syllables"][0]["status"] == "poor"
        assert data["coachingTipVi"]

        # Without override and unconfigured Azure key -> must raise 503, never fake
        app.dependency_overrides.pop(get_speech_provider, None)
        fail_res = await client.post(
            "/api/v1/pronunciation/assess",
            headers=headers,
            files={"audio": ("speech.wav", wav, "audio/wav")},
            data={"reference_text": "working", "mode": "scripted"},
        )
        assert fail_res.status_code == 503
        assert fail_res.json()["code"] == "SPEECH_ASSESSMENT_NOT_CONFIGURED"


@pytest.mark.asyncio
async def test_two_stage_placement_initializes_learner_model(upgrade_env: dict) -> None:
    headers = {"Authorization": f"Bearer {upgrade_env['token']}"}
    wav = make_test_wav(duration_sec=0.5)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        test_resp = await client.post("/api/v1/placement-tests", headers=headers)
        assert test_resp.status_code == 201
        test_data = test_resp.json()
        test_id = test_data["id"]
        prompts = test_data["scriptedPrompts"]
        assert len(prompts) == 3

        # Stage 1 scripted answer
        s1_res = await client.post(
            f"/api/v1/placement-tests/{test_id}/audio-answers",
            headers=headers,
            files={"audio": ("s1.wav", wav, "audio/wav")},
            data={
                "request_id": "s1-req-1",
                "stage": "1",
                "question_index": "0",
                "prompt_id": prompts[0]["id"],
            },
        )
        assert s1_res.status_code == 200, s1_res.text
        assert s1_res.json()["pronunciation"]["displayScore"] is not None

        # Stage 2 unscripted answers (real audio transcribed by SpeechAssessmentProvider)
        for q_idx in (0, 1):
            s2_res = await client.post(
                f"/api/v1/placement-tests/{test_id}/audio-answers",
                headers=headers,
                files={"audio": ("s2.wav", wav, "audio/wav")},
                data={
                    "request_id": f"s2-req-{q_idx}",
                    "stage": "2",
                    "question_index": str(q_idx),
                    "response_latency_seconds": "1.2",
                },
            )
            assert s2_res.status_code == 200, s2_res.text

        comp = await client.post(f"/api/v1/placement-tests/{test_id}/complete", headers=headers)
        assert comp.status_code == 200, comp.text
        c_data = comp.json()
        assert c_data["estimatedLevel"] in ("A2", "B1", "B2", "C1")
        assert c_data["explanationVi"]

        lm = await client.get("/api/v1/progress/learner-model", headers=headers)
        assert lm.status_code == 200, lm.text
        lm_data = lm.json()
        assert lm_data["estimatedCefr"] == c_data["estimatedLevel"]
        assert lm_data["calibratedDimensions"]["pronunciation"] is not None
        assert len(lm_data["snapshots"]) >= 1

        # Verify duplicate phonemes inside a single placement/session batch aggregate cleanly
        from app.services.learner_assessment import LearnerAssessmentService

        async with upgrade_env["db_factory"]() as db:
            await LearnerAssessmentService(db).record_phoneme_observations(
                upgrade_env["user_id"],
                [
                    {"ipa": "k", "accuracy": 40.0},
                    {"ipa": "k", "accuracy": 60.0},
                    {"ipa": "θ", "accuracy": 50.0},
                ],
            )
            await db.commit()


@pytest.mark.asyncio
async def test_continuous_ws_barge_in_flow(upgrade_env: dict) -> None:
    headers = {"Authorization": f"Bearer {upgrade_env['token']}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        sess_res = await client.post("/api/v1/coach/sessions", json={}, headers=headers)
        assert sess_res.status_code == 201
        session_id = uuid.UUID(sess_res.json()["id"])
        ticket = (await client.post("/api/v1/ws-tickets", headers=headers)).json()["ticket"]

    seg_id = str(uuid.uuid4())
    incoming = [
        {
            "type": "user.barge_in",
            "segmentId": seg_id,
            "spokenRatio": 0.4,
            "interruptedAtMs": 900,
            "mimeType": "audio/wav",
        },
        make_test_wav(duration_sec=0.3),
        {"type": "user.speech_end", "segmentId": seg_id, "mimeType": "audio/wav"},
    ]
    mock_ws = AsyncMock(spec=WebSocket)
    sent_frames: list[dict] = []

    async def recv() -> dict:
        if not incoming:
            raise WebSocketDisconnect()
        item = incoming.pop(0)
        return (
            {"type": "websocket.receive", "bytes": item}
            if isinstance(item, bytes)
            else {"type": "websocket.receive", "text": json.dumps(item)}
        )

    mock_ws.receive.side_effect = recv
    mock_ws.send_json.side_effect = lambda d: sent_frames.append(d)

    with (
        patch("app.api.v1.endpoints.ws_session.async_session_factory", upgrade_env["db_factory"]),
        patch(
            "app.api.v1.endpoints.ws_session.get_redis_client", lambda: upgrade_env["fake_redis"]
        ),
        patch("app.api.v1.endpoints.ws_session.get_llm_provider", FakeLlmProvider),
        patch(
            "app.api.v1.endpoints.ws_session.get_speech_assessment_provider",
            FakeSpeechAssessmentProvider,
        ),
    ):
        from app.api.v1.endpoints.ws_session import session_websocket_endpoint

        await session_websocket_endpoint(mock_ws, session_id, ticket=ticket, last_seq=0)

    state_frame = next(m for m in sent_frames if m.get("type") == "session.state")
    assert state_frame["interactionMode"] == "continuous"
    assert any(m.get("type") == "ai.interrupted" for m in sent_frames)
    ai_msg = next(m for m in sent_frames if m.get("type") == "ai.message")
    assert isinstance(ai_msg.get("startMs"), int)
    assert ai_msg["startMs"] >= 0

    async with upgrade_env["db_factory"]() as db:
        row = (
            await db.execute(select(TranscriptSegment).where(TranscriptSegment.id == seg_id))
        ).scalar_one()
        assert row.is_barge_in is True
        assert row.pronunciation_accuracy == 84.0
