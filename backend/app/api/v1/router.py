from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    coach,
    dashboard,
    gamification,
    health,
    onboarding,
    progress,
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
api_router.include_router(dashboard.router)
api_router.include_router(progress.router)
api_router.include_router(gamification.router)
api_router.include_router(ws_tickets.router, tags=["WebSocket Tickets"])
api_router.include_router(ws_session.router, tags=["WebSocket Practice"])
