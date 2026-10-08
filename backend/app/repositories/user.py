"""
User repository: CRUD for User, UserProfile, UserSettings.
"""

import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auth import User, UserProfile, UserSettings
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self.session.execute(
            select(User).where(User.email == email.lower())
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        email: str,
        full_name: str,
        password_hash: str | None,
    ) -> User:
        user = User(
            email=email.lower(),
            full_name=full_name,
            password_hash=password_hash,
        )
        self.session.add(user)
        await self.session.flush()  # Populate id before caller creates profile/settings
        return user

    async def update(self, user_id: uuid.UUID, **kwargs: object) -> User | None:
        await self.session.execute(
            update(User).where(User.id == user_id).values(**kwargs)
        )
        await self.session.flush()
        return await self.get_by_id(user_id)

    async def get_profile(self, user_id: uuid.UUID) -> UserProfile | None:
        result = await self.session.execute(
            select(UserProfile).where(UserProfile.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_settings(self, user_id: uuid.UUID) -> UserSettings | None:
        result = await self.session.execute(
            select(UserSettings).where(UserSettings.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def update_settings(
        self, user_id: uuid.UUID, **kwargs: object
    ) -> UserSettings | None:
        await self.session.execute(
            update(UserSettings).where(UserSettings.user_id == user_id).values(**kwargs)
        )
        await self.session.flush()
        return await self.get_settings(user_id)

    async def get_by_id_with_relations(self, user_id: uuid.UUID) -> User | None:
        """Load user together with profile and settings in one query."""
        result = await self.session.execute(
            select(User)
            .options(selectinload(User.profile), selectinload(User.settings))
            .where(User.id == user_id)
        )
        return result.scalar_one_or_none()
