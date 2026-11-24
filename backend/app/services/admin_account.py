import json
import uuid
from datetime import UTC, timedelta

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.admin_cursor import encode_cursor
from app.core.clock import get_clock
from app.models.admin_account_schemas import (
    AdminAccountDetail,
    AdminAccountPage,
    AdminAccountSummary,
    AdminAccountUpdate,
    AdminEarnedBadge,
    AdminOverview,
    AdminPlacement,
    AdminPlacementPage,
)
from app.models.auth import AccountAdminAudit, User
from app.repositories.admin_account import AdminAccountRepository
from app.repositories.admin_scenario import AdminScenarioRepository
from app.repositories.auth import AuthRepository
from app.repositories.gamification import GamificationRepository
from app.seeds.scenario_loader import seed_scenarios_if_empty
from app.services.admin_audit import AdminAudit


class AdminAccountService:
    def __init__(self, db: AsyncSession, actor_id: uuid.UUID, trace_id: str) -> None:
        self.db = db
        self.actor_id = actor_id
        self.trace_id = trace_id
        self.repo = AdminAccountRepository(db)

    async def list(self, q: str | None, cursor: uuid.UUID | None, limit: int) -> AdminAccountPage:
        rows = await self.repo.search(q, cursor, limit + 1)
        return AdminAccountPage(
            items=[
                AdminAccountSummary(
                    id=user.id,
                    email=user.email,
                    full_name=user.full_name,
                    role=user.role,
                    is_active=user.is_active,
                    created_at=user.created_at.replace(tzinfo=UTC)
                    if user.created_at.tzinfo is None
                    else user.created_at.astimezone(UTC),
                    cefr_level=level,
                    completed_sessions=count,
                )
                for user, level, count in rows[:limit]
            ],
            next_cursor=rows[limit - 1][0].id if len(rows) > limit else None,
        )

    async def update(self, target_id: uuid.UUID, body: AdminAccountUpdate) -> None:
        account = await self._lock_target(target_id)
        role = body.role if body.role is not None else account.role
        active = body.is_active if body.is_active is not None else account.is_active
        if (role, active) == (account.role, account.is_active):
            return
        if target_id == self.actor_id:
            raise HTTPException(
                409,
                detail={
                    "code": "SELF_ACCOUNT_CHANGE",
                    "message": "Another administrator must perform this change.",
                },
            )

        self.db.add(
            AccountAdminAudit(
                actor_id=self.actor_id,
                target_id=target_id,
                previous_role=account.role,
                new_role=role,
                previous_active=account.is_active,
                new_active=active,
                occurred_at=get_clock().now(),
                trace_id=self.trace_id,
            )
        )
        if account.is_active and not active:
            account.auth_version += 1
            await AuthRepository(self.db).revoke_all_user_tokens(target_id)
        account.role = role
        account.is_active = active
        await self.db.commit()

    async def _lock_target(self, target_id: uuid.UUID) -> User:
        accounts = await self.repo.lock_management_accounts(self.actor_id, target_id)
        actor = accounts.get(self.actor_id)
        if actor is None or actor.role != "ADMIN" or not actor.is_active:
            raise HTTPException(
                403,
                detail={"code": "ADMIN_REQUIRED", "message": "Administrator access is required."},
            )
        account = accounts.get(target_id)
        if account is None:
            raise HTTPException(
                404, detail={"code": "ACCOUNT_NOT_FOUND", "message": "Account not found."}
            )
        return account

    async def force_logout(self, target_id: uuid.UUID) -> None:
        account = await self._lock_target(target_id)
        if account.id == self.actor_id:
            raise HTTPException(
                409,
                detail={
                    "code": "SELF_ACCOUNT_CHANGE",
                    "message": "Another administrator must perform this change.",
                },
            )
        account.auth_version += 1
        await AuthRepository(self.db).revoke_all_user_tokens(target_id)
        AdminAudit(self.db, self.actor_id, self.trace_id).record(
            "ACCOUNT_FORCED_LOGOUT", "ACCOUNT", target_id
        )
        await self.db.commit()

    async def detail(self, user_id: uuid.UUID) -> AdminAccountDetail:
        user = await self.repo.get(user_id)
        if user is None:
            raise HTTPException(
                404, detail={"code": "ACCOUNT_NOT_FOUND", "message": "Account not found."}
            )
        profile = user.profile
        gamification = user.gamification_profile
        issued, completed = await self.repo.mission_totals(user_id)
        badges = await GamificationRepository(self.db).get_user_badges(user_id)
        return AdminAccountDetail(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at.replace(tzinfo=UTC)
            if user.created_at.tzinfo is None
            else user.created_at,
            cefr_level=profile.cefr_level if profile else None,
            completed_sessions=await self.repo.completed_sessions(user_id),
            avatar_url=user.avatar_url,
            timezone=profile.timezone if profile else None,
            login_methods=sorted(
                ({identity.provider for identity in user.identities})
                | ({"password"} if user.password_hash else set())
            ),
            goals=_preference_list(profile.goals if profile else None),
            weak_points=_preference_list(profile.weak_points if profile else None),
            skills=await self.repo.skills(user_id),
            total_xp=gamification.total_xp if gamification else 0,
            current_streak=gamification.current_streak if gamification else 0,
            best_streak=gamification.best_streak if gamification else 0,
            badges=[
                AdminEarnedBadge(
                    key=badge.badge_key,
                    name=badge.badge.name,
                    icon_emoji=badge.badge.icon_emoji,
                    awarded_at=badge.awarded_at,
                )
                for badge in badges
            ],
            missions_issued=issued,
            missions_completed=completed,
        )

    async def placements(
        self, user_id: uuid.UUID, cursor: str | None, limit: int
    ) -> AdminPlacementPage:
        if await self.db.get(User, user_id) is None:
            raise HTTPException(
                404, detail={"code": "ACCOUNT_NOT_FOUND", "message": "Account not found."}
            )
        rows = await self.repo.placements(user_id, cursor, limit + 1)
        items = [AdminPlacement.model_validate(row) for row in rows[:limit]]
        last = items[-1] if len(rows) > limit else None
        return AdminPlacementPage(
            items=items, next_cursor=encode_cursor(last.created_at, last.id) if last else None
        )

    async def overview(self) -> AdminOverview:
        await seed_scenarios_if_empty(self.db)
        total, active, new, completed, recent = await self.repo.totals(
            get_clock().now() - timedelta(days=7)
        )
        return AdminOverview(
            total_accounts=total,
            active_accounts=active,
            new_accounts=new,
            completed_sessions=completed,
            recent_sessions=recent,
            scenario_counts=await AdminScenarioRepository(self.db).status_counts(None, None, None),
        )


def _preference_list(value: str | None) -> list[str]:
    try:
        parsed = json.loads(value) if value else []
    except ValueError:
        return []
    return [item for item in parsed if isinstance(item, str)] if isinstance(parsed, list) else []
