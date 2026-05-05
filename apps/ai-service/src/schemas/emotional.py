"""
Pydantic schemas for Emotional Score request/response.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class EmotionalMessage(BaseModel):
    sender: Literal["A", "B"]
    text: str
    timestamp: str  # ISO format


class EmotionalScoreRequest(BaseModel):
    match_id: str
    messages: list[EmotionalMessage] = Field(default_factory=list)
    historical_avg: float | None = Field(
        default=None, description="7-day rolling avg, optional"
    )


class EmotionalBreakdown(BaseModel):
    sentiment: int   # 0-100
    enthusiasm: int  # 0-100
    engagement: int  # 0-100
    curiosity: int   # 0-100


class EmotionalScoreResponse(BaseModel):
    score: int                                        # 0-100, weighted combined
    label: Literal["WARM", "STEADY", "COOLING"]
    trend: Literal["improving", "stable", "declining"]
    breakdown: EmotionalBreakdown
    last_updated: str                                 # ISO timestamp
