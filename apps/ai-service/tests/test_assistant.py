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
    _env_float,
    _env_int,
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
    assert "Pending match requests: 2" in prompt
    assert "Unread messages: 1" in prompt
    assert "family" in prompt
    # v2 prompt: tool policy + safety rules are present
    assert "tool" in prompt.lower()


def test_build_system_prompt_handles_empty_matches() -> None:
    ctx = _make_context()
    ctx.top_matches = []
    ctx.gaps = []
    prompt = build_system_prompt(ctx)
    assert "(none yet)" in prompt
    assert "Incomplete profile sections: (none)" in prompt


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


# ---------------------------------------------------------------------------
# stream_chat — live agentic tool-calling
# ---------------------------------------------------------------------------


class _FakeBlock:
    def __init__(self, *, type="text", text="", id=None, name=None, input=None):
        self.type = type
        self.text = text
        self.id = id
        self.name = name
        self.input = input


class _FakeResp:
    def __init__(self, content, stop_reason):
        self.content = content
        self.stop_reason = stop_reason


class _FakeMessages:
    def __init__(self, responses):
        self._responses = list(responses)
        self.calls: list[dict] = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        if len(self._responses) > 1:
            return self._responses.pop(0)
        return self._responses[0]


class _FakeClient:
    def __init__(self, responses):
        self.messages = _FakeMessages(responses)


def _parse(lines):
    return [json.loads(line.removeprefix("data: ").strip()) for line in lines]


@pytest.mark.asyncio
async def test_stream_chat_live_answers_from_llm_text(monkeypatch) -> None:
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "a-key")
    client = _FakeClient([_FakeResp([_FakeBlock(text="Your profile looks great.")], "end_turn")])

    lines: list[str] = []
    with patch("src.services.assistant_service._conversation_collection", return_value=None):
        async for line in stream_chat(_make_request(), anthropic_client=client, use_mock=False):
            lines.append(line)

    parsed = _parse(lines)
    types = [p["type"] for p in parsed]
    assert types[0] == "context"
    assert types[-1] == "done"
    assert "error" not in types
    text = "".join(p["content"] for p in parsed if p["type"] == "delta")
    assert text == "Your profile looks great."


@pytest.mark.asyncio
async def test_stream_chat_live_runs_tool_then_answers(monkeypatch) -> None:
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "a-key")
    tool_resp = _FakeResp(
        [_FakeBlock(type="tool_use", id="t1", name="get_my_profile", input={})], "tool_use"
    )
    final_resp = _FakeResp([_FakeBlock(text="Your profile is 78% complete.")], "end_turn")
    client = _FakeClient([tool_resp, final_resp])
    fake_exec = AsyncMock(
        return_value={
            "tool_use_id": "t1",
            "name": "get_my_profile",
            "content": '{"completeness_pct": 78}',
            "is_error": False,
        }
    )

    lines: list[str] = []
    with patch("src.services.assistant_service._conversation_collection", return_value=None), patch(
        "src.services.assistant_service.execute_tool_call", fake_exec
    ):
        async for line in stream_chat(_make_request(), anthropic_client=client, use_mock=False):
            lines.append(line)

    parsed = _parse(lines)
    types = [p["type"] for p in parsed]
    assert "tool_progress" in types
    prog = [p for p in parsed if p["type"] == "tool_progress"]
    assert prog[0]["tool"] == "get_my_profile"
    assert fake_exec.await_count == 1
    text = "".join(p["content"] for p in parsed if p["type"] == "delta")
    assert "78%" in text
    assert types[-1] == "done"


@pytest.mark.asyncio
async def test_stream_chat_live_error_surfaces_error_event_no_fabrication(monkeypatch) -> None:
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "a-key")

    class _BoomMessages:
        async def create(self, **_):
            raise RuntimeError("provider down")

    class _BoomClient:
        def __init__(self):
            self.messages = _BoomMessages()

    lines: list[str] = []
    boom = _BoomClient()
    with patch("src.services.assistant_service._conversation_collection", return_value=None):
        async for line in stream_chat(_make_request(), anthropic_client=boom, use_mock=False):
            lines.append(line)

    parsed = _parse(lines)
    types = [p["type"] for p in parsed]
    assert "error" in types
    assert types[-1] == "done"
    # Critically: NO fabricated mock answer is streamed on a genuine failure.
    deltas = [p["content"] for p in parsed if p["type"] == "delta"]
    assert deltas == []


@pytest.mark.asyncio
async def test_stream_chat_live_tool_budget_exhaustion(monkeypatch) -> None:
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "a-key")
    monkeypatch.setattr("src.services.assistant_service.MAX_TOOL_ROUNDS", 2)
    always_tool = _FakeResp(
        [_FakeBlock(type="tool_use", id="t1", name="get_my_profile", input={})], "tool_use"
    )
    client = _FakeClient([always_tool])  # single response, repeated every round
    fake_exec = AsyncMock(
        return_value={
            "tool_use_id": "t1",
            "name": "get_my_profile",
            "content": "{}",
            "is_error": False,
        }
    )

    lines: list[str] = []
    with patch("src.services.assistant_service._conversation_collection", return_value=None), patch(
        "src.services.assistant_service.execute_tool_call", fake_exec
    ):
        async for line in stream_chat(_make_request(), anthropic_client=client, use_mock=False):
            lines.append(line)

    parsed = _parse(lines)
    types = [p["type"] for p in parsed]
    assert types[-1] == "done"
    # rounds 0..MAX_TOOL_ROUNDS inclusive → MAX_TOOL_ROUNDS+1 LLM calls
    assert len(client.messages.calls) == 3
    # tools executed only on the non-forced rounds (0 and 1)
    assert fake_exec.await_count == 2
    # a non-empty fallback answer is still streamed
    deltas = "".join(p["content"] for p in parsed if p["type"] == "delta")
    assert deltas != ""


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


# ---------------------------------------------------------------------------
# env parsing helpers — blank/garbage tolerance (regression for the prod
# ValueError: invalid literal for int() with base 10: '')
# ---------------------------------------------------------------------------


def test_env_int_returns_default_when_unset(monkeypatch) -> None:
    monkeypatch.delenv("ASSISTANT_MAX_TOKENS", raising=False)
    assert _env_int("ASSISTANT_MAX_TOKENS", 1500) == 1500


@pytest.mark.parametrize("blank", ["", "   ", "\t"])
def test_env_int_returns_default_when_blank(monkeypatch, blank) -> None:
    # This is the exact prod footgun: a present-but-empty Railway variable.
    monkeypatch.setenv("ASSISTANT_MAX_TOKENS", blank)
    assert _env_int("ASSISTANT_MAX_TOKENS", 1500) == 1500


def test_env_int_returns_default_on_garbage(monkeypatch) -> None:
    monkeypatch.setenv("ASSISTANT_MAX_TOKENS", "not-a-number")
    assert _env_int("ASSISTANT_MAX_TOKENS", 1500) == 1500


def test_env_int_parses_valid_value(monkeypatch) -> None:
    monkeypatch.setenv("ASSISTANT_MAX_TOKENS", " 2000 ")
    assert _env_int("ASSISTANT_MAX_TOKENS", 1500) == 2000


@pytest.mark.parametrize("blank", ["", "  "])
def test_env_float_returns_default_when_blank(monkeypatch, blank) -> None:
    monkeypatch.setenv("ASSISTANT_LLM_TIMEOUT_SEC", blank)
    assert _env_float("ASSISTANT_LLM_TIMEOUT_SEC", 30.0) == 30.0


def test_env_float_parses_valid_value(monkeypatch) -> None:
    monkeypatch.setenv("ASSISTANT_LLM_TIMEOUT_SEC", "45.5")
    assert _env_float("ASSISTANT_LLM_TIMEOUT_SEC", 30.0) == 45.5


@pytest.mark.asyncio
async def test_stream_chat_survives_blank_max_tokens_env(monkeypatch) -> None:
    """End-to-end repro of the prod outage: a blank ASSISTANT_MAX_TOKENS must
    NOT raise ValueError mid-stream — it falls back to the 1500 default and the
    turn completes normally."""
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "a-key")
    monkeypatch.setenv("ASSISTANT_MAX_TOKENS", "")  # the offending blank value
    client = _FakeClient([_FakeResp([_FakeBlock(text="All good.")], "end_turn")])

    lines: list[str] = []
    with patch("src.services.assistant_service._conversation_collection", return_value=None):
        async for line in stream_chat(_make_request(), anthropic_client=client, use_mock=False):
            lines.append(line)

    parsed = _parse(lines)
    types = [p["type"] for p in parsed]
    assert types[0] == "context"
    assert types[-1] == "done"
    assert "error" not in types
    # fell back to the default rather than crashing on int("")
    assert client.messages.calls[0]["max_tokens"] == 1500
