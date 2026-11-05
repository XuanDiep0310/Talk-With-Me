"""
Seed data for Gamification: XP rules, daily missions, and badge definitions.
"""

from typing import Any

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
        "key": "ROOM_SESSION",
        "xp_amount": 100,
        "is_active": True,
        "description": "Tham gia phiên phòng thoại cộng đồng",
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
        "xp_reward": 50,
        "condition_type": "COACH_SESSION",
        "target_count": 1,
        "params": {},
        "is_active": True,
    },
    {
        "key": "new_scenario",
        "title": "Luyện 1 tình huống mới",
        "xp_reward": 50,
        "condition_type": "SCENARIO_LESSON",
        "target_count": 1,
        "params": {},
        "is_active": True,
    },
    {
        "key": "room_session",
        "title": "Tham gia phòng cộng đồng",
        "xp_reward": 50,
        "condition_type": "ROOM_SESSION",
        "target_count": 1,
        "params": {},
        "is_active": True,
    },
    {
        "key": "maintain_streak",
        "title": "Duy trì streak",
        "xp_reward": 50,
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
    # --- Community Rooms ---
    {
        "key": "community_first",
        "name": "Chào sân cộng đồng",
        "description": "Tham gia buổi phòng luyện nói nhóm đầu tiên",
        "icon_emoji": "👋",
        "category": "COMMUNITY",
        "criteria_type": "ROOMS_COUNT",
        "target_value": 1,
        "params": {},
        "sort_order": 12,
    },
    {
        "key": "community_star",
        "name": "Ngôi sao cộng đồng",
        "description": "Tham gia 10 buổi phòng luyện nói cộng đồng",
        "icon_emoji": "⭐",
        "category": "COMMUNITY",
        "criteria_type": "ROOMS_COUNT",
        "target_value": 10,
        "params": {},
        "sort_order": 13,
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
    for rule_data in XP_RULES:
        existing = await session.get(XpRule, rule_data["key"])
        if not existing:
            session.add(XpRule(**rule_data))
        else:
            existing.xp_amount = int(rule_data["xp_amount"])
            existing.is_active = bool(rule_data["is_active"])
            existing.description = (
                str(rule_data["description"]) if rule_data.get("description") else None
            )

    for mission_data in MISSION_DEFINITIONS:
        existing_m = await session.get(MissionDefinition, mission_data["key"])
        if not existing_m:
            session.add(MissionDefinition(**mission_data))
        else:
            existing_m.title = str(mission_data["title"])
            existing_m.xp_reward = int(mission_data["xp_reward"])
            existing_m.condition_type = str(mission_data["condition_type"])
            existing_m.target_count = int(mission_data["target_count"])
            existing_m.params = dict(mission_data["params"])
            existing_m.is_active = bool(mission_data["is_active"])

    for badge_data in BADGE_DEFINITIONS:
        existing_b = await session.get(BadgeDefinition, badge_data["key"])
        if not existing_b:
            session.add(BadgeDefinition(**badge_data))
        else:
            existing_b.name = str(badge_data["name"])
            existing_b.description = str(badge_data["description"])
            existing_b.icon_emoji = str(badge_data["icon_emoji"])
            existing_b.category = str(badge_data["category"])
            existing_b.criteria_type = str(badge_data["criteria_type"])
            existing_b.target_value = int(badge_data["target_value"])
            existing_b.params = dict(badge_data["params"])
            existing_b.sort_order = int(badge_data["sort_order"])

    await session.flush()
