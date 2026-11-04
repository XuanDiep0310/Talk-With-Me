"""
Gamification service implementing business rules for XP awards, streaks, daily missions,
badge evaluations, notifications, and CEFR level advancement (SRS Table 3.4 & D-02).
"""

from __future__ import annotations

import logging
import uuid
from datetime import date, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock, get_clock
from app.core.events import FeedbackGenerated, RoleplayEvaluated, RoomSessionCompleted, event_bus
from app.models.gamification import (
    GamificationProfile,
    UserBadge,
    XpTransaction,
)
from app.models.gamification_schemas import (
    BadgeItem,
    BadgesListResponse,
    ClaimMissionResponse,
    DailyMissionItem,
    DailyMissionsTodayResponse,
    GamificationSummaryResponse,
    LevelConditionProgress,
    NotificationItem,
    NotificationsListResponse,
    XpHistoryResponse,
    XpTransactionResponse,
)
from app.models.scenario import UserScenarioProgress
from app.models.scoring import SessionFeedback, SessionSkillScore
from app.models.session import Session
from app.repositories.gamification import GamificationRepository

logger = logging.getLogger(__name__)

LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1"]

LEVEL_REQUIREMENTS: dict[str, dict] = {
    "A1": {
        "min_score": 0.0,
        "min_sessions": 0,
        "min_scenarios": 0,
        "min_skills_score": None,
    },
    "A2": {
        "min_score": 40.0,
        "min_sessions": 5,
        "min_scenarios": 3,
        "min_skills_score": None,
    },
    "B1": {
        "min_score": 55.0,
        "min_sessions": 10,
        "min_scenarios": 5,
        "min_skills_score": None,
    },
    "B2": {
        "min_score": 70.0,
        "min_sessions": 20,
        "min_scenarios": 5,
        "min_skills_score": 60.0,  # "Không kỹ năng chính nào < 60"
    },
    "C1": {
        "min_score": 85.0,
        "min_sessions": 30,
        "min_scenarios": 5,
        "min_skills_score": 75.0,  # "Không kỹ năng chính nào < 75"
    },
}

MISSION_ICONS = {
    "coach_session": "🎙️",
    "new_scenario": "🎭",
    "room_session": "👥",
    "maintain_streak": "🔥",
}


class GamificationService:
    """Core domain logic for gamification and level system."""

    def __init__(
        self,
        db_session: AsyncSession,
        clock: Clock | None = None,
        recent_sessions_count: int = 5,
    ) -> None:
        self._session = db_session
        self._repo = GamificationRepository(db_session)
        self._clock = clock or get_clock()
        self._recent_sessions_count = recent_sessions_count

    def _get_user_local_date(self, tz_str: str | None) -> date:
        """Convert current clock UTC time to user local date (D-09)."""
        now_utc = self._clock.now()
        try:
            tz = ZoneInfo(tz_str) if tz_str else ZoneInfo("Asia/Ho_Chi_Minh")
        except Exception:
            tz = ZoneInfo("Asia/Ho_Chi_Minh")
        return now_utc.astimezone(tz).date()

    # --- XP Awarding & Ledger Invariant ---

    async def award_xp(
        self,
        user_id: uuid.UUID,
        rule_key: str,
        source_type: str,
        source_id: str,
        description: str | None = None,
        amount_override: int | None = None,
    ) -> XpTransaction | None:
        """
        Award XP based on rule_key with strict idempotency <rule>:<source_id>.
        Maintains invariant: total_xp == sum(transactions).
        """
        rule = await self._repo.get_rule(rule_key)
        amount = amount_override if amount_override is not None else (rule.xp_amount if rule else 0)
        if amount <= 0:
            return None

        idempotency_key = f"{rule_key}:{source_id}"
        tx = await self._repo.create_xp_transaction(
            user_id=user_id,
            amount=amount,
            rule_key=rule_key,
            source_type=source_type,
            source_id=source_id,
            idempotency_key=idempotency_key,
            description=description or (rule.description if rule else None),
            created_at=self._clock.now(),
        )
        return tx

    # --- Streak Handling (D-09) ---

    async def update_streak(self, user_id: uuid.UUID) -> tuple[int, bool]:
        """
        Update user's streak when a qualifying learning activity is completed.
        Rules:
        - If already active on user's local day: streak remains unchanged.
        - If active yesterday: current_streak += 1.
        - If missed yesterday or first time: current_streak = 1.
        - Updates best_streak = max(best_streak, current_streak).
        - Awards +20 XP streak bonus once per day (idempotent key STREAK_BONUS:<user_id>:<date>).
        - Marks 'maintain_streak' daily mission as completed.
        Returns (current_streak, is_first_activity_today).
        """
        profile = await self._repo.get_or_create_profile(user_id)
        u_profile = await self._repo.get_user_profile(user_id)
        today = self._get_user_local_date(u_profile.timezone if u_profile else None)

        if profile.last_active_date == today:
            # Already logged active today
            return profile.current_streak, False

        # First qualifying activity today!
        yesterday = today - timedelta(days=1)
        if profile.last_active_date == yesterday:
            profile.current_streak += 1
        else:
            profile.current_streak = 1

        profile.best_streak = max(profile.best_streak, profile.current_streak)
        profile.last_active_date = today

        # Award Streak Bonus (20 XP)
        await self.award_xp(
            user_id=user_id,
            rule_key="STREAK_BONUS",
            source_type="STREAK",
            source_id=f"{user_id}:{today.isoformat()}",
            description=f"Duy trì streak ngày {today.isoformat()}",
        )

        # Progress daily mission: maintain_streak
        await self._repo.ensure_daily_missions(user_id, today)
        await self._repo.update_mission_progress(
            user_id=user_id,
            mission_date=today,
            condition_type="STREAK",
            increment=1,
            now=self._clock.now(),
        )

        await self._session.flush()
        return profile.current_streak, True

    async def check_and_reset_missed_streaks(self) -> int:
        """
        Periodic/cron task: Reset current_streak to 0 for users who missed yesterday in their timezone.
        """
        stmt = select(GamificationProfile).where(GamificationProfile.current_streak > 0)
        res = await self._session.execute(stmt)
        profiles = res.scalars().all()
        reset_count = 0

        for p in profiles:
            u_profile = await self._repo.get_user_profile(p.user_id)
            today = self._get_user_local_date(u_profile.timezone if u_profile else None)
            yesterday = today - timedelta(days=1)
            if p.last_active_date is None or p.last_active_date < yesterday:
                p.current_streak = 0
                reset_count += 1

        await self._session.flush()
        return reset_count

    # --- Daily Missions ---

    async def get_today_missions(self, user_id: uuid.UUID) -> DailyMissionsTodayResponse:
        """Get today's 4 daily missions for user, generating them lazily on first access."""
        u_profile = await self._repo.get_user_profile(user_id)
        today = self._get_user_local_date(u_profile.timezone if u_profile else None)
        user_missions = await self._repo.ensure_daily_missions(user_id, today)

        items: list[DailyMissionItem] = []
        completed_count = 0
        for um in user_missions:
            is_done = um.status in ("COMPLETED", "CLAIMED")
            if is_done:
                completed_count += 1
            items.append(
                DailyMissionItem(
                    id=um.id,
                    mission_key=um.mission_key,
                    title=um.mission.title,
                    xp_reward=um.mission.xp_reward,
                    condition_type=um.mission.condition_type,
                    progress=um.progress,
                    target=um.target,
                    status=um.status,
                    done=is_done,
                    completed_at=um.completed_at,
                    claimed_at=um.claimed_at,
                    icon=MISSION_ICONS.get(um.mission_key, "🎯"),
                )
            )

        total_count = len(items)
        progress_pct = int(completed_count / total_count * 100) if total_count > 0 else 0

        return DailyMissionsTodayResponse(
            date=today,
            missions=items,
            completed_count=completed_count,
            total_count=total_count,
            progress_pct=progress_pct,
        )

    async def claim_mission(
        self, user_id: uuid.UUID, mission_id: uuid.UUID
    ) -> ClaimMissionResponse:
        """Claim XP reward for a completed daily mission."""
        um = await self._repo.get_user_mission(mission_id, user_id)
        if not um:
            raise ValueError("MISSION_NOT_FOUND")
        if um.status == "CLAIMED":
            raise ValueError("MISSION_ALREADY_CLAIMED")
        if um.status != "COMPLETED":
            raise ValueError("MISSION_NOT_COMPLETED")

        um.status = "CLAIMED"
        um.claimed_at = self._clock.now()

        # Award XP
        tx = await self.award_xp(
            user_id=user_id,
            rule_key="DAILY_MISSION",
            source_type="DAILY_MISSION",
            source_id=str(um.id),
            description=f"Thưởng nhiệm vụ: {um.mission.title}",
            amount_override=um.mission.xp_reward,
        )
        profile = await self._repo.get_or_create_profile(user_id)

        return ClaimMissionResponse(
            mission_id=um.id,
            claimed=True,
            xp_awarded=tx.amount if tx else um.mission.xp_reward,
            new_total_xp=profile.total_xp,
        )

    # --- Level Advancement Logic (SRS 3.4 & D-02) ---

    async def get_level_advancement_stats(self, user_id: uuid.UUID) -> dict[str, Any]:
        """
        Calculate user's metrics for level evaluation:
        1. Completed valid sessions count
        2. Distinct completed scenarios count
        3. Overall Score: average of last N completed sessions
        4. Core 5 skills average scores across last N completed sessions
        """
        # 1. Total completed sessions with FEEDBACK_READY and valid overall score
        sess_stmt = (
            select(Session)
            .join(SessionFeedback, Session.id == SessionFeedback.session_id)
            .where(
                Session.user_id == user_id,
                SessionFeedback.status == "FEEDBACK_READY",
                SessionFeedback.overall_score.isnot(None),
            )
            .order_by(Session.created_at.desc())
        )
        res_sessions = (await self._session.execute(sess_stmt)).scalars().all()
        total_sessions = len(res_sessions)

        # 2. Total distinct completed scenarios
        scen_stmt = select(func.count(distinct(UserScenarioProgress.scenario_id))).where(
            UserScenarioProgress.user_id == user_id,
            UserScenarioProgress.status == "COMPLETED",
        )
        total_scenarios = int((await self._session.execute(scen_stmt)).scalar_one() or 0)

        # 3. Overall score across last N sessions
        recent_sessions = res_sessions[: self._recent_sessions_count]
        overall_scores = [
            s.feedback.overall_score
            for s in recent_sessions
            if s.feedback and s.feedback.overall_score is not None
        ]
        avg_overall = round(sum(overall_scores) / len(overall_scores), 1) if overall_scores else 0.0

        # 4. Average score for each of the 5 core skills over recent sessions
        recent_session_ids = [s.id for s in recent_sessions]
        skill_scores_map: dict[str, list[float]] = {
            "fluency": [],
            "listening": [],
            "vocabulary": [],
            "response_speed": [],
            "pronunciation": [],
        }
        if recent_session_ids:
            skills_stmt = select(SessionSkillScore).where(
                SessionSkillScore.session_id.in_(recent_session_ids)
            )
            scores = (await self._session.execute(skills_stmt)).scalars().all()
            for sc in scores:
                if sc.score is not None and sc.skill_name in skill_scores_map:
                    skill_scores_map[sc.skill_name].append(sc.score)

        avg_skills: dict[str, float] = {}
        for skill_name, vals in skill_scores_map.items():
            avg_skills[skill_name] = round(sum(vals) / len(vals), 1) if vals else 0.0

        return {
            "total_sessions": total_sessions,
            "total_scenarios": total_scenarios,
            "avg_overall": avg_overall,
            "avg_skills": avg_skills,
        }

    async def evaluate_level_advancement(
        self, user_id: uuid.UUID, triggering_session_id: uuid.UUID | None = None
    ) -> tuple[str, bool]:
        """
        Check if user qualifies for level promotion according to SRS Table 3.4.
        Never degrades level (Rule 4).
        If promoted, records level_history and creates congratulatory notification.
        Returns (current_or_new_level, did_promote).
        """
        u_profile = await self._repo.get_user_profile(user_id)
        current_level = u_profile.cefr_level if u_profile and u_profile.cefr_level else "A1"
        if current_level not in LEVEL_ORDER:
            current_level = "A1"

        stats = await self.get_level_advancement_stats(user_id)
        current_idx = LEVEL_ORDER.index(current_level)

        # Check progressively higher levels
        new_level = current_level
        for target_level in LEVEL_ORDER[current_idx + 1 :]:
            reqs = LEVEL_REQUIREMENTS[target_level]
            # Check conditions
            if stats["avg_overall"] < reqs["min_score"]:
                break
            if stats["total_sessions"] < reqs["min_sessions"]:
                break
            if stats["total_scenarios"] < reqs["min_scenarios"]:
                break
            if reqs["min_skills_score"] is not None and any(
                v < reqs["min_skills_score"] for v in stats["avg_skills"].values()
            ):
                break
            # All conditions met for target_level!
            new_level = target_level

        if new_level != current_level:
            # Advance level!
            reason = (
                f"Đạt điều kiện Bảng 3.4: Điểm tổng {stats['avg_overall']} (yêu cầu {LEVEL_REQUIREMENTS[new_level]['min_score']}), "
                f"{stats['total_sessions']} sessions, {stats['total_scenarios']} scenarios."
            )
            await self._repo.record_level_advancement(
                user_id=user_id,
                from_level=current_level,
                to_level=new_level,
                reason=reason,
                session_id=triggering_session_id,
                created_at=self._clock.now(),
            )
            # Create congratulatory notification
            await self._repo.create_notification(
                user_id=user_id,
                type_="LEVEL_UP",
                title=f"Chúc mừng bạn đã thăng hạng Level {new_level}! 🎓",
                content=f"Bạn đã hoàn thành xuất sắc các mục tiêu và chính thức đạt trình độ {new_level} trong khung CEFR.",
                created_at=self._clock.now(),
            )
            # Evaluate badge for level advancement (e.g. B1 Achiever)
            await self.evaluate_badges(user_id)
            return new_level, True

        return current_level, False

    # --- Badges Evaluation ---

    async def evaluate_badges(self, user_id: uuid.UUID) -> list[UserBadge]:
        """
        Evaluate criteria for all 6 badges and award newly qualified ones.
        """
        u_profile = await self._repo.get_user_profile(user_id)
        level = u_profile.cefr_level if u_profile and u_profile.cefr_level else "A1"
        profile = await self._repo.get_or_create_profile(user_id)
        stats = await self.get_level_advancement_stats(user_id)

        # Check maximum fluency score across all sessions
        fluency_stmt = (
            select(func.max(SessionSkillScore.score))
            .join(SessionFeedback, SessionSkillScore.session_id == SessionFeedback.session_id)
            .join(Session, SessionFeedback.session_id == Session.id)
            .where(
                Session.user_id == user_id,
                SessionSkillScore.skill_name == "fluency",
            )
        )
        max_fluency = (await self._session.execute(fluency_stmt)).scalar_one_or_none() or 0.0

        # Check completed rooms count
        room_stmt = select(func.count(Session.id)).where(
            Session.user_id == user_id,
            Session.type == "ROOM",
            Session.status.in_(["ENDED", "FEEDBACK_READY"]),
        )
        rooms_count = int((await self._session.execute(room_stmt)).scalar_one() or 0)

        awarded: list[UserBadge] = []
        badge_defs = await self._repo.list_badge_definitions()
        for b in badge_defs:
            should_award = False
            if (
                b.key == "first_speaker"
                and stats["total_sessions"] >= 1
                or b.key == "streak_7"
                and (profile.current_streak >= 7 or profile.best_streak >= 7)
                or b.key == "b1_achiever"
                and level in ("B1", "B2", "C1")
                or b.key == "fluency_master"
                and max_fluency >= 85
                or b.key == "master_actor"
                and stats["total_scenarios"] >= 20
                or b.key == "community_star"
                and rooms_count >= 10
            ):
                should_award = True

            if should_award:
                res = await self._repo.award_badge(
                    user_id=user_id,
                    badge_key=b.key,
                    awarded_at=self._clock.now(),
                    metadata={"eval_time": self._clock.now().isoformat()},
                )
                if res:
                    awarded.append(res)
                    await self._repo.create_notification(
                        user_id=user_id,
                        type_="BADGE_UNLOCKED",
                        title=f"Huy hiệu mới: {b.name} {b.icon_emoji}",
                        content=f'Bạn đã mở khóa thành công huy hiệu "{b.name}": {b.description}',
                        created_at=self._clock.now(),
                    )

        return awarded

    # --- Summaries ---

    async def get_summary(self, user_id: uuid.UUID) -> GamificationSummaryResponse:
        """
        Return user's gamification summary with progress toward next level (D-02).
        """
        profile = await self._repo.get_or_create_profile(user_id)
        u_profile = await self._repo.get_user_profile(user_id)
        current_level = u_profile.cefr_level if u_profile and u_profile.cefr_level else "A1"
        if current_level not in LEVEL_ORDER:
            current_level = "A1"

        stats = await self.get_level_advancement_stats(user_id)
        earned_badges = await self._repo.get_user_badges(user_id)
        all_badges = await self._repo.list_badge_definitions()

        current_idx = LEVEL_ORDER.index(current_level)
        next_level = LEVEL_ORDER[current_idx + 1] if current_idx < len(LEVEL_ORDER) - 1 else None

        conditions: list[LevelConditionProgress] = []
        is_ready = False
        progress_pct = 100

        if next_level:
            reqs = LEVEL_REQUIREMENTS[next_level]
            # Overall score
            score_met = stats["avg_overall"] >= reqs["min_score"]
            conditions.append(
                LevelConditionProgress(
                    name="Điểm giao tiếp trung bình",
                    description=f"Trung bình {self._recent_sessions_count} buổi gần nhất",
                    current_value=stats["avg_overall"],
                    required_value=reqs["min_score"],
                    unit="điểm",
                    is_met=score_met,
                )
            )
            # Sessions count
            sess_met = stats["total_sessions"] >= reqs["min_sessions"]
            conditions.append(
                LevelConditionProgress(
                    name="Số buổi đã luyện tập",
                    description="Tổng số buổi hoàn thành đạt chất lượng",
                    current_value=stats["total_sessions"],
                    required_value=reqs["min_sessions"],
                    unit="buổi",
                    is_met=sess_met,
                )
            )
            # Scenarios count
            if reqs["min_scenarios"] > 0:
                scen_met = stats["total_scenarios"] >= reqs["min_scenarios"]
                conditions.append(
                    LevelConditionProgress(
                        name="Tình huống hoàn thành",
                        description="Số tình huống thực tế khác nhau",
                        current_value=stats["total_scenarios"],
                        required_value=reqs["min_scenarios"],
                        unit="tình huống",
                        is_met=scen_met,
                    )
                )
            else:
                scen_met = True

            # Min skills score (for B2, C1)
            skills_met = True
            if reqs["min_skills_score"] is not None:
                min_skill_val = min(stats["avg_skills"].values()) if stats["avg_skills"] else 0.0
                skills_met = min_skill_val >= reqs["min_skills_score"]
                conditions.append(
                    LevelConditionProgress(
                        name="Điểm kỹ năng tối thiểu",
                        description=f"Không kỹ năng nào < {reqs['min_skills_score']}",
                        current_value=min_skill_val,
                        required_value=reqs["min_skills_score"],
                        unit="điểm",
                        is_met=skills_met,
                    )
                )

            is_ready = score_met and sess_met and scen_met and skills_met
            met_count = sum(1 for c in conditions if c.is_met)
            progress_pct = int(met_count / len(conditions) * 100) if conditions else 0

        return GamificationSummaryResponse(
            xp=profile.total_xp,
            level=current_level,
            next_level=next_level,
            current_streak=profile.current_streak,
            best_streak=profile.best_streak,
            badges_earned=len(earned_badges),
            badges_total=len(all_badges),
            level_conditions=conditions,
            level_progress_pct=progress_pct,
            is_ready_for_promotion=is_ready,
        )

    async def get_badges_list(self, user_id: uuid.UUID) -> BadgesListResponse:
        """Fetch all badges with user earned status and current progress."""
        all_defs = await self._repo.list_badge_definitions()
        user_badges = await self._repo.get_user_badges(user_id)
        earned_map = {ub.badge_key: ub for ub in user_badges}

        stats = await self.get_level_advancement_stats(user_id)
        profile = await self._repo.get_or_create_profile(user_id)

        items: list[BadgeItem] = []
        for b in all_defs:
            is_earned = b.key in earned_map
            earned_at = earned_map[b.key].awarded_at if is_earned else None

            # Calculate progress for display
            curr_progress = 0
            if b.key == "first_speaker":
                curr_progress = min(b.target_value, stats["total_sessions"])
            elif b.key == "streak_7":
                curr_progress = min(
                    b.target_value, max(profile.current_streak, profile.best_streak)
                )
            elif b.key == "b1_achiever" or b.key == "fluency_master":
                curr_progress = 1 if is_earned else 0
            elif b.key == "master_actor":
                curr_progress = min(b.target_value, stats["total_scenarios"])
            elif b.key == "community_star":
                curr_progress = 1 if is_earned else 0

            items.append(
                BadgeItem(
                    key=b.key,
                    name=b.name,
                    description=b.description,
                    icon_emoji=b.icon_emoji,
                    category=b.category,
                    criteria_type=b.criteria_type,
                    target_value=b.target_value,
                    sort_order=b.sort_order,
                    earned=is_earned,
                    earned_at=earned_at,
                    progress=b.target_value if is_earned else curr_progress,
                    total=b.target_value,
                )
            )

        return BadgesListResponse(
            badges=items,
            earned_count=len(user_badges),
            total_count=len(all_defs),
        )

    async def get_xp_history(
        self, user_id: uuid.UUID, limit: int = 50, offset: int = 0
    ) -> XpHistoryResponse:
        """List user's XP transactions."""
        txs = await self._repo.list_xp_transactions(user_id, limit, offset)
        profile = await self._repo.get_or_create_profile(user_id)
        return XpHistoryResponse(
            transactions=[
                XpTransactionResponse(
                    id=t.id,
                    amount=t.amount,
                    rule_key=t.rule_key,
                    source_type=t.source_type,
                    source_id=t.source_id,
                    idempotency_key=t.idempotency_key,
                    description=t.description,
                    created_at=t.created_at,
                )
                for t in txs
            ],
            total_xp=profile.total_xp,
        )

    async def get_notifications(
        self, user_id: uuid.UUID, limit: int = 50, unread_only: bool = False
    ) -> NotificationsListResponse:
        """List user notifications."""
        notis = await self._repo.list_notifications(user_id, limit, unread_only)
        unread_count = await self._repo.get_unread_notification_count(user_id)
        return NotificationsListResponse(
            notifications=[
                NotificationItem(
                    id=n.id,
                    type=n.type,
                    title=n.title,
                    content=n.content,
                    is_read=n.is_read,
                    created_at=n.created_at,
                )
                for n in notis
            ],
            unread_count=unread_count,
        )

    async def mark_notification_read(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Mark single notification as read."""
        return await self._repo.mark_notification_read(notification_id, user_id)

    async def mark_all_notifications_read(self, user_id: uuid.UUID) -> int:
        """Mark all notifications as read."""
        return await self._repo.mark_all_notifications_read(user_id)

    # --- Domain Event Handlers ---

    async def on_feedback_generated(self, event: FeedbackGenerated) -> None:
        """
        Handle FeedbackGenerated domain event from Coach/AI sessions.
        Rule: "Chỉ cộng XP khi session đạt dữ liệu tối thiểu (không phải INSUFFICIENT_DATA)."
        """
        if event.status == "INSUFFICIENT_DATA" or event.overall_score is None:
            logger.info(
                "Session %s has INSUFFICIENT_DATA. Skipping XP and streak.", event.session_id
            )
            return

        # 1. Award COACH_SESSION XP (+100 XP)
        await self.award_xp(
            user_id=event.user_id,
            rule_key="COACH_SESSION",
            source_type="COACH_SESSION",
            source_id=str(event.session_id),
            description="Hoàn thành phiên luyện nói với AI Coach",
        )

        # 2. Update Streak
        await self.update_streak(event.user_id)

        # 3. Progress daily mission: coach_session
        u_profile = await self._repo.get_user_profile(event.user_id)
        today = self._get_user_local_date(u_profile.timezone if u_profile else None)
        await self._repo.ensure_daily_missions(event.user_id, today)
        await self._repo.update_mission_progress(
            user_id=event.user_id,
            mission_date=today,
            condition_type="COACH_SESSION",
            increment=1,
            now=self._clock.now(),
        )

        # 4. Check level progression & badges
        await self.evaluate_level_advancement(event.user_id, triggering_session_id=event.session_id)
        await self.evaluate_badges(event.user_id)

    async def on_roleplay_evaluated(self, event: RoleplayEvaluated) -> None:
        """
        Handle RoleplayEvaluated domain event from scenario practice.
        Rule: "Chỉ cộng XP khi session đạt dữ liệu tối thiểu (không phải INSUFFICIENT_DATA)."
        """
        if event.overall_score is None:
            logger.info("Roleplay session %s has no score. Skipping XP.", event.session_id)
            return

        # 1. Award SCENARIO_LESSON XP (+100 XP)
        await self.award_xp(
            user_id=event.user_id,
            rule_key="SCENARIO_LESSON",
            source_type="SCENARIO_LESSON",
            source_id=str(event.session_id),
            description="Hoàn thành tình huống giao tiếp",
        )

        # 2. Update Streak
        await self.update_streak(event.user_id)

        # 3. Progress daily mission: new_scenario
        u_profile = await self._repo.get_user_profile(event.user_id)
        today = self._get_user_local_date(u_profile.timezone if u_profile else None)
        await self._repo.ensure_daily_missions(event.user_id, today)
        await self._repo.update_mission_progress(
            user_id=event.user_id,
            mission_date=today,
            condition_type="SCENARIO_LESSON",
            increment=1,
            now=self._clock.now(),
        )

        # 4. Check level progression & badges
        await self.evaluate_level_advancement(event.user_id, triggering_session_id=event.session_id)
        await self.evaluate_badges(event.user_id)

    async def on_room_session_completed(self, event: RoomSessionCompleted) -> None:
        """
        Handle RoomSessionCompleted domain event from Community Voice Rooms (Sprint 7 ready).
        """
        # 1. Award ROOM_SESSION XP (+100 XP)
        await self.award_xp(
            user_id=event.user_id,
            rule_key="ROOM_SESSION",
            source_type="ROOM_SESSION",
            source_id=str(event.session_id),
            description="Tham gia phòng luyện nói cộng đồng",
        )

        # 2. Update Streak
        await self.update_streak(event.user_id)

        # 3. Progress daily mission: room_session
        u_profile = await self._repo.get_user_profile(event.user_id)
        today = self._get_user_local_date(u_profile.timezone if u_profile else None)
        await self._repo.ensure_daily_missions(event.user_id, today)
        await self._repo.update_mission_progress(
            user_id=event.user_id,
            mission_date=today,
            condition_type="ROOM_SESSION",
            increment=1,
            now=self._clock.now(),
        )

        # 4. Check level progression & badges
        await self.evaluate_level_advancement(event.user_id, triggering_session_id=event.session_id)
        await self.evaluate_badges(event.user_id)


def register_gamification_event_listeners() -> None:
    """Wire up async domain event bus subscribers for gamification processing."""
    from app.core.database import async_session_factory

    async def _on_feedback_generated(event: FeedbackGenerated) -> None:
        async with async_session_factory() as db:
            svc = GamificationService(db)
            await svc.on_feedback_generated(event)
            await db.commit()

    async def _on_roleplay_evaluated(event: RoleplayEvaluated) -> None:
        async with async_session_factory() as db:
            svc = GamificationService(db)
            await svc.on_roleplay_evaluated(event)
            await db.commit()

    async def _on_room_session_completed(event: RoomSessionCompleted) -> None:
        async with async_session_factory() as db:
            svc = GamificationService(db)
            await svc.on_room_session_completed(event)
            await db.commit()

    event_bus.subscribe(FeedbackGenerated, _on_feedback_generated)
    event_bus.subscribe(RoleplayEvaluated, _on_roleplay_evaluated)
    event_bus.subscribe(RoomSessionCompleted, _on_room_session_completed)
