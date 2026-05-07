"""
FII (Family Inclination Index) Pydantic schemas.

FiiSignals  — raw 0-100 input fields per profile
FiiProfileScore — computed score, label, and per-dimension breakdown
FiiCompatibilityRequest — pair of signals + flags
FiiCompatibilityResponse — full result envelope
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# Ordered low → high family inclination
FII_LABELS = [
    "Independent",
    "Independent-Leaning",
    "Balanced",
    "Family-Oriented",
    "Family-First",
]

COMPAT_LABELS = [
    "Highly Aligned",
    "Mostly Aligned",
    "Worth Discussing",
    "Different Outlooks",
]


class FiiSignals(BaseModel):
    """Seven weighted signals — each 0 (low family inclination) to 100 (high)."""

    joint_family_preference: int = Field(ge=0, le=100)
    parents_living_with: int = Field(ge=0, le=100)
    family_decision_involvement: int = Field(ge=0, le=100)
    family_events_priority: int = Field(ge=0, le=100)
    siblings_relationship_strength: int = Field(ge=0, le=100)
    religious_practice_with_family: int = Field(ge=0, le=100)
    geographic_proximity_to_family: int = Field(ge=0, le=100)


class FiiProfileScore(BaseModel):
    """Computed FII score for one profile."""

    score: int = Field(ge=0, le=100)
    label: str
    breakdown: dict[str, int]


class FiiCompatibilityRequest(BaseModel):
    """Request body for POST /ai/fii/compatibility."""

    profile_a: FiiSignals
    profile_b: FiiSignals
    profile_a_name: str = Field(default="", max_length=100)
    profile_b_name: str = Field(default="", max_length=100)
    use_llm_narrative: bool = Field(default=False)


class FiiCompatibilityResponse(BaseModel):
    """Full compatibility result returned to the caller."""

    profile_a_score: FiiProfileScore
    profile_b_score: FiiProfileScore
    delta: int
    compatibility: str
    compatibility_color: str
    narrative: str
    discussion_starter: str
    narrative_source: Literal["template", "sonnet"]
