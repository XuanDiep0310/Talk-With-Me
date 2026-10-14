"""
CoachService: Business logic for AI Coach topics, practice sessions, transcripts, and session lifecycle.
"""

import json
import uuid
from datetime import UTC

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock, SystemClock
from app.models.coach_schemas import (
    AddTranscriptSegmentRequest,
    CoachTopicGroupSchema,
    CoachTopicSchema,
    CoachTopicsResponse,
    CreateCoachSessionRequest,
    EndSessionResponse,
    SessionResponse,
    TranscriptSegmentResponse,
)
from app.models.session import CoachTopic, Session, TranscriptSegment
from app.repositories.session import CoachTopicRepository, SessionRepository, TranscriptRepository
from app.repositories.user import UserRepository
from app.services.session_state_machine import (
    SessionState,
    SessionStateMachine,
)
from app.services.topic_ranking import rank_topics


class CoachService:
    def __init__(
        self,
        db: AsyncSession,
        clock: Clock | None = None,
    ) -> None:
        self.db = db
        self.clock = clock or SystemClock()
        self.topic_repo = CoachTopicRepository(db)
        self.session_repo = SessionRepository(db)
        self.transcript_repo = TranscriptRepository(db)
        self.user_repo = UserRepository(db)

    async def list_topics(self, user_id: uuid.UUID, q: str | None = None) -> CoachTopicsResponse:
        # 1. Ensure seed topics exist
        await self.topic_repo.seed_defaults_if_empty()

        # 2. Get user learning profile for personalization
        user = await self.user_repo.get_by_id(user_id)
        profile = user.profile if user else None
        user_level = profile.cefr_level if profile else "A1"

        user_interests: list[str] = []
        if profile and profile.interests:
            try:
                user_interests = (
                    json.loads(profile.interests)
                    if isinstance(profile.interests, str)
                    else list(profile.interests)
                )
            except Exception:
                user_interests = []

        user_weak_points: list[str] = []
        if profile and profile.weak_points:
            try:
                user_weak_points = (
                    json.loads(profile.weak_points)
                    if isinstance(profile.weak_points, str)
                    else list(profile.weak_points)
                )
            except Exception:
                user_weak_points = []

        # 3. Retrieve active topics (filtered by search query if present)
        topics = await self.topic_repo.list_topics(q=q, active_only=True)

        # 4. Score and rank topics for "Recommended for you" group
        ranked = rank_topics(
            topics=list(topics),
            user_level=user_level,
            user_interests=user_interests,
            user_weak_points=user_weak_points,
        )

        # Top 3 recommended topics
        recommended_schemas: list[CoachTopicSchema] = [
            CoachTopicSchema(
                id=t.id,
                category=t.category,
                title=t.title,
                description=t.description,
                min_level=t.min_level,
                target_skills=t.target_skills or [],
                is_active=t.is_active,
                score=round(score, 1),
            )
            for t, score in ranked[:3]
        ]

        # 5. Group topics by category
        groups_dict: dict[str, list[CoachTopicSchema]] = {}
        for t in topics:
            schema = CoachTopicSchema(
                id=t.id,
                category=t.category,
                title=t.title,
                description=t.description,
                min_level=t.min_level,
                target_skills=t.target_skills or [],
                is_active=t.is_active,
            )
            groups_dict.setdefault(t.category, []).append(schema)

        group_schemas = [
            CoachTopicGroupSchema(category=cat, topics=topic_list)
            for cat, topic_list in groups_dict.items()
        ]

        return CoachTopicsResponse(
            recommended=recommended_schemas,
            groups=group_schemas,
            total_topics=len(topics),
        )

    async def create_session(
        self, user_id: uuid.UUID, data: CreateCoachSessionRequest
    ) -> SessionResponse:
        # 1. Require completed onboarding
        user = await self.user_repo.get_by_id(user_id)
        if not user or not user.profile or not user.profile.onboarding_completed_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must complete onboarding before starting an AI Coach session",
            )

        user_level = user.profile.cefr_level or "A1"

        # 2. Resolve topic
        topic: CoachTopic | None = None
        if data.topic_id:
            topic = await self.topic_repo.get_by_id(data.topic_id)
            if not topic:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Coach topic not found",
                )
        else:
            # Default to first active topic
            topics = await self.topic_repo.list_topics(active_only=True)
            if topics:
                topic = topics[0]

        now = self.clock.now()

        # 3. Create session record
        session = Session(
            id=uuid.uuid4(),
            type="COACH",
            user_id=user_id,
            topic_id=topic.id if topic else None,
            level=user_level,
            status=SessionState.CREATED.value,
            started_at=now,
            duration_seconds=0.0,
            spoken_seconds=0.0,
        )
        await self.session_repo.create(session)

        # 4. Generate AI Coach opening message
        topic_title = topic.title if topic else "General Conversation"
        initial_message = (
            f"Hello! I'm Alex, your English Communication Coach. "
            f"Today we're talking about '{topic_title}'. "
            f"Could you start by telling me a little about yourself or your thoughts on this topic?"
        )

        initial_segment = TranscriptSegment(
            pk=uuid.uuid4(),
            id=str(uuid.uuid4()),
            session_id=session.id,
            speaker="AI",
            user_id=None,
            text=initial_message,
            start_ms=0,
            end_ms=3000,
            confidence=1.0,
            is_final=True,
            seq=1,
        )
        await self.transcript_repo.add_segment(initial_segment)

        # Reload session with relationships
        loaded = await self.session_repo.get_by_id(session.id)
        return self._to_session_response(loaded or session, initial_message=initial_message)

    async def get_session(self, session_id: uuid.UUID, user_id: uuid.UUID) -> SessionResponse:
        session = await self.session_repo.get_by_id_and_user(session_id, user_id)
        if not session:
            # Per AGENTS.md §7: return 404 instead of 403 when accessing unauthorized resource
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )
        return self._to_session_response(session)

    async def add_transcript_segment(
        self,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        data: AddTranscriptSegmentRequest,
    ) -> TranscriptSegmentResponse:
        session = await self.session_repo.get_by_id_and_user(session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

        # Check idempotency first: if already saved, return existing
        existing = await self.transcript_repo.get_by_session_and_segment_id(session_id, data.id)
        if existing:
            return self._to_transcript_response(existing)

        # Audio/transcripts can only be accepted when session is ACTIVE per AGENTS.md §8 rule 3
        if session.status != SessionState.ACTIVE.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot add transcript segment when session is in status '{session.status}'",
            )

        max_seq = await self.transcript_repo.get_max_seq(session_id)
        segment = TranscriptSegment(
            pk=uuid.uuid4(),
            id=data.id,
            session_id=session_id,
            speaker=data.speaker.upper(),
            user_id=user_id if data.speaker.upper() == "USER" else None,
            text=data.text,
            start_ms=data.start_ms,
            end_ms=data.end_ms,
            confidence=data.confidence,
            is_final=data.is_final,
            seq=max_seq + 1,
        )
        saved = await self.transcript_repo.add_segment(segment)

        # Update spoken seconds if speaker is USER
        if data.speaker.upper() == "USER" and data.end_ms > data.start_ms:
            delta_spoken = (data.end_ms - data.start_ms) / 1000.0
            session.spoken_seconds += delta_spoken
            await self.session_repo.save(session)

        return self._to_transcript_response(saved)

    async def list_transcripts(
        self, session_id: uuid.UUID, user_id: uuid.UUID, after_seq: int = 0
    ) -> list[TranscriptSegmentResponse]:
        session = await self.session_repo.get_by_id_and_user(session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )
        segments = await self.transcript_repo.list_by_session(session_id, after_seq=after_seq)
        return [self._to_transcript_response(s) for s in segments]

    async def end_session(
        self, session_id: uuid.UUID, user_id: uuid.UUID, reason: str = "USER_REQUESTED"
    ) -> EndSessionResponse:
        session = await self.session_repo.get_by_id_and_user(session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

        # Idempotency: if already ended, return current values without error
        terminal_states = {
            SessionState.ENDED.value,
            SessionState.FEEDBACK_READY.value,
            SessionState.INSUFFICIENT_DATA.value,
            SessionState.FAILED.value,
        }
        if session.status in terminal_states:
            return EndSessionResponse(
                id=session.id,
                status=session.status,
                ended_at=session.ended_at,
                duration_seconds=session.duration_seconds,
                spoken_seconds=session.spoken_seconds,
                end_reason=session.end_reason,
            )

        # Transition: current -> ENDING -> ENDED
        now = self.clock.now()
        current_state = SessionState(session.status)

        # If still in CREATED or ACTIVE or RECONNECTING, move to ENDING then ENDED
        if current_state in (SessionState.ACTIVE, SessionState.RECONNECTING):
            SessionStateMachine.transition(current_state, SessionState.ENDING)
            SessionStateMachine.transition(SessionState.ENDING, SessionState.ENDED)
        elif current_state == SessionState.CREATED:
            # Cancelled before becoming active
            session.status = SessionState.ENDED.value
        else:
            SessionStateMachine.transition(current_state, SessionState.ENDED)

        session.status = SessionState.ENDED.value
        session.ended_at = now
        session.end_reason = reason

        if session.started_at:
            started = session.started_at
            if started.tzinfo is None and now.tzinfo is not None:
                started = started.replace(tzinfo=UTC)
            elif started.tzinfo is not None and now.tzinfo is None:
                now = now.replace(tzinfo=UTC)
            session.duration_seconds = max(0.0, (now - started).total_seconds())

        await self.session_repo.save(session)

        return EndSessionResponse(
            id=session.id,
            status=session.status,
            ended_at=session.ended_at,
            duration_seconds=session.duration_seconds,
            spoken_seconds=session.spoken_seconds,
            end_reason=session.end_reason,
        )

    def _to_session_response(
        self, session: Session, initial_message: str | None = None
    ) -> SessionResponse:
        topic_schema: CoachTopicSchema | None = None
        if session.topic:
            topic_schema = CoachTopicSchema(
                id=session.topic.id,
                category=session.topic.category,
                title=session.topic.title,
                description=session.topic.description,
                min_level=session.topic.min_level,
                target_skills=session.topic.target_skills or [],
                is_active=session.topic.is_active,
            )

        transcript_schemas = [self._to_transcript_response(t) for t in (session.transcripts or [])]

        return SessionResponse(
            id=session.id,
            type=session.type,
            user_id=session.user_id,
            topic_id=session.topic_id,
            topic=topic_schema,
            level=session.level,
            status=session.status,
            started_at=session.started_at,
            ended_at=session.ended_at,
            duration_seconds=session.duration_seconds,
            spoken_seconds=session.spoken_seconds,
            end_reason=session.end_reason,
            initial_message=initial_message,
            transcripts=transcript_schemas,
        )

    def _to_transcript_response(self, segment: TranscriptSegment) -> TranscriptSegmentResponse:
        return TranscriptSegmentResponse(
            id=segment.id,
            session_id=segment.session_id,
            speaker=segment.speaker,
            user_id=segment.user_id,
            text=segment.text,
            start_ms=segment.start_ms,
            end_ms=segment.end_ms,
            confidence=segment.confidence,
            is_final=segment.is_final,
            seq=segment.seq,
            created_at=segment.created_at,
        )
