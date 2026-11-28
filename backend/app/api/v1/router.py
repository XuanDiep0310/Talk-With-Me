from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin_accounts,
    admin_categories,
    admin_coach,
    admin_gamification,
    admin_reporting,
    admin_scenarios,
    admin_sessions,
    auth,
    coach,
    dashboard,
    gamification,
    health,
    onboarding,
    progress,
    pronunciation,
    scenarios,
    users,
    voice,
    ws_session,
    ws_tickets,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(voice.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(onboarding.router)
api_router.include_router(coach.router, prefix="/coach", tags=["Coach"])
api_router.include_router(scenarios.router)
api_router.include_router(pronunciation.router)
api_router.include_router(dashboard.router)
api_router.include_router(progress.router)
api_router.include_router(gamification.router)
api_router.include_router(ws_tickets.router, tags=["WebSocket Tickets"])
api_router.include_router(ws_session.router, tags=["WebSocket Practice"])
api_router.include_router(admin_scenarios.router)
api_router.include_router(admin_categories.router)
api_router.include_router(admin_accounts.router)
api_router.include_router(admin_coach.router)
api_router.include_router(admin_gamification.router)
api_router.include_router(admin_sessions.router)
api_router.include_router(admin_reporting.router)
