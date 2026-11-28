"""
In-process asynchronous domain event bus.
Enables loose coupling between modules (e.g. Coach/Scoring emitting FeedbackGenerated,
RoleplayEvaluated, DrillAssessed; Gamification and LearnerAssessment listening).
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from collections import defaultdict
from collections.abc import Callable, Coroutine
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class Event:
    """Base domain event class."""

    pass


@dataclass
class FeedbackGenerated(Event):
    """Event emitted whenever post-session scoring and feedback is successfully generated."""

    session_id: uuid.UUID
    user_id: uuid.UUID
    status: str
    overall_score: float | None
    partial: bool
    skill_scores: dict[str, float | None]
    average_latency_ms: float | None = None
    phoneme_errors: list[dict[str, Any]] = field(default_factory=list)
    modality: str = "UNSCRIPTED"


@dataclass
class RoleplayEvaluated(Event):
    """Event emitted whenever post-roleplay mission evaluation is completed."""

    session_id: uuid.UUID
    scenario_id: uuid.UUID
    user_id: uuid.UUID
    passed: bool
    requirements_passed: int
    requirements_total: int
    used_chunks_count: int
    needs_practice_chunks_count: int
    overall_score: float | None


@dataclass
class DrillAssessed(Event):
    """Event emitted when a scripted drill includes acoustic pronunciation metrics."""

    user_id: uuid.UUID
    scenario_id: uuid.UUID
    chunk_id: uuid.UUID
    accuracy_score: float
    fluency_score: float | None
    prosody_score: float | None
    phoneme_errors: list[dict[str, Any]]


EventHandler = Callable[[Any], Coroutine[Any, Any, None]]


class EventBus:
    """In-process async event bus."""

    def __init__(self) -> None:
        self._subscribers: dict[type[Event], list[EventHandler]] = defaultdict(list)

    def subscribe(self, event_type: type[Event], handler: EventHandler) -> None:
        self._subscribers[event_type].append(handler)

    def unsubscribe(self, event_type: type[Event], handler: EventHandler) -> None:
        if handler in self._subscribers[event_type]:
            self._subscribers[event_type].remove(handler)

    async def publish(self, event: Event) -> None:
        handlers = self._subscribers.get(type(event), [])
        for handler in handlers:
            try:
                res = handler(event)
                if asyncio.iscoroutine(res):
                    await res
            except Exception as exc:
                logger.error("Error executing event handler %s for %s: %s", handler, event, exc)


event_bus = EventBus()
