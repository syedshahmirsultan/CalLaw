"""Message processing and legal agent invocation endpoints."""

import asyncio
import json
from typing import AsyncGenerator, List, Optional

from fastapi import APIRouter, Depends, Header, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.coordinator import LegalAgentCoordinator
from app.api.dependencies import get_current_user, get_db
from app.api.guards import ensure_guest_can_send
from app.core.logging import logger
from app.db.models import Conversation, LegalSource, Message, User, utc_now
from app.schemas.legal import LegalAnalysis
from app.schemas.message import MessageCreate, MessageProcessResponse, MessageResponse
from app.services.conversation_service import ConversationService

router = APIRouter(prefix="/conversations/{conversation_id}/messages", tags=["Messages"])


@router.get("", response_model=List[MessageResponse])
async def get_messages(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all messages and their legal sources for a conversation."""
    conversation = await ConversationService.get_conversation_by_id(db, conversation_id, current_user)
    return conversation.messages


async def _save_user_message(db: AsyncSession, conversation: Conversation, content: str) -> Message:
    history_len = len(conversation.messages)
    user_msg = Message(conversation_id=conversation.id, role="user", content=content, agent_state="user_input")
    db.add(user_msg)
    if conversation.title == "New Legal Inquiry" and history_len == 0:
        clean = content.replace("\n", " ")
        conversation.title = clean[:60] + ("…" if len(clean) > 60 else "")
    conversation.updated_at = utc_now()
    await db.commit()
    await db.refresh(user_msg)
    return user_msg


async def _save_assistant_message(
    db: AsyncSession, conversation: Conversation, analysis: LegalAnalysis, user_msg: Message
) -> MessageProcessResponse:
    details = {**analysis.details, "uncertainties": analysis.uncertainties}
    assistant_msg = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=analysis.answer,
        agent_state=analysis.agent_state,
        details=details,
    )
    db.add(assistant_msg)
    await db.flush()
    for s in analysis.legal_sources:
        db.add(LegalSource(
            message_id=assistant_msg.id,
            source_type=s.source_type,
            jurisdiction=s.jurisdiction,
            code_name=s.code_name,
            section=s.section,
            title=s.title[:255],
            citation=s.citation,
            source_url=s.source_url,
            relevance_summary=s.relevance_summary,
            retrieved_text_snippet=s.retrieved_text_snippet,
            key_quote=s.key_quote,
            applicability=s.applicability,
            statute_history=s.statute_history,
        ))
    conversation.updated_at = utc_now()
    await db.commit()
    await db.refresh(assistant_msg)

    def as_response(m: Message, sources, det) -> MessageResponse:
        return MessageResponse(
            id=m.id, conversation_id=m.conversation_id, role=m.role, content=m.content,
            agent_state=m.agent_state, created_at=m.created_at, legal_sources=sources, details=det,
        )

    return MessageProcessResponse(
        user_message=as_response(user_msg, [], None),
        assistant_message=as_response(assistant_msg, analysis.legal_sources, details),
        agent_state=analysis.agent_state,
        clarifying_questions=analysis.clarifying_questions,
        legal_sources=analysis.legal_sources,
        uncertainties=analysis.uncertainties,
        details=details,
    )


@router.post("", response_model=MessageProcessResponse, status_code=status.HTTP_201_CREATED)
async def post_message_and_execute_agent(
    conversation_id: str,
    data: MessageCreate,
    x_llm_api_key: Optional[str] = Header(None, alias="X-LLM-API-Key"),
    x_llm_provider: Optional[str] = Header(None, alias="X-LLM-Provider"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a message and run the legal agent (blocking; returns the full result)."""
    conversation = await ConversationService.get_conversation_by_id(db, conversation_id, current_user)
    await ensure_guest_can_send(db, current_user)
    history = list(conversation.messages)
    content = data.content.strip()
    user_msg = await _save_user_message(db, conversation, content)

    analysis = await LegalAgentCoordinator.process_turn(
        conversation_id=conversation.id,
        messages_history=history,
        latest_user_message=content,
        api_key=x_llm_api_key,
        provider=x_llm_provider,
    )
    return await _save_assistant_message(db, conversation, analysis, user_msg)


@router.post("/stream")
async def post_message_stream(
    conversation_id: str,
    data: MessageCreate,
    x_llm_api_key: Optional[str] = Header(None, alias="X-LLM-API-Key"),
    x_llm_provider: Optional[str] = Header(None, alias="X-LLM-Provider"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Same as POST /messages, but streams progress as Server-Sent Events.

    Events: {"type": "progress", "stage", "label", "detail"} ... then
    {"type": "final", "data": MessageProcessResponse} or {"type": "error", "detail"}.
    """
    conversation = await ConversationService.get_conversation_by_id(db, conversation_id, current_user)
    await ensure_guest_can_send(db, current_user)
    history = list(conversation.messages)
    content = data.content.strip()
    user_msg = await _save_user_message(db, conversation, content)

    queue: asyncio.Queue = asyncio.Queue()

    async def on_event(stage: str, label: str, detail: Optional[str] = None) -> None:
        await queue.put({"type": "progress", "stage": stage, "label": label, "detail": detail})

    async def run() -> None:
        try:
            analysis = await LegalAgentCoordinator.process_turn(
                conversation_id=conversation.id,
                messages_history=history,
                latest_user_message=content,
                api_key=x_llm_api_key,
                provider=x_llm_provider,
                on_event=on_event,
            )
            result = await _save_assistant_message(db, conversation, analysis, user_msg)
            await queue.put({"type": "final", "data": json.loads(result.model_dump_json())})
        except Exception as e:  # never leave the client hanging
            logger.error(f"Streaming turn failed: {e}", exc_info=True)
            await queue.put({"type": "error", "detail": "Something went wrong while analyzing your situation. Please try again."})

    async def event_stream() -> AsyncGenerator[str, None]:
        task = asyncio.create_task(run())
        yield f"data: {json.dumps({'type': 'progress', 'stage': 'received', 'label': 'Message received', 'detail': None})}\n\n"
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=15)
            except asyncio.TimeoutError:
                yield ": keep-alive\n\n"
                continue
            yield f"data: {json.dumps(event)}\n\n"
            if event["type"] in ("final", "error"):
                break
        await task

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
