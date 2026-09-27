"""Access rules shared by endpoints."""

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import Conversation, Message, User

SIGNUP_REQUIRED = {
    "code": "signup_required",
    "message": "Create a free account to keep going. Your conversation will be saved to it.",
}


def is_guest(user: User) -> bool:
    return user.clerk_user_id.startswith("guest_")


async def guest_message_count(db: AsyncSession, user: User) -> int:
    stmt = (
        select(func.count(Message.id))
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(Conversation.user_id == user.id, Message.role == "user")
    )
    return (await db.execute(stmt)).scalar_one()


async def ensure_guest_can_send(db: AsyncSession, user: User) -> None:
    """Guests may send GUEST_MESSAGE_LIMIT messages; after that they must sign up."""
    if not is_guest(user):
        return
    if await guest_message_count(db, user) >= settings.GUEST_MESSAGE_LIMIT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=SIGNUP_REQUIRED)
