"""
Pydantic schemas for horoscope / Guna Milan endpoints.

Mirrors the Zod schemas in packages/schemas/src/matching.ts.
"""

from pydantic import BaseModel, Field


class HoroscopeProfile(BaseModel):
    """Horoscope details for a single person."""

    rashi: str = Field(
        ...,
        description="Moon sign (Rashi) in North Indian naming, e.g. 'Mesha', 'Vrishabha'",
    )
    nakshatra: str = Field(
        ...,
        description="Birth star (Nakshatra), e.g. 'Ashwini', 'Rohini'",
    )
    manglik: bool = Field(
        ...,
        description="Whether the person has Mangal Dosha",
    )


class GunaInput(BaseModel):
    """Input for the Guna Milan calculation."""

    profile_a: HoroscopeProfile = Field(
        ...,
        description="Horoscope profile of the groom (boy)",
    )
    profile_b: HoroscopeProfile = Field(
        ...,
        description="Horoscope profile of the bride (girl)",
    )


class FactorDetail(BaseModel):
    """Score detail for a single Ashtakoot factor."""

    score: int
    max: int
    compatible: bool


class GunaFactors(BaseModel):
    """All 8 Ashtakoot factor scores."""

    varna:        FactorDetail
    vashya:       FactorDetail
    tara:         FactorDetail
    yoni:         FactorDetail
    graha_maitri: FactorDetail
    gana:         FactorDetail
    bhakoot:      FactorDetail
    nadi:         FactorDetail


class GunaResultResponse(BaseModel):
    """
    Guna Milan calculation result.
    snake_case keys align with standard JSON convention;
    the TypeScript frontend uses camelCase (grahaMaitri) after deserialization.
    """

    total_score:           int
    max_score:             int
    percentage:            float
    factors:               GunaFactors
    mangal_dosha_conflict: bool
    interpretation:        str
    recommendation:        str
