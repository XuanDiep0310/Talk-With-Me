"""
Endpoints for AI Coach topics, sessions, transcripts, and feedback.
"""

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.auth import User
from app.models.coach_schemas import (
    AddTranscriptSegmentRequest,
    CoachTopicsResponse,
    CreateCoachSessionRequest,
    EndSessionRequest,
    EndSessionResponse,
    SessionFeedbackStatusResponse,
    SessionResponse,
    TranscriptSegmentResponse,
    TranslateTextRequest,
    TranslateTextResponse,
)
from app.services.coach import CoachService

router = APIRouter()


@router.get("/topics", response_model=CoachTopicsResponse)
async def get_coach_topics(
    q: str | None = Query(
        None, description="Search query for topic title, category, or description"
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CoachTopicsResponse:
    """Retrieve catalog of AI Coach topics categorized and personalized for the current user."""
    service = CoachService(db)
    return await service.list_topics(user_id=current_user.id, q=q)


@router.post("/sessions", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_coach_session(
    data: CreateCoachSessionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    """
    Start a new AI Coach practice session.
    Requires the user to have completed onboarding.
    The AI Coach immediately generates an initial greeting adapted to user level and topic.
    """
    service = CoachService(db)
    return await service.create_session(user_id=current_user.id, data=data)


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_coach_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    """Retrieve details and transcript history of a practice session."""
    service = CoachService(db)
    return await service.get_session(session_id=session_id, user_id=current_user.id)


@router.post(
    "/sessions/{session_id}/transcript",
    response_model=TranscriptSegmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_transcript_segment(
    session_id: uuid.UUID,
    data: AddTranscriptSegmentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TranscriptSegmentResponse:
    """
    Save a dialogue segment into the session Live Script.
    Idempotent by (session_id, data.id).
    Only accepted when session status is ACTIVE.
    """
    service = CoachService(db)
    return await service.add_transcript_segment(
        session_id=session_id, user_id=current_user.id, data=data
    )


@router.get("/sessions/{session_id}/transcript", response_model=list[TranscriptSegmentResponse])
async def list_transcripts(
    session_id: uuid.UUID,
    after_seq: int = Query(
        0, ge=0, description="Fetch segments with seq strictly greater than this value"
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TranscriptSegmentResponse]:
    """Retrieve live script transcript segments for a session, supporting sequence resumption."""
    service = CoachService(db)
    return await service.list_transcripts(
        session_id=session_id, user_id=current_user.id, after_seq=after_seq
    )


@router.post("/sessions/{session_id}/end", response_model=EndSessionResponse)
async def end_coach_session(
    session_id: uuid.UUID,
    data: EndSessionRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EndSessionResponse:
    """
    End the AI Coach practice session.
    Idempotent: multiple calls return the same ended session state.
    """
    service = CoachService(db)
    reason = data.reason if data and data.reason else "USER_REQUESTED"
    return await service.end_session(session_id=session_id, user_id=current_user.id, reason=reason)


@router.get(
    "/sessions/{session_id}/feedback",
    response_model=SessionFeedbackStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def get_coach_session_feedback(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionFeedbackStatusResponse:
    """
    Get post-session feedback status.
    Returns HTTP 202 PENDING for Sprint 3 (full scoring engine implemented in Sprint 4).
    """
    service = CoachService(db)
    # Validate session access (returns 404 if not found or unauthorized)
    await service.get_session(session_id=session_id, user_id=current_user.id)
    return SessionFeedbackStatusResponse(session_id=session_id, status="PENDING")


@router.post("/translate", response_model=TranslateTextResponse)
async def translate_text(
    data: TranslateTextRequest,
    current_user: User = Depends(get_current_user),  # noqa: ARG001
) -> TranslateTextResponse:
    """Translate dialogue text to target language (default Vietnamese) using active LLM."""
    from app.core.providers.llm_provider import get_llm_provider

    llm = get_llm_provider()
    translated = await llm.translate_text(data.text, target_lang=data.target_lang)
    return TranslateTextResponse(original_text=data.text, translated_text=translated)

