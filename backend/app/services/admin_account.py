import uuid
from datetime import UTC, timedelta

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import get_clock
from app.models.admin_account_schemas import (
    AdminAccountPage,
    AdminAccountSummary,
    AdminAccountUpdate,
    AdminOverview,
)
from app.models.auth import AccountAdminAudit
from app.repositories.admin_account import AdminAccountRepository
from app.repositories.admin_scenario import AdminScenarioRepository
from app.repositories.auth import AuthRepository
from app.seeds.scenario_loader import seed_scenarios_if_empty


class AdminAccountService:
    def __init__(self, db: AsyncSession, actor_id: uuid.UUID, trace_id: str) -> None:
        self.db = db
        self.actor_id = actor_id
        self.trace_id = trace_id
        self.repo = AdminAccountRepository(db)

    async def list(self, q: str | None, cursor: uuid.UUID | None, limit: int) -> AdminAccountPage:
        rows = await self.repo.list(q, cursor, limit + 1)
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
