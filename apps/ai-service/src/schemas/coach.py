"""
Pydantic schemas for the Conversation Coach endpoint.

Route: POST /ai/coach/suggest
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ProfileSnapshot(BaseModel):
    """Lightweight profile snapshot sent by the API for coach context."""

    profile_id: str
    interests: list[str] = Field(default_factory=list)
    hobbies: list[str] = Field(default_factory=list)
    bio: str = ""
    occupation: str = ""
    city: str = ""


class Message(BaseModel):
    """A single message in the conversation history."""

    sender: Literal["A", "B"]
    text: str
    timestamp: str  # ISO 8601 format


class CoachRequest(BaseModel):
    """Request body for the conversation coach suggestion endpoint."""

    profile_a: ProfileSnapshot
    profile_b: ProfileSnapshot
    conversation_history: list[Message] = Field(default_factory=list)
    match_id: str


class CoachSuggestion(BaseModel):
    """A single AI-generated conversation suggestion."""

    text: str
    reason: str
    tone: Literal["warm", "curious", "light"]


class CoachResponse(BaseModel):
    """Response from the conversation coach endpoint."""

    suggestions: list[CoachSuggestion]
    state: Literal["STARTING", "ACTIVE", "COOLING"]
    cached: bool = False
