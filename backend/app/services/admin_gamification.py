from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_gamification_schemas import (
    AdminBadge,
    AdminMission,
    AdminMissionUpdate,
    AdminXpFilters,
    AdminXpPage,
    AdminXpRule,
    AdminXpRuleUpdate,
)
from app.models.gamification import BadgeDefinition, MissionDefinition, XpRule
from app.repositories.admin_gamification import AdminGamificationRepository
from app.services.admin_audit import AdminAudit


class AdminGamificationService:
    def __init__(self, db: AsyncSession, audit: AdminAudit) -> None:
        self.db = db
        self.repo = AdminGamificationRepository(db)
        self.audit = audit

    async def rules(self) -> list[AdminXpRule]:
        return [
            AdminXpRule.model_validate(row)
            for row in await self.db.scalars(select(XpRule).order_by(XpRule.key))
        ]

    async def update_rule(self, key: str, body: AdminXpRuleUpdate) -> AdminXpRule:
        rule = await self.repo.get_rule(key)
        if rule is None:
            raise HTTPException(
                404, detail={"code": "XP_RULE_NOT_FOUND", "message": "XP rule not found."}
            )
        before = AdminXpRule.model_validate(rule).model_dump(by_alias=True)
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(rule, field, value)
        result = AdminXpRule.model_validate(rule)
        if before != result.model_dump(by_alias=True):
            self.audit.record(
                "XP_RULE_UPDATED", "XP_RULE", key, before, result.model_dump(by_alias=True)
            )
        await self.db.commit()
        return result

    async def missions(self) -> list[AdminMission]:
        return [
            AdminMission.model_validate(row)
            for row in await self.db.scalars(
                select(MissionDefinition).order_by(MissionDefinition.key)
            )
        ]

    async def update_mission(self, key: str, body: AdminMissionUpdate) -> AdminMission:
        mission = await self.repo.get_mission(key)
        if mission is None:
            raise HTTPException(
                404, detail={"code": "MISSION_NOT_FOUND", "message": "Mission not found."}
            )
        if mission.condition_type == "STREAK" and body.target_count not in (None, 1):
            raise HTTPException(
                422,
                detail={
                    "code": "INVALID_MISSION_TARGET",
                    "message": "Streak missions support one event per day.",
                },
            )
        before = AdminMission.model_validate(mission).model_dump(by_alias=True)
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(mission, field, value)
        result = AdminMission.model_validate(mission)
        if before != result.model_dump(by_alias=True):
            self.audit.record(
                "MISSION_UPDATED", "MISSION", key, before, result.model_dump(by_alias=True)
            )
        await self.db.commit()
        return result

    async def badges(self) -> list[AdminBadge]:
        return [
            AdminBadge.model_validate(row)
            for row in await self.db.scalars(
                select(BadgeDefinition).order_by(BadgeDefinition.sort_order, BadgeDefinition.key)
            )
        ]

    async def transactions(self, filters: AdminXpFilters) -> AdminXpPage:
        return await self.repo.transactions(filters)
