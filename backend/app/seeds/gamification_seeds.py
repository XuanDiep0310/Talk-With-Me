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
        "key": "streak_7",
        "name": "Streak 7 ngày",
        "description": "Duy trì chuỗi học tập liên tiếp trong 7 ngày",
        "icon_emoji": "🔥",
        "category": "STREAK",
        "criteria_type": "STREAK_DAYS",
        "target_value": 7,
        "params": {},
        "sort_order": 2,
    },
    {
        "key": "b1_achiever",
        "name": "B1 Achiever",
        "description": "Đạt trình độ CEFR Level B1 trở lên",
        "icon_emoji": "🎯",
        "category": "LEVEL",
        "criteria_type": "CEFR_LEVEL",
        "target_value": 1,
        "params": {"min_level": "B1"},
        "sort_order": 3,
    },
    {
        "key": "fluency_master",
        "name": "Fluency Master",
        "description": "Đạt điểm độ lưu loát từ 85 trở lên trong một buổi luyện",
        "icon_emoji": "⚡",
        "category": "SKILL",
        "criteria_type": "FLUENCY_SCORE",
        "target_value": 85,
        "params": {},
        "sort_order": 4,
    },
    {
        "key": "master_actor",
        "name": "Diễn viên xuất sắc",
        "description": "Hoàn thành 20 tình huống thực tế khác nhau",
        "icon_emoji": "🎭",
        "category": "SCENARIO",
        "criteria_type": "SCENARIOS_COMPLETED",
        "target_value": 20,
        "params": {},
        "sort_order": 5,
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
        "sort_order": 6,
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
            existing.description = str(rule_data["description"]) if rule_data.get("description") else None

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
