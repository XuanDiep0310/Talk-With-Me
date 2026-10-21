"""
Endpoints for AI Coach topics, sessions, transcripts, and feedback.
"""

import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.auth import User
from app.models.coach_schemas import (
    AddTranscriptSegmentRequest,
    CoachTopicsResponse,
    CreateCoachSessionRequest,
    EndSessionRequest,
    EndSessionResponse,
    SessionResponse,
    SessionSuggestionsResponse,
    SuggestedReplyItem,
    TranscriptSegmentResponse,
    TranslateTextRequest,
    TranslateTextResponse,
)
from app.models.scoring_schemas import SessionFeedbackResponse
from app.services.coach import CoachService
from app.services.scoring import ScoringService

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
    response_model=SessionFeedbackResponse,
    responses={
        200: {
            "model": SessionFeedbackResponse,
            "description": "Feedback generated or finalized (FEEDBACK_READY, INSUFFICIENT_DATA, FAILED)",
        },
        202: {
            "model": SessionFeedbackResponse,
            "description": "Feedback calculation in progress (PENDING)",
        },
    },
)
async def get_coach_session_feedback(
    session_id: uuid.UUID,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionFeedbackResponse:
    """
    Get post-session feedback report.
    Returns HTTP 202 when PENDING.
    Returns HTTP 200 when FEEDBACK_READY, INSUFFICIENT_DATA, or FAILED (with retryable flag).
    Returns HTTP 404 if session does not exist or unauthorized.
    """
    service = ScoringService(db)
    status_code, feedback_resp = await service.get_feedback(
        session_id=session_id, user_id=current_user.id
    )
    response.status_code = status_code
    return feedback_resp


@router.post(
    "/sessions/{session_id}/feedback/retry",
    response_model=SessionFeedbackResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def retry_coach_session_feedback(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionFeedbackResponse:
    """
    Manually retry feedback generation for a failed session.
    Resets feedback status to PENDING and triggers background calculation.
    """
    service = ScoringService(db)
    return await service.retry_feedback(session_id=session_id, user_id=current_user.id)



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


@router.get("/sessions/{session_id}/suggestions", response_model=SessionSuggestionsResponse)
async def get_session_suggestions(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionSuggestionsResponse:
    """Generate 3 level-tailored suggested replies for the latest AI question in this session."""
    service = CoachService(db)
    session = await service.get_session(session_id=session_id, user_id=current_user.id)
    from app.core.providers.llm_provider import get_llm_provider
    from app.repositories.session import TranscriptRepository

    t_repo = TranscriptRepository(db)
    all_segments = await t_repo.list_by_session(session_id)
    last_ai_text = "What would you like to share about this topic?"
    for seg in reversed(all_segments):
        if seg.speaker == "AI":
            last_ai_text = seg.text
            break

    history = [
        {"role": "user" if t.speaker == "USER" else "model", "content": t.text}
        for t in all_segments[-6:]
    ]
    topic_title = session.topic.title if session.topic else "General Conversation"
    topic_min_level = session.topic.min_level if session.topic else "A1"

    llm = get_llm_provider()
    raw_suggs = await llm.generate_suggested_replies(
        history=history,
        last_ai_message=last_ai_text,
        user_level=session.level,
        topic_title=topic_title,
        topic_min_level=topic_min_level,
    )
    items = [
        SuggestedReplyItem(text=s["text"], translation=s.get("translation", "")) for s in raw_suggs
    ]
    return SessionSuggestionsResponse(session_id=session_id, level=session.level, suggestions=items)
