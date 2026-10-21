import sys
from collections.abc import AsyncGenerator
from typing import cast

import redis.asyncio as aioredis
from redis.asyncio import Redis

from app.core.config import get_settings

settings = get_settings()

is_test_env = "pytest" in sys.modules or settings.ENVIRONMENT == "test"

redis_pool = aioredis.ConnectionPool.from_url(
    settings.REDIS_URL,
    decode_responses=True,
    max_connections=20,
)


def get_redis_client() -> Redis:
    if is_test_env:
        return cast(Redis, Redis.from_url(settings.REDIS_URL, decode_responses=True))
    return Redis(connection_pool=redis_pool)


async def get_redis() -> AsyncGenerator[Redis, None]:
    client = get_redis_client()
    try:
        yield client
    finally:
        await client.aclose()
