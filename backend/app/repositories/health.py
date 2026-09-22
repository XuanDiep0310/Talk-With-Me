import time

from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class HealthRepository:
    def __init__(self, db_session: AsyncSession, redis_client: Redis):
        self.db = db_session
        self.redis = redis_client

    async def check_database(self) -> tuple[bool, float, str]:
        start = time.perf_counter()
        try:
            result = await self.db.execute(text("SELECT 1"))
            val = result.scalar()
            latency = (time.perf_counter() - start) * 1000
            if val == 1:
                return True, round(latency, 2), "Database connection active"
            return False, round(latency, 2), "Unexpected query result"
        except Exception as e:
            latency = (time.perf_counter() - start) * 1000
            return False, round(latency, 2), str(e)

    async def check_redis(self) -> tuple[bool, float, str]:
        start = time.perf_counter()
        try:
            pong = await self.redis.ping()
            latency = (time.perf_counter() - start) * 1000
            if pong:
                return True, round(latency, 2), "Redis connection active"
            return False, round(latency, 2), "Redis ping failed"
        except Exception as e:
            latency = (time.perf_counter() - start) * 1000
            return False, round(latency, 2), str(e)
