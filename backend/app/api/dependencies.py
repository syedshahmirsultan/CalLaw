"""FastAPI dependency injection for database sessions and Clerk authentication."""

from typing import Optional
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import User
from app.core.security import verify_clerk_token
from app.services.user_service import UserService
from app.core.logging import logger


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Dependency that validates Clerk Bearer token and returns the authenticated User.
    Enforces that every authenticated request maps to a verified user.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization format. Expected 'Bearer <token>'",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1]
    claims = await verify_clerk_token(token)

    if not claims or "sub" not in claims:
        logger.warning("Rejected unauthenticated request: invalid or expired Clerk token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    clerk_user_id = claims["sub"]
    email = claims.get("email")

    user = await UserService.get_or_create_user(db, clerk_user_id=clerk_user_id, email=email)
    return user
