"""
Matrimony AI Assistant service.

Streams Claude responses over SSE with RAG-light context. Mirrors the
coach_service.py lazy-singleton pattern for the Anthropic client + Helicone
proxy. Persists last 50 messages per conversation to MongoDB collection
`assistant_conversations` via motor (async).

Mock fallback (llm_client.ai_mock_enabled): only when the selected provider has
no API key, or AI_FORCE_MOCK=true — NOT tied to USE_MOCK_SERVICES (which mocks
MSG91/Razorpay in the Node api). Keeps api/web flows testable without a live key.
"""

from __future__ import annotations

import asyncio
import json
import os
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import structlog

from src.schemas.assistant import AssistantChatRequest, RagContext
from src.services.assistant_errors import LlmProviderError
from src.services.assistant_tools import execute_tool_call, get_tool_schemas
from src.services.llm_client import (
    ai_mock_enabled,
    append_assistant_turn,
    append_tool_results,
    get_llm_client,
    llm_api_key_present,
)
from src.services.observability import capture_exception, capture_message

log = structlog.get_logger("assistant-service")


def _env_int(name: str, default: int) -> int:
    """Parse an int env var, tolerating unset/blank/garbage values.

    os.getenv(name, default) only substitutes the default when the var is
    *unset* — a present-but-empty value (a blank Railway variable) returns "",
    and int("") raises ValueError. This never lets that crash the request.
    """
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw.strip())
    except ValueError:
        log.warning("bad_env_int", var=name, value=raw, fallback=default)
        return default


def _env_float(name: str, default: float) -> float:
    """Float counterpart to _env_int — same blank/garbage tolerance."""
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return float(raw.strip())
    except ValueError:
        log.warning("bad_env_float", var=name, value=raw, fallback=default)
        return default

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

# Versioned prompt file (CLAUDE.md convention). Loaded at request time.
# Resolve robustly across layouts — the monorepo (repo-root ``prompts/``) and the
# Docker image (vendored ``src/prompts/``; the container only ``COPY src ./src``).
# A hardcoded ``parents[4]`` crashed the whole service at import in Docker
# (``/app/src/services/...`` has no 5th parent → IndexError). Never raise here.
def _resolve_prompt_path() -> Path:
    here = Path(__file__).resolve()
    rel = ("prompts", "matrimony-assistant-v2.md")
    candidates = [
        here.parent.parent.joinpath(*rel),         # src/prompts (vendored → in Docker image)
        *(p.joinpath(*rel) for p in here.parents),  # any ancestor (monorepo repo root)
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    # None found: return the vendored location; the request-time read is guarded
    # (try/except) and falls back to _FALLBACK_SYSTEM.
    return candidates[0]


_PROMPT_PATH = _resolve_prompt_path()

# Fallback if the prompt file is unreadable — keeps the assistant answering with
# the essential safety + tool rules baked in.
_FALLBACK_SYSTEM = (
    "You are the Smart Shaadi Assistant. Use the provided tools to read the "
    "authenticated user's OWN data and answer warmly and concisely in the "
    "Indian matrimonial context. Never reveal other users' contact info. If a "
    "tool fails, say so honestly rather than guessing.\n\n"
    "## Current user context\n{{USER_CONTEXT}}"
)


def _render_context_snapshot(context: RagContext) -> str:
    """Render the RAG snapshot as a compact orientation block for the prompt."""
    if context.top_matches:
        matches = ", ".join(
            f"{m.display_name} ({m.compatibility_pct}%)" for m in context.top_matches
        )
    else:
        matches = "(none yet)"
    gaps = ", ".join(context.gaps) if context.gaps else "(none)"
    return (
        f"- Profile completeness: {context.completeness_pct}% (tier: {context.tier})\n"
        f"- Top matches: {matches}\n"
        f"- Pending match requests: {context.pending_requests}\n"
        f"- Unread messages: {context.unread_messages}\n"
        f"- Incomplete profile sections: {gaps}\n"
        f"- Last active: {context.last_active_iso or '(unknown)'}"
    )


def build_system_prompt(context: RagContext) -> str:
    """Load the v2 system prompt and inject the user's orientation snapshot."""
    try:
        template = _PROMPT_PATH.read_text(encoding="utf-8")
    except OSError:
        log.error("assistant_prompt_missing", path=str(_PROMPT_PATH))
        template = _FALLBACK_SYSTEM
    return template.replace("{{USER_CONTEXT}}", _render_context_snapshot(context))


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

# Agent-loop tuning
MAX_TOOL_ROUNDS = _env_int("ASSISTANT_MAX_TOOL_ROUNDS", 4)
_PER_CALL_TIMEOUT_SEC = _env_float("ASSISTANT_LLM_TIMEOUT_SEC", 30.0)
_DELTA_CHUNK_CHARS = 90


def _provider() -> str:
    return os.getenv("LLM_PROVIDER", "anthropic").strip().lower()


def _tool_choice_none() -> Any:
    """Provider-appropriate 'do not call any tool' directive (forced-final turn)."""
    return "none" if _provider() == "gemini" else {"type": "none"}


def _chunk_text(text: str) -> list[str]:
    """Split final answer into small slices so SSE deltas render progressively.

    Concatenation on the client reproduces ``text`` exactly (lossless slicing).
    """
    if not text:
        return [""]
    return [text[i : i + _DELTA_CHUNK_CHARS] for i in range(0, len(text), _DELTA_CHUNK_CHARS)]


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
    Yield SSE-formatted strings for the chat turn (agentic tool-calling).

    Frame order:
    1. {type: "context", context: {...}}
    2. {type: "tool_progress", tool: "..."} — zero or more, as tools run
    3. {type: "delta", content: "..."} — N chunks of the final answer
    4. {type: "done", conversation_id: "..."}
       or {type: "error", message, recoverable} then {type: "done"} on failure.

    Mock chunks are emitted ONLY in intentional mock mode (AI_FORCE_MOCK or a
    missing provider key — see ai_mock_enabled; NOT USE_MOCK_SERVICES). A genuine
    live-mode failure surfaces an SSE `error` event (and is captured to Sentry)
    rather than a fabricated answer — the old silent MOCK_CHUNKS swallow is gone.

    Persists user + assembled assistant text to MongoDB on completion.
    """
    conversation_id = request.conversation_id or str(uuid.uuid4())
    if use_mock is None:
        # Decoupled from USE_MOCK_SERVICES — the assistant runs on the real
        # provider whenever a key is present. See llm_client.ai_mock_enabled.
        use_mock = ai_mock_enabled()

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

    # ── Live mode (agentic tool-calling) ──────────────────────────────────
    client = anthropic_client if anthropic_client is not None else _get_async_anthropic()

    yield _sse_line({"type": "context", "context": request.context.model_dump()})

    # Key is present here (else the mock branch caught it). A None client means
    # SDK init failed — surface it honestly, do NOT fabricate a mock answer.
    if client is None:
        log.error("assistant_client_init_failed")
        capture_message("assistant_client_init_failed", feature="matrimony-assistant")
        yield _sse_line({
            "type": "error",
            "message": "The assistant is temporarily unavailable. Please try again shortly.",
            "recoverable": True,
        })
        yield _sse_line({"type": "done", "conversation_id": conversation_id})
        return

    history = await fetch_history(request.conversation_id)
    messages: list[dict[str, Any]] = [
        *history,
        {"role": "user", "content": request.message},
    ]
    tools = get_tool_schemas()
    model = os.getenv("ASSISTANT_MODEL", "claude-sonnet-4-6")
    max_tokens = _env_int("ASSISTANT_MAX_TOKENS", 1500)
    system_prompt = build_system_prompt(request.context)
    base_headers = {
        "Helicone-Property-Feature": "matrimony-assistant",
        "Helicone-User-Id": request.profile_id,
    }

    assembled = ""
    try:
        final_text = ""
        for round_idx in range(MAX_TOOL_ROUNDS + 1):
            forced_final = round_idx == MAX_TOOL_ROUNDS
            create_kwargs: dict[str, Any] = {
                "model": model,
                "max_tokens": max_tokens,
                "system": system_prompt,
                "messages": messages,
                "tools": tools,
                "extra_headers": {**base_headers, "Helicone-Property-ToolRound": str(round_idx)},
            }
            if forced_final:
                # Budget exhausted: force a text answer with whatever we gathered.
                create_kwargs["tool_choice"] = _tool_choice_none()
                log.warning("agent_tool_budget_exhausted", rounds=MAX_TOOL_ROUNDS)

            try:
                response = await asyncio.wait_for(
                    client.messages.create(**create_kwargs),
                    timeout=_PER_CALL_TIMEOUT_SEC,
                )
            except Exception as exc:  # noqa: BLE001 — normalize to a typed error
                raise LlmProviderError(str(exc)) from exc

            text_parts: list[str] = []
            tool_uses: list[Any] = []
            for block in getattr(response, "content", None) or []:
                if getattr(block, "type", "text") == "tool_use":
                    tool_uses.append(block)
                elif getattr(block, "text", ""):
                    text_parts.append(block.text)

            if not tool_uses or forced_final:
                final_text = "".join(text_parts).strip()
                break

            # Announce + run the requested tools, feed results back, loop.
            for tu in tool_uses:
                yield _sse_line({"type": "tool_progress", "tool": getattr(tu, "name", "")})
            append_assistant_turn(messages, response)
            results = await asyncio.gather(
                *[
                    execute_tool_call(
                        tu, user_id=request.user_id, profile_id=request.profile_id
                    )
                    for tu in tool_uses
                ]
            )
            append_tool_results(messages, list(results))

        if not final_text:
            final_text = (
                "I looked into that but couldn't put together a full answer just "
                "now. Could you rephrase, or try again in a moment?"
            )

        for chunk in _chunk_text(final_text):
            yield _sse_line({"type": "delta", "content": chunk})
        assembled = final_text

    except Exception as exc:  # noqa: BLE001
        log.error("assistant_agent_failed", error=str(exc))
        capture_exception(exc, feature="matrimony-assistant")
        yield _sse_line({
            "type": "error",
            "message": "Sorry — I ran into a problem reaching the assistant. Please try again.",
            "recoverable": True,
        })
        yield _sse_line({"type": "done", "conversation_id": conversation_id})
        return

    yield _sse_line({"type": "done", "conversation_id": conversation_id})

    await persist_turn(
        conversation_id,
        request.user_id,
        request.profile_id,
        request.message,
        assembled,
    )
