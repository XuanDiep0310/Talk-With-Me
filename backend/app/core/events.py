"""
In-process asynchronous domain event bus.
Enables loose coupling between modules (e.g. Coach/Scoring emitting FeedbackGenerated,
Gamification listening to grant XP in Sprint 6).
"""

import asyncio
import logging
import uuid
from collections import defaultdict
from collections.abc import Callable, Coroutine
from dataclasses import dataclass
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


EventHandler = Callable[[Any], Coroutine[Any, Any, None]]


class EventBus:
    """In-process async event bus."""

    def __init__(self) -> None:
        self._subscribers: dict[type[Event], list[EventHandler]] = defaultdict(list)

    def subscribe(self, event_type: type[Event], handler: EventHandler) -> None:
        """Register an async handler for a given event type."""
        self._subscribers[event_type].append(handler)

    def unsubscribe(self, event_type: type[Event], handler: EventHandler) -> None:
        """Unregister an async handler."""
        if handler in self._subscribers[event_type]:
            self._subscribers[event_type].remove(handler)

    async def publish(self, event: Event) -> None:
        """Publish an event to all registered async handlers."""
        handlers = self._subscribers.get(type(event), [])
        for handler in handlers:
            try:
                res = handler(event)
                if asyncio.iscoroutine(res):
                    await res
            except Exception as exc:
                logger.error("Error executing event handler %s for %s: %s", handler, event, exc)


# Global singleton instance for app-wide domain events
event_bus = EventBus()
