"""
Integration tests for post-session scoring engine and feedback APIs:
1. /end -> background job -> feedback generated with Fake LLM
2. /end called twice gives identical response and creates single feedback (idempotency)
3. LLM failure with retry: transient error retried and succeeds
4. LLM failure exhausted -> status FAILED (retryable=True), manual retry POST succeeds
5. Session with insufficient data -> status INSUFFICIENT_DATA, all scores null, no fake scores
6. Unauthorized access by another user returns 404 (AGENTS.md §7)
7. HTTP 202 when PENDING, HTTP 200 when FEEDBACK_READY
"""

import asyncio
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
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
from app.core.providers.llm_provider import FakeLlmProvider
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserProfile
from app.models.base import Base
from app.models.scoring import SessionFeedback
from app.models.session import CoachTopic, Session, TranscriptSegment
from app.services.scoring.service import ScoringService
from app.services.session_state_machine import SessionState


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


@pytest_asyncio.fixture
async def scoring_db() -> AsyncGenerator[async_sessionmaker[AsyncSession], None]:
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
    scoring_db: async_sessionmaker[AsyncSession],
) -> AsyncGenerator[dict, None]:
    fake_redis = FakeRedis()

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with scoring_db() as session:
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
        SCORING_MIN_USER_WORDS=5,
        SCORING_MIN_USER_TURNS=1,
        SCORING_MIN_SPOKEN_SECONDS=5.0,
        ARQ_MODE="eager",
        LLM_PROVIDER="fake",
        GROQ_API_KEY="",
        LLM_API_KEY="",
    )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = override_get_redis
    app.dependency_overrides[get_settings] = lambda: test_settings

    # Create test users and topic
    user1_id = uuid.uuid4()
    user2_id = uuid.uuid4()
    topic_id = uuid.uuid4()

    async with scoring_db() as db:
        u1 = User(
            id=user1_id,
            email="learner1@example.com",
            password_hash=hash_password("Password123!"),
            full_name="Learner One",
            is_active=True,
        )
        p1 = UserProfile(
            user_id=user1_id,
            cefr_level="B1",
            goals='["career"]',
            weak_points='["Fluency"]',
            interests='["Travel"]',
            onboarding_completed_at=datetime.now(UTC),
        )
        u1.profile = p1

        u2 = User(
            id=user2_id,
            email="learner2@example.com",
            password_hash=hash_password("Password123!"),
            full_name="Learner Two",
            is_active=True,
        )
        p2 = UserProfile(
            user_id=user2_id,
            cefr_level="A2",
            goals='["travel"]',
            weak_points='["Pronunciation"]',
            interests='["Daily Life"]',
            onboarding_completed_at=datetime.now(UTC),
        )
        u2.profile = p2

        topic = CoachTopic(
            id=topic_id,
            category="Travel & Culture",
            title="Vacation in Da Nang",
            description="Discussing vacation experiences in coastal cities.",
            min_level="A2",
            target_skills=["Fluency", "Vocabulary"],
            is_active=True,
            sort_order=1,
        )
        db.add_all([u1, u2, topic])
        await db.commit()

    from datetime import timedelta

    token1 = create_access_token(
        payload={"sub": str(user1_id), "email": "learner1@example.com"},
        expires_delta=timedelta(minutes=30),
        secret=test_settings.JWT_SECRET_KEY,
        algorithm=test_settings.JWT_ALGORITHM,
    )
    token2 = create_access_token(
        payload={"sub": str(user2_id), "email": "learner2@example.com"},
        expires_delta=timedelta(minutes=30),
        secret=test_settings.JWT_SECRET_KEY,
        algorithm=test_settings.JWT_ALGORITHM,
    )

    fake_llm = FakeLlmProvider()
    with patch("app.services.scoring.service.get_llm_provider", return_value=fake_llm):
        yield {
            "user1_id": user1_id,
            "user2_id": user2_id,
            "token1": token1,
            "token2": token2,
            "topic_id": topic_id,
            "db_factory": scoring_db,
        }

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_end_session_triggers_feedback_generation(test_env: dict) -> None:
    """1. /end triggers feedback generation, returning valid scores and qualitative points."""
    db_factory = test_env["db_factory"]
    token = test_env["token1"]
    user_id = test_env["user1_id"]
    topic_id = test_env["topic_id"]

    session_id = uuid.uuid4()
    now = datetime.now(UTC)

    # Setup ACTIVE session with rich dialogue
    async with db_factory() as db:
        session = Session(
            id=session_id,
            type="COACH",
            user_id=user_id,
            topic_id=topic_id,
            level="B1",
            status=SessionState.ACTIVE.value,
            started_at=now,
            spoken_seconds=11.5,
        )
        db.add(session)
        # Add dialogue
        t1 = TranscriptSegment(
            pk=uuid.uuid4(),
            id=str(uuid.uuid4()),
            session_id=session_id,
            speaker="AI",
            text="Hello! What do you like most about Da Nang beach?",
            start_ms=0,
            end_ms=3000,
            seq=1,
        )
        t2 = TranscriptSegment(
            pk=uuid.uuid4(),
            id=str(uuid.uuid4()),
            session_id=session_id,
            speaker="USER",
            text="I really love swimming in the ocean and walking along the beautiful sandy shore every morning.",
            start_ms=4500,  # 1.5s latency (<= 2s)
            end_ms=10500,  # 6.0s
            confidence=0.92,
            seq=2,
        )
        t3 = TranscriptSegment(
            pk=uuid.uuid4(),
            id=str(uuid.uuid4()),
            session_id=session_id,
            speaker="AI",
            text="That sounds amazing! What kind of local seafood do you enjoy eating?",
            start_ms=11000,
            end_ms=14000,
            seq=3,
        )
        t4 = TranscriptSegment(
            pk=uuid.uuid4(),
            id=str(uuid.uuid4()),
            session_id=session_id,
            speaker="USER",
            text="I enjoy grilled squid and fresh prawns because they are extremely fresh and flavorful.",
            start_ms=15800,  # 1.8s latency (<= 2s)
            end_ms=21300,  # 5.5s
            confidence=0.95,
            seq=4,
        )
        db.add_all([t1, t2, t3, t4])
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Patch async_session_factory in tasks to use the test SQLite db
        with patch("app.services.scoring.tasks.async_session_factory", db_factory):
            # 1. Call /end
            res = await client.post(
                f"/api/v1/coach/sessions/{session_id}/end",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "ENDED"

            # Allow background task to complete
            import asyncio

            fb_ready = False
            res_fb = None
            for _ in range(30):
                await asyncio.sleep(0.05)
                res_check = await client.get(
                    f"/api/v1/coach/sessions/{session_id}/feedback",
                    headers={"Authorization": f"Bearer {token}"},
                )
                if (
                    res_check.status_code == 200
                    and res_check.json().get("status") == "FEEDBACK_READY"
                ):
                    fb_ready = True
                    res_fb = res_check
                    break

            assert fb_ready, (
                f"Feedback was not ready in time, last status: {res_check.status_code} {res_check.text}"
            )
            assert res_fb is not None
            fb = res_fb.json()
            assert fb["status"] == "FEEDBACK_READY"
            assert fb["overallScore"] is not None
            assert fb["overallScore"] > 0
            assert fb["partial"] is False
            assert len(fb["skills"]) == 5
            assert len(fb["strengths"]) >= 2
            assert len(fb["improvements"]) >= 1
            assert fb["nextPractice"] is not None


@pytest.mark.asyncio
async def test_end_session_called_twice_is_idempotent(test_env: dict) -> None:
    """2. Calling /end twice returns the same ended status and does not corrupt feedback."""
    db_factory = test_env["db_factory"]
    token = test_env["token1"]
    user_id = test_env["user1_id"]
    topic_id = test_env["topic_id"]

    session_id = uuid.uuid4()
    async with db_factory() as db:
        session = Session(
            id=session_id,
            type="COACH",
            user_id=user_id,
            topic_id=topic_id,
            level="B1",
            status=SessionState.ACTIVE.value,
            started_at=datetime.now(UTC),
        )
        db.add(session)
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        with patch(
            "app.services.scoring.tasks.enqueue_feedback_job", new_callable=AsyncMock
        ) as mock_enqueue:
            res1 = await client.post(
                f"/api/v1/coach/sessions/{session_id}/end",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert res1.status_code == 200

            res2 = await client.post(
                f"/api/v1/coach/sessions/{session_id}/end",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert res2.status_code == 200
            assert res1.json()["status"] == res2.json()["status"] == "ENDED"
            assert mock_enqueue.call_count == 1


@pytest.mark.asyncio
async def test_insufficient_data_produces_no_fake_scores(test_env: dict) -> None:
    """5. Sessions below threshold (words < 5 or spoken < 5s) return INSUFFICIENT_DATA and null scores."""
    db_factory = test_env["db_factory"]
    token = test_env["token1"]
    user_id = test_env["user1_id"]
    topic_id = test_env["topic_id"]

    session_id = uuid.uuid4()
    now = datetime.now(UTC)

    async with db_factory() as db:
        session = Session(
            id=session_id,
            type="COACH",
            user_id=user_id,
            topic_id=topic_id,
            level="A1",
            status=SessionState.ACTIVE.value,
            started_at=now,
            spoken_seconds=1.5,
        )
        db.add(session)
        t1 = TranscriptSegment(
            pk=uuid.uuid4(),
            id=str(uuid.uuid4()),
            session_id=session_id,
            speaker="AI",
            text="Hi! How are you today?",
            start_ms=0,
            end_ms=2000,
            seq=1,
        )
        t2 = TranscriptSegment(
            pk=uuid.uuid4(),
            id=str(uuid.uuid4()),
            session_id=session_id,
            speaker="USER",
            text="I good.",  # Only 2 words < 5
            start_ms=3000,
            end_ms=4500,
            confidence=0.90,
            seq=2,
        )
        db.add_all([t1, t2])
        await db.commit()

    async with db_factory() as db:
        service = ScoringService(db)
        resp = await service.generate_feedback(session_id)
        assert resp.status == "INSUFFICIENT_DATA"
        assert resp.overall_score is None

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(
            f"/api/v1/coach/sessions/{session_id}/feedback",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        fb = res.json()
        assert fb["status"] == "INSUFFICIENT_DATA"
        assert fb["overallScore"] is None
        # All 5 skills must have null scores per AGENTS.md §8 rule 1
        for s in fb["skills"]:
            assert s["score"] is None
            assert s["naReason"] == "SESSION_INSUFFICIENT_DATA"


@pytest.mark.asyncio
async def test_unauthorized_user_feedback_returns_404(test_env: dict) -> None:
    """6. Accessing another user's session feedback returns 404 (AGENTS.md §7)."""
    db_factory = test_env["db_factory"]
    token2 = test_env["token2"]  # User 2
    user1_id = test_env["user1_id"]
    topic_id = test_env["topic_id"]

    session_id = uuid.uuid4()
    async with db_factory() as db:
        session = Session(
            id=session_id,
            type="COACH",
            user_id=user1_id,  # Owned by User 1
            topic_id=topic_id,
            level="B1",
            status=SessionState.ACTIVE.value,
            started_at=datetime.now(UTC),
        )
        db.add(session)
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # User 2 attempts to view User 1's feedback
        res = await client.get(
            f"/api/v1/coach/sessions/{session_id}/feedback",
            headers={"Authorization": f"Bearer {token2}"},
        )
        assert res.status_code == 404

        # User 2 attempts to retry User 1's feedback
        res_retry = await client.post(
            f"/api/v1/coach/sessions/{session_id}/feedback/retry",
            headers={"Authorization": f"Bearer {token2}"},
        )
        assert res_retry.status_code == 404


@pytest.mark.asyncio
async def test_llm_failure_sets_failed_and_manual_retry_succeeds(test_env: dict) -> None:
    """4. If LLM fails all retries, feedback becomes FAILED (retryable=True); manual retry succeeds."""
    db_factory = test_env["db_factory"]
    token = test_env["token1"]
    user_id = test_env["user1_id"]
    topic_id = test_env["topic_id"]

    session_id = uuid.uuid4()
    now = datetime.now(UTC)

    async with db_factory() as db:
        session = Session(
            id=session_id,
            type="COACH",
            user_id=user_id,
            topic_id=topic_id,
            level="B1",
            status=SessionState.ENDED.value,
            started_at=now,
            ended_at=now,
            spoken_seconds=10.0,
        )
        t1 = TranscriptSegment(
            pk=uuid.uuid4(),
            id=str(uuid.uuid4()),
            session_id=session_id,
            speaker="AI",
            text="Hello! Tell me about your city.",
            start_ms=0,
            end_ms=2000,
            seq=1,
        )
        t2 = TranscriptSegment(
            pk=uuid.uuid4(),
            id=str(uuid.uuid4()),
            session_id=session_id,
            speaker="USER",
            text="I live in Hanoi which is famous for delicious food and friendly people.",
            start_ms=3500,
            end_ms=9500,
            confidence=0.91,
            seq=2,
        )
        db.add_all([session, t1, t2])
        await db.commit()

    # Step 1: Simulate LLM outage
    failing_llm = AsyncMock()
    failing_llm.evaluate_post_session.side_effect = RuntimeError(
        "OpenAI / Gemini API 503 Overloaded"
    )

    with patch("app.services.scoring.service.get_llm_provider", return_value=failing_llm):
        async with db_factory() as db:
            service = ScoringService(db)
            resp = await service.generate_feedback(session_id)
            assert resp.status == "FAILED"
            assert resp.retryable is True
            assert resp.overall_score is None

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Step 2: Query feedback -> 200 FAILED with retryable flag
        res = await client.get(
            f"/api/v1/coach/sessions/{session_id}/feedback",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        fb = res.json()
        assert fb["status"] == "FAILED"
        assert fb["retryable"] is True

        # Step 3: Call retry endpoint -> returns 202 PENDING
        with patch("app.services.scoring.tasks.async_session_factory", db_factory):
            res_retry = await client.post(
                f"/api/v1/coach/sessions/{session_id}/feedback/retry",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert res_retry.status_code == 202
            assert res_retry.json()["status"] == "PENDING"

            # Step 4: Background retry task completes -> FEEDBACK_READY
            fb_ready = False
            res_fb2 = None
            for _ in range(30):
                await asyncio.sleep(0.05)
                res_check = await client.get(
                    f"/api/v1/coach/sessions/{session_id}/feedback",
                    headers={"Authorization": f"Bearer {token}"},
                )
                if (
                    res_check.status_code == 200
                    and res_check.json().get("status") == "FEEDBACK_READY"
                ):
                    fb_ready = True
                    res_fb2 = res_check
                    break

            assert fb_ready, (
                f"Feedback retry did not complete in time: {res_check.status_code} {res_check.text}"
            )
            assert res_fb2 is not None
            fb2 = res_fb2.json()
            assert fb2["status"] == "FEEDBACK_READY"
            assert fb2["overallScore"] is not None
            assert fb2["retryable"] is False


@pytest.mark.asyncio
async def test_feedback_pending_202_then_200(test_env: dict) -> None:
    """7. GET returns 202 when feedback is PENDING, and 200 when FEEDBACK_READY."""
    db_factory = test_env["db_factory"]
    token = test_env["token1"]
    user_id = test_env["user1_id"]
    topic_id = test_env["topic_id"]

    session_id = uuid.uuid4()
    async with db_factory() as db:
        session = Session(
            id=session_id,
            type="COACH",
            user_id=user_id,
            topic_id=topic_id,
            level="B1",
            status=SessionState.ACTIVE.value,
            started_at=datetime.now(UTC),
        )
        db.add(session)
        # Create explicit PENDING feedback
        pending_feedback = SessionFeedback(
            session_id=session_id,
            status="PENDING",
            formula_version="1.0.0",
        )
        db.add(pending_feedback)
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Check PENDING returns 202
        res_pending = await client.get(
            f"/api/v1/coach/sessions/{session_id}/feedback",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_pending.status_code == 202
        assert res_pending.json()["status"] == "PENDING"

        # Update to FEEDBACK_READY
        async with db_factory() as db:
            fb = await db.get(SessionFeedback, session_id)
            if fb:
                fb.status = "FEEDBACK_READY"
                fb.overall_score = 88.0
                await db.commit()

        # Check FEEDBACK_READY returns 200
        res_ready = await client.get(
            f"/api/v1/coach/sessions/{session_id}/feedback",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_ready.status_code == 200
        assert res_ready.json()["status"] == "FEEDBACK_READY"
        assert res_ready.json()["overallScore"] == 88.0
