from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.admin_reporting_schemas import (
    AdminAnalytics,
    AdminAuditFilters,
    AdminAuditPage,
    AnalyticsRange,
)
from app.models.admin_scenario_schemas import ADMIN_ACCESS_RESPONSES
from app.services.admin_reporting import AdminReportingService

router = APIRouter(
    prefix="/admin",
    tags=["Admin Reporting"],
    responses=ADMIN_ACCESS_RESPONSES,
    dependencies=[Depends(require_admin)],
)


def reporting(db: AsyncSession = Depends(get_db)) -> AdminReportingService:
    return AdminReportingService(db)


Reporting = Annotated[AdminReportingService, Depends(reporting)]


@router.get("/analytics/overview")
async def analytics(
    service: Reporting,
    response: Response,
    period: Annotated[AnalyticsRange, Query(alias="range")] = "7d",
) -> AdminAnalytics:
    response.headers["Cache-Control"] = "no-store"
    return await service.overview(period)


@router.get("/audit-logs")
async def audit_logs(
    service: Reporting, response: Response, filters: Annotated[AdminAuditFilters, Query()]
) -> AdminAuditPage:
    response.headers["Cache-Control"] = "no-store"
    return await service.audit_log(filters)
