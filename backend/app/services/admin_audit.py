import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import get_clock
from app.models.admin_audit import AdminAuditEvent


class AdminAudit:
    def __init__(self, db: AsyncSession, actor_id: uuid.UUID, trace_id: str) -> None:
        self.db = db
        self.actor_id = actor_id
        self.trace_id = trace_id

    def record(
        self,
        action: str,
        target_type: str,
        target_id: str | uuid.UUID,
        before: dict[str, object] | None = None,
        after: dict[str, object] | None = None,
    ) -> None:
        self.db.add(
            AdminAuditEvent(
                actor_id=self.actor_id,
                target_type=target_type,
                target_id=str(target_id),
                action=action,
                before=before,
                after=after,
                occurred_at=get_clock().now(),
                trace_id=self.trace_id,
            )
        )
