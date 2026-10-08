"""
Clock abstraction to avoid calling datetime.now() directly in business logic.
Inject Clock into services to allow testing with fake/frozen time.
"""

from datetime import UTC, datetime
from typing import Protocol


class Clock(Protocol):
    """Abstract clock interface."""

    def now(self) -> datetime: ...


class SystemClock:
    """Production clock that returns real UTC time."""

    def now(self) -> datetime:
        return datetime.now(UTC)


# Singleton used in production code
system_clock: Clock = SystemClock()
