"""
Integration tests for the complete Onboarding API flows:
1. Placement Test -> Level -> Preferences -> Complete
2. Manual Self-Selection Level -> Preferences -> Complete
3. Insufficient data -> A1 fallback + needs_reassessment=True
4. Missing required preferences (empty list) is rejected with 422
5. Complete onboarding twice (idempotency check)
6. Accessing another user's placement test returns 404 (AGENTS.md §8 rule 7)
"""

from collections.abc import AsyncGenerator

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

from app.api.deps import get_db, get_redis
from app.core.config import Settings, get_settings
from app.main import app
from app.models.base import Base


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.ttls: dict[str, int] = {}

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def ttl(self, key: str) -> int:
        return self.ttls.get(key, 300)

    async def delete(self, key: str) -> None:
        self.store.pop(key, None)

    async def ping(self) -> bool:
        return True

    def pipeline(self) -> "FakePipeline":
        return FakePipeline(self)


class FakePipeline:
    def __init__(self, redis: FakeRedis) -> None:
        self.redis = redis
        self.ops: list = []

    def incr(self, key: str) -> "FakePipeline":
        current = int(self.redis.store.get(key, 0)) + 1
        self.redis.store[key] = str(current)
        return self

    def expire(self, key: str, seconds: int) -> "FakePipeline":
        self.redis.ttls[key] = seconds
        return self

    async def execute(self) -> list:
        return []


@pytest_asyncio.fixture
async def onboarding_db() -> AsyncGenerator[async_sessionmaker[AsyncSession], None]:
    engine: AsyncEngine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
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
async def client(
    onboarding_db: async_sessionmaker[AsyncSession],
) -> AsyncGenerator[AsyncClient, None]:
    fake_redis = FakeRedis()

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with onboarding_db() as session:
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
        REFRESH_TOKEN_REMEMBER_DAYS=30,
        REFRESH_TOKEN_NO_REMEMBER_DAYS=1,
        PLACEMENT_MIN_ANSWERS=3,
        PLACEMENT_MIN_WORDS=30,
    )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = override_get_redis
    app.dependency_overrides[get_settings] = lambda: test_settings

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    app.dependency_overrides.clear()


async def register_and_get_token(client: AsyncClient, email: str = "tester@example.com") -> str:
    res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "fullName": "Test User",
            "password": "Password123!",
            "termsAccepted": True,
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["accessToken"]


# ---------------------------------------------------------------------------
# Integration Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_onboarding_options(client: AsyncClient) -> None:
    res = await client.get("/api/v1/onboarding/options")
    assert res.status_code == 200
    data = res.json()
    assert len(data["interests"]) == 8
    assert len(data["goals"]) == 5
    assert len(data["weakPoints"]) == 5
    assert "A1" in data["cefrLevels"]
    assert len(data["placementQuestions"]) >= 3


@pytest.mark.asyncio
async def test_flow_placement_test_to_completion(client: AsyncClient) -> None:
    token = await register_and_get_token(client, "placement_user@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Placement Test
    test_res = await client.post("/api/v1/placement-tests", headers=headers)
    assert test_res.status_code == 201
    test_data = test_res.json()
    test_id = test_data["id"]
    assert test_data["status"] == "IN_PROGRESS"

    # 2. Submit 3 answers with enough words
    sample_answers = [
        "I visited Da Nang last summer with my best friends. It was truly memorable because the beaches were pristine and the food was delicious.",
        "My daily routine involves waking up early, having a fresh breakfast, studying English, and working on software projects.",
        "Technology plays a crucial role in my daily life because it allows me to communicate and work remotely seamlessly.",
    ]
    for i, ans in enumerate(sample_answers):
        ans_res = await client.post(
            f"/api/v1/placement-tests/{test_id}/answers",
            headers=headers,
            json={
                "requestId": f"req-uuid-{i}",
                "questionIndex": i,
                "transcript": ans,
                "sttConfidence": 0.9,
                "speakingDurationSeconds": 15.0,
                "responseLatencySeconds": 1.5,
            },
        )
        assert ans_res.status_code == 200
        assert ans_res.json()["wordCount"] > 10

    # 3. Complete placement test
    complete_res = await client.post(f"/api/v1/placement-tests/{test_id}/complete", headers=headers)
    assert complete_res.status_code == 200
    complete_data = complete_res.json()
    assert complete_data["estimatedLevel"] in ("A2", "B1", "B2", "C1")
    assert complete_data["isInsufficientData"] is False
    assert complete_data["needsReassessment"] is False

    # 4. Save preferences
    pref_res = await client.put(
        "/api/v1/me/preferences",
        headers=headers,
        json={
            "interests": ["travel", "technology"],
            "goals": ["daily_conversation", "work_presentation"],
            "weakPoints": ["pronunciation", "vocabulary"],
        },
    )
    assert pref_res.status_code == 200
    assert pref_res.json()["interests"] == ["travel", "technology"]

    # 5. Complete onboarding
    onboard_res = await client.post("/api/v1/me/onboarding/complete", headers=headers)
    assert onboard_res.status_code == 200
    onboard_data = onboard_res.json()
    assert onboard_data["onboardingCompletedAt"] is not None
    assert onboard_data["cefrLevel"] == complete_data["estimatedLevel"]
    assert onboard_data["levelSource"] == "PLACEMENT"

    # 6. Check /me returns full profile
    me_res = await client.get("/api/v1/me", headers=headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["cefrLevel"] == complete_data["estimatedLevel"]
    assert me_data["interests"] == ["travel", "technology"]
    assert me_data["goals"] == ["daily_conversation", "work_presentation"]
    assert me_data["weakPoints"] == ["pronunciation", "vocabulary"]
    assert me_data["onboardingCompletedAt"] is not None


@pytest.mark.asyncio
async def test_flow_self_selected_level_to_completion(client: AsyncClient) -> None:
    token = await register_and_get_token(client, "self_user@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Set Level manually
    level_res = await client.put(
        "/api/v1/me/level",
        headers=headers,
        json={"level": "B2", "source": "SELF"},
    )
    assert level_res.status_code == 200
    assert level_res.json()["cefrLevel"] == "B2"
    assert level_res.json()["levelSource"] == "SELF"

    # 2. Save preferences
    pref_res = await client.put(
        "/api/v1/me/preferences",
        headers=headers,
        json={
            "interests": ["food"],
            "goals": ["travel_solo"],
            "weakPoints": ["listening"],
        },
    )
    assert pref_res.status_code == 200

    # 3. Complete onboarding
    onboard_res = await client.post("/api/v1/me/onboarding/complete", headers=headers)
    assert onboard_res.status_code == 200
    assert onboard_res.json()["cefrLevel"] == "B2"
    assert onboard_res.json()["levelSource"] == "SELF"


@pytest.mark.asyncio
async def test_insufficient_data_falls_back_to_a1(client: AsyncClient) -> None:
    token = await register_and_get_token(client, "short_speaker@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Placement Test
    test_res = await client.post("/api/v1/placement-tests", headers=headers)
    test_id = test_res.json()["id"]

    # 2. Only submit 1 answer with 2 words (< min 3 answers & < min 30 words)
    await client.post(
        f"/api/v1/placement-tests/{test_id}/answers",
        headers=headers,
        json={
            "requestId": "short-req-1",
            "questionIndex": 0,
            "transcript": "Yes trip.",
            "sttConfidence": 0.5,
            "speakingDurationSeconds": 1.0,
            "responseLatencySeconds": 2.0,
        },
    )

    # 3. Complete test
    complete_res = await client.post(f"/api/v1/placement-tests/{test_id}/complete", headers=headers)
    assert complete_res.status_code == 200
    data = complete_res.json()
    assert data["estimatedLevel"] == "A1"
    assert data["isInsufficientData"] is True
    assert data["needsReassessment"] is True

    # 4. Profile reflects needs_reassessment=True
    me_res = await client.get("/api/v1/me", headers=headers)
    assert me_res.json()["cefrLevel"] == "A1"
    assert me_res.json()["needsReassessment"] is True


@pytest.mark.asyncio
async def test_missing_required_preferences_rejected(client: AsyncClient) -> None:
    token = await register_and_get_token(client, "invalid_pref@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Empty interests list
    res = await client.put(
        "/api/v1/me/preferences",
        headers=headers,
        json={
            "interests": [],
            "goals": ["daily_conversation"],
            "weakPoints": ["pronunciation"],
        },
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_complete_onboarding_idempotent(client: AsyncClient) -> None:
    token = await register_and_get_token(client, "idempotent_user@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    await client.put("/api/v1/me/level", headers=headers, json={"level": "A2", "source": "SELF"})
    await client.put(
        "/api/v1/me/preferences",
        headers=headers,
        json={
            "interests": ["sports"],
            "goals": ["job_interview"],
            "weakPoints": ["grammar"],
        },
    )

    # First call
    first_res = await client.post("/api/v1/me/onboarding/complete", headers=headers)
    assert first_res.status_code == 200
    first_ts = first_res.json()["onboardingCompletedAt"]

    # Second call - returns same timestamp without error
    second_res = await client.post("/api/v1/me/onboarding/complete", headers=headers)
    assert second_res.status_code == 200
    second_ts = second_res.json()["onboardingCompletedAt"]
    assert first_ts.rstrip("Z") == second_ts.rstrip("Z")


@pytest.mark.asyncio
async def test_accessing_other_users_placement_test_returns_404(client: AsyncClient) -> None:
    # User 1 creates a test
    token1 = await register_and_get_token(client, "user1@example.com")
    test_res = await client.post(
        "/api/v1/placement-tests", headers={"Authorization": f"Bearer {token1}"}
    )
    test_id = test_res.json()["id"]

    # User 2 tries to submit an answer to User 1's test
    token2 = await register_and_get_token(client, "user2@example.com")
    intruder_res = await client.post(
        f"/api/v1/placement-tests/{test_id}/answers",
        headers={"Authorization": f"Bearer {token2}"},
        json={
            "requestId": "intruder-req-1",
            "questionIndex": 0,
            "transcript": "I am an intruder",
        },
    )
    # AGENTS.md §7: Truy cập tài nguyên của người khác trả 404 chứ không phải 403
    assert intruder_res.status_code == 404
    assert intruder_res.json()["code"] == "PLACEMENT_TEST_NOT_FOUND"


@pytest.mark.asyncio
async def test_adaptive_placement_test_progression_and_early_convergence(client: AsyncClient) -> None:
    """Verify D-25: Tier progression from Tier 1 -> Tier 2 -> Tier 3 and early convergence at 3 answers."""
    token = await register_and_get_token(client, "adaptive_user@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Start placement test: initial tier is Tier 1
    create_res = await client.post("/api/v1/placement-tests", headers=headers)
    assert create_res.status_code == 201
    data = create_res.json()
    test_id = data["id"]
    assert data["initialTier"] == 1
    assert "Can you introduce yourself" in data["initialQuestion"]
    assert len(data["initialQuestionTranslation"]) > 0

    # 2. Answer 1: Strong answer -> Next question jumps to Tier 2
    ans1_res = await client.post(
        f"/api/v1/placement-tests/{test_id}/answers",
        headers=headers,
        json={
            "requestId": "adaptive-req-1",
            "questionIndex": 0,
            "transcript": "Hello, my name is Alex and in my free time I love reading books, playing tennis, and learning foreign languages every single day.",
            "sttConfidence": 0.95,
            "speakingDurationSeconds": 14.0,
            "responseLatencySeconds": 1.2,
        },
    )
    assert ans1_res.status_code == 200
    ans1_data = ans1_res.json()
    assert ans1_data["currentTier"] == 1
    assert ans1_data["nextTier"] == 2
    assert ans1_data["isConverged"] is False
    assert ans1_data["canFinishEarly"] is False
    assert ans1_data["totalAnswered"] == 1
    assert ans1_data["nextQuestion"] is not None
    assert ans1_data["nextQuestionTranslation"] is not None

    # 3. Answer 2: Another strong answer in Tier 2 -> Jumps to Tier 3
    q2_idx = ans1_data["nextQuestionIndex"]
    ans2_res = await client.post(
        f"/api/v1/placement-tests/{test_id}/answers",
        headers=headers,
        json={
            "requestId": "adaptive-req-2",
            "questionIndex": q2_idx,
            "transcript": "Last year I visited Da Nang with my friends and we explored ancient temples and experienced incredible coastal culture.",
            "sttConfidence": 0.94,
            "speakingDurationSeconds": 15.0,
            "responseLatencySeconds": 1.4,
        },
    )
    assert ans2_res.status_code == 200
    ans2_data = ans2_res.json()
    assert ans2_data["currentTier"] == 2
    assert ans2_data["nextTier"] == 3
    assert ans2_data["totalAnswered"] == 2
    assert ans2_data["canFinishEarly"] is False

    # 4. Answer 3: Strong answer in Tier 3 -> Reaches minimum 3 answers and converges early
    q3_idx = ans2_data["nextQuestionIndex"]
    ans3_res = await client.post(
        f"/api/v1/placement-tests/{test_id}/answers",
        headers=headers,
        json={
            "requestId": "adaptive-req-3",
            "questionIndex": q3_idx,
            "transcript": "From my perspective, artificial intelligence is transforming how industries operate and creating specialized career paths for technical talent.",
            "sttConfidence": 0.96,
            "speakingDurationSeconds": 18.0,
            "responseLatencySeconds": 1.5,
        },
    )
    assert ans3_res.status_code == 200
    ans3_data = ans3_res.json()
    assert ans3_data["currentTier"] == 3
    assert ans3_data["totalAnswered"] == 3
    assert ans3_data["canFinishEarly"] is True
    assert ans3_data["isConverged"] is True

    # 5. Complete test directly with early convergence
    comp_res = await client.post(f"/api/v1/placement-tests/{test_id}/complete", headers=headers)
    assert comp_res.status_code == 200
    comp_data = comp_res.json()
    assert comp_data["estimatedLevel"] in ("B1", "B2", "C1")
    assert comp_data["isInsufficientData"] is False
