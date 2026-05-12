"""
Tests for the Matrimony AI Assistant service and router.

Run: pytest tests/test_assistant.py -v

Mongo + Anthropic are mocked so no live connections are required.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

from src.schemas.assistant import AssistantChatRequest, RagContext, TopMatchEntry
from src.services.assistant_service import (
    MOCK_CHUNKS,
    build_system_prompt,
    fetch_history,
    persist_turn,
    stream_chat,
)


def _make_context() -> RagContext:
    return RagContext(
        completeness_pct=78,
        tier="STANDARD",
        top_matches=[
            TopMatchEntry(
                profile_id="00000000-0000-0000-0000-000000000001",
                display_name="Anika",
                compatibility_pct=92,
            )
        ],
        pending_requests=2,
        unread_messages=1,
        gaps=["family"],
        last_active_iso="2026-05-12T07:00:00Z",
    )


def _make_request(conversation_id: str | None = None) -> AssistantChatRequest:
    return AssistantChatRequest(
        user_id="user-1",
        profile_id="profile-1",
        message="What should I do next?",
        conversation_id=conversation_id,
        context=_make_context(),
    )


# ---------------------------------------------------------------------------
# build_system_prompt
# ---------------------------------------------------------------------------


def test_build_system_prompt_includes_context_fields() -> None:
    prompt = build_system_prompt(_make_context())
    assert "78%" in prompt
    assert "STANDARD" in prompt
    assert "Anika (92%)" in prompt
    assert "2 match requests" in prompt
    assert "1 unread messages" in prompt
    assert "family" in prompt


def test_build_system_prompt_handles_empty_matches() -> None:
    ctx = _make_context()
    ctx.top_matches = []
    ctx.gaps = []
    prompt = build_system_prompt(ctx)
    assert "(none yet)" in prompt
    assert "Profile gaps: (none)" in prompt


# ---------------------------------------------------------------------------
# stream_chat — mock mode
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_stream_chat_mock_yields_context_delta_done() -> None:
    chunks: list[str] = []
    with patch(
        "src.services.assistant_service._conversation_collection",
        return_value=None,
    ):
        async for line in stream_chat(_make_request(), use_mock=True):
            chunks.append(line)

    parsed = [json.loads(c.removeprefix("data: ").strip()) for c in chunks]
    types = [p["type"] for p in parsed]
    assert types[0] == "context"
    assert types[-1] == "done"
    assert all(t in {"context", "delta", "done"} for t in types)
    deltas = [p["content"] for p in parsed if p["type"] == "delta"]
    assert deltas == MOCK_CHUNKS


@pytest.mark.asyncio
async def test_stream_chat_generates_conversation_id_when_null() -> None:
    captured_ids: list[str] = []
    with patch(
        "src.services.assistant_service._conversation_collection",
        return_value=None,
    ):
        async for line in stream_chat(_make_request(conversation_id=None), use_mock=True):
            payload = json.loads(line.removeprefix("data: ").strip())
            if payload["type"] == "done":
                captured_ids.append(payload["conversation_id"])

    assert len(captured_ids) == 1
    assert captured_ids[0]
    assert len(captured_ids[0]) >= 16  # uuid-shaped


@pytest.mark.asyncio
async def test_stream_chat_reuses_provided_conversation_id() -> None:
    given = "11111111-2222-3333-4444-555555555555"
    captured_ids: list[str] = []
    with patch(
        "src.services.assistant_service._conversation_collection",
        return_value=None,
    ):
        async for line in stream_chat(_make_request(conversation_id=given), use_mock=True):
            payload = json.loads(line.removeprefix("data: ").strip())
            if payload["type"] == "done":
                captured_ids.append(payload["conversation_id"])

    assert captured_ids == [given]


# ---------------------------------------------------------------------------
# Mongo helpers
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_fetch_history_returns_empty_for_missing_conversation() -> None:
    fake_coll = AsyncMock()
    fake_coll.find_one = AsyncMock(return_value=None)
    with patch(
        "src.services.assistant_service._conversation_collection",
        return_value=fake_coll,
    ):
        result = await fetch_history("does-not-exist")
    assert result == []


@pytest.mark.asyncio
async def test_fetch_history_returns_last_messages_in_order() -> None:
    fake_coll = AsyncMock()
    fake_coll.find_one = AsyncMock(
        return_value={
            "conversation_id": "c1",
            "messages": [
                {"role": "user", "content": "hi"},
                {"role": "assistant", "content": "hello"},
                {"role": "user", "content": "and you?"},
            ],
        }
    )
    with patch(
        "src.services.assistant_service._conversation_collection",
        return_value=fake_coll,
    ):
        result = await fetch_history("c1")
    assert result == [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
        {"role": "user", "content": "and you?"},
    ]


@pytest.mark.asyncio
async def test_persist_turn_upserts_user_and_assistant_messages() -> None:
    fake_coll = AsyncMock()
    fake_coll.update_one = AsyncMock()
    with patch(
        "src.services.assistant_service._conversation_collection",
        return_value=fake_coll,
    ):
        await persist_turn("c1", "u1", "p1", "hello", "hi back")
    assert fake_coll.update_one.await_count == 1
    args, kwargs = fake_coll.update_one.call_args
    push_payload = args[1]["$push"]["messages"]["$each"]
    assert [m["role"] for m in push_payload] == ["user", "assistant"]
    assert push_payload[0]["content"] == "hello"
    assert push_payload[1]["content"] == "hi back"
    assert kwargs.get("upsert") is True
