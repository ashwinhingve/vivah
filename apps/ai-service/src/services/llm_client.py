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
"""

from __future__ import annotations

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


def _to_openai_messages(system: str | None, messages: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Anthropic shape (system kwarg + messages) -> OpenAI messages array.

    All call-sites pass plain-string ``content``, so no content-block
    flattening is needed.
    """
    out: list[dict[str, str]] = []
    if system:
        out.append({"role": "system", "content": system})
    for m in messages:
        out.append({"role": m["role"], "content": m["content"]})
    return out


# --- Anthropic-surface response shims (so `.content[0].text` keeps working) ---


class _Block:
    __slots__ = ("text",)

    def __init__(self, text: str) -> None:
        self.text = text


class _Resp:
    __slots__ = ("content",)

    def __init__(self, text: str) -> None:
        self.content = [_Block(text)]


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
        completion = self._client.chat.completions.create(**kwargs)
        text = completion.choices[0].message.content or ""
        return _Resp(text)


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
