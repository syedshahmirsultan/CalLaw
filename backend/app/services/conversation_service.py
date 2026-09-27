"""Conversation lifecycle and ownership management service."""

from typing import List, Optional
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.db.models import Conversation, Message, LegalSource, User
from app.schemas.conversation import ConversationCreate, ConversationSummary, ConversationDetail
from app.core.logging import logger


class ConversationService:
    """Service handling conversations with strict user-ownership enforcement."""

    @staticmethod
    async def list_conversations(
        db: AsyncSession,
        user: User
    ) -> List[ConversationSummary]:
        """List all conversations belonging to the authenticated user."""
        # Query conversations with message count
        stmt = (
            select(
                Conversation.id,
                Conversation.title,
                Conversation.created_at,
                Conversation.updated_at,
                func.count(Message.id).label("message_count"),
            )
            .outerjoin(Message, Conversation.id == Message.conversation_id)
            .where(Conversation.user_id == user.id)
            .group_by(Conversation.id)
            .order_by(desc(Conversation.updated_at))
        )
        result = await db.execute(stmt)
        rows = result.all()

        return [
            ConversationSummary(
                id=row.id,
                title=row.title,
                created_at=row.created_at,
                updated_at=row.updated_at,
                message_count=row.message_count,
            )
            for row in rows
        ]

    @staticmethod
    async def create_conversation(
        db: AsyncSession,
        user: User,
        data: ConversationCreate
    ) -> Conversation:
        """Create a new conversation for the authenticated user."""
        title = data.title or "New Legal Inquiry"
        if data.initial_message and len(data.initial_message.strip()) > 0:
            # Generate short title from first 30 chars if default title was kept
            if title == "New Legal Inquiry":
                snippet = data.initial_message.strip().replace("\n", " ")
                title = snippet[:35] + ("..." if len(snippet) > 35 else "")

        conversation = Conversation(
            user_id=user.id,
            title=title
        )
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)
        logger.info(f"Created conversation {conversation.id} for user {user.id}")
        return conversation

    @staticmethod
    async def get_conversation_by_id(
        db: AsyncSession,
        conversation_id: str,
        user: User
    ) -> Conversation:
        """
        Fetch conversation by ID ensuring strict ownership.
        Raises 404 if not found or if owned by another user.
        """
        stmt = (
            select(Conversation)
            .where(Conversation.id == conversation_id, Conversation.user_id == user.id)
            .options(
                selectinload(Conversation.messages).selectinload(Message.legal_sources)
            )
        )
        result = await db.execute(stmt)
        conversation = result.scalar_one_or_none()

        if not conversation:
            # Check if conversation exists under another user to avoid leaking data
            check_stmt = select(Conversation.id).where(Conversation.id == conversation_id)
            exists = (await db.execute(check_stmt)).scalar_one_or_none()
            if exists:
                logger.warning(
                    f"Forbidden access attempt: user {user.id} tried to access conversation {conversation_id}"
                )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )

        return conversation

    @staticmethod
    async def update_title(
        db: AsyncSession,
        conversation_id: str,
        user: User,
        new_title: str
    ) -> Conversation:
        """Update conversation title."""
        conversation = await ConversationService.get_conversation_by_id(db, conversation_id, user)
        conversation.title = new_title.strip()
        await db.commit()
        await db.refresh(conversation)
        return conversation

    @staticmethod
    async def delete_conversation(
        db: AsyncSession,
        conversation_id: str,
        user: User
    ) -> bool:
        """Delete conversation and cascade delete its messages and legal sources."""
        conversation = await ConversationService.get_conversation_by_id(db, conversation_id, user)
        await db.delete(conversation)
        await db.commit()
        logger.info(f"Deleted conversation {conversation_id} for user {user.id}")
        return True
