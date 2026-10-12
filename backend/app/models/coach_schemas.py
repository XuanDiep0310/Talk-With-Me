"""
Pydantic v2 schemas for Coach topics, sessions, transcripts, and WebSocket tickets.

All public API schemas use camelCase aliases per AGENTS.md §7 convention.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class _CamelModel(BaseModel):
    """Base schema with camelCase aliases and populate-by-name support."""

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
    )


class CoachTopicSchema(_CamelModel):
    id: uuid.UUID
    category: str
    title: str
    description: str
    min_level: str
    target_skills: list[str]
    is_active: bool
    score: float | None = None


class CoachTopicGroupSchema(_CamelModel):
    category: str
    topics: list[CoachTopicSchema]


class CoachTopicsResponse(_CamelModel):
    recommended: list[CoachTopicSchema]
    groups: list[CoachTopicGroupSchema]
    total_topics: int


class CreateCoachSessionRequest(_CamelModel):
    topic_id: uuid.UUID | None = None


class TranscriptSegmentResponse(_CamelModel):
    id: str
    session_id: uuid.UUID
    speaker: str
    user_id: uuid.UUID | None = None
    text: str
    start_ms: int = 0
    end_ms: int = 0
    confidence: float | None = None
    is_final: bool = True
    seq: int = 1
    created_at: datetime | None = None


class SessionResponse(_CamelModel):
    id: uuid.UUID
    type: str
    user_id: uuid.UUID
    topic_id: uuid.UUID | None = None
    topic: CoachTopicSchema | None = None
    level: str
    status: str
    started_at: datetime | None = None
    ended_at: datetime | None = None
    duration_seconds: float = 0.0
    spoken_seconds: float = 0.0
    end_reason: str | None = None
    initial_message: str | None = None
    transcripts: list[TranscriptSegmentResponse] = Field(default_factory=list)


class AddTranscriptSegmentRequest(_CamelModel):
    id: str  # Client-generated UUID
    speaker: str = "USER"  # "USER" | "AI"
    text: str
    start_ms: int = 0
    end_ms: int = 0
    confidence: float | None = None
    is_final: bool = True


class EndSessionRequest(_CamelModel):
    reason: str | None = "USER_REQUESTED"


class EndSessionResponse(_CamelModel):
    id: uuid.UUID
    status: str
    ended_at: datetime | None = None
    duration_seconds: float = 0.0
    spoken_seconds: float = 0.0
    end_reason: str | None = None


class SessionFeedbackStatusResponse(_CamelModel):
    session_id: uuid.UUID
    status: str = "PENDING"  # PENDING, READY, INSUFFICIENT_DATA
    message: str = "Feedback calculation is queued and will be available in Sprint 4"


class WsTicketResponse(_CamelModel):
    ticket: str
    expires_in: int = 30
