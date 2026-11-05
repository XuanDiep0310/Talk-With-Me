"""Seed script for database."""

import asyncio
import sys
from pathlib import Path

# Ensure backend root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import async_session_factory
from app.seeds.gamification_seeds import seed_gamification
from app.seeds.scenario_loader import seed_scenarios


async def main() -> None:
    print("Seeding scenarios...")
    async with async_session_factory() as db:
        await seed_scenarios(db)
        print("Seeding gamification rules, missions, and badges...")
        await seed_gamification(db)
        await db.commit()
    print("Seeding completed successfully!")


if __name__ == "__main__":
    asyncio.run(main())
