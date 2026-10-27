"""
Repository for Scenarios, Chunks, Requirements, Progress, Drills, and Evaluations.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.scenario import (
    ChunkBank,
    DrillAttempt,
    RoleplayEvaluation,
    Scenario,
    ScenarioChunk,
    UserScenarioProgress,
)


class ScenarioRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_scenarios(
        self,
        category: str | None = None,
        level: str | None = None,
        q: str | None = None,
    ) -> Sequence[Scenario]:
        stmt = (
            select(Scenario)
            .options(
                selectinload(Scenario.requirements),
                selectinload(Scenario.chunks),
            )
            .order_by(Scenario.sort_order.asc(), Scenario.created_at.asc())
        )
        if category:
            stmt = stmt.where(Scenario.category == category.upper())
        if level:
            stmt = stmt.where(Scenario.level == level.upper())
        if q:
            term = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    Scenario.title_vi.ilike(term),
                    Scenario.title_en.ilike(term),
                    Scenario.context.ilike(term),
                    Scenario.slug.ilike(term),
                )
            )

        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_by_id(self, scenario_id: uuid.UUID) -> Scenario | None:
        stmt = (
            select(Scenario)
            .options(
                selectinload(Scenario.requirements),
                selectinload(Scenario.chunks),
            )
            .where(Scenario.id == scenario_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Scenario | None:
        stmt = (
            select(Scenario)
            .options(
                selectinload(Scenario.requirements),
                selectinload(Scenario.chunks),
            )
            .where(Scenario.slug == slug)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_chunk_by_id(self, chunk_id: uuid.UUID) -> ScenarioChunk | None:
        stmt = select(ScenarioChunk).where(ScenarioChunk.id == chunk_id)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_user_progress(
        self, user_id: uuid.UUID, scenario_id: uuid.UUID
    ) -> UserScenarioProgress | None:
        stmt = select(UserScenarioProgress).where(
            UserScenarioProgress.user_id == user_id,
            UserScenarioProgress.scenario_id == scenario_id,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_user_progress(
        self, user_id: uuid.UUID
    ) -> Sequence[UserScenarioProgress]:
        stmt = select(UserScenarioProgress).where(UserScenarioProgress.user_id == user_id)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def upsert_user_progress(
        self,
        user_id: uuid.UUID,
        scenario_id: uuid.UUID,
        status: str | None = None,
        score: float | None = None,
        practiced_chunk_id: str | None = None,
        completed_at: datetime | None = None,
        last_attempt_at: datetime | None = None,
    ) -> UserScenarioProgress:
        progress = await self.get_user_progress(user_id, scenario_id)
        if not progress:
            chunks_list: list[str] = [practiced_chunk_id] if practiced_chunk_id else []
            progress = UserScenarioProgress(
                id=uuid.uuid4(),
                user_id=user_id,
                scenario_id=scenario_id,
                status=status or "NOT_STARTED",
                highest_score=score,
                practiced_chunks=chunks_list,
                completed_at=completed_at,
                last_attempt_at=last_attempt_at,
            )
            self.db.add(progress)
        else:
            if status and status != progress.status and (
                progress.status != "COMPLETED" or status == "COMPLETED"
            ):
                progress.status = status
            if score is not None and (
                progress.highest_score is None or score > progress.highest_score
            ):
                progress.highest_score = score
            if practiced_chunk_id and practiced_chunk_id not in progress.practiced_chunks:
                progress.practiced_chunks = [*progress.practiced_chunks, practiced_chunk_id]
            if completed_at:
                progress.completed_at = completed_at
            if last_attempt_at:
                progress.last_attempt_at = last_attempt_at

        await self.db.commit()
        await self.db.refresh(progress)
        return progress

    async def record_drill_attempt(
        self,
        user_id: uuid.UUID,
        scenario_id: uuid.UUID,
        chunk_id: uuid.UUID,
        is_skipped: bool = False,
    ) -> DrillAttempt:
        attempt = DrillAttempt(
            id=uuid.uuid4(),
            user_id=user_id,
            scenario_id=scenario_id,
            chunk_id=chunk_id,
            is_skipped=is_skipped,
        )
        self.db.add(attempt)
        await self.db.commit()
        await self.db.refresh(attempt)
        return attempt

    async def list_chunk_bank(self, user_id: uuid.UUID) -> Sequence[ChunkBank]:
        stmt = (
            select(ChunkBank)
            .options(
                selectinload(ChunkBank.chunk).selectinload(ScenarioChunk.scenario),
            )
            .where(ChunkBank.user_id == user_id)
            .order_by(ChunkBank.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def upsert_chunk_bank(
        self,
        user_id: uuid.UUID,
        chunk_id: uuid.UUID,
        status: str = "NEEDS_PRACTICE",
        last_reviewed_at: datetime | None = None,
    ) -> ChunkBank:
        stmt = select(ChunkBank).where(
            ChunkBank.user_id == user_id,
            ChunkBank.chunk_id == chunk_id,
        )
        res = await self.db.execute(stmt)
        entry = res.scalar_one_or_none()

        if not entry:
            entry = ChunkBank(
                id=uuid.uuid4(),
                user_id=user_id,
                chunk_id=chunk_id,
                status=status,
                last_reviewed_at=last_reviewed_at,
            )
            self.db.add(entry)
        else:
            entry.status = status
            if last_reviewed_at:
                entry.last_reviewed_at = last_reviewed_at

        await self.db.commit()
        await self.db.refresh(entry)
        return entry

    async def get_evaluation_by_session_id(
        self, session_id: uuid.UUID
    ) -> RoleplayEvaluation | None:
        stmt = (
            select(RoleplayEvaluation)
            .options(selectinload(RoleplayEvaluation.scenario))
            .where(RoleplayEvaluation.session_id == session_id)
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def save_evaluation(self, evaluation: RoleplayEvaluation) -> RoleplayEvaluation:
        stmt = select(RoleplayEvaluation).where(
            RoleplayEvaluation.session_id == evaluation.session_id
        )
        res = await self.db.execute(stmt)
        existing = res.scalar_one_or_none()
        if existing:
            existing.status = evaluation.status
            existing.passed = evaluation.passed
            existing.requirements_evaluation = evaluation.requirements_evaluation
            existing.chunks_used_well = evaluation.chunks_used_well
            existing.chunks_to_improve = evaluation.chunks_to_improve
            existing.strengths = evaluation.strengths
            existing.improvements = evaluation.improvements
            existing.next_practice = evaluation.next_practice
            existing.evaluated_at = evaluation.evaluated_at
            evaluation = existing
        else:
            self.db.add(evaluation)
        await self.db.commit()
        await self.db.refresh(evaluation)
        return evaluation
