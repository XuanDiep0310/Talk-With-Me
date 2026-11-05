"""
Integration tests for Gamification, Progress, Dashboard, Daily Missions, Badges,
Event handling, and Ledger Invariants (Sprint 6).
"""

import asyncio
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db, get_redis
from app.core.events import FeedbackGenerated
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserProfile
from app.models.base import Base
from app.models.gamification import (
    GamificationProfile,
    Notification,
    UserDailyMission,
)
from app.seeds.gamification_seeds import seed_gamification
from app.services.gamification import GamificationService


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


class FakeClock:
    def __init__(self, current_time: datetime) -> None:
        self._current_time = current_time

    def now(self) -> datetime:
        return self._current_time

    def advance(self, **kwargs: float) -> None:
        self._current_time += timedelta(**kwargs)


@pytest_asyncio.fixture
async def gamification_db() -> AsyncGenerator[async_sessionmaker[AsyncSession], None]:
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

    async with session_factory() as session:
        await seed_gamification(session)
        await session.commit()

    yield session_factory

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def gamification_test_env(
    gamification_db: async_sessionmaker[AsyncSession],
) -> AsyncGenerator[dict, None]:
    fake_redis = FakeRedis()

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with gamification_db() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    def override_get_redis() -> Redis:
        return fake_redis  # type: ignore[return-value]

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = override_get_redis

    yield {
        "db": gamification_db,
        "redis": fake_redis,
    }

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac


async def create_test_user(
    db_factory: async_sessionmaker[AsyncSession],
    email: str = "gamify@example.com",
    name: str = "Gamify Tester",
    cefr_level: str = "A1",
) -> tuple[User, str]:
    async with db_factory() as session:
        user = User(
            id=uuid.uuid4(),
            email=email,
            password_hash=hash_password("Password123!"),
            full_name=name,
            is_active=True,
        )
        session.add(user)
        await session.flush()

        profile = UserProfile(
            user_id=user.id,
            cefr_level=cefr_level,
            timezone="Asia/Ho_Chi_Minh",
        )
        session.add(profile)

        gamify_profile = GamificationProfile(
            user_id=user.id,
            total_xp=0,
            current_streak=0,
            best_streak=0,
            last_active_date=None,
        )
        session.add(gamify_profile)
        await session.commit()

        from app.core.config import get_settings

        settings = get_settings()
        token = create_access_token(
            payload={"sub": str(user.id), "email": user.email},
            expires_delta=timedelta(hours=1),
            secret=settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )
        return user, token


# --- Integration Tests ---


@pytest.mark.asyncio
async def test_event_to_ledger_invariant_and_replay_protection(
    gamification_test_env: dict,
) -> None:
    """
    1. FeedbackGenerated event awards XP.
    2. Invariant: profile.total_xp == sum(xp_transactions.amount).
    3. Replaying the exact same event does NOT award XP again (idempotent).
    4. Session with INSUFFICIENT_DATA does NOT award XP.
    """
    db_factory = gamification_test_env["db"]
    user, _ = await create_test_user(db_factory, email="event_test@example.com")
    session_id = uuid.uuid4()

    async with db_factory() as session:
        svc = GamificationService(session)

        # 1. Fire FeedbackGenerated with FEEDBACK_READY
        event1 = FeedbackGenerated(
            session_id=session_id,
            user_id=user.id,
            status="FEEDBACK_READY",
            overall_score=75.0,
            partial=False,
            skill_scores={"fluency": 75.0},
        )
        await svc.on_feedback_generated(event1)
        await session.commit()

        # Invariant check: total_xp must equal sum(amount)
        p = await svc._repo.get_or_create_profile(user.id)
        true_sum = await svc._repo.get_xp_sum(user.id)
        assert p.total_xp == true_sum
        # 100 XP from coach session + 20 XP from first streak bonus today = 120 XP
        assert p.total_xp == 120

        # 2. Replay the same event -> should be rejected by idempotency key
        await svc.on_feedback_generated(event1)
        await session.commit()

        p_after = await svc._repo.get_or_create_profile(user.id)
        true_sum_after = await svc._repo.get_xp_sum(user.id)
        assert p_after.total_xp == 120
        assert p_after.total_xp == true_sum_after

        # 3. Fire FeedbackGenerated with INSUFFICIENT_DATA -> does not add XP
        event_insufficient = FeedbackGenerated(
            session_id=uuid.uuid4(),
            user_id=user.id,
            status="INSUFFICIENT_DATA",
            overall_score=None,
            partial=False,
            skill_scores={},
        )
        await svc.on_feedback_generated(event_insufficient)
        await session.commit()

        p_insufficient = await svc._repo.get_or_create_profile(user.id)
        assert p_insufficient.total_xp == 120


@pytest.mark.asyncio
async def test_dashboard_and_gamification_endpoints(
    gamification_test_env: dict,
    client: AsyncClient,
) -> None:
    """Test GET /dashboard, GET /gamification/summary, GET /missions/today, and GET /badges."""
    db_factory = gamification_test_env["db"]
    user, token = await create_test_user(db_factory, email="dashboard_test@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET /dashboard
    resp = await client.get("/api/v1/dashboard", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "greeting" in data
    assert data["displayName"] == user.full_name
    assert "xp" in data
    assert "streak" in data
    assert "todayMissions" in data
    assert len(data["todayMissions"]) == 4
    assert "motivationalCard" in data
    assert len(data["skills"]) == 5

    # 2. GET /gamification/summary
    resp_sum = await client.get("/api/v1/gamification/summary", headers=headers)
    assert resp_sum.status_code == 200
    data_sum = resp_sum.json()
    assert data_sum["level"] == "A1"
    assert data_sum["nextLevel"] == "A2"
    assert len(data_sum["levelConditions"]) > 0

    # 3. GET /missions/today
    resp_m = await client.get("/api/v1/missions/today", headers=headers)
    assert resp_m.status_code == 200
    data_m = resp_m.json()
    assert data_m["totalCount"] == 4
    assert len(data_m["missions"]) == 4

    # 4. GET /badges
    resp_b = await client.get("/api/v1/badges", headers=headers)
    assert resp_b.status_code == 200
    data_b = resp_b.json()
    assert data_b["totalCount"] >= 6
    assert len(data_b["badges"]) >= 6


@pytest.mark.asyncio
async def test_daily_missions_concurrent_safety(
    gamification_test_env: dict,
    client: AsyncClient,
) -> None:
    """Calling /missions/today concurrently returns exactly 4 missions without duplicate records."""
    db_factory = gamification_test_env["db"]
    _, token = await create_test_user(db_factory, email="concurrent_m@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Call 5 times concurrently
    results = await asyncio.gather(
        client.get("/api/v1/missions/today", headers=headers),
        client.get("/api/v1/missions/today", headers=headers),
        client.get("/api/v1/missions/today", headers=headers),
        client.get("/api/v1/missions/today", headers=headers),
        client.get("/api/v1/missions/today", headers=headers),
    )

    for r in results:
        assert r.status_code == 200
        assert len(r.json()["missions"]) == 4


@pytest.mark.asyncio
async def test_claim_mission_flow(
    gamification_test_env: dict,
    client: AsyncClient,
) -> None:
    """Test completing a mission, claiming it, and verifying 409 when claiming again."""
    db_factory = gamification_test_env["db"]
    user, token = await create_test_user(db_factory, email="claim_m@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Fetch today's missions
    resp_today = await client.get("/api/v1/missions/today", headers=headers)
    missions = resp_today.json()["missions"]
    m_coach = next(m for m in missions if m["missionKey"] == "coach_session")

    # 2. Cannot claim while IN_PROGRESS -> 409
    resp_early = await client.post(f"/api/v1/missions/{m_coach['id']}/claim", headers=headers)
    assert resp_early.status_code == 409

    # 3. Complete mission manually in DB
    async with db_factory() as session:
        stmt = select(UserDailyMission).where(UserDailyMission.id == uuid.UUID(m_coach["id"]))
        db_m = (await session.execute(stmt)).scalar_one()
        db_m.progress = 1
        db_m.status = "COMPLETED"
        await session.commit()

    # 4. Claim mission -> 200 OK + 50 XP
    resp_claim = await client.post(f"/api/v1/missions/{m_coach['id']}/claim", headers=headers)
    assert resp_claim.status_code == 200
    claim_data = resp_claim.json()
    assert claim_data["claimed"] is True
    assert claim_data["xpAwarded"] == 50
    assert claim_data["newTotalXp"] == 50

    # 5. Claim again -> 409 MISSION_ALREADY_CLAIMED
    resp_again = await client.post(f"/api/v1/missions/{m_coach['id']}/claim", headers=headers)
    assert resp_again.status_code == 409
    assert resp_again.json()["code"] == "MISSION_ALREADY_CLAIMED"


@pytest.mark.asyncio
async def test_notifications_and_authorization(
    gamification_test_env: dict,
    client: AsyncClient,
) -> None:
    """Test listing notifications, marking read, and 404 for accessing other user's resource."""
    db_factory = gamification_test_env["db"]
    user1, token1 = await create_test_user(db_factory, email="u1_noti@example.com")
    user2, token2 = await create_test_user(db_factory, email="u2_noti@example.com")

    # Create notification for user1
    async with db_factory() as session:
        noti = Notification(
            id=uuid.uuid4(),
            user_id=user1.id,
            type="SYSTEM",
            title="Chào mừng bạn!",
            content="Bắt đầu học ngay hôm nay nhé.",
            is_read=False,
            created_at=datetime.now(UTC),
        )
        session.add(noti)
        await session.commit()
        noti_id = str(noti.id)

    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}

    # 1. User1 sees notification
    resp1 = await client.get("/api/v1/notifications", headers=headers1)
    assert resp1.status_code == 200
    assert resp1.json()["unreadCount"] == 1

    # 2. User2 tries to mark User1's notification read -> 404 NOT_FOUND (Rule 7)
    resp_unauth = await client.patch(f"/api/v1/notifications/{noti_id}/read", headers=headers2)
    assert resp_unauth.status_code == 404

    # 3. User1 marks notification read -> 200 OK
    resp_read = await client.patch(f"/api/v1/notifications/{noti_id}/read", headers=headers1)
    assert resp_read.status_code == 200

    # 4. Check unreadCount is now 0
    resp_after = await client.get("/api/v1/notifications", headers=headers1)
    assert resp_after.json()["unreadCount"] == 0
