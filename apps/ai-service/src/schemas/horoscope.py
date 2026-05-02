"""
Pydantic schemas for horoscope / Guna Milan endpoints.

Mirrors the Zod schemas in packages/schemas/src/matching.ts and the
TypeScript GunaResult interface in packages/types/src/matching.ts.
"""

from __future__ import annotations

from typing import Literal, Optional, Union

from pydantic import BaseModel, Field

ManglikStatus = Literal["YES", "NO", "PARTIAL"]


class HoroscopeProfile(BaseModel):
    """Horoscope details for a single person."""

    rashi: str = Field(..., description="Moon sign (Rashi), e.g. 'Mesha', 'Vrishabha'")
    nakshatra: str = Field(..., description="Birth star (Nakshatra), e.g. 'Ashwini'")
    manglik: Union[bool, ManglikStatus] = Field(
        ...,
        description="Manglik status. Accepts bool (legacy) or 'YES' | 'NO' | 'PARTIAL'.",
    )


class GunaInput(BaseModel):
    """Input for the Guna Milan calculation."""

    profile_a: HoroscopeProfile = Field(..., description="Groom (boy)")
    profile_b: HoroscopeProfile = Field(..., description="Bride (girl)")


class FactorDetail(BaseModel):
    """Per-factor detail returned by the calculator."""

    score: int
    max: int
    compatible: bool
    name: str
    name_hi: str
    domain: str
    meaning: str
    status: Literal["excellent", "good", "average", "low", "neutral"]
    boy_value: Optional[str] = None
    girl_value: Optional[str] = None
    axis: Optional[str] = None  # only for bhakoot


class GunaFactors(BaseModel):
    varna:        FactorDetail
    vashya:       FactorDetail
    tara:         FactorDetail
    yoni:         FactorDetail
    graha_maitri: FactorDetail
    gana:         FactorDetail
    bhakoot:      FactorDetail
    nadi:         FactorDetail


class ManglikDosha(BaseModel):
    boy_status: ManglikStatus
    girl_status: ManglikStatus
    conflict: bool
    cancelled: bool
    severity: Literal["none", "low", "medium", "high"]
    reason: str


class NadiDosha(BaseModel):
    same_nadi: bool
    dosha: bool
    cancelled: bool
    severity: Literal["none", "low", "medium", "high"]
    reason: str
    boy_nadi: Optional[str] = None
    girl_nadi: Optional[str] = None


class BhakootDosha(BaseModel):
    dosha: bool
    cancelled: bool
    severity: Literal["none", "low", "medium", "high"]
    axis: Optional[str] = None
    reason: str


class RajjuDosha(BaseModel):
    dosha: bool
    boy_rajju: Optional[str] = None
    girl_rajju: Optional[str] = None
    severity: Literal["none", "low", "medium", "high"]
    reason: str


class VedhaDosha(BaseModel):
    dosha: bool
    severity: Literal["none", "low", "medium", "high"]
    reason: str


class GanaDosha(BaseModel):
    dosha: bool
    cancelled: bool
    severity: Literal["none", "low", "medium", "high"]
    reason: str
    boy_gana: Optional[str] = None
    girl_gana: Optional[str] = None


class DoshaSummary(BaseModel):
    manglik: ManglikDosha
    nadi:    NadiDosha
    bhakoot: BhakootDosha
    rajju:   RajjuDosha
    vedha:   VedhaDosha
    gana:    GanaDosha


class MahendraYoga(BaseModel):
    present: bool
    count: Optional[int] = None
    reason: str


class StreeDeerghaYoga(BaseModel):
    present: bool
    count: Optional[int] = None
    reason: str


class YogasSummary(BaseModel):
    mahendra:      MahendraYoga
    stree_deergha: StreeDeerghaYoga


class DomainInsight(BaseModel):
    score: float
    label: Literal["excellent", "good", "average", "low"]
    summary: str


class InsightsSummary(BaseModel):
    mental:     DomainInsight
    physical:   DomainInsight
    prosperity: DomainInsight
    progeny:    DomainInsight
    longevity:  DomainInsight


class Remedy(BaseModel):
    code: str
    dosha: str
    name: str
    description: str
    severity: Literal["none", "low", "medium", "high"]


class GunaResultResponse(BaseModel):
    """Advanced Guna Milan result with doshas, yogas, insights and remedies."""

    total_score:           int
    max_score:             int
    percentage:            float
    factors:               GunaFactors
    doshas:                DoshaSummary
    yogas:                 YogasSummary
    insights:              InsightsSummary
    remedies:              list[Remedy]
    blocking_dosha:        bool
    mangal_dosha_conflict: bool  # legacy field
    interpretation:        Literal["Excellent match", "Good match", "Average match", "Not recommended"]
    recommendation:        str
