from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_gamification_schemas import (
    AdminBadge,
    AdminBadgeCreate,
    AdminBadgeInput,
    AdminBadgeUpdate,
    AdminMission,
    AdminMissionCreate,
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

    async def create_mission(self, body: AdminMissionCreate) -> AdminMission:
        if body.condition_type == "STREAK" and body.target_count != 1:
            raise HTTPException(
                422,
                detail={
                    "code": "INVALID_MISSION_TARGET",
                    "message": "Streak missions support one event per day.",
                },
            )
        row = MissionDefinition(**body.model_dump())
        self.db.add(row)
        result = AdminMission.model_validate(row)
        self.audit.record(
            "MISSION_CREATED", "MISSION", row.key, after=result.model_dump(by_alias=True)
        )
        await self.commit_definition()
        return result

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
            self.badge_response(row)
            for row in await self.db.scalars(
                select(BadgeDefinition).order_by(BadgeDefinition.sort_order, BadgeDefinition.key)
            )
        ]

    @staticmethod
    def badge_response(row: BadgeDefinition) -> AdminBadge:
        return AdminBadge(
            key=row.key,
            name=row.name,
            description=row.description,
            icon_emoji=row.icon_emoji,
            category=row.category,
            criteria_type=row.criteria_type,
            target_value=row.target_value,
            min_level=row.params.get("min_level") if row.params else None,
            is_active=row.is_active,
        )

    async def create_badge(self, body: AdminBadgeCreate) -> AdminBadge:
        row = BadgeDefinition(key=body.key, category=body.category, sort_order=0)
        self.db.add(row)
        return await self.write_badge(row, body, None)

    async def update_badge(self, key: str, body: AdminBadgeUpdate) -> AdminBadge:
        row = await self.repo.get_badge(key)
        if row is None:
            raise HTTPException(
                404, detail={"code": "BADGE_NOT_FOUND", "message": "Badge not found."}
            )
        previous = self.badge_response(row)
        try:
            merged = AdminBadgeInput.model_validate(
                {
                    **previous.model_dump(exclude={"key"}),
                    **body.model_dump(exclude_unset=True),
                }
            )
        except ValidationError as exc:
            raise HTTPException(
                422,
                detail={"code": "INVALID_BADGE", "message": "Invalid badge fields or criteria."},
            ) from exc
        return await self.write_badge(row, merged, previous)

    async def write_badge(
        self, row: BadgeDefinition, body: AdminBadgeInput, previous: AdminBadge | None
    ) -> AdminBadge:
        for field, value in body.model_dump(exclude={"min_level", "key"}).items():
            setattr(row, field, value)
        row.params = {**(row.params or {})}
        row.params.pop("min_level", None)
        if body.min_level:
            row.params["min_level"] = body.min_level
        result = self.badge_response(row)
        if previous != result:
            self.audit.record(
                "BADGE_UPDATED" if previous else "BADGE_CREATED",
                "BADGE",
                row.key,
                previous.model_dump(by_alias=True) if previous else None,
                result.model_dump(by_alias=True),
            )
        await self.commit_definition()
        return result

    async def commit_definition(self) -> None:
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise HTTPException(
                409,
                detail={
                    "code": "DEFINITION_CONFLICT",
                    "message": "This definition conflicts with an existing rule.",
                },
            ) from exc

    async def transactions(self, filters: AdminXpFilters) -> AdminXpPage:
        return await self.repo.transactions(filters)
