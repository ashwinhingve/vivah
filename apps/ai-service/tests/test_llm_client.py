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
