"""Conversation management endpoints."""

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db, get_current_user
from app.api.guards import ensure_guest_can_send
from app.db.models import User
from app.schemas.conversation import (
    ConversationCreate,
    ConversationUpdate,
    ConversationSummary,
    ConversationDetail,
)
from app.services.conversation_service import ConversationService

router = APIRouter(prefix="/conversations", tags=["Conversations"])


@router.get("", response_model=List[ConversationSummary])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all conversations for the authenticated user."""
    return await ConversationService.list_conversations(db, current_user)


@router.post("", response_model=ConversationSummary, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    data: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new conversation for the authenticated user."""
    await ensure_guest_can_send(db, current_user)
    conversation = await ConversationService.create_conversation(db, current_user, data)
    return ConversationSummary(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        message_count=0,
    )


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch a full conversation with messages and legal sources.
    Strictly verifies ownership: Returns 404 if not owned by caller.
    """
    conversation = await ConversationService.get_conversation_by_id(db, conversation_id, current_user)
    return conversation


@router.patch("/{conversation_id}", response_model=ConversationSummary)
async def update_conversation(
    conversation_id: str,
    data: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a conversation title."""
    conversation = await ConversationService.update_title(db, conversation_id, current_user, data.title)
    return ConversationSummary(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        message_count=len(conversation.messages) if conversation.messages else 0,
    )


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a conversation and all cascaded messages and sources."""
    await ConversationService.delete_conversation(db, conversation_id, current_user)
    return None
