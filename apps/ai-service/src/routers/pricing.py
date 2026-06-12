"""
Dynamic Pricing router (Phase 5 Tier 1).

Routes:
  POST /ai/pricing/suggest   -> deterministic suggested price + bounds + en/hi text

Deterministic — pure math, NO LLM call (Rule-1 boundary, like Guna Milan /
calendar). Protected by X-Internal-Key (global middleware + per-route Depends).
See docs/adr/ADR-001-pricing-model.md.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from src.deps.auth import verify_internal_key
from src.schemas.pricing import PricingSuggestRequest, PricingSuggestResponse
from src.services import pricing_service

router = APIRouter(prefix="/ai/pricing", tags=["pricing"])


@router.post(
    "/suggest",
    response_model=PricingSuggestResponse,
    dependencies=[Depends(verify_internal_key)],
)
def suggest(req: PricingSuggestRequest) -> PricingSuggestResponse:
    """
    Suggested price for one service line. Clamped to the vendor's bounds and
    always overridable; the response carries a bilingual explanation so the price
    never reads as surge.
    """
    return pricing_service.compute_suggestion(req)
