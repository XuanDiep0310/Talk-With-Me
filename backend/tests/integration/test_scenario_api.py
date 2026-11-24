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
import os
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from redis.asyncio import Redis
from schemathesis import openapi
from schemathesis.checks import (
    content_type_conformance,
    response_schema_conformance,
    status_code_conformance,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool
from sqlalchemy.schema import CreateSchema, DropSchema

from app.api.deps import get_db, get_redis
from app.core.config import Settings, get_settings
from app.core.providers.llm_provider import FakeLlmProvider, get_llm_provider
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models import ChunkBank, Scenario  # noqa: F401
from app.models.auth import AccountAdminAudit, User, UserProfile
from app.models.base import Base
from app.models.scenario import ScenarioAdminAudit, UserScenarioProgress
from app.seeds.scenario_loader import load_all_scenarios_from_yaml, seed_scenarios

ADMIN_SCENARIOS = "/api/v1/admin/scenarios"


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
async def scenario_db(
    request: pytest.FixtureRequest, test_settings: Settings
) -> AsyncGenerator[async_sessionmaker[AsyncSession], None]:
    schema = None
    if getattr(request, "param", None) == "postgresql":
        if os.getenv("RUN_INTEGRATION_TESTS") != "true":
            pytest.skip("PostgreSQL integration tests are disabled")
        schema = f"scenario_test_{uuid.uuid4().hex}"
        engine: AsyncEngine = create_async_engine(
            test_settings.DATABASE_URL,
            connect_args={"server_settings": {"search_path": schema}},
        )
    else:
        engine = create_async_engine(
            "sqlite+aiosqlite:///:memory:",
            poolclass=StaticPool,
            connect_args={"check_same_thread": False},
        )

    try:
        async with engine.begin() as conn:
            if schema:
                await conn.execute(CreateSchema(schema))
            await conn.run_sync(Base.metadata.create_all)
        yield async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    finally:
        async with engine.begin() as conn:
            if schema:
                await conn.execute(DropSchema(schema, cascade=True, if_exists=True))
            else:
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


async def grant_scenario_admin(env: dict) -> dict[str, str]:
    async with env["db_factory"].begin() as db:
        user = await db.get(User, env["user_id"])
        user.role = "ADMIN"
    return {"Authorization": f"Bearer {env['token']}", "X-Trace-Id": "admin-scenario-test"}


@pytest.mark.integration
async def test_accounts_can_only_be_changed_by_another_admin(scenario_test_env: dict) -> None:
    env = scenario_test_env
    client: AsyncClient = env["client"]
    admin = await grant_scenario_admin(env)
    learner = {"Authorization": f"Bearer {env['other_token']}"}
    target = f"/api/v1/admin/users/{env['other_user_id']}"

    assert (await client.get("/api/v1/admin/users", headers=learner)).status_code == 403
    page = await client.get("/api/v1/admin/users", headers=admin, params={"q": "other@"})
    assert page.status_code == 200
    assert page.json()["items"][0]["cefrLevel"] == "A2"
    assert page.json()["items"][0]["completedSessions"] == 0

    own = await client.patch(
        f"/api/v1/admin/users/{env['user_id']}", json={"isActive": False}, headers=admin
    )
    assert own.status_code == 409
    assert (await client.patch(target, json={"role": "ADMIN"}, headers=admin)).status_code == 204
    assert (await client.get("/api/v1/admin/overview", headers=learner)).json()[
        "activeAccounts"
    ] == 2
    assert (await client.patch(target, json={"role": "LEARNER"}, headers=admin)).status_code == 204
    assert (await client.get("/api/v1/admin/users", headers=learner)).status_code == 403

    credentials = {
        "email": "other@talkwithme.vn",
        "password": "Pass1234",
        "rememberMe": False,
    }
    previous = await client.post("/api/v1/auth/login", json=credentials)
    assert previous.status_code == 200
    previous_refresh = {"refreshToken": previous.json()["refreshToken"]}
    assert (await client.patch(target, json={"isActive": False}, headers=admin)).status_code == 204
    assert (await client.post("/api/v1/auth/refresh", json=previous_refresh)).status_code == 401
    assert (await client.get("/api/v1/me", headers=learner)).status_code == 401
    login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "other@talkwithme.vn",
            "password": "Pass1234",
            "rememberMe": False,
        },
    )
    assert login.status_code == 403
    assert (await client.patch(target, json={"isActive": True}, headers=admin)).status_code == 204
    assert (await client.post("/api/v1/auth/refresh", json=previous_refresh)).status_code == 401
    assert (await client.get("/api/v1/me", headers=learner)).status_code == 401
    login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "other@talkwithme.vn",
            "password": "Pass1234",
            "rememberMe": False,
        },
    )
    assert login.status_code == 200
    new_headers = {"Authorization": "Bearer " + login.json()["accessToken"]}
    assert (await client.get("/api/v1/me", headers=new_headers)).status_code == 200
    async with env["db_factory"]() as db:
        audit = list(await db.scalars(select(AccountAdminAudit)))
        assert len(audit) == 4
        assert all(
            row.actor_id == env["user_id"] and row.target_id == env["other_user_id"]
            for row in audit
        )


@pytest.mark.integration
async def test_admin_catalog_tracks_renames_counts_and_referenced_categories(
    scenario_test_env: dict,
) -> None:
    env = scenario_test_env
    client: AsyncClient = env["client"]
    admin = await grant_scenario_admin(env)
    path = "/api/v1/admin/scenario-categories"
    assert (
        await client.post(path, json={"code": "INTERVIEWS", "nameVi": "Phỏng vấn"}, headers=admin)
    ).status_code == 201
    assert (
        await client.post(path, json={"code": "EMPTY", "nameVi": "Nhóm trống"}, headers=admin)
    ).status_code == 201
    assert (await client.delete(path + "/EMPTY", headers=admin)).status_code == 204
    assert (
        await client.post(
            ADMIN_SCENARIOS,
            json={"slug": "interview-practice", "category": "INTERVIEWS"},
            headers=admin,
        )
    ).status_code == 201
    assert (await client.delete(path + "/INTERVIEWS", headers=admin)).status_code == 409
    renamed = await client.patch(
        path + "/INTERVIEWS", json={"nameVi": "Phỏng vấn việc làm"}, headers=admin
    )
    assert renamed.json()["lessonCount"] == 1
    library = await client.get("/api/v1/scenarios", headers=admin)
    assert any(item["nameVi"] == "Phỏng vấn việc làm" for item in library.json()["categories"])
    page = await client.get(ADMIN_SCENARIOS, params={"status": "PUBLISHED"}, headers=admin)
    assert page.json()["counts"] == {"PUBLISHED": 20, "DRAFT": 1, "ARCHIVED": 0}


@pytest.mark.integration
async def test_ai_suggestions_are_validated_without_creating_a_draft(
    scenario_test_env: dict,
) -> None:
    env = scenario_test_env
    client: AsyncClient = env["client"]
    admin = await grant_scenario_admin(env)
    app.dependency_overrides[get_llm_provider] = FakeLlmProvider
    payload = {"topic": "Đặt phòng khách sạn", "level": "B1", "chunkCount": 5}
    assert (await client.post(ADMIN_SCENARIOS + "/generate", json=payload)).status_code == 401
    result = await client.post(ADMIN_SCENARIOS + "/generate", headers=admin, json=payload)
    assert result.status_code == 200, result.text
    draft = result.json()
    assert draft["slug"] == "dat-phong-khach-san"
    assert len(draft["chunks"]) == 5 and len(draft["requirements"]) == 2
    assert (await client.get(ADMIN_SCENARIOS, headers=admin)).json()["counts"]["DRAFT"] == 0
    options = await client.post(
        ADMIN_SCENARIOS + "/generate-distractors",
        headers=admin,
        json={
            "text": "Can I book here?",
            "meaningVi": "Tôi đặt phòng ở đây được không?",
            "level": "B1",
        },
    )
    assert options.status_code == 200, options.text
    assert len(options.json()["distractorsEn"]) == len(options.json()["distractorsVi"]) == 3

    class BrokenProvider(FakeLlmProvider):
        async def generate_editor_json(self, instruction: str, data: dict[str, object]) -> object:  # noqa: ARG002
            return {"chunks": []}

    app.dependency_overrides[get_llm_provider] = BrokenProvider
    rejected = await client.post(ADMIN_SCENARIOS + "/generate", headers=admin, json=payload)
    assert rejected.status_code == 502
    assert rejected.json()["code"] == "EDITOR_AI_UNAVAILABLE"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_admin_responses_match_the_exported_openapi(scenario_test_env: dict) -> None:
    client: AsyncClient = scenario_test_env["client"]
    admin = await grant_scenario_admin(scenario_test_env)
    schema = openapi.from_path(Path(__file__).resolve().parents[3] / "openapi/openapi.json")
    checks = [status_code_conformance, content_type_conformance, response_schema_conformance]

    created = await client.post(ADMIN_SCENARIOS, headers=admin, json={"slug": "contract-lesson"})
    assert created.status_code == 201, created.text
    schema[ADMIN_SCENARIOS]["POST"].Case().validate_response(created, checks=checks)
    scenario_id = created.json()["id"]
    for method, suffix, status_code, payload, headers in [
        ("GET", "", 200, None, admin),
        ("GET", "", 401, None, {}),
        ("GET", "/{id}", 200, None, admin),
        ("PUT", "/{id}", 200, {"slug": "contract-lesson", "revision": 1}, admin),
        ("PUT", "/{id}", 409, {"slug": "contract-lesson", "revision": 1}, admin),
        ("PATCH", "/{id}/status", 422, {"status": "PUBLISHED", "revision": 2}, admin),
        ("POST", "/{id}/duplicate", 201, {"slug": "contract-copy"}, admin),
    ]:
        path = ADMIN_SCENARIOS + suffix
        response = await client.request(
            method, path.format(id=scenario_id), json=payload, headers=headers
        )
        assert response.status_code == status_code, response.text
        operation = schema[path][method]
        case = operation.Case(path_parameters={"id": scenario_id} if suffix else None)
        case.validate_response(response, checks=checks)

    for path in (
        "/api/v1/admin/users",
        "/api/v1/admin/overview",
        "/api/v1/admin/scenario-categories",
        "/api/v1/admin/coach-topics",
        "/api/v1/admin/gamification/xp-rules",
        "/api/v1/admin/gamification/transactions",
        "/api/v1/admin/sessions",
    ):
        response = await client.get(path, headers=admin)
        assert response.status_code == 200, response.text
        schema[path]["GET"].Case().validate_response(response, checks=checks)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_admin_routes_check_database_role_on_every_request(scenario_test_env: dict) -> None:
    env = scenario_test_env
    client: AsyncClient = env["client"]
    learner = {"Authorization": f"Bearer {env['token']}"}
    scenario_id = uuid.uuid4()
    path = f"{ADMIN_SCENARIOS}/{scenario_id}"

    for method, url, body in [
        ("GET", ADMIN_SCENARIOS, None),
        ("POST", ADMIN_SCENARIOS, {"slug": "new-lesson"}),
        ("GET", path, None),
        ("PUT", path, {"slug": "new-lesson", "revision": 1}),
        ("PATCH", f"{path}/status", {"status": "PUBLISHED", "revision": 1}),
        ("POST", f"{path}/duplicate", {"slug": "new-copy"}),
    ]:
        assert (await client.request(method, url, json=body)).status_code == 401
        response = await client.request(method, url, json=body, headers=learner)
        assert response.status_code == 403
        assert response.json()["code"] == "ADMIN_REQUIRED"

    admin = await grant_scenario_admin(env)
    assert (await client.get("/api/v1/me", headers=admin)).json()["role"] == "ADMIN"
    assert (await client.get(ADMIN_SCENARIOS, headers=admin)).status_code == 200
    async with env["db_factory"].begin() as db:
        user = await db.get(User, env["user_id"])
        user.role = "LEARNER"
    assert (await client.get(ADMIN_SCENARIOS, headers=admin)).status_code == 403


@pytest.mark.integration
@pytest.mark.asyncio
async def test_admin_replaces_lesson_without_breaking_existing_roleplay(
    scenario_test_env: dict,
) -> None:
    env = scenario_test_env
    client: AsyncClient = env["client"]
    admin = await grant_scenario_admin(env)
    learner = {"Authorization": f"Bearer {env['other_token']}"}

    response = await client.post(ADMIN_SCENARIOS, headers=admin, json={"slug": "incomplete"})
    assert response.status_code == 201, response.text
    draft = response.json()
    incomplete = await client.patch(
        f"{ADMIN_SCENARIOS}/{draft['id']}/status",
        headers=admin,
        json={"status": "PUBLISHED", "revision": draft["revision"]},
    )
    assert incomplete.status_code == 422
    assert "titleVi" in incomplete.json()["details"]["fields"]
    assert (await client.get("/api/v1/scenarios/incomplete", headers=learner)).status_code == 404

    source = (await client.get("/api/v1/scenarios/supermarket-shopping", headers=learner)).json()
    source_id = source["id"]
    source_admin = (await client.get(f"{ADMIN_SCENARIOS}/{source_id}", headers=admin)).json()
    copied = await client.post(
        f"{ADMIN_SCENARIOS}/{source_id}/duplicate", headers=admin, json={"slug": "new-market"}
    )
    assert copied.status_code == 201, copied.text
    copy = copied.json()
    assert copy["status"] == "DRAFT"
    assert copy["id"] != source_id
    assert copy["chunks"][0]["id"] != source["chunks"][0]["id"]
    assert copy["requirements"][0]["id"] != source["requirements"][0]["id"]
    assert copy["chunks"][0]["distractorsEn"] == source_admin["chunks"][0]["distractorsEn"]

    copy_path = f"{ADMIN_SCENARIOS}/{copy['id']}"
    updated = await client.put(
        copy_path, headers=admin, json={**copy, "titleVi": "Mua sắm: bài mới"}
    )
    assert updated.status_code == 200, updated.text
    publish = await client.patch(
        f"{copy_path}/status",
        headers=admin,
        json={"status": "PUBLISHED", "revision": updated.json()["revision"]},
    )
    assert publish.status_code == 200, publish.text
    immutable = await client.put(copy_path, headers=admin, json=publish.json())
    assert immutable.status_code == 409
    assert immutable.json()["code"] == "SCENARIO_IMMUTABLE"

    started = await client.post(f"/api/v1/scenarios/{source_id}/roleplays", headers=learner)
    assert started.status_code == 201, started.text
    session_id = started.json()["sessionId"]
    transcript = f"/api/v1/roleplays/{session_id}/transcript"
    first_turn = {
        "id": str(uuid.uuid4()),
        "speaker": "USER",
        "text": "Excuse me, where can I find the fresh organic produce section?",
        "startMs": 1000,
        "endMs": 8000,
        "confidence": 0.95,
        "isFinal": True,
    }
    assert (await client.post(transcript, headers=learner, json=first_turn)).status_code == 201
    archived = await client.patch(
        f"{ADMIN_SCENARIOS}/{source_id}/status",
        headers=admin,
        json={"status": "ARCHIVED", "revision": source_admin["revision"]},
    )
    assert archived.status_code == 200, archived.text
    for path in [source_id, "supermarket-shopping", f"{source_id}/chunks"]:
        hidden = await client.get(f"/api/v1/scenarios/{path}", headers=learner)
        assert hidden.status_code == 404
    drill = await client.post(
        f"/api/v1/scenarios/{source_id}/drills",
        headers=learner,
        json={"chunkId": source["chunks"][0]["id"], "isSkipped": False},
    )
    assert drill.status_code == 404
    assert (
        await client.post(f"/api/v1/scenarios/{source_id}/roleplays", headers=learner)
    ).status_code == 404

    turn = await client.post(
        transcript,
        headers=learner,
        json={
            **first_turn,
            "id": str(uuid.uuid4()),
            "text": "How much is this bottle of olive oil? Do you accept credit cards?",
            "startMs": 9000,
            "endMs": 16000,
        },
    )
    assert turn.status_code == 201, turn.text
    assert (
        await client.post(f"/api/v1/roleplays/{session_id}/end", headers=learner)
    ).status_code == 200
    evaluation = await client.get(f"/api/v1/roleplays/{session_id}/evaluation", headers=learner)
    assert evaluation.status_code == 200, evaluation.text
    assert evaluation.json()["scenarioId"] == source_id
    assert (await client.get("/api/v1/me/chunk-bank", headers=learner)).json()["totalCount"] >= 1
    history = await client.get("/api/v1/progress/history", headers=learner)
    assert history.status_code == 200, history.text
    assert session_id in history.text

    catalog = (await client.get("/api/v1/scenarios", headers=learner)).json()
    assert catalog["totalCount"] == 20
    assert catalog["completedCount"] == 0
    replacement = next(row for row in catalog["scenarios"] if row["id"] == copy["id"])
    assert replacement["status"] == "NOT_STARTED"
    assert not any(row["id"] == source_id for row in catalog["scenarios"])
    async with env["db_factory"]() as db:
        assert await seed_scenarios(db) == 0
        original = await db.get(Scenario, uuid.UUID(source_id))
        assert original.status == "ARCHIVED"
        assert await db.scalar(
            select(UserScenarioProgress.id).where(
                UserScenarioProgress.user_id == env["other_user_id"],
                UserScenarioProgress.scenario_id == uuid.UUID(source_id),
            )
        )
        audit = await db.scalar(
            select(ScenarioAdminAudit).where(
                ScenarioAdminAudit.scenario_id == uuid.UUID(source_id),
                ScenarioAdminAudit.action == "ARCHIVE",
            )
        )
        assert audit.actor_id == env["user_id"]
        assert audit.trace_id == "admin-scenario-test"

    restored = await client.patch(
        f"{ADMIN_SCENARIOS}/{source_id}/status",
        headers=admin,
        json={"status": "PUBLISHED", "revision": archived.json()["revision"]},
    )
    assert restored.status_code == 200, restored.text
    assert (await client.get(f"/api/v1/scenarios/{source_id}", headers=learner)).status_code == 200


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.parametrize("scenario_db", ["postgresql"], indirect=True)
async def test_admin_prevents_concurrent_overwrites_and_duplicate_slugs(
    scenario_test_env: dict,
) -> None:
    client: AsyncClient = scenario_test_env["client"]
    headers = await grant_scenario_admin(scenario_test_env)
    created = await client.post(ADMIN_SCENARIOS, headers=headers, json={"slug": "concurrent"})
    assert created.status_code == 201, created.text
    draft = created.json()
    path = f"{ADMIN_SCENARIOS}/{draft['id']}"
    responses = await asyncio.gather(
        client.put(path, headers=headers, json={**draft, "titleEn": "First edit"}),
        client.put(path, headers=headers, json={**draft, "titleEn": "Second edit"}),
    )
    assert sorted(response.status_code for response in responses) == [200, 409]
    failed = next(response for response in responses if response.status_code == 409)
    assert failed.json()["code"] == "SCENARIO_REVISION_CONFLICT"
    duplicated = await client.post(ADMIN_SCENARIOS, headers=headers, json={"slug": draft["slug"]})
    assert duplicated.status_code == 409
    assert duplicated.json()["code"] == "SCENARIO_SLUG_CONFLICT"

    page = await client.get(ADMIN_SCENARIOS, headers=headers, params={"limit": 1})
    assert page.status_code == 200
    first = page.json()
    second = await client.get(
        ADMIN_SCENARIOS, headers=headers, params={"limit": 1, "cursor": first["nextCursor"]}
    )
    assert second.json()["items"][0]["id"] != first["items"][0]["id"]
    filtered = await client.get(
        ADMIN_SCENARIOS, headers=headers, params={"q": "concurrent", "status": "DRAFT"}
    )
    assert [row["id"] for row in filtered.json()["items"]] == [draft["id"]]


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
    resp1 = await client.post(
        f"/api/v1/scenarios/{scen_id}/drills", json=drill_payload, headers=headers
    )
    assert resp1.status_code == 201
    data1 = resp1.json()
    assert str(chunk_id) in data1["practicedChunks"]

    # 2. Skip next drill
    chunk_id_2 = scen["chunks"][1]["id"]
    skip_payload = {"chunkId": chunk_id_2, "isSkipped": True}
    resp2 = await client.post(
        f"/api/v1/scenarios/{scen_id}/drills", json=skip_payload, headers=headers
    )
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
    t1_resp = await client.post(
        f"/api/v1/roleplays/{session_id}/transcript", json=t1_payload, headers=headers
    )
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
    t2_resp = await client.post(
        f"/api/v1/roleplays/{session_id}/transcript", json=t2_payload, headers=headers
    )
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

    scen_resp = await client.get(
        "/api/v1/scenarios/job-interview", headers={"Authorization": f"Bearer {token}"}
    )
    scen_id = scen_resp.json()["id"]

    rp_resp = await client.post(
        f"/api/v1/scenarios/{scen_id}/roleplays", headers={"Authorization": f"Bearer {token}"}
    )
    sess_id = rp_resp.json()["sessionId"]

    # Other user attempts to access
    other_headers = {"Authorization": f"Bearer {other_token}"}
    resp_eval = await client.get(f"/api/v1/roleplays/{sess_id}/evaluation", headers=other_headers)
    assert resp_eval.status_code == 404

    resp_trans = await client.post(
        f"/api/v1/roleplays/{sess_id}/transcript",
        json={
            "id": str(uuid.uuid4()),
            "speaker": "USER",
            "text": "Hacked",
            "startMs": 0,
            "endMs": 1000,
        },
        headers=other_headers,
    )
    assert resp_trans.status_code == 404

    resp_end = await client.post(f"/api/v1/roleplays/{sess_id}/end", headers=other_headers)
    assert resp_end.status_code == 404


@pytest.mark.integration
@pytest.mark.parametrize("scenario_db", ["sqlite", "postgresql"], indirect=True)
async def test_admin_coach_topic_publication_and_session_snapshot(
    scenario_test_env: dict, scenario_db: async_sessionmaker[AsyncSession]
) -> None:
    from app.api.deps import get_llm_provider as provider_dependency
    from app.models.admin_audit import AdminAuditEvent

    env = scenario_test_env
    client = env["client"]
    learner = {"Authorization": f"Bearer {env['token']}"}
    admin_path = "/api/v1/admin/coach-topics"
    assert (await client.get(admin_path)).status_code == 401
    assert (await client.get(admin_path, headers=learner)).status_code == 403
    admin = await grant_scenario_admin(env)
    app.dependency_overrides[provider_dependency] = FakeLlmProvider
    draft = await client.post(
        admin_path + "/generate", headers=admin, json={"idea": "Weekend plans"}
    )
    assert draft.status_code == 200
    created = await client.post(admin_path, headers=admin, json=draft.json())
    assert created.status_code == 201
    topic = created.json()
    assert topic["isActive"] is False
    session_path = "/api/v1/coach/sessions"
    data = {"topicId": topic["id"]}
    assert (await client.post(session_path, headers=admin, json=data)).status_code == 404
    patch_path = f"{admin_path}/{topic['id']}"
    assert (
        await client.patch(patch_path, headers=admin, json={"isActive": True})
    ).status_code == 200
    started = await client.post(session_path, headers=admin, json=data)
    assert started.status_code == 201, started.text
    assert (
        await client.patch(
            patch_path, headers=admin, json={"title": "Updated topic", "isActive": False}
        )
    ).status_code == 200
    assert (await client.post(session_path, headers=admin, json=data)).status_code == 404
    history = await client.get(f"{session_path}/{started.json()['id']}", headers=admin)
    assert history.json()["topic"]["title"] == topic["title"]
    page = await client.get(admin_path, headers=admin, params={"q": "Updated", "isActive": False})
    assert [item["id"] for item in page.json()] == [topic["id"]]
    async with scenario_db() as db:
        events = (
            await db.scalars(
                select(AdminAuditEvent).where(AdminAuditEvent.target_id == topic["id"])
            )
        ).all()
        assert len(events) == 3


@pytest.mark.integration
@pytest.mark.parametrize("scenario_db", ["postgresql"], indirect=True)
async def test_admin_gamification_preserves_issued_terms_and_claims_once(
    scenario_test_env: dict, scenario_db: async_sessionmaker[AsyncSession]
) -> None:
    from app.models.gamification import UserDailyMission
    from app.repositories.gamification import GamificationRepository
    from app.seeds.gamification_seeds import seed_gamification

    env = scenario_test_env
    client = env["client"]
    admin = await grant_scenario_admin(env)
    learner = {"Authorization": f"Bearer {env['other_token']}"}
    base = "/api/v1/admin/gamification"
    async with scenario_db() as db:
        await seed_gamification(db)
    assert (await client.get(base + "/xp-rules", headers=learner)).status_code == 403
    today = "/api/v1/missions/today"
    issued = (await client.get(today, headers=learner)).json()
    coach = next(row for row in issued["missions"] if row["missionKey"] == "coach_session")
    assert coach["xpReward"] == 50 and coach["target"] == 1
    assert (
        await client.patch(base + "/xp-rules/DAILY_MISSION", headers=admin, json={"xpAmount": 75})
    ).status_code == 200
    assert (
        await client.patch(
            base + "/missions/coach_session", headers=admin, json={"targetCount": 2, "xpReward": 80}
        )
    ).status_code == 200
    async with scenario_db() as db:
        await seed_gamification(db)
        row = await db.get(UserDailyMission, uuid.UUID(coach["id"]))
        assert row is not None
        row.status = "COMPLETED"
        await db.commit()
    new = (await client.get(today, headers=admin)).json()["missions"]
    assert next(row for row in new if row["missionKey"] == "coach_session")["xpReward"] == 80
    assert next(row for row in new if row["missionKey"] == "new_scenario")["xpReward"] == 75
    assert (
        await client.patch(
            base + "/xp-rules/DAILY_MISSION", headers=admin, json={"isActive": False}
        )
    ).status_code == 200
    assert len((await client.get(today, headers=learner)).json()["missions"]) == 3
    claim_path = f"/api/v1/missions/{coach['id']}/claim"
    results = await asyncio.gather(*(client.post(claim_path, headers=learner) for _ in range(2)))
    assert sorted(response.status_code for response in results) == [200, 409]
    assert (
        next(response for response in results if response.status_code == 200).json()["xpAwarded"]
        == 50
    )
    ledger = await client.get(
        base + "/transactions",
        headers=admin,
        params={"idempotencyKey": f"DAILY_MISSION:{coach['id']}"},
    )
    assert ledger.status_code == 200, ledger.text
    assert [item["amount"] for item in ledger.json()["items"]] == [50]
    async with scenario_db() as db:
        repo = GamificationRepository(db)
        profile = await repo.get_or_create_profile(env["other_user_id"])
        assert profile.total_xp == await repo.get_xp_sum(env["other_user_id"]) == 50


@pytest.mark.integration
@pytest.mark.parametrize("scenario_db", ["postgresql"], indirect=True)
async def test_session_qa_scopes_pagination_and_serializes_retry(
    scenario_test_env: dict,
    scenario_db: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from unittest.mock import AsyncMock

    from app.core.providers.stt_provider import SttResult, WordTiming
    from app.models.admin_audit import AdminAuditEvent
    from app.models.scoring import SessionFeedback
    from app.models.session import Session, TranscriptSegment
    from app.repositories.session import TranscriptRepository
    from app.services.scoring import tasks
    from app.services.speech_features import apply_speech_features

    env = scenario_test_env
    client = env["client"]
    admin = await grant_scenario_admin(env)
    learner = {"Authorization": f"Bearer {env['other_token']}"}
    session_id, segment_id = uuid.uuid4(), str(uuid.uuid4())
    async with scenario_db.begin() as db:
        db.add(
            Session(
                id=session_id,
                user_id=env["other_user_id"],
                level="B1",
                type="COACH",
                status="ACTIVE",
                speech_features_version=1,
            )
        )

    async def store():
        async with scenario_db() as db:
            row = TranscriptSegment(
                id=segment_id,
                session_id=session_id,
                user_id=env["other_user_id"],
                speaker="USER",
                text="Um, hello.",
                start_ms=0,
                end_ms=0,
                is_final=True,
            )
            apply_speech_features(
                row,
                pause_threshold_ms=1500,
                capture_offset_ms=500,
                playback_end_ms=100,
                stt=SttResult(
                    "Um, hello.",
                    0.8,
                    1.2,
                    [WordTiming("Um", 0, 600, 0.8), WordTiming("hello", 2200, 2800, 0.8)],
                    word_times_measured=True,
                    measured_confidence=0.8,
                ),
            )
            _, inserted = await TranscriptRepository(db).add_active_segment(
                row, env["other_user_id"]
            )
            return inserted

    assert sorted(await asyncio.gather(store(), store())) == [False, True]
    async with scenario_db.begin() as db:
        session = await db.get(Session, session_id)
        assert session is not None and session.spoken_seconds == 1.2
        session.status = "FAILED"
        session.ended_at = datetime.now(UTC)
        db.add(SessionFeedback(session_id=session_id, status="FAILED", retryable=True))
        db.add(
            TranscriptSegment(
                id=str(uuid.uuid4()),
                session_id=session_id,
                speaker="USER",
                seq=2,
                text="Legacy utterance",
                confidence=0.95,
                start_ms=0,
                end_ms=2000,
                is_final=True,
            )
        )

    path = f"/api/v1/admin/sessions/{session_id}"
    assert (await client.get(path, headers=learner)).status_code == 403
    first = await client.get(path + "/transcript", headers=admin, params={"limit": 1})
    assert first.status_code == 200, first.text
    assert first.headers["cache-control"] == "no-store"
    item = first.json()["items"][0]
    assert item["confidence"] == 0.8 and item["speechMs"] == 1200
    assert item["longPauseCount"] == 1 and item["longPauseMs"] == 1600
    second = (
        await client.get(
            path + "/transcript",
            headers=admin,
            params={"cursor": first.json()["nextCursor"], "limit": 1},
        )
    ).json()
    assert second["items"][0]["confidence"] is None
    assert second["items"][0]["speechMs"] is None
    assert (
        await client.patch(path + "/qa-labels", headers=admin, json={"labels": ["UNUSUAL_SCORE"]})
    ).status_code == 200
    assert (
        await client.get("/api/v1/admin/sessions", headers=admin, params={"label": "STT"})
    ).json()["items"] == []
    found = (
        await client.get(
            "/api/v1/admin/sessions",
            headers=admin,
            params={
                "label": "UNUSUAL_SCORE",
                "q": "other learner",
                "userId": str(env["other_user_id"]),
            },
        )
    ).json()
    assert [row["id"] for row in found["items"]] == [str(session_id)]

    enqueue = AsyncMock(side_effect=ConnectionError("queue offline"))
    monkeypatch.setattr(tasks, "enqueue_feedback_job", enqueue)
    failed_request = await client.post(path + "/retry-feedback", headers=admin)
    assert failed_request.status_code == 503
    failed_detail = (await client.get(path, headers=admin)).json()
    assert failed_detail["status"] == "FAILED" and failed_detail["feedback"]["retryable"]
    enqueue.side_effect = None
    enqueue.reset_mock()
    retries = await asyncio.gather(
        *(client.post(path + "/retry-feedback", headers=admin) for _ in range(2))
    )
    assert [response.status_code for response in retries] == [202, 202]
    enqueue.assert_awaited_once_with(session_id, strict=True)
    async with scenario_db() as db:
        audit = (
            await db.scalars(
                select(AdminAuditEvent).where(AdminAuditEvent.action == "SESSION_TRANSCRIPT_VIEWED")
            )
        ).all()
        assert len(audit) == 2
        assert all(event.before is None and event.after is None for event in audit)


@pytest.mark.integration
async def test_admin_force_logout_revokes_access_refresh_and_ticket(
    scenario_test_env: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    from unittest.mock import AsyncMock

    from fastapi import WebSocket

    from app.api.v1.endpoints import ws_session

    env = scenario_test_env
    client = env["client"]
    admin = await grant_scenario_admin(env)
    secret = {"email": "other@talkwithme.vn", "password": "Pass1234"}
    login = await client.post("/api/v1/auth/login", json=secret)
    assert login.status_code == 200, login.text
    body = login.json()
    learner = {"Authorization": f"Bearer {body['accessToken']}"}
    session = await client.post("/api/v1/coach/sessions", json={}, headers=learner)
    assert session.status_code == 201
    ticket = (await client.post("/api/v1/ws-tickets", headers=learner)).json()["ticket"]
    user_route = f"/api/v1/admin/users/{env['other_user_id']}"
    async with env["db_factory"].begin() as db:
        preferences = await db.get(UserProfile, env["other_user_id"])
        assert preferences is not None
        preferences.goals = '["job_interview"]'
        preferences.weak_points = '["pronunciation"]'
    profile = await client.get(user_route, headers=admin)
    assert profile.status_code == 200, profile.text
    assert profile.json()["loginMethods"] == ["password"]
    assert profile.json()["goalLabels"] == ["Phỏng vấn xin việc"]
    assert profile.json()["weakPointLabels"] == ["Phát âm"]
    assert (await client.post(user_route + "/force-logout", headers=admin)).status_code == 204
    assert (await client.get("/api/v1/me", headers=learner)).status_code == 401
    assert (
        await client.post("/api/v1/auth/refresh", json={"refreshToken": body["refreshToken"]})
    ).status_code == 401
    from app.api.deps import get_redis

    redis = app.dependency_overrides[get_redis]()
    monkeypatch.setattr(ws_session, "get_redis_client", lambda: redis)
    monkeypatch.setattr(ws_session, "async_session_factory", env["db_factory"])
    ws = AsyncMock(spec=WebSocket)
    await ws_session.session_websocket_endpoint(ws, uuid.UUID(session.json()["id"]), ticket, 0)
    ws.close.assert_awaited_once_with(code=4004)


@pytest.mark.integration
@pytest.mark.parametrize("scenario_db", ["postgresql"], indirect=True)
async def test_admin_analytics_uses_local_days_and_fresh_measured_data(
    scenario_test_env: dict,
    scenario_db: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from types import SimpleNamespace

    from app.models.onboarding import PlacementTest
    from app.models.scenario import RoleplayEvaluation
    from app.models.scoring import SessionFeedback, SessionSkillScore
    from app.models.session import CoachTopic, Session, TranscriptSegment

    now = datetime(2026, 11, 24, 18, 0, tzinfo=UTC)
    monkeypatch.setattr(
        "app.services.admin_reporting.get_clock", lambda: SimpleNamespace(now=lambda: now)
    )
    env = scenario_test_env
    learner_id = env["other_user_id"]
    client = env["client"]
    admin = await grant_scenario_admin(env)
    path = "/api/v1/admin/analytics/overview"
    assert (await client.get(path)).status_code == 401
    assert (
        await client.get(path, headers={"Authorization": f"Bearer {env['other_token']}"})
    ).status_code == 403
    response = await client.get(path, headers=admin)
    assert response.status_code == 200, response.text
    before = response.json()
    assert before["speakingMinutes"] == {"average": None, "sampleCount": 0, "legacySampleCount": 0}
    assert before["activeToday"] == before["activeInPeriod"] == 0
    assert len(before["days"]) == 7
    assert before["days"][-1]["day"] == "2026-11-25"
    assert before["days"][-1]["isPartial"]

    today, yesterday, pending = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    async with scenario_db.begin() as db:
        scenario_id = await db.scalar(select(Scenario.id).limit(1))
        assert scenario_id is not None
        boundary = datetime(2026, 11, 24, 17, 0, tzinfo=UTC)
        active_id, placement_id, older_id, created_id = (uuid.uuid4() for _ in range(4))
        topic_id = uuid.uuid4()
        db.add(
            CoachTopic(
                id=topic_id, title="Travel plans", category="Travel", description="Plan a trip"
            )
        )
        for user_id in (active_id, placement_id, older_id, created_id):
            db.add(User(id=user_id, email=f"{user_id}@example.com", full_name="Analytics fixture"))
        await db.flush()
        db.add_all(
            [
                Session(
                    user_id=active_id,
                    type="COACH",
                    level="A1",
                    status="ACTIVE",
                    started_at=boundary - timedelta(seconds=1),
                ),
                Session(
                    user_id=created_id,
                    type="COACH",
                    level="A1",
                    status="CREATED",
                    started_at=boundary,
                ),
                PlacementTest(
                    user_id=older_id, status="COMPLETED", completed_at=boundary - timedelta(days=12)
                ),
                PlacementTest(user_id=placement_id, status="COMPLETED", completed_at=boundary),
                Session(
                    id=today,
                    user_id=learner_id,
                    type="COACH",
                    level="A2",
                    status="FEEDBACK_READY",
                    ended_at=boundary,
                    speech_features_version=1,
                    topic_id=topic_id,
                ),
                Session(
                    id=yesterday,
                    user_id=learner_id,
                    type="ROLEPLAY",
                    level="A1",
                    scenario_id=scenario_id,
                    status="FEEDBACK_READY",
                    ended_at=boundary - timedelta(seconds=1),
                    spoken_seconds=120,
                ),
                Session(
                    id=pending,
                    user_id=learner_id,
                    type="ROLEPLAY",
                    level="A1",
                    scenario_id=scenario_id,
                    status="ENDED",
                    ended_at=boundary,
                ),
            ]
        )
        await db.flush()
        db.add_all(
            [
                SessionFeedback(session_id=today, status="FEEDBACK_READY", formula_version="1.1.0"),
                RoleplayEvaluation(
                    session_id=yesterday,
                    user_id=learner_id,
                    scenario_id=scenario_id,
                    status="COMPLETED",
                    passed=False,
                ),
                TranscriptSegment(
                    session_id=today,
                    id=str(uuid.uuid4()),
                    speaker="USER",
                    text="measured",
                    speech_source="STT",
                    speech_ms=60000,
                    confidence=0.8,
                ),
                TranscriptSegment(
                    session_id=yesterday,
                    id=str(uuid.uuid4()),
                    speaker="USER",
                    text="legacy",
                    confidence=0.95,
                ),
            ]
        )
        await db.flush()
        db.add_all(
            [
                SessionSkillScore(
                    session_id=today, skill_name="pronunciation", score=80, is_reference=True
                ),
                SessionSkillScore(session_id=today, skill_name="listening", score=None),
            ]
        )
    week = await client.get(path, headers=admin)
    assert week.json()["activeInPeriod"] == 3
    response = await client.get(path, headers=admin, params={"range": "30d"})
    assert response.status_code == 200, response.text
    report = response.json()
    assert len(report["days"]) == 30
    assert report["activeToday"] == report["days"][-1]["activeLearners"] == 3
    assert report["activeInPeriod"] == 4
    assert report["days"][-2]["roleplaySessions"] == 1
    assert report["days"][-1]["coachSessions"] == report["days"][-1]["roleplaySessions"] == 1
    assert report["speakingMinutes"] == {"average": 1.5, "sampleCount": 2, "legacySampleCount": 1}
    assert report["sttConfidence"] == {"average": 0.8, "sampleCount": 1}
    assert report["feedbackStatuses"]["NOT_REQUESTED"] == 2
    assert report["skills"] == [
        {
            "skill": "pronunciation",
            "formulaVersion": "1.1.0",
            "isReference": True,
            "average": 80.0,
            "sampleCount": 1,
        }
    ]
    assert report["popularCoachTopics"] == [
        {"id": str(topic_id), "title": "Travel plans", "attempts": 1}
    ]
    hardest = report["difficultScenarios"][0]
    assert (hardest["attempts"], hardest["evaluatedAttempts"], hardest["failureRate"]) == (2, 1, 1)
    schema = openapi.from_path(Path(__file__).resolve().parents[3] / "openapi/openapi.json")
    schema[path]["GET"].Case().validate_response(
        response,
        checks=[status_code_conformance, content_type_conformance, response_schema_conformance],
    )


@pytest.mark.integration
@pytest.mark.parametrize("scenario_db", ["postgresql"], indirect=True)
async def test_admin_audit_merges_sources_and_keeps_cursor_stable(
    scenario_test_env: dict, scenario_db: async_sessionmaker[AsyncSession]
) -> None:
    from app.models.admin_audit import AdminAuditEvent

    env = scenario_test_env
    client = env["client"]
    admin = await grant_scenario_admin(env)
    at = datetime(2026, 11, 24, 17, tzinfo=UTC)
    async with scenario_db.begin() as db:
        scenario_id = await db.scalar(select(Scenario.id).limit(1))
        db.add_all(
            [
                AdminAuditEvent(
                    actor_id=env["user_id"],
                    target_type="SESSION",
                    target_id=str(uuid.uuid4()),
                    action="SESSION_TRANSCRIPT_VIEWED",
                    occurred_at=at,
                    trace_id="unified",
                ),
                ScenarioAdminAudit(
                    actor_id=env["user_id"],
                    scenario_id=scenario_id,
                    action="PUBLISH",
                    occurred_at=at,
                    trace_id="unified",
                ),
                AccountAdminAudit(
                    actor_id=env["user_id"],
                    target_id=env["other_user_id"],
                    previous_role="LEARNER",
                    new_role="LEARNER",
                    previous_active=True,
                    new_active=False,
                    occurred_at=at,
                    trace_id="unified",
                ),
            ]
        )
    path = "/api/v1/admin/audit-logs"
    cursor = None
    rows = []
    for _ in range(3):
        filters = {"limit": 1, "traceId": "unified"}
        if cursor:
            filters["cursor"] = cursor
        response = await client.get(path, headers=admin, params=filters)
        assert response.status_code == 200, response.text
        body = response.json()
        rows.extend(body["items"])
        cursor = body["nextCursor"]
    assert cursor is None
    assert {event["source"] for event in rows} == {"ACCOUNT", "ADMIN", "SCENARIO"}
    assert (
        next(event for event in rows if event["source"] == "ACCOUNT")["after"]["isActive"] is False
    )
    assert next(event for event in rows if event["source"] == "SCENARIO")["before"] is None


@pytest.mark.integration
@pytest.mark.parametrize("scenario_db", ["sqlite", "postgresql"], indirect=True)
async def test_admin_accounts_page_uses_newest_date_and_stable_ties(
    scenario_test_env: dict,
) -> None:
    env = scenario_test_env
    admin = await grant_scenario_admin(env)
    async with env["db_factory"].begin() as db:
        times = [datetime(2026, 1, 2, tzinfo=UTC)] * 2 + [datetime(2026, 1, 1, tzinfo=UTC)]
        ids = [*sorted((uuid.uuid4(), uuid.uuid4()), reverse=True), uuid.uuid4()]
        for user_id, created_at in zip(ids, times, strict=True):
            db.add(
                User(
                    id=user_id,
                    email=f"{user_id}@example.com",
                    full_name="Cursor fixture",
                    created_at=created_at,
                )
            )
    path = "/api/v1/admin/users"
    params = {"q": "Cursor fixture", "limit": 2}
    first = await env["client"].get(path, headers=admin, params=params)
    assert first.status_code == 200, first.text
    assert [entry["id"] for entry in first.json()["items"]] == [str(item) for item in ids[:2]]
    second = await env["client"].get(
        path,
        headers=admin,
        params={
            **params,
            "cursor": first.json()["nextCursor"],
        },
    )
    assert second.status_code == 200, second.text
    assert [entry["id"] for entry in second.json()["items"]] == [str(ids[2])]
    assert second.json()["nextCursor"] is None


@pytest.mark.integration
@pytest.mark.parametrize("scenario_db", ["postgresql"], indirect=True)
async def test_admin_creates_missions_and_awards_badges_from_editable_criteria(
    scenario_test_env: dict,
    scenario_db: async_sessionmaker[AsyncSession],
) -> None:
    from app.repositories.gamification import GamificationRepository
    from app.seeds.gamification_seeds import seed_gamification
    from app.services.gamification import GamificationService

    env = scenario_test_env
    client = env["client"]
    admin = await grant_scenario_admin(env)
    learner = {"Authorization": f"Bearer {env['other_token']}"}
    base = "/api/v1/admin/gamification"
    async with scenario_db() as db:
        await seed_gamification(db)
    mission = {
        "key": "event_coach",
        "title": "Event Coach",
        "conditionType": "COACH_SESSION",
        "targetCount": 2,
        "xpReward": 70,
        "isActive": True,
    }
    assert (await client.post(base + "/missions", headers=learner, json=mission)).status_code == 403
    created = await client.post(base + "/missions", headers=admin, json=mission)
    assert created.status_code == 201, created.text
    assert (await client.post(base + "/missions", headers=admin, json=mission)).status_code == 409
    issued = (await client.get("/api/v1/missions/today", headers=learner)).json()["missions"]
    assert next(row for row in issued if row["missionKey"] == "event_coach")["xpReward"] == 70
    data = {
        "key": "event_level",
        "name": "Event badge",
        "description": "Reach A2",
        "iconEmoji": "★",
        "criteriaType": "CEFR_LEVEL",
        "minLevel": "A2",
    }
    response = await client.post(base + "/badges", headers=admin, json=data)
    assert response.status_code == 201, response.text
    assert response.json()["isActive"] is False

    async def earned() -> set[str]:
        async with scenario_db.begin() as db:
            repo = GamificationRepository(db)
            service = GamificationService(db)
            await service.evaluate_badges(env["other_user_id"])
            return {badge.badge_key for badge in await repo.get_user_badges(env["other_user_id"])}

    assert "event_level" not in await earned()
    response = await client.patch(
        base + "/badges/event_level", headers=admin, json={"isActive": True}
    )
    assert response.status_code == 200, response.text
    assert "event_level" in await earned()
    response = await client.patch(
        base + "/badges/event_level", headers=admin, json={"isActive": False}
    )
    assert response.status_code == 200
    assert "event_level" in await earned()


@pytest.mark.integration
@pytest.mark.parametrize("scenario_db", ["postgresql"], indirect=True)
async def test_admin_adjusts_level_and_xp_with_ledger_idempotency(
    scenario_test_env: dict,
    scenario_db: async_sessionmaker[AsyncSession],
) -> None:
    from unittest.mock import AsyncMock

    from app.api.deps import get_email_sender
    from app.models.onboarding import LevelHistory
    from app.repositories.gamification import GamificationRepository

    env = scenario_test_env
    client = env["client"]
    target = env["other_user_id"]
    admin = await grant_scenario_admin(env)
    path = f"/api/v1/admin/users/{target}"
    level = {"level": "B2", "reason": "Placement reassessment"}
    assert (await client.patch(path + "/level", headers=admin, json=level)).status_code == 204
    assert (await client.patch(path + "/level", headers=admin, json=level)).status_code == 204
    grant = {"requestId": str(uuid.uuid4()), "amount": 40, "reason": "Correct streak award"}
    requests = await asyncio.gather(
        *(client.post(path + "/xp-adjustments", headers=admin, json=grant) for _ in range(2))
    )
    assert [response.status_code for response in requests] == [204, 204]
    assert (
        await client.post(path + "/xp-adjustments", headers=admin, json={**grant, "amount": 50})
    ).status_code == 409
    correction = {"requestId": str(uuid.uuid4()), "amount": -10, "reason": "Correct excess award"}
    assert (
        await client.post(path + "/xp-adjustments", headers=admin, json=correction)
    ).status_code == 204
    assert (
        await client.post(
            path + "/xp-adjustments",
            headers=admin,
            json={**correction, "requestId": str(uuid.uuid4()), "amount": -40},
        )
    ).status_code == 409
    mailer = AsyncMock()
    app.dependency_overrides[get_email_sender] = lambda: mailer
    assert (await client.post(path + "/password-reset", headers=admin)).status_code == 204
    mailer.send_password_reset.assert_awaited_once()
    async with scenario_db() as db:
        result = (
            await db.scalars(select(LevelHistory).where(LevelHistory.user_id == target))
        ).one()
        assert (result.from_level, result.level, result.source) == ("A2", "B2", "ADMIN_ADJUSTMENT")
        repo = GamificationRepository(db)
        profile = await repo.get_or_create_profile(target)
        assert profile.total_xp == await repo.get_xp_sum(target) == 30
        rows = await repo.list_xp_transactions(target)
        assert len(rows) == 2 and all(row.source_type == "ADMIN_ADJUSTMENT" for row in rows)


@pytest.mark.integration
async def test_admin_topic_actions_keep_seed_and_session_history_safe(
    scenario_test_env: dict,
) -> None:
    env = scenario_test_env
    client = env["client"]
    admin = await grant_scenario_admin(env)
    base = "/api/v1/admin/coach-topics"
    before = (await client.get(base, headers=admin)).json()
    first, second = before[:2]
    assert (
        await client.post(
            base + "/" + second["id"] + "/move", headers=admin, json={"direction": "up"}
        )
    ).status_code == 204
    reordered = (await client.get(base, headers=admin)).json()
    assert [row["id"] for row in reordered[:2]] == [second["id"], first["id"]]
    assert (await client.delete(base + "/" + second["id"], headers=admin)).status_code == 204
    assert second["id"] not in {row["id"] for row in (await client.get(base, headers=admin)).json()}
    learner = {"Authorization": f"Bearer {env['other_token']}"}
    sessions = "/api/v1/coach/sessions"
    assert (
        await client.post(sessions, headers=learner, json={"topicId": second["id"]})
    ).status_code == 404
    assert (
        await client.post(sessions, headers=learner, json={"topicId": first["id"]})
    ).status_code == 201
    assert (await client.delete(base + "/" + first["id"], headers=admin)).status_code == 409


@pytest.mark.integration
async def test_admin_qa_note_and_reevaluation_preserve_published_scores(
    scenario_test_env: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.models.admin_audit import AdminAuditEvent
    from app.models.scoring import SessionFeedback
    from app.models.session import Session, TranscriptSegment

    monkeypatch.setattr("app.services.scoring.service.get_llm_provider", FakeLlmProvider)

    env = scenario_test_env
    client = env["client"]
    admin = await grant_scenario_admin(env)
    learner = {"Authorization": f"Bearer {env['other_token']}"}
    session_id = uuid.uuid4()
    async with env["db_factory"].begin() as db:
        db.add(
            Session(
                id=session_id,
                user_id=env["other_user_id"],
                type="COACH",
                status="ACTIVE",
                level="A2",
            )
        )
    path = f"/api/v1/admin/sessions/{session_id}"
    body = {"requestId": str(uuid.uuid4())}
    assert (await client.post(path + "/reevaluate", headers=admin, json=body)).status_code == 409
    async with env["db_factory"].begin() as db:
        session = await db.get(Session, session_id)
        session.status = "FEEDBACK_READY"
        session.ended_at = datetime.now(UTC)
        db.add(SessionFeedback(session_id=session_id, status="FEEDBACK_READY", overall_score=82))
    assert (
        await client.patch(path + "/qa-note", headers=learner, json={"note": "private"})
    ).status_code == 403
    assert (
        await client.patch(path + "/qa-note", headers=admin, json={"note": "private"})
    ).status_code == 200
    preview = await client.post(path + "/reevaluate", headers=admin, json=body)
    assert preview.status_code == 200, preview.text
    assert preview.json()["status"] == "INSUFFICIENT_DATA"
    assert (
        await client.post(path + "/reevaluate", headers=admin, json=body)
    ).json() == preview.json()
    detail = (await client.get(path, headers=admin)).json()
    assert detail["qaNote"] == "private" and detail["qaPreview"]["overallScore"] is None
    async with env["db_factory"].begin() as db:
        db.add(
            TranscriptSegment(
                id=str(uuid.uuid4()),
                session_id=session_id,
                speaker="USER",
                seq=1,
                text="I like to practice speaking English with classmates after our lessons today.",
                speech_source="STT",
                speech_ms=7200,
                speech_span_ms=8000,
                long_pause_count=0,
                word_count=13,
                confidence=0.9,
                response_latency_ms=600,
            )
        )
    recalculated = await client.post(
        path + "/reevaluate", headers=admin, json={"requestId": str(uuid.uuid4())}
    )
    assert recalculated.status_code == 200, recalculated.text
    assert recalculated.json()["status"] == "FEEDBACK_READY"
    assert recalculated.json()["formulaVersion"] == "1.1.0"
    feedback = (
        await client.get(f"/api/v1/coach/sessions/{session_id}/feedback", headers=learner)
    ).json()
    assert feedback["overallScore"] == 82 and "qaNote" not in feedback
    async with env["db_factory"]() as db:
        events = (
            await db.scalars(
                select(AdminAuditEvent).where(AdminAuditEvent.target_id == str(session_id))
            )
        ).all()
        assert sorted(event.action for event in events) == [
            "SESSION_QA_NOTE_UPDATED",
            "SESSION_QA_REEVALUATED",
            "SESSION_QA_REEVALUATED",
        ]
        assert all("private" not in str(event.after) for event in events)
