"""
Pydantic schemas for the Marriage Readiness Score endpoint.

Marriage Readiness is a user-controlled composite indicator (not ML) that
measures communication depth, profile completeness, and life goal clarity.
The user decides whether to display this score to others.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class MarriageReadinessRequest(BaseModel):
    user_id: str = Field(min_length=1)

    # Communication depth signals (last 30 days)
    avg_msg_count_per_conv: float = Field(
        ge=0,
        description="Average number of messages per conversation (last 30d)",
    )
    avg_msg_length: int = Field(
        ge=0,
        description="Average character length of user-sent messages",
    )

    # Profile completeness (0-100)
    profile_completeness: int = Field(ge=0, le=100)

    # Goal clarity — partner preference booleans
    age_pref_set: bool = Field(description="Age range preference is set (min + max)")
    religion_pref_set: bool = Field(description="Religion preference array is non-empty")
    distance_pref_set: bool = Field(description="max_distance_km is set")
    education_pref_set: bool = Field(description="Education preferences array is non-empty")
    lifestyle_pref_set: bool = Field(description="Lifestyle tags preference is non-empty")


class ReadinessDimensions(BaseModel):
    communication_depth: int = Field(ge=0, le=100)
    completeness: int = Field(ge=0, le=100)
    goal_clarity: int = Field(ge=0, le=100)


class MarriageReadinessResponse(BaseModel):
    user_id: str
    readiness_score: int = Field(ge=0, le=100)
    dimensions: ReadinessDimensions
    next_actions: list[str]
    version: str = "marriage-readiness-v1.0"
