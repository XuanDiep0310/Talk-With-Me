"""
API endpoints for Scenario Lessons, Reflex Drills, Roleplays, Evaluations, and Chunk Bank.
"""

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.auth import User
from app.models.coach_schemas import (
    AddTranscriptSegmentRequest,
    EndSessionResponse,
    TranscriptSegmentResponse,
)
from app.models.scenario_schemas import (
    ChunkBankResponse,
    CreateRoleplayRequest,
    RecordDrillRequest,
    RecordDrillResponse,
    RoleplayEvaluationResponse,
    RoleplaySessionResponse,
    ScenarioChunksResponse,
    ScenarioDetailResponse,
    ScenarioLibraryResponse,
)
from app.services.scenario import ScenarioService

router = APIRouter()


@router.get(
    "/scenarios",
    response_model=ScenarioLibraryResponse,
    tags=["Scenarios"],
    summary="List scenarios with filters and completion stats",
)
async def list_scenarios(
    category: str | None = Query(
        None, description="Category filter (DAILY_LIFE, SOCIAL, TRAVEL_SHOPPING, WORKPLACE)"
    ),
    level: str | None = Query(None, description="CEFR level filter (A1, A2, B1, B2, C1)"),
    status: str | None = Query(
        None, description="Status filter (NOT_STARTED, IN_PROGRESS, COMPLETED)"
    ),
    q: str | None = Query(None, description="Search term for title or context"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScenarioLibraryResponse:
    """Retrieve all scenarios with personalized user progress, categorized counts, and filters."""
    service = ScenarioService(db)
    return await service.list_scenarios(
        user_id=current_user.id,
        category=category,
        level=level,
        status_filter=status,
        q=q,
    )


@router.get(
    "/scenarios/{id}",
    response_model=ScenarioDetailResponse,
    tags=["Scenarios"],
    summary="Get scenario detail with requirements, chunks, and progress",
)
async def get_scenario_detail(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScenarioDetailResponse:
    """Get full scenario details by UUID or slug, including requirements, chunks, and practiced status."""
    service = ScenarioService(db)
    return await service.get_scenario_detail(id, current_user.id)


@router.get(
    "/scenarios/{id}/chunks",
    response_model=ScenarioChunksResponse,
    tags=["Scenarios"],
    summary="Get scenario chunks for learning and reflex practice",
)
async def get_scenario_chunks(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),  # noqa: ARG001
    db: AsyncSession = Depends(get_db),
) -> ScenarioChunksResponse:
    """Retrieve useful language chunks for the scenario."""
    service = ScenarioService(db)
    return await service.get_scenario_chunks(id)


@router.post(
    "/scenarios/{id}/drills",
    response_model=RecordDrillResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Scenarios"],
    summary="Record chunk reflex drill attempt",
)
async def record_drill_attempt(
    id: uuid.UUID,
    data: RecordDrillRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RecordDrillResponse:
    """Record an ungraded listen-and-repeat chunk drill attempt or skip."""
    service = ScenarioService(db)
    return await service.record_drill(
        scenario_id=id,
        user_id=current_user.id,
        data=data,
    )


@router.post(
    "/scenarios/{id}/roleplays",
    response_model=RoleplaySessionResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Scenarios"],
    summary="Start an interactive roleplay session for a scenario",
)
async def start_scenario_roleplay(
    id: uuid.UUID,
    data: CreateRoleplayRequest | None = None,  # noqa: ARG001
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RoleplaySessionResponse:
    """Create a new roleplay session (type=ROLEPLAY) and generate initial AI greeting."""
    service = ScenarioService(db)
    return await service.create_roleplay_session(scenario_id=id, user_id=current_user.id)


@router.post(
    "/roleplays/{id}/transcript",
    response_model=TranscriptSegmentResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Roleplays"],
    summary="Add a transcript segment to roleplay session",
)
async def add_roleplay_transcript_segment(
    id: uuid.UUID,
    data: AddTranscriptSegmentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TranscriptSegmentResponse:
    """Idempotently add a Live Script dialogue turn to the roleplay session."""
    service = ScenarioService(db)
    return await service.add_transcript_segment(session_id=id, user_id=current_user.id, data=data)


@router.post(
    "/roleplays/{id}/end",
    response_model=EndSessionResponse,
    tags=["Roleplays"],
    summary="End roleplay session and trigger evaluation",
)
async def end_roleplay_session(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EndSessionResponse:
    """End the roleplay session and asynchronously trigger requirement and scoring evaluation."""
    service = ScenarioService(db)
    return await service.end_roleplay_session(session_id=id, user_id=current_user.id)


@router.get(
    "/roleplays/{id}/evaluation",
    response_model=RoleplayEvaluationResponse,
    tags=["Roleplays"],
    summary="Get mission evaluation and chunk feedback for roleplay session",
)
async def get_roleplay_evaluation(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RoleplayEvaluationResponse:
    """Retrieve PASS/FAIL milestones, chunk usage, strengths, improvements, and next practice."""
    service = ScenarioService(db)
    return await service.get_roleplay_evaluation(session_id=id, user_id=current_user.id)


@router.get(
    "/me/chunk-bank",
    response_model=ChunkBankResponse,
    tags=["Chunk Bank"],
    summary="Retrieve user personal chunk bank",
)
async def get_my_chunk_bank(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChunkBankResponse:
    """Retrieve user's personal language chunk bank with review statuses."""
    service = ScenarioService(db)
    return await service.get_chunk_bank(user_id=current_user.id)
