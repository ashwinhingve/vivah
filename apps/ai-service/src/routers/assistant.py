"""
Matrimony AI Assistant router.

Route: POST /ai/assistant/chat — Server-Sent Events stream.

Auth: global InternalKeyAuthMiddleware + per-route Depends(verify_internal_key).
Body shape: AssistantChatRequest. Response is text/event-stream.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from src.deps.auth import verify_internal_key
from src.schemas.assistant import AssistantChatRequest
from src.services.assistant_service import stream_chat

router = APIRouter(prefix="/ai/assistant", tags=["assistant"])


@router.post(
    "/chat",
    dependencies=[Depends(verify_internal_key)],
)
async def chat(request: AssistantChatRequest) -> StreamingResponse:
    return StreamingResponse(
        stream_chat(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
