"""
Pydantic schemas for the Matrimony AI Assistant.

Request shape mirrors the Node.js api caller: a free-text user message,
RAG context gathered server-side, plus an optional conversation_id to thread
across turns. Response is streamed via SSE — see services.assistant_service.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class TopMatchEntry(BaseModel):
    profile_id: str = Field(..., description="Other party's profile UUID")
    display_name: str = Field(..., description="Other party's display name (masked if applicable)")
    compatibility_pct: int = Field(..., ge=0, le=100, description="Match score 0-100")


class RagContext(BaseModel):
    """
    User-state snapshot fed to Claude as system-prompt context. Built on the
    Node.js side in assistantContext.ts so the AI service stays stateless.
    """

    completeness_pct: int = Field(..., ge=0, le=100)
    tier: str = Field(..., description="STARTER | STANDARD | PREMIUM | ELITE")
    top_matches: list[TopMatchEntry] = Field(default_factory=list, max_length=5)
    pending_requests: int = Field(0, ge=0)
    unread_messages: int = Field(0, ge=0)
    gaps: list[str] = Field(default_factory=list, description="Missing profile sections")
    last_active_iso: str | None = Field(default=None)


class AssistantChatRequest(BaseModel):
    user_id: str
    profile_id: str
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_id: str | None = Field(default=None)
    context: RagContext


# Response is streamed as SSE — these models document the wire shape but the
# router does not return any of them as a JSON body. See stream_chat().
class AssistantContextEvent(BaseModel):
    type: str = "context"
    context: RagContext


class AssistantDeltaEvent(BaseModel):
    type: str = "delta"
    content: str


class AssistantDoneEvent(BaseModel):
    type: str = "done"
    conversation_id: str
