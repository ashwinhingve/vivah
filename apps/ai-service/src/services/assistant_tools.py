"""Tool catalog for the Matrimony AI Assistant agent loop.

Each tool is declared in the canonical (Anthropic) schema shape
``{name, description, input_schema}`` — ``llm_client._to_openai_tools`` rewrites
it for the Gemini/OpenAI-compat path, so ONE catalog serves both providers.

Every tool maps 1:1 to an entry in the Node api tool registry
(``apps/api/src/services/assistantTools.ts``) and executes via the internal
bridge (``api_client.call_tool``). The api re-resolves userId->profileId and
runs an already-authorized service function, so a tool can only ever read the
authenticated caller's own data, with contact info already masked.

The assistant is READ-ONLY: no tool here mutates state.
"""

from __future__ import annotations

import json
import os
from typing import Any

import structlog

from src.services.api_client import call_tool
from src.services.assistant_errors import ToolExecutionError

log = structlog.get_logger("assistant-tools")

# Keep tool results from blowing the context window. Truncation is flagged so
# the model knows the payload was clipped.
_MAX_RESULT_CHARS = 6000


def _wedding_id_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "wedding_id": {
                "type": "string",
                "description": "The wedding's id, obtained from a prior list_weddings call.",
            }
        },
        "required": ["wedding_id"],
    }


# Canonical tool schemas. Order is presentation-only.
_CORE_TOOLS: list[dict[str, Any]] = [
    {
        "name": "get_my_profile",
        "description": (
            "Get the authenticated user's own matrimonial profile: completeness %, "
            "premium tier, verification status, key personal/education/career/family "
            "fields, and which profile sections are still incomplete. Use for any "
            "question about the user's own profile or what to fill in next."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_my_matches",
        "description": (
            "Get the user's top compatibility matches (masked names + match score %). "
            "Use for 'who are my best matches', 'show my matches', ranking questions."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_pending_requests",
        "description": (
            "Get the user's match requests. direction='received' for requests others "
            "sent them (default), 'sent' for requests they sent out. Returns counts + "
            "masked summaries."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "direction": {
                    "type": "string",
                    "enum": ["received", "sent"],
                    "description": "Which side of the request list to fetch. Default 'received'.",
                }
            },
        },
    },
    {
        "name": "get_who_liked_me",
        "description": (
            "Get the list/count of people who have liked (sent a pending request to) "
            "the user. Use for 'who liked me', 'how many likes do I have'."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_match_status",
        "description": (
            "Get the match/request status between the user and one other profile. "
            "other_profile_id MUST come from a prior tool result (e.g. get_my_matches); "
            "never invent one."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "other_profile_id": {
                    "type": "string",
                    "description": "The other party's profile id from a prior tool result.",
                }
            },
            "required": ["other_profile_id"],
        },
    },
    {
        "name": "list_conversations",
        "description": (
            "List the user's chat conversations (masked participant name, last-message "
            "preview, per-conversation unread count). Use for 'my chats/messages'."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_unread_count",
        "description": (
            "Get the user's total number of unread chat messages across all "
            "conversations. Use for 'do I have unread messages', 'how many unread'."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "list_weddings",
        "description": (
            "List the weddings the user owns or collaborates on (id, title, date, "
            "status, planning progress). Call this first to get a wedding_id for the "
            "budget/tasks/ceremonies tools."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_wedding_budget",
        "description": (
            "Get a wedding's budget summary: total, allocated, spent, and "
            "per-category breakdown."
        ),
        "input_schema": _wedding_id_schema(),
    },
    {
        "name": "get_wedding_tasks",
        "description": (
            "Get a wedding's task board: tasks grouped by status, with due "
            "dates and assignees."
        ),
        "input_schema": _wedding_id_schema(),
    },
    {
        "name": "get_wedding_ceremonies",
        "description": (
            "Get the ceremonies/events planned for a wedding (name, date, "
            "venue, timing)."
        ),
        "input_schema": _wedding_id_schema(),
    },
    {
        "name": "suggest_muhurat_dates",
        "description": (
            "Suggest auspicious Hindu wedding (vivah muhurat) dates near a target date. "
            "wedding_date is an ISO date (YYYY-MM-DD)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "wedding_date": {
                    "type": "string",
                    "description": "Target wedding date, ISO format YYYY-MM-DD.",
                }
            },
            "required": ["wedding_date"],
        },
    },
]


# Semantic 'find similar matches' — pgvector-backed, gated (P1). Only exposed
# when the api-side embedding path is enabled, so P0 ships with zero embedding
# dependency.
_SEMANTIC_TOOL: dict[str, Any] = {
    "name": "find_similar_matches",
    "description": (
        "Find profiles semantically similar to the user's (shared interests / life "
        "goals / values) using vector search, still filtered by mutual preferences "
        "and blocks. Returns masked candidates with a descriptive similarity label, "
        "NOT the official match score. Use for 'find people like me', 'similar profiles'."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "limit": {
                "type": "integer",
                "minimum": 1,
                "maximum": 10,
                "description": "How many similar profiles to return (default 5).",
            }
        },
    },
}


def _semantic_enabled() -> bool:
    return os.getenv("ASSISTANT_SEMANTIC_SEARCH_ENABLED", "false").strip().lower() == "true"


def get_tool_schemas() -> list[dict[str, Any]]:
    """Return the active tool catalog (semantic tool included only when enabled)."""
    tools = list(_CORE_TOOLS)
    if _semantic_enabled():
        tools.append(_SEMANTIC_TOOL)
    return tools


def get_tool_names() -> set[str]:
    """Allowlist of dispatchable tool names."""
    return {t["name"] for t in get_tool_schemas()}


def _truncate(text: str) -> str:
    if len(text) <= _MAX_RESULT_CHARS:
        return text
    return text[:_MAX_RESULT_CHARS] + "\n…[truncated]"


async def execute_tool_call(
    tool_use: Any,
    *,
    user_id: str,
    profile_id: str,
) -> dict[str, Any]:
    """Execute one ``tool_use`` block and return a normalized tool-result dict.

    Result shape (fed to ``llm_client.append_tool_results``):
        ``{"tool_use_id": str, "name": str, "content": str, "is_error": bool}``

    Failures are ISOLATED — a bad/unavailable tool yields ``is_error=True`` with
    a short JSON error the model can gracefully explain, never an exception that
    aborts the whole turn.
    """
    name = getattr(tool_use, "name", None) or ""
    tool_use_id = getattr(tool_use, "id", None) or ""
    args = getattr(tool_use, "input", None) or {}

    if name not in get_tool_names():
        log.warning("tool_not_allowed", tool=name)
        return {
            "tool_use_id": tool_use_id,
            "name": name,
            "content": json.dumps({"error": "unknown_tool"}),
            "is_error": True,
        }

    try:
        data = await call_tool(
            user_id=user_id, profile_id=profile_id, tool_name=name, args=args
        )
        content = _truncate(json.dumps(data, ensure_ascii=False, default=str))
        log.info("tool_call_complete", tool=name)
        return {
            "tool_use_id": tool_use_id,
            "name": name,
            "content": content,
            "is_error": False,
        }
    except ToolExecutionError as exc:
        log.warning("tool_call_failed", tool=name, error=str(exc))
        return {
            "tool_use_id": tool_use_id,
            "name": name,
            "content": json.dumps({"error": "tool_temporarily_unavailable"}),
            "is_error": True,
        }
