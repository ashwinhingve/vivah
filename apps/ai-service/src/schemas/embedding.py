"""Pydantic schemas for profile embedding generation.

The Node api sends the already-assembled, redaction-safe profile text (no
contact info) — the ai-service only turns text into a vector, it does not read
the DB. Response carries the vector + its dimension so the caller can assert the
column width before persisting.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class EmbeddingRequest(BaseModel):
    profile_id: str = Field(..., description="profiles.id — echoed back, not used to fetch data")
    text: str = Field(..., min_length=1, max_length=8000, description="Assembled profile text")


class EmbeddingResponse(BaseModel):
    profile_id: str
    embedding: list[float] = Field(default_factory=list)
    dims: int = Field(0, description="Length of embedding; 0 when the model is unavailable")
    available: bool = Field(True, description="False when the embedding model failed to load")
