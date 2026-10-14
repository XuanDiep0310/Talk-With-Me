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

    async def create_ticket(self, user_id: uuid.UUID, ttl_seconds: int | None = None) -> str:
        ttl = ttl_seconds or self.settings.WS_TICKET_EXPIRE_SECONDS
        ticket = str(uuid.uuid4())
        key = f"ws_ticket:{ticket}"
        await self.redis.set(key, str(user_id), ex=ttl)
        return ticket

    async def consume_ticket(self, ticket: str) -> uuid.UUID | None:
        if not ticket:
            return None
        key = f"ws_ticket:{ticket}"
        try:
            val = await self.redis.getdel(key)
        except (AttributeError, Exception):
            val = await self.redis.get(key)
            if val is not None:
                await self.redis.delete(key)

        if not val:
            return None
        try:
            return uuid.UUID(str(val))
        except ValueError:
            return None
