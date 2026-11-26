"""Seed script for database."""

import argparse
import asyncio
import sys
from pathlib import Path

# Ensure backend root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import delete, text

from app.core.database import async_session_factory
from app.models.auth import User
from app.repositories.session import CoachTopicRepository
from app.seeds.gamification_seeds import seed_gamification
from app.seeds.scenario_loader import seed_scenarios

RESET_TABLES = (
    "account_admin_audit",
    "admin_audit_events",
    "badge_definitions",
    "chunk_bank",
    "coach_topics",
    "drill_attempts",
    "gamification_profiles",
    "level_history",
    "mission_definitions",
    "notifications",
    "password_reset_tokens",
    "placement_answers",
    "placement_tests",
    "refresh_tokens",
    "roleplay_evaluations",
    "scenario_admin_audit",
    "scenario_categories",
    "scenario_chunks",
    "scenario_requirements",
    "scenarios",
    "scoring_audit",
    "session_feedback",
    "session_skill_scores",
    "sessions",
    "transcript_segments",
    "user_badges",
    "user_daily_missions",
    "user_scenario_progress",
    "xp_rules",
    "xp_transactions",
)


async def reset_database(*, wipe_users: bool = False) -> None:
    """Truncate old practice/content/gamification data before re-seeding."""
    tables = (*RESET_TABLES, "users") if wipe_users else RESET_TABLES
    async with async_session_factory() as db:
        await db.execute(text("TRUNCATE TABLE " + ", ".join(tables) + " RESTART IDENTITY CASCADE"))
        if not wipe_users:
            await db.execute(delete(User).where(User.email.like("test%")))
        await db.commit()
    print("Database cleared.")


async def main(*, reset: bool = False, wipe_users: bool = False) -> None:
    if reset:
        print("Resetting old database data...")
        await reset_database(wipe_users=wipe_users)
    print("Seeding scenarios & shared categories...")
    async with async_session_factory() as db:
        await seed_scenarios(db)
        print("Seeding AI Coach topics...")
        await CoachTopicRepository(db).ensure_defaults()
        print("Seeding gamification rules, missions, and badges...")
        await seed_gamification(db)
        await db.commit()
    print("Seeding completed successfully!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Wipe existing content/session/gamification data before seeding.",
    )
    parser.add_argument(
        "--wipe-users",
        action="store_true",
        help="Also truncate all user accounts when --reset is used.",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Confirm destructive --reset operation.",
    )
    args = parser.parse_args()
    if args.reset and not args.yes:
        raise SystemExit("Refusing to reset database without --yes confirmation.")
    asyncio.run(main(reset=args.reset, wipe_users=args.wipe_users))
