"""Reverse HTTP client: ai-service -> Node api internal tool bridge.

The assistant agent loop runs in this Python service, but the authoritative,
user-authorized data lives behind the Node api (which owns Postgres/Mongo/Redis
and the userId->profileId resolution + per-user filtering). ai-service has no
Postgres access of its own, so every tool call bridges back over HTTP to
``POST {API_BASE_URL}/internal/assistant/tool`` — authenticated with the same
shared ``AI_SERVICE_INTERNAL_KEY`` the api already uses to call us.

Lazy-singleton ``httpx.AsyncClient`` mirrors the ``_get_mongo`` pattern in
assistant_service.py so we reuse one connection pool across tool calls.
"""

from __future__ import annotations

import os
from typing import Any

import httpx
import structlog

from src.services.assistant_errors import ToolExecutionError

log = structlog.get_logger("assistant-api-client")

_client: httpx.AsyncClient | None = None

# One tool call must never hang the turn: the whole agent loop is itself bounded
# by asyncio.wait_for in stream_chat, but per-call timeouts fail fast + cleanly.
_TOOL_TIMEOUT_SEC = 8.0


def _api_base_url() -> str:
    return os.getenv("API_BASE_URL", "http://localhost:4000").rstrip("/")


def _internal_key() -> str:
    # Accept either name — the api validates AI_SERVICE_INTERNAL_KEY; some envs
    # only set AI_SERVICE_API_KEY. Prefer the internal-key name.
    return os.getenv("AI_SERVICE_INTERNAL_KEY") or os.getenv("AI_SERVICE_API_KEY") or ""


def get_api_client() -> httpx.AsyncClient:
    """Return a lazy-initialized shared AsyncClient."""
    global _client  # noqa: PLW0603
    if _client is None:
        _client = httpx.AsyncClient(timeout=_TOOL_TIMEOUT_SEC)
    return _client


async def call_tool(
    *,
    user_id: str,
    profile_id: str,
    tool_name: str,
    args: dict[str, Any],
) -> Any:
    """Invoke a single assistant tool via the Node api internal bridge.

    Returns the tool's ``data`` payload on success. Raises ToolExecutionError on
    transport failure, non-2xx, or an ``{success:false}`` envelope — the agent
    loop catches this and feeds the model an honest ``is_error`` result rather
    than fabricating an answer.
    """
    client = get_api_client()
    url = f"{_api_base_url()}/internal/assistant/tool"
    try:
        resp = await client.post(
            url,
            headers={"X-Internal-Key": _internal_key()},
            json={
                "userId": user_id,
                "profileId": profile_id,
                "toolName": tool_name,
                "args": args or {},
            },
        )
    except httpx.HTTPError as exc:
        log.warning("tool_bridge_transport_error", tool=tool_name, error=str(exc))
        raise ToolExecutionError(tool_name, "bridge unreachable") from exc

    if resp.status_code >= 400:
        # 4xx/5xx from the bridge — includes authz 403 and TOOL_NOT_FOUND 400.
        log.warning("tool_bridge_http_error", tool=tool_name, status=resp.status_code)
        raise ToolExecutionError(tool_name, f"bridge returned {resp.status_code}")

    try:
        body = resp.json()
    except ValueError as exc:
        raise ToolExecutionError(tool_name, "bridge returned non-JSON") from exc

    if not body.get("success", False):
        code = (body.get("error") or {}).get("code", "UNKNOWN")
        raise ToolExecutionError(tool_name, f"bridge error {code}")

    return body.get("data")


async def aclose() -> None:
    """Close the shared client (used by tests / graceful shutdown)."""
    global _client  # noqa: PLW0603
    if _client is not None:
        await _client.aclose()
        _client = None
