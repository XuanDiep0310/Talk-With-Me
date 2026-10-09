"""
Onboarding repository: CRUD for PlacementTest, PlacementAnswer, LevelHistory, UserProfile onboarding fields.
No business logic here — only DB operations.
"""

import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auth import UserProfile
from app.models.onboarding import LevelHistory, PlacementAnswer, PlacementTest
from app.repositories.base import BaseRepository


class PlacementTestRepository(BaseRepository[PlacementTest]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def create(self, user_id: uuid.UUID) -> PlacementTest:
        test = PlacementTest(id=uuid.uuid4(), user_id=user_id, status="CREATED")
        self.session.add(test)
        await self.session.flush()
        return test

    async def get_by_id(self, test_id: uuid.UUID) -> PlacementTest | None:
        result = await self.session.execute(
            select(PlacementTest)
            .options(selectinload(PlacementTest.answers))
            .where(PlacementTest.id == test_id)
        )
        return result.scalar_one_or_none()

    async def get_by_id_and_user(
        self, test_id: uuid.UUID, user_id: uuid.UUID
    ) -> PlacementTest | None:
        """Scoped lookup — prevents accessing another user's test (AGENTS.md §8 rule 7)."""
        result = await self.session.execute(
            select(PlacementTest)
            .options(selectinload(PlacementTest.answers))
            .where(PlacementTest.id == test_id, PlacementTest.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def update_status(self, test_id: uuid.UUID, status: str) -> None:
        await self.session.execute(
            update(PlacementTest).where(PlacementTest.id == test_id).values(status=status)
        )
        await self.session.flush()

    async def complete(
        self,
        test_id: uuid.UUID,
        *,
        estimated_level: str,
        is_insufficient_data: bool,
        features_json: str,
        completed_at: datetime,
    ) -> None:
        await self.session.execute(
            update(PlacementTest)
            .where(PlacementTest.id == test_id)
            .values(
                status="COMPLETED",
                estimated_level=estimated_level,
                is_insufficient_data=is_insufficient_data,
                features_json=features_json,
                completed_at=completed_at,
            )
        )
        await self.session.flush()

    async def get_latest_for_user(self, user_id: uuid.UUID) -> PlacementTest | None:
        result = await self.session.execute(
            select(PlacementTest)
            .where(PlacementTest.user_id == user_id)
            .order_by(PlacementTest.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()


class PlacementAnswerRepository(BaseRepository[PlacementAnswer]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def create(
        self,
        test_id: uuid.UUID,
        request_id: str,
        question_index: int,
        transcript: str | None,
        stt_confidence: float | None,
        speaking_duration_seconds: float | None,
        response_latency_seconds: float | None,
        word_count: int | None,
    ) -> PlacementAnswer:
        answer = PlacementAnswer(
            id=uuid.uuid4(),
            test_id=test_id,
            request_id=request_id,
            question_index=question_index,
            transcript=transcript,
            stt_confidence=stt_confidence,
            speaking_duration_seconds=speaking_duration_seconds,
            response_latency_seconds=response_latency_seconds,
            word_count=word_count,
        )
        self.session.add(answer)
        await self.session.flush()
        return answer

    async def get_by_request_id(
        self, test_id: uuid.UUID, request_id: str
    ) -> PlacementAnswer | None:
        result = await self.session.execute(
            select(PlacementAnswer).where(
                PlacementAnswer.test_id == test_id,
                PlacementAnswer.request_id == request_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_test(self, test_id: uuid.UUID) -> list[PlacementAnswer]:
        result = await self.session.execute(
            select(PlacementAnswer)
            .where(PlacementAnswer.test_id == test_id)
            .order_by(PlacementAnswer.question_index)
        )
        return list(result.scalars().all())


class LevelHistoryRepository(BaseRepository[LevelHistory]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def record(
        self,
        user_id: uuid.UUID,
        level: str,
        source: str,
        placement_test_id: uuid.UUID | None,
        created_at: datetime,
    ) -> LevelHistory:
        entry = LevelHistory(
            id=uuid.uuid4(),
            user_id=user_id,
            level=level,
            source=source,
            placement_test_id=placement_test_id,
            created_at=created_at,
        )
        self.session.add(entry)
        await self.session.flush()
        return entry

    async def list_for_user(self, user_id: uuid.UUID) -> list[LevelHistory]:
        result = await self.session.execute(
            select(LevelHistory)
            .where(LevelHistory.user_id == user_id)
            .order_by(LevelHistory.created_at.desc())
        )
        return list(result.scalars().all())


class OnboardingProfileRepository:
    """Thin wrapper for onboarding-specific profile operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_profile(self, user_id: uuid.UUID) -> UserProfile | None:
        result = await self.session.execute(
            select(UserProfile).where(UserProfile.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def update_preferences(
        self,
        user_id: uuid.UUID,
        interests: list[str],
        goals: list[str],
        weak_points: list[str],
    ) -> None:
        import json

        await self.session.execute(
            update(UserProfile)
            .where(UserProfile.user_id == user_id)
            .values(
                interests=json.dumps(interests),
                goals=json.dumps(goals),
                weak_points=json.dumps(weak_points),
            )
        )
        await self.session.flush()

    async def set_level(
        self,
        user_id: uuid.UUID,
        level: str,
        source: str,
        needs_reassessment: bool,
    ) -> None:
        await self.session.execute(
            update(UserProfile)
            .where(UserProfile.user_id == user_id)
            .values(
                cefr_level=level,
                level_source=source,
                needs_reassessment=needs_reassessment,
            )
        )
        await self.session.flush()

    async def complete_onboarding(self, user_id: uuid.UUID, completed_at: datetime) -> None:
        await self.session.execute(
            update(UserProfile)
            .where(UserProfile.user_id == user_id)
            .values(onboarding_completed_at=completed_at)
        )
        await self.session.flush()
