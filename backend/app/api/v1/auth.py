"""User profile and guest-to-account endpoints."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.api.guards import is_guest
from app.core.config import settings
from app.core.logging import logger
from app.core.security import GUEST_TOKEN_RE
from app.db.models import Conversation, User
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


class MeResponse(UserResponse):
    is_guest: bool
    guest_message_limit: int


class ClaimRequest(BaseModel):
    guest_tokens: List[str] = Field(default_factory=list, max_length=5)


class ClaimResponse(BaseModel):
    moved_conversations: int


@router.get("/me", response_model=MeResponse)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    """Return the current user, including whether they are a guest."""
    return MeResponse(
        **UserResponse.model_validate(current_user).model_dump(),
        is_guest=is_guest(current_user),
        guest_message_limit=settings.GUEST_MESSAGE_LIMIT,
    )


@router.post("/claim", response_model=ClaimResponse)
async def claim_guest_conversations(
    data: ClaimRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """After sign-up, move conversations a visitor started as a guest into their account.

    Guest ids are random UUIDs held only by that browser, so presenting one proves
    ownership. In development the legacy shared demo id is also accepted so existing
    local history carries over.
    """
    if is_guest(current_user):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sign in before claiming guest conversations.")

    is_dev = settings.ENVIRONMENT.lower() in ("development", "dev", "local", "test")
    allowed = [
        t for t in data.guest_tokens
        if GUEST_TOKEN_RE.match(t) or (is_dev and t == "dev_user_california_citizen")
    ]
    if not allowed:
        return ClaimResponse(moved_conversations=0)

    guests = (await db.execute(select(User).where(User.clerk_user_id.in_(allowed)))).scalars().all()
    moved = 0
    for guest in guests:
        if guest.id == current_user.id:
            continue
        result = await db.execute(
            update(Conversation).where(Conversation.user_id == guest.id).values(user_id=current_user.id)
        )
        moved += result.rowcount or 0
        await db.execute(delete(User).where(User.id == guest.id))
    await db.commit()
    if moved:
        logger.info(f"Moved {moved} guest conversation(s) into user {current_user.id}")
    return ClaimResponse(moved_conversations=moved)
