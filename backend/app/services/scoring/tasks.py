"""
Background worker jobs and ARQ task definitions for scoring and feedback generation.
Supports ARQ Redis queue mode and eager in-process task mode for local testing.
"""

import asyncio
import logging
import uuid
from typing import Any

from app.core.config import get_settings
from app.core.database import async_session_factory
from app.services.scoring.service import ScoringService

logger = logging.getLogger(__name__)


async def generate_feedback_task(session_id: uuid.UUID) -> None:
    """Coroutine that instantiates database session and runs scoring service."""
    async with async_session_factory() as db:
        try:
            service = ScoringService(db)
            await service.generate_feedback(session_id)
        except Exception as exc:
            logger.error("Error executing generate_feedback_task for %s: %s", session_id, exc)


async def arq_generate_feedback(ctx: dict[str, Any], session_id_str: str) -> None:  # noqa: ARG001
    """ARQ job entrypoint for generating post-session feedback."""
    session_id = uuid.UUID(session_id_str)
    await generate_feedback_task(session_id)



async def enqueue_feedback_job(session_id: uuid.UUID) -> None:
    """
    Enqueue generate_feedback job.
    Uses ARQ Redis queue if configured, otherwise executes asynchronously via asyncio task.
    """
    settings = get_settings()

    if settings.ARQ_MODE == "arq":
        try:
            from arq import create_pool
            from arq.connections import RedisSettings

            redis_settings = RedisSettings(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD or None,
                database=settings.REDIS_DB,
            )
            pool = await create_pool(redis_settings)
            await pool.enqueue_job("arq_generate_feedback", str(session_id))
            await pool.close()
            logger.info("Enqueued generate_feedback job in ARQ for session %s", session_id)
            return
        except Exception as exc:
            logger.warning(
                "Could not enqueue into ARQ Redis queue (%s), falling back to in-process task",
                exc,
            )

    # Eager / fallback mode
    asyncio.create_task(generate_feedback_task(session_id))
    logger.info("Launched in-process generate_feedback_task for session %s", session_id)


class WorkerSettings:
    """ARQ worker configuration."""

    settings = get_settings()
    functions = [arq_generate_feedback]
    redis_settings = None  # instantiated dynamically when run via arq CLI
