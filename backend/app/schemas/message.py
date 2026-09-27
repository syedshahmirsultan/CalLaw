"""Message schemas."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.legal import NormalizedLegalSource


class MessageCreate(BaseModel):
    """Schema for incoming user message."""

    content: str = Field(..., min_length=1, max_length=10000, description="User question or clarification answer")


class MessageResponse(BaseModel):
    """Schema for individual stored message with its sources."""

    id: str
    conversation_id: str
    role: str  # "user" | "assistant" | "system"
    content: str
    agent_state: Optional[str] = None
    created_at: datetime
    legal_sources: List[NormalizedLegalSource] = Field(default_factory=list)
    details: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class MessageProcessResponse(BaseModel):
    """Response returned when a user sends a message and the agent processes it."""

    user_message: MessageResponse
    assistant_message: MessageResponse
    agent_state: str  # "clarifying" | "answered" | "insufficient_evidence"
    clarifying_questions: List[str] = Field(default_factory=list)
    legal_sources: List[NormalizedLegalSource] = Field(default_factory=list)
    uncertainties: List[str] = Field(default_factory=list)
    details: Dict[str, Any] = Field(default_factory=dict)
