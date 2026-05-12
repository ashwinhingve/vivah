"""
Pydantic schemas for the Profile Optimizer endpoint.

Profile Optimizer is a rule-based scorer (no ML) that evaluates
photo quality, bio strength, and profile completeness, then returns
actionable field-level suggestions to guide the user in improving
their profile.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ProfileOptimizerRequest(BaseModel):
    user_id: str = Field(min_length=1)
    photo_count: int = Field(ge=0, description="Total primary + secondary photos")
    has_primary_photo: bool = Field(description="True if a primary photo is set")
    bio_text: str = Field(default="", description="User bio text from MongoDB")
    profile_completeness: int = Field(ge=0, le=100, description="Profile completeness 0-100")


class FieldSuggestion(BaseModel):
    field: str
    score: int = Field(ge=0, le=100)
    priority: int = Field(ge=1, description="1=highest priority")
    suggestion: str


class DimensionScores(BaseModel):
    photo_score: int = Field(ge=0, le=100)
    bio_score: int = Field(ge=0, le=100)
    completeness_score: int = Field(ge=0, le=100)


class ProfileOptimizerResponse(BaseModel):
    user_id: str
    overall_score: int = Field(ge=0, le=100)
    tier: Literal["excellent", "good", "needs_work", "incomplete"]
    dimensions: DimensionScores
    field_suggestions: list[FieldSuggestion]
    version: str = "profile-optimizer-v1.0"
