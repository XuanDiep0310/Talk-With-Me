"""
Unit tests for Gamification, Streak logic, XP ledger, Level progression,
Badge criteria, and Skill history algorithm (AGENTS.md §8, D-01, D-02, D-09, D-10).
"""

import uuid
from datetime import UTC, date, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.auth import UserProfile
from app.models.gamification import (
    BadgeDefinition,
    GamificationProfile,
    UserBadge,
)
from app.services.gamification import (
    GamificationService,
)


class FakeClock:
    """Mock clock for deterministic time manipulation in unit tests."""

    def __init__(self, current_time: datetime) -> None:
        self._current_time = current_time

    def now(self) -> datetime:
        return self._current_time

    def set_time(self, new_time: datetime) -> None:
        self._current_time = new_time

    def advance(self, **kwargs: float) -> None:
        self._current_time += timedelta(**kwargs)


@pytest.mark.asyncio
async def test_streak_calculation_same_day_no_duplicate() -> None:
    """If user is active twice on the same local date, streak does not change and bonus is given once."""
    user_id = uuid.uuid4()
    now = datetime(2026, 11, 4, 10, 0, 0, tzinfo=UTC)
    clock = FakeClock(now)

    mock_db = AsyncMock()
    service = GamificationService(mock_db, clock=clock)

    profile = GamificationProfile(
        user_id=user_id,
        total_xp=100,
        current_streak=3,
        best_streak=3,
        last_active_date=date(2026, 11, 4),  # already active today
    )
    u_profile = UserProfile(user_id=user_id, timezone="Asia/Ho_Chi_Minh")

    service._repo.get_or_create_profile = AsyncMock(return_value=profile)
    service._repo.get_user_profile = AsyncMock(return_value=u_profile)
    service.award_xp = AsyncMock()

    streak, is_first = await service.update_streak(user_id)

    assert streak == 3
    assert is_first is False
    service.award_xp.assert_not_called()


@pytest.mark.asyncio
async def test_streak_consecutive_day_increments_streak() -> None:
    """If user was active yesterday, streak increments by 1 and streak bonus is awarded."""
    user_id = uuid.uuid4()
    # 2026-11-04 10:00:00 UTC is 17:00:00 in Vietnam (date 2026-11-04)
    now = datetime(2026, 11, 4, 10, 0, 0, tzinfo=UTC)
    clock = FakeClock(now)

    mock_db = AsyncMock()
    service = GamificationService(mock_db, clock=clock)

    profile = GamificationProfile(
        user_id=user_id,
        total_xp=100,
        current_streak=3,
        best_streak=5,
        last_active_date=date(2026, 11, 3),  # yesterday!
    )
    u_profile = UserProfile(user_id=user_id, timezone="Asia/Ho_Chi_Minh")

    service._repo.get_or_create_profile = AsyncMock(return_value=profile)
    service._repo.get_user_profile = AsyncMock(return_value=u_profile)
    service.award_xp = AsyncMock()
    service._repo.ensure_daily_missions = AsyncMock()
    service._repo.update_mission_progress = AsyncMock()

    streak, is_first = await service.update_streak(user_id)

    assert streak == 4
    assert is_first is True
    assert profile.current_streak == 4
    assert profile.last_active_date == date(2026, 11, 4)
    service.award_xp.assert_called_once_with(
        user_id=user_id,
        rule_key="STREAK_BONUS",
        source_type="STREAK",
        source_id=f"{user_id}:2026-11-04",
        description="Duy trì streak ngày 2026-11-04",
    )


@pytest.mark.asyncio
async def test_streak_broken_gap_resets_to_one() -> None:
    """If user missed more than 1 day, streak resets to 1."""
    user_id = uuid.uuid4()
    now = datetime(2026, 11, 4, 10, 0, 0, tzinfo=UTC)
    clock = FakeClock(now)

    mock_db = AsyncMock()
    service = GamificationService(mock_db, clock=clock)

    profile = GamificationProfile(
        user_id=user_id,
        total_xp=500,
        current_streak=10,
        best_streak=10,
        last_active_date=date(2026, 11, 1),  # 3 days ago!
    )
    u_profile = UserProfile(user_id=user_id, timezone="Asia/Ho_Chi_Minh")

    service._repo.get_or_create_profile = AsyncMock(return_value=profile)
    service._repo.get_user_profile = AsyncMock(return_value=u_profile)
    service.award_xp = AsyncMock()
    service._repo.ensure_daily_missions = AsyncMock()
    service._repo.update_mission_progress = AsyncMock()

    streak, is_first = await service.update_streak(user_id)

    assert streak == 1
    assert is_first is True
    assert profile.current_streak == 1
    assert profile.best_streak == 10  # best streak retained
    assert profile.last_active_date == date(2026, 11, 4)


@pytest.mark.asyncio
async def test_streak_timezone_boundary_vietnam() -> None:
    """
    Test midnight boundary in Asia/Ho_Chi_Minh (UTC+7):
    23:59:50 local (16:59:50 UTC) -> local date 2026-11-04
    00:00:10 local (17:00:10 UTC) -> local date 2026-11-05
    """
    user_id = uuid.uuid4()
    # 23:59:50 Vietnam on Nov 4 = 16:59:50 UTC on Nov 4
    t1 = datetime(2026, 11, 4, 16, 59, 50, tzinfo=UTC)
    clock = FakeClock(t1)

    mock_db = AsyncMock()
    service = GamificationService(mock_db, clock=clock)

    profile = GamificationProfile(
        user_id=user_id,
        total_xp=0,
        current_streak=5,
        best_streak=5,
        last_active_date=date(2026, 11, 3),
    )
    u_profile = UserProfile(user_id=user_id, timezone="Asia/Ho_Chi_Minh")

    service._repo.get_or_create_profile = AsyncMock(return_value=profile)
    service._repo.get_user_profile = AsyncMock(return_value=u_profile)
    service.award_xp = AsyncMock()
    service._repo.ensure_daily_missions = AsyncMock()
    service._repo.update_mission_progress = AsyncMock()

    # Step 1: Active at 23:59 Vietnam -> increments streak to 6 for Nov 4
    streak1, _ = await service.update_streak(user_id)
    assert streak1 == 6
    assert profile.last_active_date == date(2026, 11, 4)

    # Step 2: Advance clock by 30 seconds -> 00:00:20 Vietnam on Nov 5 (17:00:20 UTC Nov 4)
    clock.advance(seconds=30)
    streak2, is_first2 = await service.update_streak(user_id)
    assert streak2 == 7
    assert is_first2 is True
    assert profile.last_active_date == date(2026, 11, 5)


@pytest.mark.asyncio
async def test_cron_reset_missed_streaks() -> None:
    """Test cron task resets streak to 0 for users who missed yesterday."""
    now = datetime(2026, 11, 5, 10, 0, 0, tzinfo=UTC)
    clock = FakeClock(now)

    u1 = uuid.uuid4()
    u2 = uuid.uuid4()

    # User 1 active yesterday (Nov 4) -> streak safe
    p1 = GamificationProfile(user_id=u1, current_streak=5, last_active_date=date(2026, 11, 4))
    # User 2 last active Nov 3 (missed yesterday) -> streak must reset to 0
    p2 = GamificationProfile(user_id=u2, current_streak=10, last_active_date=date(2026, 11, 3))

    mock_db = AsyncMock()
    # Mock scalars().all() returning both profiles
    mock_res = MagicMock()
    mock_res.scalars.return_value.all.return_value = [p1, p2]
    mock_db.execute.return_value = mock_res

    service = GamificationService(mock_db, clock=clock)
    service._repo.get_user_profile = AsyncMock(
        return_value=UserProfile(user_id=u1, timezone="Asia/Ho_Chi_Minh")
    )

    reset_count = await service.check_and_reset_missed_streaks()
    assert reset_count == 1
    assert p1.current_streak == 5
    assert p2.current_streak == 0


# --- Level Advancement Unit Tests (SRS Table 3.4 & D-02) ---


@pytest.mark.asyncio
async def test_level_advancement_a1_to_a2_success_and_failure() -> None:
    """
    A1 -> A2 requires: overall >= 40, sessions >= 5, scenarios >= 3.
    """
    user_id = uuid.uuid4()
    mock_db = AsyncMock()
    service = GamificationService(mock_db)

    # 1. Failure: Score 39.0 (below 40)
    service._repo.get_user_profile = AsyncMock(
        return_value=UserProfile(user_id=user_id, cefr_level="A1")
    )
    service.get_level_advancement_stats = AsyncMock(
        return_value={
            "total_sessions": 6,
            "total_scenarios": 4,
            "avg_overall": 39.0,
            "avg_skills": {},
        }
    )
    new_lvl, promoted = await service.evaluate_level_advancement(user_id)
    assert new_lvl == "A1"
    assert promoted is False

    # 2. Failure: Sessions 4 (below 5)
    service.get_level_advancement_stats = AsyncMock(
        return_value={
            "total_sessions": 4,
            "total_scenarios": 5,
            "avg_overall": 50.0,
            "avg_skills": {},
        }
    )
    new_lvl, promoted = await service.evaluate_level_advancement(user_id)
    assert new_lvl == "A1"
    assert promoted is False

    # 3. Failure: Scenarios 2 (below 3)
    service.get_level_advancement_stats = AsyncMock(
        return_value={
            "total_sessions": 10,
            "total_scenarios": 2,
            "avg_overall": 60.0,
            "avg_skills": {},
        }
    )
    new_lvl, promoted = await service.evaluate_level_advancement(user_id)
    assert new_lvl == "A1"
    assert promoted is False

    # 4. Success: All met!
    service.get_level_advancement_stats = AsyncMock(
        return_value={
            "total_sessions": 5,
            "total_scenarios": 3,
            "avg_overall": 42.0,
            "avg_skills": {},
        }
    )
    service._repo.record_level_advancement = AsyncMock()
    service._repo.create_notification = AsyncMock()
    service.evaluate_badges = AsyncMock()

    new_lvl, promoted = await service.evaluate_level_advancement(user_id)
    assert new_lvl == "A2"
    assert promoted is True
    service._repo.record_level_advancement.assert_called_once()
    service._repo.create_notification.assert_called_once()


@pytest.mark.asyncio
async def test_level_advancement_b1_to_b2_requires_min_skills() -> None:
    """
    B1 -> B2 requires: overall >= 70, sessions >= 20, scenarios >= 5, and NO core skill < 60.
    """
    user_id = uuid.uuid4()
    mock_db = AsyncMock()
    service = GamificationService(mock_db)
    service._repo.get_user_profile = AsyncMock(
        return_value=UserProfile(user_id=user_id, cefr_level="B1")
    )

    # Failure: overall is 75, but fluency is 58 (< 60)
    service.get_level_advancement_stats = AsyncMock(
        return_value={
            "total_sessions": 25,
            "total_scenarios": 10,
            "avg_overall": 75.0,
            "avg_skills": {
                "fluency": 58.0,
                "listening": 70.0,
                "vocabulary": 80.0,
                "response_speed": 75.0,
                "pronunciation": 72.0,
            },
        }
    )
    new_lvl, promoted = await service.evaluate_level_advancement(user_id)
    assert new_lvl == "B1"
    assert promoted is False

    # Success: all skills >= 60
    service.get_level_advancement_stats = AsyncMock(
        return_value={
            "total_sessions": 25,
            "total_scenarios": 10,
            "avg_overall": 75.0,
            "avg_skills": {
                "fluency": 65.0,
                "listening": 70.0,
                "vocabulary": 80.0,
                "response_speed": 75.0,
                "pronunciation": 72.0,
            },
        }
    )
    service._repo.record_level_advancement = AsyncMock()
    service._repo.create_notification = AsyncMock()
    service.evaluate_badges = AsyncMock()

    new_lvl, promoted = await service.evaluate_level_advancement(user_id)
    assert new_lvl == "B2"
    assert promoted is True


@pytest.mark.asyncio
async def test_level_never_degrades_rule_4() -> None:
    """
    Level never degrades even if recent session scores drop significantly.
    """
    user_id = uuid.uuid4()
    mock_db = AsyncMock()
    service = GamificationService(mock_db)
    # User is currently B1
    service._repo.get_user_profile = AsyncMock(
        return_value=UserProfile(user_id=user_id, cefr_level="B1")
    )

    # Low score of 20.0
    service.get_level_advancement_stats = AsyncMock(
        return_value={
            "total_sessions": 12,
            "total_scenarios": 6,
            "avg_overall": 20.0,
            "avg_skills": {},
        }
    )
    new_lvl, promoted = await service.evaluate_level_advancement(user_id)
    assert new_lvl == "B1"
    assert promoted is False


# --- Badges Evaluation Unit Tests ---


@pytest.mark.asyncio
async def test_badge_evaluations() -> None:
    """Verify criteria triggers for each badge definition."""
    user_id = uuid.uuid4()
    mock_db = AsyncMock()
    service = GamificationService(mock_db)

    badge_first = BadgeDefinition(
        key="first_speaker", name="Người nói đầu tiên", target_value=1, sort_order=1
    )
    badge_streak = BadgeDefinition(
        key="streak_7", name="Streak 7 ngày", target_value=7, sort_order=2
    )
    badge_b1 = BadgeDefinition(key="b1_achiever", name="B1 Achiever", target_value=1, sort_order=3)
    badge_fluency = BadgeDefinition(
        key="fluency_master", name="Fluency Master", target_value=85, sort_order=4
    )
    badge_actor = BadgeDefinition(
        key="master_actor", name="Diễn viên xuất sắc", target_value=20, sort_order=5
    )
    badge_room = BadgeDefinition(
        key="community_star", name="Ngôi sao cộng đồng", target_value=10, sort_order=6
    )

    service._repo.list_badge_definitions = AsyncMock(
        return_value=[badge_first, badge_streak, badge_b1, badge_fluency, badge_actor, badge_room]
    )
    service._repo.get_user_profile = AsyncMock(
        return_value=UserProfile(user_id=user_id, cefr_level="B1")
    )
    service._repo.get_or_create_profile = AsyncMock(
        return_value=GamificationProfile(user_id=user_id, current_streak=7, best_streak=7)
    )
    service.get_level_advancement_stats = AsyncMock(
        return_value={
            "total_sessions": 5,
            "total_scenarios": 20,
            "avg_overall": 75.0,
            "avg_skills": {},
        }
    )

    # Max fluency mock
    mock_max_fluency = MagicMock()
    mock_max_fluency.scalar_one_or_none.return_value = 88.0
    # Room count mock
    mock_room_count = MagicMock()
    mock_room_count.scalar_one.return_value = 12

    mock_db.execute.side_effect = [mock_max_fluency, mock_room_count]
    service._repo.award_badge = AsyncMock(
        side_effect=lambda *args, **kwargs: UserBadge(
            user_id=kwargs.get("user_id", args[0] if args else None),
            badge_key=kwargs.get("badge_key", args[1] if len(args) > 1 else "b"),
            awarded_at=datetime.now(UTC),
        )
    )
    service._repo.create_notification = AsyncMock()

    awarded = await service.evaluate_badges(user_id)
    awarded_keys = [b.badge_key for b in awarded]

    assert "first_speaker" in awarded_keys
    assert "streak_7" in awarded_keys
    assert "b1_achiever" in awarded_keys
    assert "fluency_master" in awarded_keys
    assert "master_actor" in awarded_keys
    assert "community_star" in awarded_keys
    assert len(awarded) == 6
