"""
Integration tests for Scenario Lessons, Reflex Drills, Roleplays, and Evaluations (Sprint 5).

Covers:
1. Seed schema validation (20 scenarios, 4 groups, 4-6 chunks each, key UI scenarios present).
2. Library catalog with filtering (category, level, status, q) and progress statistics.
3. Scenario detail by ID/slug and chunks retrieval.
4. Drill attempts saving progress and handling skip.
5. Roleplay session lifecycle -> transcript -> end -> evaluation with Fake LLM & chunk bank update.
6. Evaluation idempotency (re-running evaluation does not duplicate records or conflict).
7. Access control: other user accessing roleplay session returns 404 (AGENTS.md §7).
"""

import asyncio
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

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
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models import ChunkBank, Scenario  # noqa: F401
from app.models.auth import User, UserProfile
from app.models.base import Base
from app.seeds.scenario_loader import load_all_scenarios_from_yaml, seed_scenarios


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
async def scenario_db() -> AsyncGenerator[async_sessionmaker[AsyncSession], None]:
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
async def scenario_test_env(
    scenario_db: async_sessionmaker[AsyncSession],
) -> AsyncGenerator[dict, None]:
    fake_redis = FakeRedis()

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with scenario_db() as session:
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
        SCORING_MIN_USER_WORDS=3,
        SCORING_MIN_USER_TURNS=1,
        SCORING_MIN_SPOKEN_SECONDS=1.0,
        ARQ_MODE="eager",
        LLM_PROVIDER="fake",
        GROQ_API_KEY="",
        LLM_API_KEY="",
    )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = override_get_redis
    app.dependency_overrides[get_settings] = lambda: test_settings

    # Pre-seed scenarios into in-memory DB
    async with scenario_db() as db:
        await seed_scenarios(db)

    # Seed primary test user
    user_id = uuid.uuid4()
    other_user_id = uuid.uuid4()
    async with scenario_db() as db:
        user = User(
            id=user_id,
            email="learner@talkwithme.vn",
            full_name="Test Learner",
            password_hash=hash_password("Pass1234"),
            is_active=True,
        )
        profile = UserProfile(
            user_id=user_id,
            cefr_level="B1",
            onboarding_completed_at=datetime.now(UTC),
        )
        other_user = User(
            id=other_user_id,
            email="other@talkwithme.vn",
            full_name="Other Learner",
            password_hash=hash_password("Pass1234"),
            is_active=True,
        )
        other_profile = UserProfile(
            user_id=other_user_id,
            cefr_level="A2",
            onboarding_completed_at=datetime.now(UTC),
        )
        db.add_all([user, profile, other_user, other_profile])
        await db.commit()

    token = create_access_token(
        payload={"sub": str(user_id), "email": "learner@talkwithme.vn"},
        expires_delta=timedelta(minutes=test_settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        secret=test_settings.JWT_SECRET_KEY,
        algorithm=test_settings.JWT_ALGORITHM,
    )
    other_token = create_access_token(
        payload={"sub": str(other_user_id), "email": "other@talkwithme.vn"},
        expires_delta=timedelta(minutes=test_settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        secret=test_settings.JWT_SECRET_KEY,
        algorithm=test_settings.JWT_ALGORITHM,
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield {
            "client": client,
            "token": token,
            "other_token": other_token,
            "user_id": user_id,
            "other_user_id": other_user_id,
            "db_factory": scenario_db,
        }

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_seed_schema_and_catalog_completeness() -> None:
    """Verify 20 scenarios, 4 categories (5 each), 4-6 chunks, and UI required scenarios."""
    scenarios = load_all_scenarios_from_yaml()
    assert len(scenarios) == 20, f"Expected 20 scenarios, got {len(scenarios)}"

    categories: dict[str, int] = {}
    slugs = set()
    titles_vi = set()

    for s in scenarios:
        cat = s["category"]
        categories[cat] = categories.get(cat, 0) + 1
        slugs.add(s["slug"])
        titles_vi.add(s["title_vi"])

        # Chunks requirement: 4 to 6 chunks per scenario
        chunks = s.get("chunks", [])
        assert 4 <= len(chunks) <= 6, f"Scenario {s['slug']} has {len(chunks)} chunks"

        # Requirements presence
        assert len(s.get("requirements", [])) >= 3

    assert categories == {
        "DAILY_LIFE": 5,
        "SOCIAL": 5,
        "TRAVEL_SHOPPING": 5,
        "WORKPLACE": 5,
    }

    # Verify key UI scenarios
    required_ui_titles = [
        "Mua sắm tại siêu thị",
        "Đặt bàn tại nhà hàng",
        "Đến gặp bác sĩ",
        "Thuê căn hộ",
        "Giới thiệu bản thân",
        "Tiệc gặp mặt (Party)",
        "Kết bạn online",
        "Phỏng vấn xin việc",
        "Họp nhóm dự án",
        "Gọi điện khách hàng",
    ]
    for required_title in required_ui_titles:
        assert required_title in titles_vi, f"Missing required UI scenario: {required_title}"


@pytest.mark.asyncio
async def test_get_scenarios_library_and_filtering(scenario_test_env: dict) -> None:
    client: AsyncClient = scenario_test_env["client"]
    token: str = scenario_test_env["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Full library listing
    resp = await client.get("/api/v1/scenarios", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["totalCount"] == 20
    assert len(data["scenarios"]) == 20
    assert len(data["categories"]) == 4
    assert data["xpReward"] == 100

    # 2. Filter by category
    resp_cat = await client.get("/api/v1/scenarios?category=DAILY_LIFE", headers=headers)
    assert resp_cat.status_code == 200
    data_cat = resp_cat.json()
    assert len(data_cat["scenarios"]) == 5
    assert all(s["category"] == "DAILY_LIFE" for s in data_cat["scenarios"])

    # 3. Filter by level
    resp_lvl = await client.get("/api/v1/scenarios?level=B1", headers=headers)
    assert resp_lvl.status_code == 200
    data_lvl = resp_lvl.json()
    assert len(data_lvl["scenarios"]) >= 3
    assert all(s["level"] == "B1" for s in data_lvl["scenarios"])

    # 4. Search query
    resp_q = await client.get("/api/v1/scenarios?q=bác sĩ", headers=headers)
    assert resp_q.status_code == 200
    data_q = resp_q.json()
    assert len(data_q["scenarios"]) == 1
    assert data_q["scenarios"][0]["slug"] == "doctor-visit"


@pytest.mark.asyncio
async def test_get_scenario_detail_and_chunks(scenario_test_env: dict) -> None:
    client: AsyncClient = scenario_test_env["client"]
    token: str = scenario_test_env["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get by slug
    resp = await client.get("/api/v1/scenarios/supermarket-shopping", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["slug"] == "supermarket-shopping"
    assert data["titleVi"] == "Mua sắm tại siêu thị"
    assert len(data["chunks"]) >= 4
    assert len(data["requirements"]) >= 3
    scenario_id = data["id"]

    # Get chunks endpoint
    chunks_resp = await client.get(f"/api/v1/scenarios/{scenario_id}/chunks", headers=headers)
    assert chunks_resp.status_code == 200
    chunks_data = chunks_resp.json()
    assert len(chunks_data["chunks"]) == len(data["chunks"])


@pytest.mark.asyncio
async def test_drill_recording_and_skip(scenario_test_env: dict) -> None:
    client: AsyncClient = scenario_test_env["client"]
    token: str = scenario_test_env["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get a scenario and its first chunk
    scen_resp = await client.get("/api/v1/scenarios/restaurant-reservation", headers=headers)
    scen = scen_resp.json()
    scen_id = scen["id"]
    chunk_id = scen["chunks"][0]["id"]

    # 1. Practice drill (listen and repeat)
    drill_payload = {"chunkId": chunk_id, "isSkipped": False}
    resp1 = await client.post(f"/api/v1/scenarios/{scen_id}/drills", json=drill_payload, headers=headers)
    assert resp1.status_code == 201
    data1 = resp1.json()
    assert str(chunk_id) in data1["practicedChunks"]

    # 2. Skip next drill
    chunk_id_2 = scen["chunks"][1]["id"]
    skip_payload = {"chunkId": chunk_id_2, "isSkipped": True}
    resp2 = await client.post(f"/api/v1/scenarios/{scen_id}/drills", json=skip_payload, headers=headers)
    assert resp2.status_code == 201

    # Verify scenario detail reflects IN_PROGRESS and practiced chunks
    detail_resp = await client.get(f"/api/v1/scenarios/{scen_id}", headers=headers)
    detail = detail_resp.json()
    assert detail["status"] == "IN_PROGRESS"
    assert str(chunk_id) in detail["practicedChunks"]


@pytest.mark.asyncio
async def test_roleplay_lifecycle_and_evaluation_flow(scenario_test_env: dict) -> None:
    client: AsyncClient = scenario_test_env["client"]
    token: str = scenario_test_env["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Start roleplay for supermarket scenario
    scen_resp = await client.get("/api/v1/scenarios/supermarket-shopping", headers=headers)
    scen = scen_resp.json()
    scen_id = scen["id"]

    roleplay_resp = await client.post(f"/api/v1/scenarios/{scen_id}/roleplays", headers=headers)
    assert roleplay_resp.status_code == 201
    roleplay_data = roleplay_resp.json()
    session_id = roleplay_data["sessionId"]
    assert roleplay_data["status"] == "CREATED"
    assert "openingMessage" in roleplay_data

    # 2. Send user and AI transcript turns
    t1_payload = {
        "id": str(uuid.uuid4()),
        "speaker": "USER",
        "text": "Excuse me, where can I find the fresh organic produce section?",
        "startMs": 1000,
        "endMs": 3500,
        "confidence": 0.95,
        "isFinal": True,
    }
    t1_resp = await client.post(f"/api/v1/roleplays/{session_id}/transcript", json=t1_payload, headers=headers)
    assert t1_resp.status_code == 201

    t2_payload = {
        "id": str(uuid.uuid4()),
        "speaker": "USER",
        "text": "How much is this bottle of olive oil? Do you accept credit cards here?",
        "startMs": 4000,
        "endMs": 7500,
        "confidence": 0.96,
        "isFinal": True,
    }
    t2_resp = await client.post(f"/api/v1/roleplays/{session_id}/transcript", json=t2_payload, headers=headers)
    assert t2_resp.status_code == 201

    # 3. End roleplay
    end_resp = await client.post(f"/api/v1/roleplays/{session_id}/end", headers=headers)
    assert end_resp.status_code == 200
    assert end_resp.json()["status"] == "ENDED"

    # Wait for background evaluation
    await asyncio.sleep(0.3)

    # 4. Fetch mission evaluation
    eval_resp = await client.get(f"/api/v1/roleplays/{session_id}/evaluation", headers=headers)
    assert eval_resp.status_code == 200
    eval_data = eval_resp.json()
    assert eval_data["sessionId"] == session_id
    assert eval_data["passed"] is True
    assert len(eval_data["requirements"]) >= 3
    assert len(eval_data["chunksUsedWell"]) >= 1
    assert len(eval_data["strengths"]) >= 2
    assert len(eval_data["improvements"]) >= 1

    # 5. Check chunk bank
    bank_resp = await client.get("/api/v1/me/chunk-bank", headers=headers)
    assert bank_resp.status_code == 200
    bank_data = bank_resp.json()
    assert bank_data["totalCount"] >= 1


@pytest.mark.asyncio
async def test_recompletion_idempotency(scenario_test_env: dict) -> None:
    """Verifies that calling end or evaluation multiple times is completely idempotent."""
    client: AsyncClient = scenario_test_env["client"]
    token: str = scenario_test_env["token"]
    headers = {"Authorization": f"Bearer {token}"}

    scen_resp = await client.get("/api/v1/scenarios/restaurant-reservation", headers=headers)
    scen_id = scen_resp.json()["id"]

    rp_resp = await client.post(f"/api/v1/scenarios/{scen_id}/roleplays", headers=headers)
    sess_id = rp_resp.json()["sessionId"]

    # Add utterance
    t_payload = {
        "id": str(uuid.uuid4()),
        "speaker": "USER",
        "text": "I'd like to book a table for four tonight near the window.",
        "startMs": 0,
        "endMs": 2500,
        "confidence": 0.95,
        "isFinal": True,
    }
    await client.post(f"/api/v1/roleplays/{sess_id}/transcript", json=t_payload, headers=headers)

    # End first time
    end1 = await client.post(f"/api/v1/roleplays/{sess_id}/end", headers=headers)
    assert end1.status_code == 200

    # End second time (should succeed without error)
    end2 = await client.post(f"/api/v1/roleplays/{sess_id}/end", headers=headers)
    assert end2.status_code == 200

    await asyncio.sleep(0.3)

    eval1 = await client.get(f"/api/v1/roleplays/{sess_id}/evaluation", headers=headers)
    eval2 = await client.get(f"/api/v1/roleplays/{sess_id}/evaluation", headers=headers)
    assert eval1.status_code == 200
    assert eval2.status_code == 200
    assert eval1.json()["passed"] == eval2.json()["passed"]


@pytest.mark.asyncio
async def test_other_user_roleplay_access_returns_404(scenario_test_env: dict) -> None:
    """Rule 7 AGENTS.md: Accessing another user's roleplay session returns 404, not 403."""
    client: AsyncClient = scenario_test_env["client"]
    token: str = scenario_test_env["token"]
    other_token: str = scenario_test_env["other_token"]

    scen_resp = await client.get("/api/v1/scenarios/job-interview", headers={"Authorization": f"Bearer {token}"})
    scen_id = scen_resp.json()["id"]

    rp_resp = await client.post(f"/api/v1/scenarios/{scen_id}/roleplays", headers={"Authorization": f"Bearer {token}"})
    sess_id = rp_resp.json()["sessionId"]

    # Other user attempts to access
    other_headers = {"Authorization": f"Bearer {other_token}"}
    resp_eval = await client.get(f"/api/v1/roleplays/{sess_id}/evaluation", headers=other_headers)
    assert resp_eval.status_code == 404

    resp_trans = await client.post(
        f"/api/v1/roleplays/{sess_id}/transcript",
        json={"id": str(uuid.uuid4()), "speaker": "USER", "text": "Hacked", "startMs": 0, "endMs": 1000},
        headers=other_headers,
    )
    assert resp_trans.status_code == 404

    resp_end = await client.post(f"/api/v1/roleplays/{sess_id}/end", headers=other_headers)
    assert resp_end.status_code == 404
