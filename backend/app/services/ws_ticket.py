"""
WebSocket one-time ticket service.

Tickets expire in 30 seconds and are strictly single-use (consumed and deleted upon first connection).
"""

import uuid

from redis.asyncio import Redis

from app.core.config import get_settings


class WsTicketService:
    def __init__(self, redis: Redis) -> None:
        self.redis = redis
        self.settings = get_settings()

    async def create_ticket(
        self, user_id: uuid.UUID, ttl_seconds: int | None = None, *, auth_version: int = 0
    ) -> str:
        ttl = ttl_seconds or self.settings.WS_TICKET_EXPIRE_SECONDS
        ticket = str(uuid.uuid4())
        key = f"ws_ticket:{ticket}"
        await self.redis.set(key, f"{user_id}:{auth_version}", ex=ttl)
        return ticket

    async def consume_ticket(self, ticket: str) -> tuple[uuid.UUID, int] | None:
        if not ticket:
            return None
        key = f"ws_ticket:{ticket}"
        val = await self.redis.getdel(key)
        if not val:
            return None
        try:
            user_id, version = str(val).split(":")
            return uuid.UUID(user_id), int(version)
        except ValueError:
            return None
