"""
Progress & Dashboard service for computing skill progress, session history,
30-day changes, and motivational dashboard statistics.
"""

from __future__ import annotations

import base64
import logging
import uuid
from collections.abc import Sequence
from datetime import datetime, timedelta

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.clock import Clock, get_clock
from app.models.auth import User
from app.models.gamification_schemas import (
    DashboardRecentSession,
    DashboardResponse,
    DashboardSkillOverview,
    MotivationalCard,
    ProgressHistoryResponse,
    ProgressSkillsResponse,
    ProgressSummaryResponse,
    SessionHistoryItem,
    SkillDetailItem,
)
from app.models.scenario import Scenario, UserScenarioProgress
from app.models.scoring import SessionFeedback, SessionSkillScore
from app.models.session import Session
from app.repositories.gamification import GamificationRepository
from app.services.gamification import LEVEL_REQUIREMENTS, GamificationService

logger = logging.getLogger(__name__)

SKILL_CONFIG = {
    "fluency": {
        "label": "Độ lưu loát",
        "color": "#286FB4",
        "desc": "Tốc độ nói, ngập ngừng, khoảng lặng và mức độ liền mạch",
    },
    "listening": {
        "label": "Khả năng nghe hiểu",
        "color": "#DF4C73",
        "desc": "Mức độ hiểu câu hỏi và phản hồi đúng trọng tâm",
    },
    "vocabulary": {
        "label": "Vốn từ vựng",
        "color": "#f59e0b",
        "desc": "Độ đa dạng từ vựng (MTLD) và sử dụng cụm từ giao tiếp",
    },
    "response_speed": {
        "label": "Tốc độ phản xạ",
        "color": "#059669",
        "desc": "Thời gian phản hồi khi nghe câu hỏi",
    },
    "pronunciation": {
        "label": "Độ chính xác phát âm (tham khảo)",
        "color": "#7c3aed",
        "desc": "Độ tin cậy nhận diện giọng nói (STT Confidence)",
    },
}


class ProgressService:
    """Service providing aggregated progress, skills analytics, and dashboard metrics."""

    def __init__(
        self,
        db_session: AsyncSession,
        clock: Clock | None = None,
    ) -> None:
        self._session = db_session
        self._repo = GamificationRepository(db_session)
        self._gamification_svc = GamificationService(db_session, clock=clock)
        self._clock = clock or get_clock()

    # --- Progress Summary ---

    async def get_progress_summary(self, user_id: uuid.UUID) -> ProgressSummaryResponse:
        """Fetch overall score, 30-day change, and practice counts."""
        profile = await self._repo.get_or_create_profile(user_id)
        u_profile = await self._repo.get_user_profile(user_id)
        level = u_profile.cefr_level if u_profile and u_profile.cefr_level else "A1"

        # Recent completed sessions
        sess_stmt = (
            select(SessionFeedback.overall_score)
            .join(Session, Session.id == SessionFeedback.session_id)
            .where(
                Session.user_id == user_id,
                SessionFeedback.status == "FEEDBACK_READY",
                SessionFeedback.overall_score.isnot(None),
            )
            .order_by(Session.created_at.desc())
        )
        scores = (await self._session.execute(sess_stmt)).scalars().all()
        valid_scores = [float(s) for s in scores if s is not None]
        total_sessions = len(valid_scores)

        # Current overall score (avg of last 5)
        current_overall = (
            round(sum(valid_scores[:5]) / len(valid_scores[:5]), 1) if valid_scores else None
        )

        # Sessions between 30 and 60 days ago to compute change30Days
        now = self._clock.now()
        thirty_days_ago = now - timedelta(days=30)
        sixty_days_ago = now - timedelta(days=60)

        prev_stmt = (
            select(SessionFeedback.overall_score)
            .join(Session, Session.id == SessionFeedback.session_id)
            .where(
                Session.user_id == user_id,
                SessionFeedback.status == "FEEDBACK_READY",
                SessionFeedback.overall_score.isnot(None),
                Session.created_at >= sixty_days_ago,
                Session.created_at <= thirty_days_ago,
            )
        )
        prev_scores = (await self._session.execute(prev_stmt)).scalars().all()
        valid_prev = [float(s) for s in prev_scores if s is not None]
        if valid_prev and current_overall is not None:
            prev_avg = sum(valid_prev) / len(valid_prev)
            change_30_days = round(current_overall - prev_avg, 1)
        elif len(valid_scores) > 5 and current_overall is not None:
            older_avg = sum(valid_scores[5:]) / len(valid_scores[5:])
            change_30_days = round(current_overall - older_avg, 1)
        else:
            change_30_days = None

        # Distinct completed scenarios
        scen_stmt = select(func.count(distinct(UserScenarioProgress.scenario_id))).where(
            UserScenarioProgress.user_id == user_id,
            UserScenarioProgress.status == "COMPLETED",
        )
        total_scenarios = int((await self._session.execute(scen_stmt)).scalar_one() or 0)

        return ProgressSummaryResponse(
            overall_score=current_overall,
            change_30_days=change_30_days,
            total_xp=profile.total_xp,
            current_streak=profile.current_streak,
            level=level,
            completed_sessions=total_sessions,
            completed_scenarios=total_scenarios,
        )

    # --- Progress Skills ---

    async def get_progress_skills(self, user_id: uuid.UUID) -> ProgressSkillsResponse:
        """
        Fetch skill scores breakdown for the 5 communication skills.
        Algorithm for "trước" (prev):
        - Average score in sessions from 31 to 60 days ago.
        - If none, average of the user's first 3 sessions ever completed.
        - If still none, null.
        """
        now = self._clock.now()
        day_31_ago = now - timedelta(days=31)
        day_60_ago = now - timedelta(days=60)

        # 1. Recent sessions (last 5)
        recent_sessions_stmt = (
            select(Session.id)
            .join(SessionFeedback, Session.id == SessionFeedback.session_id)
            .where(
                Session.user_id == user_id,
                SessionFeedback.status == "FEEDBACK_READY",
            )
            .order_by(Session.created_at.desc())
            .limit(5)
        )
        recent_ids = (await self._session.execute(recent_sessions_stmt)).scalars().all()

        # 2. Sessions between 31 and 60 days ago
        window_sessions_stmt = (
            select(Session.id)
            .join(SessionFeedback, Session.id == SessionFeedback.session_id)
            .where(
                Session.user_id == user_id,
                SessionFeedback.status == "FEEDBACK_READY",
                Session.created_at >= day_60_ago,
                Session.created_at <= day_31_ago,
            )
        )
        window_ids = (await self._session.execute(window_sessions_stmt)).scalars().all()

        # 3. First 3 sessions ever completed (fallback for prev)
        first_3_sessions_stmt = (
            select(Session.id)
            .join(SessionFeedback, Session.id == SessionFeedback.session_id)
            .where(
                Session.user_id == user_id,
                SessionFeedback.status == "FEEDBACK_READY",
            )
            .order_by(Session.created_at.asc())
            .limit(3)
        )
        first_3_ids = (await self._session.execute(first_3_sessions_stmt)).scalars().all()

        # Helper to compute average score for a skill across given session IDs
        async def get_avg_for_sessions(
            session_ids: Sequence[uuid.UUID], skill: str
        ) -> float | None:
            if not session_ids:
                return None
            stmt = select(func.avg(SessionSkillScore.score)).where(
                SessionSkillScore.session_id.in_(session_ids),
                SessionSkillScore.skill_name == skill,
                SessionSkillScore.score.isnot(None),
            )
            res = (await self._session.execute(stmt)).scalar_one_or_none()
            return round(float(res), 1) if res is not None else None

        skill_items: list[SkillDetailItem] = []
        for skill_key, cfg in SKILL_CONFIG.items():
            current_val = await get_avg_for_sessions(recent_ids, skill_key)

            # Determine prev
            prev_val = await get_avg_for_sessions(window_ids, skill_key)
            if prev_val is None and len(recent_ids) > 1:
                # Use first 3 sessions as fallback if not identical to recent
                first_avg = await get_avg_for_sessions(first_3_ids, skill_key)
                if first_avg is not None:
                    prev_val = first_avg

            change_val = (
                round(current_val - prev_val, 1)
                if current_val is not None and prev_val is not None
                else None
            )

            # Status label
            if current_val is None:
                status_label = "Chưa có dữ liệu"
            elif current_val >= 70:
                status_label = "Tốt"
            elif current_val >= 50:
                status_label = "Đang phát triển"
            else:
                status_label = "Cần cải thiện"

            skill_items.append(
                SkillDetailItem(
                    skill=skill_key,
                    label=cfg["label"],
                    current=current_val,
                    prev=prev_val,
                    change=change_val,
                    status_label=status_label,
                    color=cfg["color"],
                    description=cfg["desc"],
                )
            )

        return ProgressSkillsResponse(skills=skill_items)

    # --- Progress History (Cursor-based) ---

    async def get_progress_history(
        self,
        user_id: uuid.UUID,
        type_: str | None = None,
        limit: int = 15,
        cursor: str | None = None,
    ) -> ProgressHistoryResponse:
        """
        Cursor-paginated session history for the user.
        Cursor encodes created_at ISO timestamp.
        """
        stmt = (
            select(Session)
            .options(selectinload(Session.feedback), selectinload(Session.topic))
            .where(
                Session.user_id == user_id,
                Session.status.in_(["FEEDBACK_READY", "ENDED"]),
            )
        )

        if type_:
            norm_type = type_.upper()
            if norm_type in ("COACH", "AI_COACH", "AI-COACH"):
                stmt = stmt.where(Session.type == "COACH")
            elif norm_type in ("ROLEPLAY", "SCENARIO"):
                stmt = stmt.where(Session.type == "ROLEPLAY")
            elif norm_type == "ROOM":
                stmt = stmt.where(Session.type == "ROOM")

        # Handle cursor
        if cursor:
            try:
                decoded_ts = datetime.fromisoformat(
                    base64.b64decode(cursor.encode("utf-8")).decode("utf-8")
                )
                stmt = stmt.where(Session.created_at < decoded_ts)
            except Exception:
                logger.warning("Invalid history cursor: %s", cursor)

        stmt = stmt.order_by(Session.created_at.desc()).limit(limit + 1)
        res = (await self._session.execute(stmt)).scalars().all()

        has_more = len(res) > limit
        items_to_return = res[:limit]

        next_cursor = None
        if has_more and items_to_return:
            last_item = items_to_return[-1]
            next_cursor = base64.b64encode(last_item.created_at.isoformat().encode("utf-8")).decode(
                "utf-8"
            )

        formatted_items: list[SessionHistoryItem] = []
        for s in items_to_return:
            # Determine topic display name
            topic_title = "Luyện nói tự do"
            if s.topic and s.topic.title:
                topic_title = s.topic.title
            elif s.scenario_id:
                # Fetch scenario title if available
                scen = await self._session.get(Scenario, s.scenario_id)
                if scen:
                    topic_title = scen.title_vi

            # Emoji & display type
            if s.type == "COACH":
                type_display = "AI Coach"
                emoji = "🎙️"
            elif s.type == "ROLEPLAY":
                type_display = "Tình huống"
                emoji = "🎭"
            else:
                type_display = "Cộng đồng"
                emoji = "👥"

            # Duration formatting
            mins = int(s.duration_seconds // 60)
            secs = int(s.duration_seconds % 60)
            duration_str = f"{mins}p {secs}s" if mins > 0 else f"{secs}s"

            # Date formatting (local date)
            date_str = s.created_at.strftime("%d/%m/%Y")

            score = s.feedback.overall_score if s.feedback else None

            formatted_items.append(
                SessionHistoryItem(
                    id=s.id,
                    type=type_display,
                    topic=topic_title,
                    date=date_str,
                    duration=duration_str,
                    score=score,
                    emoji=emoji,
                )
            )

        return ProgressHistoryResponse(
            items=formatted_items,
            next_cursor=next_cursor,
            has_more=has_more,
        )

    # --- Dashboard ---

    async def get_dashboard(self, user_id: uuid.UUID) -> DashboardResponse:
        """Fetch unified data for the Dashboard (UI Screens 12 & 13)."""
        user = await self._session.get(User, user_id)
        display_name = user.full_name if user else "bạn"
        summary = await self.get_progress_summary(user_id)
        gamification = await self._gamification_svc.get_summary(user_id)
        today_missions = await self._gamification_svc.get_today_missions(user_id)
        skills_resp = await self.get_progress_skills(user_id)
        history_resp = await self.get_progress_history(user_id, limit=5)

        # 5 Skills for dashboard
        skills_overview = [
            DashboardSkillOverview(
                skill=sk.skill,
                label=sk.label,
                value=int(round(sk.current)) if sk.current is not None else 0,
                color=sk.color,
            )
            for sk in skills_resp.skills
        ]

        # 5 Recent sessions for dashboard
        recent_sessions = [
            DashboardRecentSession(
                id=h.id,
                type="ai-coach"
                if "Coach" in h.type
                else "scenario"
                if "Tình" in h.type
                else "community",
                topic=h.topic,
                date=h.date,
                duration=h.duration,
                score=int(round(h.score)) if h.score is not None else 0,
            )
            for h in history_resp.items
        ]

        # Rule-based Motivational Card based on distance to next level
        next_level = gamification.next_level
        if not next_level:
            motivational = MotivationalCard(
                title=f"Chúc mừng, {display_name}! 🌟",
                message="Bạn đã chinh phục đỉnh cao CEFR C1. Hãy tiếp tục duy trì thói quen luyện nói tự tin mỗi ngày nhé!",
                target_level=None,
            )
        else:
            reqs = LEVEL_REQUIREMENTS[next_level]
            current_overall = summary.overall_score or 0.0
            score_gap = max(0.0, round(reqs["min_score"] - current_overall, 1))
            remaining_sessions = max(0, reqs["min_sessions"] - summary.completed_sessions)

            if score_gap > 0 and remaining_sessions > 0:
                msg = f"Còn {remaining_sessions} buổi luyện tập và +{score_gap} điểm để chạm mốc {next_level}."
            elif remaining_sessions > 0:
                msg = f"Điểm số của bạn đã sẵn sàng! Luyện thêm {remaining_sessions} buổi nữa để thăng cấp {next_level}."
            elif score_gap > 0:
                msg = f"Bạn cần thêm +{score_gap} điểm giao tiếp để mở khóa trình độ {next_level}."
            else:
                msg = f"Bạn đã đạt toàn bộ tiêu chí! Hãy hoàn thành một phiên luyện tiếp theo để chính thức thăng cấp {next_level}."

            motivational = MotivationalCard(
                title=f"Cố lên, {display_name}! 🚀",
                message=msg,
                target_level=next_level,
                remaining_sessions=remaining_sessions,
                score_gap=score_gap,
            )

        overall_score = (
            int(round(summary.overall_score))
            if summary.overall_score is not None
            else (
                int(round(sum(s.value for s in skills_overview) / len(skills_overview)))
                if skills_overview
                else 0
            )
        )

        return DashboardResponse(
            greeting=f"Xin chào, {display_name}! 👋",
            display_name=display_name,
            overall_score=overall_score,
            xp=gamification.xp,
            total_xp=gamification.xp,
            streak=gamification.current_streak,
            current_streak=gamification.current_streak,
            level=gamification.level,
            next_level=gamification.next_level,
            today_missions=today_missions.missions,
            missions_progress_pct=today_missions.progress_pct,
            skills=skills_overview,
            recent_sessions=recent_sessions,
            motivational_card=motivational,
        )
