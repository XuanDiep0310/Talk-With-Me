from sqlalchemy import String, case, cast, func, literal, null, select, tuple_, union_all
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.admin_cursor import decode_cursor, encode_cursor
from app.models.admin_audit import AdminAuditEvent
from app.models.admin_reporting_schemas import AdminAuditFilters, AdminAuditItem, AdminAuditPage
from app.models.auth import AccountAdminAudit, User
from app.models.scenario import ScenarioAdminAudit


class AdminAuditRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(self, filters: AdminAuditFilters) -> AdminAuditPage:
        event = AdminAuditEvent
        account = AccountAdminAudit
        scenario = ScenarioAdminAudit
        role_changed = account.previous_role != account.new_role
        active_changed = account.previous_active != account.new_active
        account_action = case(
            (role_changed & active_changed, "ACCOUNT_UPDATED"),
            (role_changed, "ACCOUNT_ROLE_CHANGED"),
            (account.new_active.is_(True), "ACCOUNT_UNLOCKED"),
            else_="ACCOUNT_LOCKED",
        )
        events = union_all(
            select(
                event.id,
                literal("ADMIN").label("source"),
                event.actor_id,
                event.target_type,
                event.target_id,
                event.action,
                event.before,
                event.after,
                event.occurred_at,
                event.trace_id,
            ),
            select(
                account.id,
                literal("ACCOUNT"),
                account.actor_id,
                literal("ACCOUNT"),
                cast(account.target_id, String),
                account_action,
                func.jsonb_build_object(
                    "role", account.previous_role, "isActive", account.previous_active
                ),
                func.jsonb_build_object("role", account.new_role, "isActive", account.new_active),
                account.occurred_at,
                account.trace_id,
            ),
            select(
                scenario.id,
                literal("SCENARIO"),
                scenario.actor_id,
                literal("SCENARIO"),
                cast(scenario.scenario_id, String),
                scenario.action,
                cast(null(), JSONB),
                cast(null(), JSONB),
                scenario.occurred_at,
                scenario.trace_id,
            ),
        ).subquery("events")
        query = select(*events.c, User.email.label("actor_email")).outerjoin(
            User, User.id == events.c.actor_id
        )
        if filters.from_date:
            query = query.where(events.c.occurred_at >= filters.from_date)
        if filters.to_date:
            query = query.where(events.c.occurred_at < filters.to_date)
        if filters.action:
            query = query.where(events.c.action == filters.action)
        if filters.target_type:
            query = query.where(events.c.target_type == filters.target_type)
        if filters.trace_id:
            query = query.where(events.c.trace_id == filters.trace_id)
        if filters.cursor:
            at, event_id, source = decode_cursor(filters.cursor)
            query = query.where(
                tuple_(events.c.occurred_at, events.c.source, events.c.id)
                < tuple_(literal(at), literal(source), literal(event_id))
            )
        rows = (
            (
                await self.db.execute(
                    query.order_by(
                        events.c.occurred_at.desc(), events.c.source.desc(), events.c.id.desc()
                    ).limit(filters.limit + 1)
                )
            )
            .mappings()
            .all()
        )
        items = [AdminAuditItem.model_validate(row) for row in rows[: filters.limit]]
        last = items[-1] if len(rows) > filters.limit else None
        return AdminAuditPage(
            items=items,
            next_cursor=encode_cursor(last.occurred_at, last.id, last.source) if last else None,
        )
