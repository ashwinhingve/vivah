"""Shared LLM client factory with an env-driven provider switch.

Lets every AI feature run on either Anthropic Claude (default) or Google
Gemini (a free, OpenAI-compatible endpoint) chosen purely by the
``LLM_PROVIDER`` env var — flip back to Claude with no code change.

Why an adapter: the four feature services
(coach / dpi / fii / assistant) all talk to the **Anthropic client
surface** — sync ``client.messages.create(...)`` returning
``response.content[0].text``, and async
``async with client.messages.stream(...) as s: async for t in s.text_stream``.
For Gemini we wrap the OpenAI SDK in adapters that expose that exact
surface, so the call-sites (and their tests, which inject mock clients)
stay byte-for-byte identical.

Env vars:
    LLM_PROVIDER       "anthropic" (default) | "gemini"
    ANTHROPIC_API_KEY  required when provider=anthropic
    HELICONE_API_KEY   optional Helicone proxy (anthropic path only)
    GEMINI_API_KEY     required when provider=gemini
    GEMINI_MODEL       Gemini model for coach/fii/assistant (default gemini-2.5-flash)
    GEMINI_MODEL_OPUS  Gemini model mapped from claude-opus-* (default gemini-2.5-pro)
    GEMINI_BASE_URL    optional override of the Google OpenAI-compatible endpoint

Verification status:
    Everything in this module is unit-tested with a mocked OpenAI client
    (see tests/test_llm_client.py): adapter surface, model mapping,
    system-message conversion, temperature pass-through, provider selection,
    and the mock-fallback (None) behavior when a key is absent.

    The ONE thing that cannot be verified without a live credential is a real
    round-trip: set LLM_PROVIDER=gemini + a valid GEMINI_API_KEY and confirm
    ``get_llm_client(is_async=False).messages.create(...)`` actually reaches
    Google's OpenAI-compatible endpoint and returns text. There is no way to
    exercise that path in CI without a paid/free live key.
"""

from __future__ import annotations

import json
import os
from typing import Any

import structlog

log = structlog.get_logger(__name__)

_GEMINI_DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

# Sentinel so we can tell "temperature not passed" (fii/assistant) apart from
# an explicit temperature=0.0.
_UNSET = object()


def _provider() -> str:
    return os.getenv("LLM_PROVIDER", "anthropic").strip().lower()


def llm_api_key_present() -> bool:
    """True when the currently-selected provider has its API key configured.

    Used by the services' mock-fallback pre-checks so that running on Gemini
    (with no ANTHROPIC_API_KEY) does not wrongly force mock output.
    """
    if _provider() == "gemini":
        return bool(os.getenv("GEMINI_API_KEY", "").strip())
    return bool(os.getenv("ANTHROPIC_API_KEY", "").strip())


def _map_model(claude_model: str) -> str:
    """Map an incoming Claude model id to the configured Gemini model id."""
    if "opus" in (claude_model or "").lower():
        return os.getenv("GEMINI_MODEL_OPUS", "gemini-2.5-pro")
    return os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


def _to_openai_messages(system: str | None, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Anthropic shape (system kwarg + messages) -> OpenAI messages array.

    Plain turns carry just ``role``/``content``. Tool round-trip messages
    (assistant-with-``tool_calls`` and ``role:"tool"`` results, produced by
    ``append_assistant_turn``/``append_tool_results`` on the Gemini path) are
    already OpenAI-shaped and pass through untouched.
    """
    out: list[dict[str, Any]] = []
    if system:
        out.append({"role": "system", "content": system})
    for m in messages:
        if "tool_calls" in m or m.get("role") == "tool":
            out.append(m)
        else:
            out.append({"role": m["role"], "content": m.get("content", "")})
    return out


def _to_openai_tools(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Canonical (Anthropic) tool schema -> OpenAI function-tool schema.

    Input: ``{"name", "description", "input_schema": <JSON Schema>}``.
    Output: ``{"type": "function", "function": {"name", "description", "parameters"}}``.
    """
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": t.get("input_schema", {"type": "object", "properties": {}}),
            },
        }
        for t in tools
    ]


_FINISH_REASON_MAP = {
    "tool_calls": "tool_use",
    "stop": "end_turn",
    "length": "max_tokens",
    "content_filter": "end_turn",
}


def _map_finish_reason(reason: str | None) -> str:
    """OpenAI ``finish_reason`` -> Anthropic ``stop_reason``."""
    return _FINISH_REASON_MAP.get(reason or "stop", "end_turn")


def _completion_to_resp(completion: Any) -> "_Resp":
    """Normalize an OpenAI ChatCompletion into the Anthropic response surface.

    Emits a ``_Resp`` whose ``.content`` is a list of ``_Block``s: at most one
    text block plus one ``tool_use`` block per ``message.tool_calls`` entry, and
    a ``.stop_reason`` mapped from ``finish_reason`` (``"tool_use"`` whenever any
    tool call is present). Mirrors what the real Anthropic SDK returns, so the
    agent loop reads both providers with identical block-walking code.
    """
    choice = completion.choices[0]
    msg = choice.message
    blocks: list[_Block] = []
    text = getattr(msg, "content", None) or ""
    if text:
        blocks.append(_Block(text))
    # OpenAI returns a list (or None). Guard against MagicMock auto-attrs in
    # tests and any non-list so a text-only completion never mis-parses.
    tool_calls = getattr(msg, "tool_calls", None)
    if not isinstance(tool_calls, list):
        tool_calls = []
    for tc in tool_calls:
        try:
            args = json.loads(tc.function.arguments or "{}")
        except (json.JSONDecodeError, TypeError):
            args = {}
        blocks.append(_Block(type="tool_use", id=tc.id, name=tc.function.name, input=args))
    if not blocks:
        blocks.append(_Block(""))
    finish = getattr(choice, "finish_reason", None)
    stop_reason = "tool_use" if tool_calls else _map_finish_reason(finish)
    return _Resp(blocks, stop_reason)


# --- Anthropic-surface response shims (so `.content[0].text` keeps working) ---


class _Block:
    """Anthropic-style content block. ``type`` is ``"text"`` or ``"tool_use"``.

    Legacy callers construct ``_Block("some text")`` positionally; tool-use
    blocks use the keyword form ``_Block(type="tool_use", id=..., name=...,
    input=...)``. Attribute names match the real Anthropic SDK blocks so the
    agent loop can walk either provider's ``response.content`` identically.
    """

    __slots__ = ("type", "text", "id", "name", "input")

    def __init__(
        self,
        text: str = "",
        *,
        type: str = "text",
        id: str | None = None,
        name: str | None = None,
        input: dict[str, Any] | None = None,
    ) -> None:
        self.type = type
        self.text = text
        self.id = id
        self.name = name
        self.input = input


class _Resp:
    """Anthropic-style response: ``.content`` list of ``_Block`` + ``.stop_reason``.

    Accepts either a plain string (legacy single-text-block path, keeps
    ``coach``/``dpi``/``fii`` byte-for-byte unchanged) or a pre-built list of
    ``_Block``s (tool-calling path).
    """

    __slots__ = ("content", "stop_reason")

    def __init__(self, content: Any, stop_reason: str = "end_turn") -> None:
        self.content = [_Block(content)] if isinstance(content, str) else content
        self.stop_reason = stop_reason


# --- Gemini (OpenAI-compatible) adapters mimicking the Anthropic client ---


class _GeminiMessages:
    def __init__(self, openai_client: Any) -> None:
        self._client = openai_client

    def create(
        self,
        *,
        model: str,
        max_tokens: int,
        system: str | None = None,
        messages: list[dict[str, Any]] | None = None,
        temperature: Any = _UNSET,
        tools: list[dict[str, Any]] | None = None,
        tool_choice: Any = None,
        extra_headers: dict[str, str] | None = None,  # Helicone — ignored on Gemini path
        **_: Any,
    ) -> _Resp:
        kwargs: dict[str, Any] = {
            "model": _map_model(model),
            "max_tokens": max_tokens,
            "messages": _to_openai_messages(system, messages or []),
        }
        if temperature is not _UNSET:
            kwargs["temperature"] = temperature
        if tools:
            kwargs["tools"] = _to_openai_tools(tools)
            kwargs["tool_choice"] = tool_choice or "auto"
        completion = self._client.chat.completions.create(**kwargs)
        return _completion_to_resp(completion)


class _GeminiSyncAdapter:
    def __init__(self, openai_client: Any) -> None:
        self.messages = _GeminiMessages(openai_client)


class _GeminiStreamCtx:
    """Async context manager mirroring ``client.messages.stream(...)``."""

    def __init__(self, openai_client: Any, kwargs: dict[str, Any]) -> None:
        self._client = openai_client
        self._kwargs = kwargs

    async def __aenter__(self) -> "_GeminiStreamCtx":
        return self

    async def __aexit__(self, *exc: Any) -> bool:
        return False

    @property
    def text_stream(self) -> Any:
        async def _gen() -> Any:
            stream = await self._client.chat.completions.create(stream=True, **self._kwargs)
            async for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                text = getattr(delta, "content", None)
                if text:
                    yield text

        return _gen()


class _GeminiAsyncMessages:
    def __init__(self, openai_client: Any) -> None:
        self._client = openai_client

    async def create(
        self,
        *,
        model: str,
        max_tokens: int,
        system: str | None = None,
        messages: list[dict[str, Any]] | None = None,
        temperature: Any = _UNSET,
        tools: list[dict[str, Any]] | None = None,
        tool_choice: Any = None,
        extra_headers: dict[str, str] | None = None,  # Helicone — ignored on Gemini path
        **_: Any,
    ) -> _Resp:
        """Non-streaming async completion — mirrors ``AsyncAnthropic.messages.create``.

        Used by the assistant agent loop for every tool-decision round (and the
        final answer), so tool-calling stays symmetric across providers.
        """
        kwargs: dict[str, Any] = {
            "model": _map_model(model),
            "max_tokens": max_tokens,
            "messages": _to_openai_messages(system, messages or []),
        }
        if temperature is not _UNSET:
            kwargs["temperature"] = temperature
        if tools:
            kwargs["tools"] = _to_openai_tools(tools)
            kwargs["tool_choice"] = tool_choice or "auto"
        completion = await self._client.chat.completions.create(**kwargs)
        return _completion_to_resp(completion)

    def stream(
        self,
        *,
        model: str,
        max_tokens: int,
        system: str | None = None,
        messages: list[dict[str, Any]] | None = None,
        temperature: Any = _UNSET,
        extra_headers: dict[str, str] | None = None,  # Helicone — ignored on Gemini path
        **_: Any,
    ) -> _GeminiStreamCtx:
        kwargs: dict[str, Any] = {
            "model": _map_model(model),
            "max_tokens": max_tokens,
            "messages": _to_openai_messages(system, messages or []),
        }
        if temperature is not _UNSET:
            kwargs["temperature"] = temperature
        return _GeminiStreamCtx(self._client, kwargs)


class _GeminiAsyncAdapter:
    def __init__(self, openai_client: Any) -> None:
        self.messages = _GeminiAsyncMessages(openai_client)


# --- Public factory ---


def _build_anthropic(is_async: bool) -> Any | None:
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        log.error(
            "anthropic_api_key_missing",
            hint="set ANTHROPIC_API_KEY in Railway env; service falls back to mock output",
        )
        return None
    try:
        import anthropic

        helicone_api_key = os.getenv("HELICONE_API_KEY", "").strip()
        ctor = anthropic.AsyncAnthropic if is_async else anthropic.Anthropic
        if helicone_api_key:
            return ctor(
                api_key=api_key,
                base_url="https://anthropic.helicone.ai",
                default_headers={"Helicone-Auth": f"Bearer {helicone_api_key}"},
            )
        return ctor(api_key=api_key)
    except Exception as exc:  # noqa: BLE001
        log.warning("anthropic_init_failed", error=str(exc))
        return None


def _build_gemini(is_async: bool) -> Any | None:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        log.error(
            "gemini_api_key_missing",
            hint="set GEMINI_API_KEY (LLM_PROVIDER=gemini); service falls back to mock output",
        )
        return None
    try:
        import openai

        base_url = os.getenv("GEMINI_BASE_URL", _GEMINI_DEFAULT_BASE_URL)
        if is_async:
            client = openai.AsyncOpenAI(api_key=api_key, base_url=base_url)
            return _GeminiAsyncAdapter(client)
        client = openai.OpenAI(api_key=api_key, base_url=base_url)
        return _GeminiSyncAdapter(client)
    except Exception as exc:  # noqa: BLE001
        log.warning("gemini_init_failed", error=str(exc))
        return None


def get_llm_client(*, is_async: bool) -> Any | None:
    """Return an LLM client exposing the Anthropic surface.

    Provider chosen by ``LLM_PROVIDER``. Returns ``None`` when the selected
    provider's API key is missing or the SDK fails to init, so callers fall
    back to mock output exactly as before.
    """
    if _provider() == "gemini":
        return _build_gemini(is_async)
    return _build_anthropic(is_async)


# --- Tool round-trip helpers (provider-branching, operate on the message list) ---
#
# Anthropic and OpenAI-compat structurally disagree on how a tool call and its
# result are threaded back into the conversation. These two functions hide that
# divergence so the agent loop appends turns without knowing the provider.
#   Anthropic : assistant turn carries tool_use content blocks; results come
#               back as ONE user turn whose content is a list of tool_result
#               blocks keyed by tool_use_id.
#   OpenAI    : assistant turn carries a `tool_calls` array; results come back
#               as ONE separate {role:"tool"} message PER call, keyed by
#               tool_call_id.


def append_assistant_turn(messages: list[dict[str, Any]], response: Any) -> None:
    """Append the model's (tool-calling) assistant turn to ``messages`` in place."""
    if _provider() == "gemini":
        text_parts: list[str] = []
        tool_calls: list[dict[str, Any]] = []
        for block in response.content:
            if getattr(block, "type", "text") == "tool_use":
                tool_calls.append(
                    {
                        "id": block.id,
                        "type": "function",
                        "function": {
                            "name": block.name,
                            "arguments": json.dumps(block.input or {}, ensure_ascii=False),
                        },
                    }
                )
            elif getattr(block, "text", ""):
                text_parts.append(block.text)
        msg: dict[str, Any] = {"role": "assistant", "content": "".join(text_parts) or None}
        if tool_calls:
            msg["tool_calls"] = tool_calls
        messages.append(msg)
    else:
        # Anthropic accepts its own returned content blocks back verbatim.
        messages.append({"role": "assistant", "content": response.content})


def append_tool_results(messages: list[dict[str, Any]], results: list[dict[str, Any]]) -> None:
    """Append tool results to ``messages`` in place.

    Each result: ``{"tool_use_id": str, "content": str, "is_error": bool}``.
    """
    if _provider() == "gemini":
        for r in results:
            messages.append(
                {"role": "tool", "tool_call_id": r["tool_use_id"], "content": r["content"]}
            )
    else:
        blocks: list[dict[str, Any]] = []
        for r in results:
            block: dict[str, Any] = {
                "type": "tool_result",
                "tool_use_id": r["tool_use_id"],
                "content": r["content"],
            }
            if r.get("is_error"):
                block["is_error"] = True
            blocks.append(block)
        messages.append({"role": "user", "content": blocks})
