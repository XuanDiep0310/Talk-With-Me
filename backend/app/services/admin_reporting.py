from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import get_clock
from app.models.admin_reporting_schemas import (
    AdminAnalytics,
    AdminAuditFilters,
    AdminAuditPage,
    AnalyticsRange,
)
from app.repositories.admin_analytics import AdminAnalyticsRepository
from app.repositories.admin_audit import AdminAuditRepository

REPORT_ZONE = ZoneInfo("Asia/Ho_Chi_Minh")


class AdminReportingService:
    def __init__(self, db: AsyncSession) -> None:
        self.analytics = AdminAnalyticsRepository(db)
        self.audit = AdminAuditRepository(db)

    async def overview(self, period: AnalyticsRange) -> AdminAnalytics:
        now = get_clock().now()
        today = now.astimezone(REPORT_ZONE).date()
        first = today - timedelta(days=6 if period == "7d" else 29)
        week = today - timedelta(days=6)
        totals = await self.analytics.overview(
            timezone=REPORT_ZONE.key,
            first_day=first,
            last_day=today,
            start_at=datetime.combine(first, time.min, REPORT_ZONE).astimezone(UTC),
            week_start=datetime.combine(week, time.min, REPORT_ZONE).astimezone(UTC),
            generated_at=now,
        )
        result = AdminAnalytics.model_validate(
            {
                **totals,
                "range": period,
                "generated_at": now,
                "timezone": REPORT_ZONE.key,
            }
        )
        for level in ("A1", "A2", "B1", "B2", "C1", "UNKNOWN"):
            result.cefr.setdefault(level, 0)
        for status in ("NOT_REQUESTED", "PENDING", "FEEDBACK_READY", "FAILED", "INSUFFICIENT_DATA"):
            result.feedback_statuses.setdefault(status, 0)
        return result

    async def audit_log(self, filters: AdminAuditFilters) -> AdminAuditPage:
        return await self.audit.list(filters)
