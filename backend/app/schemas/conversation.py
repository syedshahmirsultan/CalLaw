"""Conversation schemas."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.message import MessageResponse


class ConversationCreate(BaseModel):
    """Schema to start a new conversation."""

    title: Optional[str] = Field(default="New Legal Inquiry", max_length=255)
    initial_message: Optional[str] = Field(default=None, max_length=10000)


class ConversationUpdate(BaseModel):
    """Schema to update conversation title."""

    title: str = Field(..., min_length=1, max_length=255)


class ConversationSummary(BaseModel):
    """Schema for sidebar listing."""

    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class ConversationDetail(BaseModel):
    """Detailed schema including all messages and their legal sources."""

    id: str
    user_id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
