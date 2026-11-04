"""
Unit tests for progress metrics, previous score algorithm, and XP idempotency.
"""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.gamification import XpRule, XpTransaction
from app.services.gamification import GamificationService
from app.services.progress import ProgressService


class FakeClock:
    def __init__(self, current_time: datetime) -> None:
        self._current_time = current_time

    def now(self) -> datetime:
        return self._current_time


@pytest.mark.asyncio
async def test_xp_award_idempotency_same_source() -> None:
    """Calling award_xp with the same idempotency key twice does not duplicate XP."""
    user_id = uuid.uuid4()
    mock_db = AsyncMock()
    service = GamificationService(mock_db)

    rule = XpRule(key="COACH_SESSION", xp_amount=100, is_active=True)
    service._repo.get_rule = AsyncMock(return_value=rule)

    created_tx = XpTransaction(
        id=uuid.uuid4(),
        user_id=user_id,
        amount=100,
        rule_key="COACH_SESSION",
        source_type="COACH_SESSION",
        source_id="session-123",
        idempotency_key="COACH_SESSION:session-123",
        created_at=datetime.now(UTC),
    )

    # First call: creates transaction
    service._repo.create_xp_transaction = AsyncMock(return_value=created_tx)
    tx1 = await service.award_xp(
        user_id=user_id,
        rule_key="COACH_SESSION",
        source_type="COACH_SESSION",
        source_id="session-123",
    )
    assert tx1 is not None
    assert tx1.amount == 100

    # Second call with same source_id: returns None because idempotency_key already exists
    service._repo.create_xp_transaction = AsyncMock(return_value=None)
    tx2 = await service.award_xp(
        user_id=user_id,
        rule_key="COACH_SESSION",
        source_type="COACH_SESSION",
        source_id="session-123",
    )
    assert tx2 is None


@pytest.mark.asyncio
async def test_skills_prev_score_window_31_to_60_days() -> None:
    """
    If sessions exist in the window 31-60 days ago, 'prev' is calculated from that window.
    """
    user_id = uuid.uuid4()
    now = datetime(2026, 11, 4, 12, 0, 0, tzinfo=UTC)
    clock = FakeClock(now)

    mock_db = AsyncMock()
    service = ProgressService(mock_db, clock=clock)

    recent_id = uuid.uuid4()
    window_id = uuid.uuid4()

    # Mock execute results:
    # 1. recent_ids -> [recent_id]
    mock_recent = MagicMock()
    mock_recent.scalars.return_value.all.return_value = [recent_id]

    # 2. window_ids -> [window_id]
    mock_window = MagicMock()
    mock_window.scalars.return_value.all.return_value = [window_id]

    # 3. first_3_ids -> [window_id]
    mock_first3 = MagicMock()
    mock_first3.scalars.return_value.all.return_value = [window_id]

    # Average scores for fluency: current=80.0, prev=70.0
    mock_score_recent = MagicMock()
    mock_score_recent.scalar_one_or_none.return_value = 80.0

    mock_score_prev = MagicMock()
    mock_score_prev.scalar_one_or_none.return_value = 70.0

    # We mock execute calls sequentially:
    # First 3 calls are for IDs: recent, window, first3
    # Next 10 calls: for each of the 5 skills, 2 calls (current, prev)
    side_effects = [mock_recent, mock_window, mock_first3]
    for _ in range(5):
        side_effects.extend([mock_score_recent, mock_score_prev])

    mock_db.execute.side_effect = side_effects

    resp = await service.get_progress_skills(user_id)
    fluency_skill = next(s for s in resp.skills if s.skill == "fluency")

    assert fluency_skill.current == 80.0
    assert fluency_skill.prev == 70.0
    assert fluency_skill.change == 10.0
    assert fluency_skill.status_label == "Tốt"


@pytest.mark.asyncio
async def test_skills_prev_score_fallback_first_3_sessions() -> None:
    """
    If no sessions exist 31-60 days ago, 'prev' falls back to average of first 3 sessions.
    """
    user_id = uuid.uuid4()
    now = datetime(2026, 11, 4, 12, 0, 0, tzinfo=UTC)
    clock = FakeClock(now)

    mock_db = AsyncMock()
    service = ProgressService(mock_db, clock=clock)

    recent_id1 = uuid.uuid4()
    recent_id2 = uuid.uuid4()
    first_id = uuid.uuid4()

    # 1. recent_ids
    mock_recent = MagicMock()
    mock_recent.scalars.return_value.all.return_value = [recent_id1, recent_id2]

    # 2. window_ids -> empty!
    mock_window = MagicMock()
    mock_window.scalars.return_value.all.return_value = []

    # 3. first_3_ids -> [first_id]
    mock_first3 = MagicMock()
    mock_first3.scalars.return_value.all.return_value = [first_id]

    mock_score_recent = MagicMock()
    mock_score_recent.scalar_one_or_none.return_value = 65.0

    mock_score_first = MagicMock()
    mock_score_first.scalar_one_or_none.return_value = 55.0

    side_effects = [mock_recent, mock_window, mock_first3]
    for _ in range(5):
        # 1 call for current, 1 call for first3 fallback
        side_effects.extend([mock_score_recent, mock_score_first])

    mock_db.execute.side_effect = side_effects

    resp = await service.get_progress_skills(user_id)
    fluency_skill = next(s for s in resp.skills if s.skill == "fluency")

    assert fluency_skill.current == 65.0
    assert fluency_skill.prev == 55.0
    assert fluency_skill.change == 10.0
    assert fluency_skill.status_label == "Đang phát triển"
