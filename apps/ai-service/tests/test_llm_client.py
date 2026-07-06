"""Unit tests for the env-driven LLM provider switch (src/services/llm_client.py).

Covers the Gemini adapter (OpenAI-compatible) preserving the Anthropic client
surface, model mapping, temperature pass-through, and provider selection.
The underlying OpenAI client is mocked — no network and no real key needed.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from src.services import llm_client

# --- helpers -----------------------------------------------------------------


def _fake_completion(text: str) -> MagicMock:
    """Mimic openai chat.completions.create(...) return shape."""
    c = MagicMock()
    c.choices = [MagicMock()]
    c.choices[0].message.content = text
    return c


# --- llm_api_key_present / provider selection --------------------------------


def test_api_key_present_gemini(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "g-key")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert llm_client.llm_api_key_present() is True


def test_api_key_absent_gemini(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert llm_client.llm_api_key_present() is False


def test_api_key_present_anthropic_default(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)  # default = anthropic
    monkeypatch.setenv("ANTHROPIC_API_KEY", "a-key")
    assert llm_client.llm_api_key_present() is True


# --- model mapping -----------------------------------------------------------


def test_model_mapping_opus_vs_flash(monkeypatch):
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    monkeypatch.delenv("GEMINI_MODEL_OPUS", raising=False)
    assert llm_client._map_model("claude-opus-4-7") == "gemini-2.5-pro"
    assert llm_client._map_model("claude-sonnet-4-6") == "gemini-2.5-flash"


def test_model_mapping_env_override(monkeypatch):
    monkeypatch.setenv("GEMINI_MODEL", "gemini-x-flash")
    monkeypatch.setenv("GEMINI_MODEL_OPUS", "gemini-x-pro")
    assert llm_client._map_model("claude-opus-4-7") == "gemini-x-pro"
    assert llm_client._map_model("claude-sonnet-4-6") == "gemini-x-flash"


# --- message conversion ------------------------------------------------------


def test_to_openai_messages_prepends_system():
    out = llm_client._to_openai_messages(
        "SYS", [{"role": "user", "content": "hi"}]
    )
    assert out == [
        {"role": "system", "content": "SYS"},
        {"role": "user", "content": "hi"},
    ]


def test_to_openai_messages_no_system():
    out = llm_client._to_openai_messages(
        None, [{"role": "user", "content": "hi"}]
    )
    assert out == [{"role": "user", "content": "hi"}]


# --- sync adapter: Anthropic surface preserved -------------------------------


def test_sync_adapter_returns_content_text_and_maps_model():
    openai_mock = MagicMock()
    openai_mock.chat.completions.create.return_value = _fake_completion("hello world")
    adapter = llm_client._GeminiSyncAdapter(openai_mock)

    with patch.dict("os.environ", {"GEMINI_MODEL": "gemini-2.5-flash"}, clear=False):
        resp = adapter.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=800,
            temperature=0.7,
            system="be nice",
            messages=[{"role": "user", "content": "suggest"}],
            extra_headers={"Helicone-Auth": "Bearer x"},  # must be ignored
        )

    # Anthropic surface: response.content[0].text
    assert resp.content[0].text == "hello world"

    kwargs = openai_mock.chat.completions.create.call_args.kwargs
    assert kwargs["model"] == "gemini-2.5-flash"
    assert kwargs["max_tokens"] == 800
    assert kwargs["temperature"] == 0.7
    assert kwargs["messages"][0] == {"role": "system", "content": "be nice"}
    assert kwargs["messages"][1] == {"role": "user", "content": "suggest"}
    assert "extra_headers" not in kwargs  # Helicone header dropped on Gemini path


def test_sync_adapter_omits_temperature_when_unset():
    openai_mock = MagicMock()
    openai_mock.chat.completions.create.return_value = _fake_completion("x")
    adapter = llm_client._GeminiSyncAdapter(openai_mock)

    adapter.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system="s",
        messages=[{"role": "user", "content": "u"}],
    )
    kwargs = openai_mock.chat.completions.create.call_args.kwargs
    assert "temperature" not in kwargs  # fii/assistant must not get a default temp


def test_sync_adapter_none_content_becomes_empty_string():
    openai_mock = MagicMock()
    openai_mock.chat.completions.create.return_value = _fake_completion(None)
    adapter = llm_client._GeminiSyncAdapter(openai_mock)
    resp = adapter.messages.create(
        model="m", max_tokens=10, system=None, messages=[{"role": "user", "content": "u"}]
    )
    assert resp.content[0].text == ""


# --- async adapter: streaming surface preserved ------------------------------


@pytest.mark.asyncio
async def test_async_adapter_text_stream_yields_deltas():
    # Build an async iterator of OpenAI streaming chunks.
    def _chunk(text):
        ch = MagicMock()
        ch.choices = [MagicMock()]
        ch.choices[0].delta.content = text
        return ch

    chunks = [_chunk("Hel"), _chunk(None), _chunk("lo"), _chunk("")]

    async def _aiter():
        for c in chunks:
            yield c

    class _Stream:
        def __aiter__(self):
            return _aiter()

    async def _create(**_):
        return _Stream()

    openai_mock = MagicMock()
    openai_mock.chat.completions.create = _create
    adapter = llm_client._GeminiAsyncAdapter(openai_mock)

    collected = []
    async with adapter.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system="sys",
        messages=[{"role": "user", "content": "hi"}],
    ) as stream:
        async for text in stream.text_stream:
            collected.append(text)

    assert collected == ["Hel", "lo"]  # None/empty deltas skipped


# --- factory selection -------------------------------------------------------


def test_get_llm_client_gemini_returns_adapter(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "g-key")
    client = llm_client.get_llm_client(is_async=False)
    assert isinstance(client, llm_client._GeminiSyncAdapter)


def test_get_llm_client_gemini_async_returns_async_adapter(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "g-key")
    client = llm_client.get_llm_client(is_async=True)
    assert isinstance(client, llm_client._GeminiAsyncAdapter)


def test_get_llm_client_gemini_missing_key_returns_none(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert llm_client.get_llm_client(is_async=False) is None


def test_get_llm_client_anthropic_missing_key_returns_none(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert llm_client.get_llm_client(is_async=False) is None


# --- tool-calling: schema translation ----------------------------------------


def test_to_openai_tools_translates_schema():
    tools = [
        {
            "name": "get_x",
            "description": "desc",
            "input_schema": {"type": "object", "properties": {"a": {"type": "string"}}},
        }
    ]
    out = llm_client._to_openai_tools(tools)
    assert out == [
        {
            "type": "function",
            "function": {
                "name": "get_x",
                "description": "desc",
                "parameters": {"type": "object", "properties": {"a": {"type": "string"}}},
            },
        }
    ]


# --- tool-calling: response normalization ------------------------------------


def _fake_tool_completion(
    *, text=None, name="get_my_profile", args='{"a": 1}', finish="tool_calls"
):
    c = MagicMock()
    choice = MagicMock()
    choice.finish_reason = finish
    msg = MagicMock()
    msg.content = text
    tc = MagicMock()
    tc.id = "call_1"
    tc.function.name = name
    tc.function.arguments = args
    msg.tool_calls = [tc]  # a real list (isinstance check passes)
    choice.message = msg
    c.choices = [choice]
    return c


def test_completion_to_resp_parses_tool_use():
    resp = llm_client._completion_to_resp(_fake_tool_completion())
    assert resp.stop_reason == "tool_use"
    assert len(resp.content) == 1
    block = resp.content[0]
    assert block.type == "tool_use"
    assert block.id == "call_1"
    assert block.name == "get_my_profile"
    assert block.input == {"a": 1}


def test_completion_to_resp_text_plus_tool():
    resp = llm_client._completion_to_resp(_fake_tool_completion(text="thinking"))
    types = [b.type for b in resp.content]
    assert types == ["text", "tool_use"]
    assert resp.content[0].text == "thinking"


def test_completion_to_resp_bad_arguments_default_empty():
    resp = llm_client._completion_to_resp(_fake_tool_completion(args="not-json"))
    assert resp.content[0].input == {}


# --- tool-calling: sync create passes tools through --------------------------


def test_sync_create_forwards_tools_and_returns_tool_use():
    openai_mock = MagicMock()
    openai_mock.chat.completions.create.return_value = _fake_tool_completion()
    adapter = llm_client._GeminiSyncAdapter(openai_mock)

    resp = adapter.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=800,
        messages=[{"role": "user", "content": "u"}],
        tools=[{"name": "get_my_profile", "description": "d", "input_schema": {"type": "object"}}],
    )
    kwargs = openai_mock.chat.completions.create.call_args.kwargs
    assert kwargs["tool_choice"] == "auto"
    assert kwargs["tools"][0]["function"]["name"] == "get_my_profile"
    assert resp.content[0].type == "tool_use"


# --- tool-calling: round-trip translators ------------------------------------


def test_append_assistant_turn_gemini(monkeypatch):
    import json as _json

    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    resp = llm_client._Resp(
        [llm_client._Block(type="tool_use", id="c1", name="foo", input={"a": 1})],
        "tool_use",
    )
    messages: list = []
    llm_client.append_assistant_turn(messages, resp)
    assert messages[0]["role"] == "assistant"
    tc = messages[0]["tool_calls"][0]
    assert tc["id"] == "c1"
    assert tc["function"]["name"] == "foo"
    assert _json.loads(tc["function"]["arguments"]) == {"a": 1}


def test_append_assistant_turn_anthropic(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)  # default anthropic
    resp = llm_client._Resp([llm_client._Block(text="hi")], "end_turn")
    messages: list = []
    llm_client.append_assistant_turn(messages, resp)
    assert messages[0] == {"role": "assistant", "content": resp.content}


def test_append_tool_results_gemini(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    messages: list = []
    llm_client.append_tool_results(
        messages, [{"tool_use_id": "c1", "content": "{}", "is_error": False}]
    )
    assert messages == [{"role": "tool", "tool_call_id": "c1", "content": "{}"}]


def test_append_tool_results_anthropic(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)  # default anthropic
    messages: list = []
    llm_client.append_tool_results(
        messages, [{"tool_use_id": "c1", "content": "{}", "is_error": True}]
    )
    assert messages[0]["role"] == "user"
    block = messages[0]["content"][0]
    assert block["type"] == "tool_result"
    assert block["tool_use_id"] == "c1"
    assert block["is_error"] is True
