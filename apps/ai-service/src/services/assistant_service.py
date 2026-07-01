"""
Matrimony AI Assistant service.

Streams Claude responses over SSE with RAG-light context. Mirrors the
coach_service.py lazy-singleton pattern for the Anthropic client + Helicone
proxy. Persists last 50 messages per conversation to MongoDB collection
`assistant_conversations` via motor (async).

Mock fallback: when USE_MOCK_SERVICES=true or ANTHROPIC_API_KEY missing,
yields a canned 3-chunk response so the api/web flows stay testable
end-to-end without a live Claude key.
"""

from __future__ import annotations

import json
import os
import uuid
from collections.abc import AsyncIterator
from typing import Any

import structlog

from src.schemas.assistant import AssistantChatRequest, RagContext
from src.services.llm_client import get_llm_client, llm_api_key_present

log = structlog.get_logger("assistant-service")

_anthropic_client = None
_mongo_client = None


def _get_async_anthropic():
    """Return a lazy-initialized AsyncAnthropic client (Helicone proxy if configured)."""
    global _anthropic_client  # noqa: PLW0603
    if _anthropic_client is not None:
        return _anthropic_client
    # Provider chosen by LLM_PROVIDER env (anthropic default | gemini); the
    # returned async client exposes the Anthropic streaming surface either way.
    _anthropic_client = get_llm_client(is_async=True)
    return _anthropic_client


def _get_mongo():
    """Return a lazy-initialized motor (async MongoDB) client. None on failure."""
    global _mongo_client  # noqa: PLW0603
    if _mongo_client is not None:
        return _mongo_client
    try:
        from motor.motor_asyncio import AsyncIOMotorClient

        uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        _mongo_client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=2000)
        return _mongo_client
    except Exception as exc:  # noqa: BLE001
        log.warning("mongo_init_failed", error=str(exc))
        return None


def _conversation_collection():
    """Return the assistant_conversations collection, or None if Mongo unavailable."""
    client = _get_mongo()
    if client is None:
        return None
    try:
        db_name = os.getenv("MONGODB_DB", "smartshaadiDB")
        return client[db_name]["assistant_conversations"]
    except Exception as exc:  # noqa: BLE001
        log.warning("mongo_collection_failed", error=str(exc))
        return None


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

_SYSTEM_TEMPLATE = """You are the Smart Shaadi matrimonial assistant. Be warm,
supportive, and culturally aware (Indian context). Use the user's data below
to answer their questions. Suggest concrete next actions. Refuse harmful or
inappropriate requests politely.

User context:
- Profile: {completeness}% complete, tier: {tier}
- Recent matches: {matches}
- Pending: {pending} match requests, {unread} unread messages
- Profile gaps: {gaps}
- Last activity: {last_active}

Now answer the user's question helpfully. Keep responses concise (2-4 short
paragraphs unless a list is clearly warranted)."""


def build_system_prompt(context: RagContext) -> str:
    """Render the system prompt with the user's RAG snapshot."""
    if context.top_matches:
        matches = ", ".join(
            f"{m.display_name} ({m.compatibility_pct}%)" for m in context.top_matches
        )
    else:
        matches = "(none yet)"
    gaps = ", ".join(context.gaps) if context.gaps else "(none)"
    return _SYSTEM_TEMPLATE.format(
        completeness=context.completeness_pct,
        tier=context.tier,
        matches=matches,
        pending=context.pending_requests,
        unread=context.unread_messages,
        gaps=gaps,
        last_active=context.last_active_iso or "(unknown)",
    )


# ---------------------------------------------------------------------------
# Conversation history (MongoDB)
# ---------------------------------------------------------------------------

HISTORY_LIMIT = 10
HISTORY_MAX_RETAINED = 50


async def fetch_history(conversation_id: str | None) -> list[dict[str, str]]:
    """Return up to HISTORY_LIMIT prior messages for the conversation, in order."""
    if not conversation_id:
        return []
    coll = _conversation_collection()
    if coll is None:
        return []
    try:
        doc = await coll.find_one({"conversation_id": conversation_id})
        if not doc:
            return []
        messages = doc.get("messages", [])
        recent = messages[-HISTORY_LIMIT:]
        return [{"role": m["role"], "content": m["content"]} for m in recent]
    except Exception as exc:  # noqa: BLE001
        log.warning("history_fetch_failed", error=str(exc))
        return []


async def persist_turn(
    conversation_id: str,
    user_id: str,
    profile_id: str,
    user_message: str,
    assistant_message: str,
) -> None:
    """Upsert user+assistant messages onto the conversation document."""
    coll = _conversation_collection()
    if coll is None:
        return
    try:
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        await coll.update_one(
            {"conversation_id": conversation_id},
            {
                "$setOnInsert": {
                    "conversation_id": conversation_id,
                    "user_id": user_id,
                    "profile_id": profile_id,
                    "created_at": now,
                },
                "$set": {"updated_at": now},
                "$push": {
                    "messages": {
                        "$each": [
                            {"role": "user", "content": user_message, "ts": now},
                            {"role": "assistant", "content": assistant_message, "ts": now},
                        ],
                        "$slice": -HISTORY_MAX_RETAINED,
                    },
                },
            },
            upsert=True,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("history_persist_failed", error=str(exc))


# ---------------------------------------------------------------------------
# Streaming
# ---------------------------------------------------------------------------

MOCK_CHUNKS = [
    "Aap ka profile ",
    "kaafi achha lag raha hai. ",
    "Next step — complete your family section and review your top match.",
]


def _sse_line(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def _stream_mock(
    conversation_id: str, context: RagContext
) -> AsyncIterator[str]:
    yield _sse_line({"type": "context", "context": context.model_dump()})
    for chunk in MOCK_CHUNKS:
        yield _sse_line({"type": "delta", "content": chunk})
    yield _sse_line({"type": "done", "conversation_id": conversation_id})


async def stream_chat(
    request: AssistantChatRequest,
    *,
    anthropic_client: Any | None = None,
    use_mock: bool | None = None,
) -> AsyncIterator[str]:
    """
    Yield SSE-formatted strings for the chat turn.

    Frame order:
    1. {type: "context", context: {...}}
    2. {type: "delta", content: "..."} — N chunks from Claude (or canned mock)
    3. {type: "done", conversation_id: "..."}

    Persists user + assembled assistant text to MongoDB on completion.
    Errors during Claude stream fall back to the mock chunks rather than
    surfacing to the caller — same posture as coach_service.
    """
    conversation_id = request.conversation_id or str(uuid.uuid4())
    if use_mock is None:
        use_mock = os.getenv("USE_MOCK_SERVICES", "false").lower() == "true"

    # ── Mock mode ─────────────────────────────────────────────────────────
    if use_mock or not llm_api_key_present():
        async for line in _stream_mock(conversation_id, request.context):
            yield line
        await persist_turn(
            conversation_id,
            request.user_id,
            request.profile_id,
            request.message,
            "".join(MOCK_CHUNKS),
        )
        return

    # ── Live mode ─────────────────────────────────────────────────────────
    client = anthropic_client if anthropic_client is not None else _get_async_anthropic()
    if client is None:
        async for line in _stream_mock(conversation_id, request.context):
            yield line
        return

    yield _sse_line({"type": "context", "context": request.context.model_dump()})

    history = await fetch_history(request.conversation_id)
    messages = [*history, {"role": "user", "content": request.message}]

    model = os.getenv("ASSISTANT_MODEL", "claude-sonnet-4-6")
    max_tokens = int(os.getenv("ASSISTANT_MAX_TOKENS", "1500"))
    system_prompt = build_system_prompt(request.context)

    extra_headers = {
        "Helicone-Property-Feature": "matrimony-assistant",
        "Helicone-User-Id": request.profile_id,
    }

    assembled: list[str] = []
    try:
        async with client.messages.stream(
            model=model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=messages,
            extra_headers=extra_headers,
        ) as stream:
            async for text in stream.text_stream:
                assembled.append(text)
                yield _sse_line({"type": "delta", "content": text})
    except Exception as exc:  # noqa: BLE001
        log.warning("assistant_stream_failed", error=str(exc))
        if not assembled:
            for chunk in MOCK_CHUNKS:
                assembled.append(chunk)
                yield _sse_line({"type": "delta", "content": chunk})

    yield _sse_line({"type": "done", "conversation_id": conversation_id})

    await persist_turn(
        conversation_id,
        request.user_id,
        request.profile_id,
        request.message,
        "".join(assembled),
    )
