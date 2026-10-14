"""
Endpoint for issuing one-time WebSocket connection tickets.
"""

from fastapi import APIRouter, Depends, status
from redis.asyncio import Redis

from app.api.deps import get_current_user, get_redis
from app.models.auth import User
from app.models.coach_schemas import WsTicketResponse
from app.services.ws_ticket import WsTicketService

router = APIRouter()


@router.post(
    "/ws-tickets",
    response_model=WsTicketResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Issue one-time WebSocket ticket",
)
async def create_ws_ticket(
    current_user: User = Depends(get_current_user),
    redis: Redis = Depends(get_redis),
) -> WsTicketResponse:
    """
    Issue a single-use authentication ticket valid for 30 seconds.
    Clients connect to WebSocket using `?ticket=<ticket_value>` without passing JWT in URL.
    """
    service = WsTicketService(redis)
    ticket = await service.create_ticket(user_id=current_user.id)
    return WsTicketResponse(ticket=ticket, expires_in=30)
