"""
Dynamic Pricing schemas (Phase 5 Tier 1).

Pydantic models for the deterministic pricing engine. Mirrors
packages/types/src/pricing.ts + packages/schemas/src/pricing.ts and
docs/adr/ADR-001-pricing-model.md. The Node api maps the snake_case wire
shape here onto the camelCase TS `PricingSuggestion` at its boundary.

No ML, no LLM — pure math. Money is integer paise (never float).
"""

from __future__ import annotations

from typing import Dict, Literal, Optional

from pydantic import BaseModel, Field, model_validator

# Mirror packages/types PricingFactor — the three dimensionless multipliers.
PricingFactor = Literal["MUHURAT", "OFFSEASON", "DEMAND"]


class PricingSuggestRequest(BaseModel):
    """
    One pricing-suggestion request for a single service line.

    `base_paise` is integer minor units (matches Money.paise bigint). Multipliers
    are dimensionless `double`. `override_paise`, when present, is the vendor's
    manually-set price — it still gets clamped into the vendor's own bounds.
    """

    base_paise: int = Field(ge=0, description="Base price, integer paise")
    currency: str = "INR"
    floor_multiplier: float = Field(gt=0, le=10)
    ceiling_multiplier: float = Field(gt=0, le=10)
    muhurat_multiplier: float = Field(default=1, gt=0, le=10)  # >= 1 in practice
    off_season_multiplier: float = Field(default=1, gt=0, le=10)  # <= 1 in practice
    # NOTE: demand is a STUB for v1 (see pricing_service.DEMAND_STUB). The field is
    # accepted for forward-compatibility but the engine ignores it until real
    # booking-density data exists post-launch.
    demand_multiplier: float = Field(default=1, gt=0, le=10)
    override_paise: Optional[int] = Field(default=None, ge=0)
    # Optional passthrough for caller correlation (mirrors PricingSuggestion).
    rule_id: Optional[str] = None
    profile_id: Optional[str] = None

    @model_validator(mode="after")
    def _ceiling_ge_floor(self) -> "PricingSuggestRequest":
        # Mirrors the Zod .refine() in packages/schemas/src/pricing.ts.
        if self.ceiling_multiplier < self.floor_multiplier:
            raise ValueError("ceiling_multiplier must be >= floor_multiplier")
        return self


class PricingSuggestResponse(BaseModel):
    """
    Deterministic advisor output. Always overridable; the UI MUST render the
    bilingual explanation so pricing never reads as surge (ADR-001).
    """

    base_paise: int
    currency: str
    applied_factors: Dict[PricingFactor, float]
    raw_multiplier: float  # product of factors, pre-clamp
    clamped_multiplier: float  # after floor/ceiling clamp
    floor_paise: int  # base_paise * floor_multiplier (rounded)
    ceiling_paise: int  # base_paise * ceiling_multiplier (rounded)
    suggested_paise: int  # final price — never outside [floor_paise, ceiling_paise]
    clamp_hit: bool  # True when the clamp changed the multiplier
    overridable: Literal[True] = True
    override_applied: bool  # True when override_paise drove the suggestion
    explanation_en: str
    explanation_hi: str
