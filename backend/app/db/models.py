"""SQLAlchemy database models for User, Conversation, Message, and LegalSource."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


def generate_uuid() -> str:
    """Generate string UUIDv4."""
    return str(uuid.uuid4())


def utc_now() -> datetime:
    """Return current UTC datetime."""
    return datetime.now(timezone.utc)


class User(Base):
    """User account model mapped to Clerk identity."""

    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    clerk_user_id = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    conversations = relationship(
        "Conversation",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="desc(Conversation.updated_at)"
    )


class Conversation(Base):
    """Legal conversation thread belonging to a user."""

    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), default="New Legal Inquiry", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    user = relationship("User", back_populates="conversations")
    messages = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at"
    )

    __table_args__ = (
        Index("idx_conversations_user_updated", "user_id", "updated_at"),
    )


class Message(Base):
    """Individual message in a conversation thread."""

    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # "user" | "assistant" | "system"
    content = Column(Text, nullable=False)
    agent_state = Column(String(50), nullable=True)  # "clarifying" | "answered" | "insufficient_evidence"
    details = Column(JSON, nullable=True)  # UI payload: questions, next steps, follow-ups, headline
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    legal_sources = relationship(
        "LegalSource",
        back_populates="message",
        cascade="all, delete-orphan",
        order_by="LegalSource.created_at"
    )

    __table_args__ = (
        Index("idx_messages_conversation_created", "conversation_id", "created_at"),
    )


class LegalSource(Base):
    """Retrieved authoritative California legal source used in an assistant response."""

    __tablename__ = "legal_sources"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    message_id = Column(String(36), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    source_type = Column(String(50), default="statute", nullable=False)  # statute | regulation | case
    jurisdiction = Column(String(50), default="California", nullable=False)
    code_name = Column(String(100), nullable=False)  # e.g., "California Civil Code"
    section = Column(String(50), nullable=False)    # e.g., "1950.5"
    title = Column(String(255), nullable=False)      # e.g., "Security Deposits"
    citation = Column(String(255), nullable=False)   # e.g., "Cal. Civ. Code § 1950.5"
    source_url = Column(Text, nullable=False)        # Verified official URL
    relevance_summary = Column(Text, nullable=True)  # Plain-English relevance
    retrieved_text_snippet = Column(Text, nullable=True)
    key_quote = Column(Text, nullable=True)          # Passage verified verbatim against official text
    applicability = Column(String(20), nullable=True)  # "yes" | "maybe"
    statute_history = Column(Text, nullable=True)    # Enactment / amendment note from leginfo
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    message = relationship("Message", back_populates="legal_sources")
