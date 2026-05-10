"""
FAQ (Function Attendance Quotient) schemas.

Pydantic models for request/response validation.
Predicts per-guest attendance probability per ceremony.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

RelationshipType = Literal["close_family", "extended_family", "friend", "colleague"]
RsvpResponse = Literal["yes", "no", "maybe", "pending"]
CeremonyType = Literal["sangeet", "mehndi", "wedding", "reception"]
ConfidenceBand = Literal["high", "medium", "low"]


class FaqInput(BaseModel):
    relationship_type: RelationshipType
    distance_km: float = Field(ge=0)
    rsvp_response: RsvpResponse
    ceremony_type: CeremonyType
    historical_attendance_rate: Optional[float] = Field(default=None, ge=0, le=1)


class FaqRequest(BaseModel):
    guest_id: str
    ceremony_id: str
    features: FaqInput


class FaqContribution(BaseModel):
    feature: str
    value: float
    contribution: float


class FaqResponse(BaseModel):
    guest_id: str
    ceremony_id: str
    predicted_probability: float
    confidence_band: ConfidenceBand
    feature_contributions: List[FaqContribution]
    model_version: str
