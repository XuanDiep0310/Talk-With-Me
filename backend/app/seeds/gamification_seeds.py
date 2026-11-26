"""
Seed data for Gamification: XP rules, daily missions, and badge definitions.
"""

from typing import Any

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gamification import BadgeDefinition, MissionDefinition, XpRule

XP_RULES: list[dict[str, Any]] = [
    {
        "key": "DAILY_MISSION",
        "xp_amount": 50,
        "is_active": True,
        "description": "Hoàn thành một nhiệm vụ hàng ngày",
    },
    {
        "key": "SCENARIO_LESSON",
        "xp_amount": 100,
        "is_active": True,
        "description": "Hoàn thành một tình huống giao tiếp (Scenario Lesson)",
    },
    {
        "key": "COACH_SESSION",
        "xp_amount": 100,
        "is_active": True,
        "description": "Hoàn thành một phiên luyện nói với AI Coach",
    },
    {
        "key": "STREAK_BONUS",
        "xp_amount": 20,
        "is_active": True,
        "description": "Duy trì chuỗi học tập hàng ngày",
    },
]

MISSION_DEFINITIONS: list[dict[str, Any]] = [
    {
        "key": "coach_session",
        "title": "Hoàn thành 1 buổi AI Coach",
        "xp_reward": None,
        "condition_type": "COACH_SESSION",
        "target_count": 1,
        "params": {},
        "is_active": True,
    },
    {
        "key": "new_scenario",
        "title": "Luyện 1 tình huống mới",
        "xp_reward": None,
        "condition_type": "SCENARIO_LESSON",
        "target_count": 1,
        "params": {},
        "is_active": True,
    },
    {
        "key": "maintain_streak",
        "title": "Duy trì streak",
        "xp_reward": None,
        "condition_type": "STREAK",
        "target_count": 1,
        "params": {},
        "is_active": True,
    },
]

BADGE_DEFINITIONS: list[dict[str, Any]] = [
    # --- Practice (AI Coach) ---
    {
        "key": "first_speaker",
        "name": "Người nói đầu tiên",
        "description": "Hoàn thành buổi nói chuyện đầu tiên với AI Coach",
        "icon_emoji": "🎙️",
        "category": "PRACTICE",
        "criteria_type": "SESSIONS_COUNT",
        "target_value": 1,
        "params": {},
        "sort_order": 1,
    },
    {
        "key": "coach_5",
        "name": "Người bạn đồng hành",
        "description": "Hoàn thành 5 buổi hội thoại 1-1 cùng AI Coach",
        "icon_emoji": "🎧",
        "category": "PRACTICE",
        "criteria_type": "SESSIONS_COUNT",
        "target_value": 5,
        "params": {},
        "sort_order": 2,
    },
    {
        "key": "coach_20",
        "name": "Chiến binh giao tiếp",
        "description": "Hoàn thành 20 buổi luyện nói cùng AI Coach",
        "icon_emoji": "🗣️",
        "category": "PRACTICE",
        "criteria_type": "SESSIONS_COUNT",
        "target_value": 20,
        "params": {},
        "sort_order": 3,
    },
    {
        "key": "coach_50",
        "name": "Bậc thầy đàm thoại",
        "description": "Chinh phục 50 buổi nói chuyện chuyên sâu cùng AI",
        "icon_emoji": "🏆",
        "category": "PRACTICE",
        "criteria_type": "SESSIONS_COUNT",
        "target_value": 50,
        "params": {},
        "sort_order": 4,
    },
    # --- Streak Habits ---
    {
        "key": "streak_3",
        "name": "Khởi động thói quen",
        "description": "Duy trì chuỗi học tập liên tiếp trong 3 ngày",
        "icon_emoji": "✨",
        "category": "STREAK",
        "criteria_type": "STREAK_DAYS",
        "target_value": 3,
        "params": {},
        "sort_order": 5,
    },
    {
        "key": "streak_7",
        "name": "Streak 7 ngày",
        "description": "Duy trì chuỗi học tập liên tiếp trong 7 ngày",
        "icon_emoji": "🔥",
        "category": "STREAK",
        "criteria_type": "STREAK_DAYS",
        "target_value": 7,
        "params": {},
        "sort_order": 6,
    },
    {
        "key": "streak_14",
        "name": "Kỷ luật thép",
        "description": "Duy trì chuỗi học tập kiên định trong 14 ngày",
        "icon_emoji": "🛡️",
        "category": "STREAK",
        "criteria_type": "STREAK_DAYS",
        "target_value": 14,
        "params": {},
        "sort_order": 7,
    },
    {
        "key": "streak_30",
        "name": "Bất khả chiến bại",
        "description": "Chinh phục chuỗi học liên tục suốt 30 ngày",
        "icon_emoji": "👑",
        "category": "STREAK",
        "criteria_type": "STREAK_DAYS",
        "target_value": 30,
        "params": {},
        "sort_order": 8,
    },
    # --- Scenario Roleplay ---
    {
        "key": "actor_1",
        "name": "Diễn viên tập sự",
        "description": "Hoàn thành bài nhập vai kịch bản tình huống đầu tiên",
        "icon_emoji": "🎬",
        "category": "SCENARIO",
        "criteria_type": "SCENARIOS_COMPLETED",
        "target_value": 1,
        "params": {},
        "sort_order": 9,
    },
    {
        "key": "actor_5",
        "name": "Nhập vai tự tin",
        "description": "Hoàn thành 5 tình huống thực tế khác nhau",
        "icon_emoji": "🎭",
        "category": "SCENARIO",
        "criteria_type": "SCENARIOS_COMPLETED",
        "target_value": 5,
        "params": {},
        "sort_order": 10,
    },
    {
        "key": "master_actor",
        "name": "Diễn viên xuất sắc",
        "description": "Hoàn thành 20 tình huống thực tế khác nhau",
        "icon_emoji": "🌟",
        "category": "SCENARIO",
        "criteria_type": "SCENARIOS_COMPLETED",
        "target_value": 20,
        "params": {},
        "sort_order": 11,
    },
    # --- Skills ---
    {
        "key": "fluency_master",
        "name": "Fluency Master",
        "description": "Đạt điểm độ lưu loát từ 75 trở lên trong một buổi luyện",
        "icon_emoji": "⚡",
        "category": "SKILL",
        "criteria_type": "FLUENCY_SCORE",
        "target_value": 75,
        "params": {},
        "sort_order": 14,
    },
    {
        "key": "speed_demon",
        "name": "Phản xạ thần tốc",
        "description": "Đạt điểm tốc độ phản xạ từ 85 trở lên trong buổi luyện",
        "icon_emoji": "🚀",
        "category": "SKILL",
        "criteria_type": "SPEED_SCORE",
        "target_value": 85,
        "params": {},
        "sort_order": 15,
    },
    # --- CEFR Levels ---
    {
        "key": "a2_achiever",
        "name": "Chinh phục A2",
        "description": "Đạt trình độ CEFR Level A2 (Sơ cấp tự tin)",
        "icon_emoji": "🌱",
        "category": "LEVEL",
        "criteria_type": "CEFR_LEVEL",
        "target_value": 1,
        "params": {"min_level": "A2"},
        "sort_order": 16,
    },
    {
        "key": "b1_achiever",
        "name": "B1 Achiever",
        "description": "Đạt trình độ CEFR Level B1 (Trung cấp độc lập)",
        "icon_emoji": "🎯",
        "category": "LEVEL",
        "criteria_type": "CEFR_LEVEL",
        "target_value": 1,
        "params": {"min_level": "B1"},
        "sort_order": 17,
    },
    {
        "key": "b2_conqueror",
        "name": "Làm chủ B2",
        "description": "Đạt trình độ CEFR Level B2 (Trung cấp nâng cao)",
        "icon_emoji": "💎",
        "category": "LEVEL",
        "criteria_type": "CEFR_LEVEL",
        "target_value": 1,
        "params": {"min_level": "B2"},
        "sort_order": 18,
    },
    {
        "key": "c1_legend",
        "name": "Huyền thoại C1",
        "description": "Đạt trình độ CEFR Level C1 (Bậc thầy ngôn ngữ)",
        "icon_emoji": "🚩",
        "category": "LEVEL",
        "criteria_type": "CEFR_LEVEL",
        "target_value": 1,
        "params": {"min_level": "C1"},
        "sort_order": 19,
    },
]


async def seed_gamification(session: AsyncSession) -> None:
    """Seed XP rules, mission definitions, and badges idempotently."""
    insert = sqlite_insert if session.get_bind().dialect.name == "sqlite" else pg_insert
    for model, items in (
        (XpRule, XP_RULES),
        (MissionDefinition, MISSION_DEFINITIONS),
        (BadgeDefinition, BADGE_DEFINITIONS),
    ):
        await session.execute(
            insert(model).values(items).on_conflict_do_nothing(index_elements=["key"])
        )
    await session.commit()
