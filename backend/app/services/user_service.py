"""User management service."""

from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User
from app.core.logging import logger


class UserService:
    """Service to handle user provisioning and lookups."""

    @staticmethod
    async def get_or_create_user(
        db: AsyncSession,
        clerk_user_id: str,
        email: Optional[str] = None
    ) -> User:
        """Fetch existing user by clerk_user_id or create a new user row."""
        result = await db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
        user = result.scalar_one_or_none()

        if user:
            # Update email if provided and changed
            if email and user.email != email:
                user.email = email
                await db.commit()
                await db.refresh(user)
            return user

        # Provision new user
        new_user = User(
            clerk_user_id=clerk_user_id,
            email=email
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        logger.info(f"Provisioned new user: {new_user.id} (Clerk ID: {clerk_user_id})")
        return new_user
