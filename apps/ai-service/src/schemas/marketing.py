"""
Marketing content generation schemas (Phase 6 Sprint J, Unit 6.4).

Request mirrors the Node.js api caller (marketing/content worker); response is
the exact GeneratedCampaignContent contract from packages/types/src/marketing.ts
— camelCase field names on the copy object are deliberate, they serialize
straight into campaign_content columns on the Node side.

Models live here (not in the router) per the src/schemas convention: the
service layer imports these too, and defining them in the router would create
a router ↔ service circular import.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class GenerateMarketingRequest(BaseModel):
    """Request to generate marketing copy for a campaign."""

    campaign_name: str = Field(..., description="Human-readable campaign name")
    description: str | None = Field(None, description="Campaign description/brief")
    segment_key: str = Field(..., description="Segment this campaign targets (e.g., 'new_incomplete_48h')")
    template_key: str = Field(..., description="Template/theme identifier (e.g., 'welcome_series')")
    conversion_goal: str = Field(default="ANY", description="Conversion goal (PROFILE_COMPLETED, BOOKING_CREATED, etc.)")
    brief: str | None = Field(None, description="Optional extra steering instructions")


class GeneratedCopy(BaseModel):
    """Marketing copy for one language."""

    subjectLine: str = Field(..., description="Email/SMS subject line")
    bodyShort: str = Field(..., description="Short version (SMS/push, ≤400 chars)")
    bodyLong: str = Field(..., description="Long version (email body)")
    ctaText: str = Field(..., description="Call-to-action button text")


class GenerateMarketingResponse(BaseModel):
    """Response from marketing content generation."""

    en: GeneratedCopy = Field(..., description="English copy")
    hi: GeneratedCopy = Field(..., description="Hindi copy (real Devanagari)")
    modelVersion: str = Field(..., description="LLM model version used (e.g., 'gemini-2.0')")
