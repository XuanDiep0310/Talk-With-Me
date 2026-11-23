"""Scenario editorial workflows and publication rules."""

import uuid
from collections.abc import Sequence

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock, get_clock
from app.models.admin_scenario_schemas import (
    AdminChunkInput,
    AdminRequirementInput,
    AdminScenarioDetail,
    AdminScenarioInput,
    AdminScenarioPage,
    AdminScenarioStatusUpdate,
    AdminScenarioSummary,
    AdminScenarioUpdate,
)
from app.models.scenario import (
    Scenario,
    ScenarioAdminAudit,
    ScenarioChunk,
    ScenarioRequirement,
    ScenarioStatus,
)
from app.repositories.admin_scenario import AdminScenarioRepository
from app.repositories.scenario_category import ScenarioCategoryRepository
from app.seeds.scenario_loader import seed_scenarios_if_empty


def publish_errors(content: Scenario | AdminScenarioInput) -> dict[str, str]:
    errors: dict[str, str] = {}
    chunks: Sequence[ScenarioChunk | AdminChunkInput] = content.chunks
    requirements: Sequence[ScenarioRequirement | AdminRequirementInput] = content.requirements
    for key, value in {
        "titleVi": content.title_vi,
        "titleEn": content.title_en,
        "context": content.context,
        "userRole": content.user_role,
        "aiRole": content.ai_role,
    }.items():
        if not value.strip():
            errors[key] = "Required for publishing."

    if not content.goals or any(not goal.strip() for goal in content.goals):
        errors["goals"] = "Add at least one non-empty learning goal."
    if not any(requirement.is_mandatory for requirement in requirements):
        errors["requirements"] = "Add at least one mandatory requirement."
    for index, requirement in enumerate(requirements):
        if not requirement.description.strip():
            errors[f"requirements.{index}.description"] = "Required for publishing."

    if not 4 <= len(chunks) <= 6:
        errors["chunks"] = "Add between four and six chunks."
    for index, chunk in enumerate(chunks):
        path = f"chunks.{index}"
        for key, value in {
            "text": chunk.text,
            "meaningVi": chunk.meaning_vi,
            "exampleSentence": chunk.example_sentence,
        }.items():
            if not value.strip():
                errors[f"{path}.{key}"] = "Required for publishing."
        if not chunk.accepted_variations or any(
            not item.strip() for item in chunk.accepted_variations
        ):
            errors[f"{path}.acceptedVariations"] = "Add at least one non-empty variation."
        for key, options, answer in (
            ("distractorsEn", chunk.distractors_en, chunk.text),
            ("distractorsVi", chunk.distractors_vi, chunk.meaning_vi),
        ):
            normalized = {option.strip().casefold() for option in options}
            if len(normalized) != 3 or "" in normalized or answer.strip().casefold() in normalized:
                errors[f"{path}.{key}"] = "Add three distinct incorrect answers."
    return errors


def _conflict(code: str, message: str) -> HTTPException:
    return HTTPException(status_code=409, detail={"code": code, "message": message})


class AdminScenarioService:
    def __init__(
        self, db: AsyncSession, actor_id: uuid.UUID, trace_id: str, clock: Clock | None = None
    ):
        self.db = db
        self.repo = AdminScenarioRepository(db)
        self.actor_id = actor_id
        self.trace_id = trace_id
        self.clock = clock or get_clock()

    async def list_page(
        self,
        category: str | None,
        level: str | None,
        status: ScenarioStatus | None,
        q: str | None,
        cursor: uuid.UUID | None,
        limit: int,
    ) -> AdminScenarioPage:
        await seed_scenarios_if_empty(self.db)
        scenarios = await self.repo.list_page(
            category=category, level=level, status=status, q=q, cursor=cursor, limit=limit + 1
        )
        return AdminScenarioPage(
            items=[AdminScenarioSummary.model_validate(scenario) for scenario in scenarios[:limit]],
            next_cursor=scenarios[limit - 1].id if len(scenarios) > limit else None,
            counts=await self.repo.status_counts(category, level, q),
        )

    async def _get(self, scenario_id: uuid.UUID, *, lock: bool = False) -> Scenario:
        scenario = await self.repo.get(scenario_id, lock=lock)
        if scenario is None:
            raise HTTPException(
                status_code=404,
                detail={"code": "SCENARIO_NOT_FOUND", "message": "Scenario not found."},
            )
        return scenario

    async def get(self, scenario_id: uuid.UUID) -> AdminScenarioDetail:
        return AdminScenarioDetail.model_validate(await self._get(scenario_id))

    async def create(self, body: AdminScenarioInput, action: str = "CREATE") -> AdminScenarioDetail:
        if action == "CREATE":
            await seed_scenarios_if_empty(self.db)
        await self._require_category(body.category)
        scenario = Scenario(id=uuid.uuid4(), status="DRAFT", revision=1)
        self._apply_content(scenario, body)
        self.db.add(scenario)
        return await self._commit(scenario, action)

    async def update(
        self, scenario_id: uuid.UUID, body: AdminScenarioUpdate
    ) -> AdminScenarioDetail:
        scenario = await self._get(scenario_id, lock=True)
        self._check_revision(scenario, body.revision)
        if scenario.status != "DRAFT":
            raise _conflict("SCENARIO_IMMUTABLE", "Only drafts can be edited.")
        await self._require_category(body.category)
        self._apply_content(scenario, body)
        scenario.revision += 1
        return await self._commit(scenario, "UPDATE")

    async def duplicate(self, scenario_id: uuid.UUID, slug: str) -> AdminScenarioDetail:
        source = await self._get(scenario_id, lock=True)
        content = AdminScenarioInput.model_validate(source).model_copy(update={"slug": slug})
        return await self.create(content, "DUPLICATE")

    async def _require_category(self, category: str) -> None:
        if not await ScenarioCategoryRepository(self.db).get(category):
            raise HTTPException(
                422, detail={"code": "CATEGORY_NOT_FOUND", "message": "Category not found."}
            )

    async def change_status(
        self, scenario_id: uuid.UUID, body: AdminScenarioStatusUpdate
    ) -> AdminScenarioDetail:
        scenario = await self._get(scenario_id, lock=True)
        self._check_revision(scenario, body.revision)
        transition = (scenario.status, body.status)
        if transition == ("DRAFT", "PUBLISHED"):
            errors = publish_errors(scenario)
            if errors:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "code": "SCENARIO_NOT_READY",
                        "message": "The draft has missing or invalid content.",
                        "details": {"fields": errors},
                    },
                )
            action = "PUBLISH"
        elif transition == ("PUBLISHED", "ARCHIVED"):
            action = "ARCHIVE"
        elif transition == ("ARCHIVED", "PUBLISHED"):
            action = "RESTORE"
        else:
            raise _conflict(
                "INVALID_SCENARIO_TRANSITION", "The requested status change is invalid."
            )
        scenario.status = body.status
        scenario.revision += 1
        return await self._commit(scenario, action)

    @staticmethod
    def _check_revision(scenario: Scenario, revision: int) -> None:
        if scenario.revision != revision:
            raise _conflict("SCENARIO_REVISION_CONFLICT", "The scenario has changed. Reload it.")

    @staticmethod
    def _apply_content(scenario: Scenario, body: AdminScenarioInput) -> None:
        for key, value in body.model_dump(exclude={"chunks", "requirements", "revision"}).items():
            setattr(scenario, key, value)
        scenario.chunks = [
            ScenarioChunk(sort_order=position, **chunk.model_dump())
            for position, chunk in enumerate(body.chunks, start=1)
        ]
        scenario.requirements = [
            ScenarioRequirement(sort_order=position, **requirement.model_dump())
            for position, requirement in enumerate(body.requirements, start=1)
        ]

    async def _commit(self, scenario: Scenario, action: str) -> AdminScenarioDetail:
        try:
            await self.db.flush()
            self.db.add(
                ScenarioAdminAudit(
                    scenario_id=scenario.id,
                    actor_id=self.actor_id,
                    action=action,
                    occurred_at=self.clock.now(),
                    trace_id=self.trace_id,
                )
            )
            await self.db.refresh(scenario, attribute_names=["updated_at"])
            response = AdminScenarioDetail.model_validate(scenario)
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            if getattr(exc.orig, "sqlstate", None) == "23505":
                raise _conflict("SCENARIO_SLUG_CONFLICT", "This slug is already in use.") from exc
            if (
                getattr(exc.orig, "sqlstate", None) == "23503"
                and getattr(getattr(exc.orig, "__cause__", None), "constraint_name", None)
                == "fk_scenarios_category"
            ):
                raise _conflict("CATEGORY_NOT_FOUND", "Category is no longer available.") from exc
            raise
        return response
