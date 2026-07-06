"""Typed error hierarchy for the Matrimony AI Assistant agent loop.

Distinguishes the three failure classes the loop treats differently:

  ToolExecutionError    — a single tool call failed (network / non-2xx / bad
                          args). Isolated: becomes an ``is_error`` tool result
                          the model sees and can talk around ("I couldn't check
                          that right now"). Never aborts the turn.
  LlmProviderError      — the LLM call itself failed (auth / rate limit / net).
                          Top-level: surfaces an SSE ``error`` event to the user
                          instead of a fabricated answer. This is the class that
                          replaces the old silent MOCK_CHUNKS swallow.
  ToolBudgetExceededError — the model kept requesting tools past the round
                          budget. Logged; forces one final tools-suppressed answer.
"""

from __future__ import annotations


class AssistantError(Exception):
    """Base class for assistant agent-loop errors."""


class ToolExecutionError(AssistantError):
    """A single tool call failed — isolated to that tool's result."""

    def __init__(self, tool_name: str, message: str) -> None:
        self.tool_name = tool_name
        super().__init__(f"tool '{tool_name}' failed: {message}")


class LlmProviderError(AssistantError):
    """The upstream LLM provider call failed — surfaced to the user."""


class ToolBudgetExceededError(AssistantError):
    """The agent exceeded its per-turn tool-call round budget."""
