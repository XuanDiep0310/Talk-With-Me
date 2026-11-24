"""Grant or revoke editorial access for an existing account."""

import argparse
import asyncio
import uuid
from typing import Literal

from app.core.database import async_session_factory
from app.repositories.user import UserRepository


async def set_role(action: Literal["grant", "revoke"], user_id: uuid.UUID) -> None:
    async with async_session_factory.begin() as db:
        repo = UserRepository(db)
        user = await repo.get_by_id(user_id)
        if user is None:
            raise SystemExit("Account does not exist.")
        if action == "grant" and not user.is_active:
            raise SystemExit("Administrator access requires an active account.")
        user.role = "ADMIN" if action == "grant" else "LEARNER"
    print(f"{user_id}: {user.role}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("grant", "revoke"))
    parser.add_argument("user_id", type=uuid.UUID)
    args = parser.parse_args()
    asyncio.run(set_role(args.action, args.user_id))


if __name__ == "__main__":
    main()
