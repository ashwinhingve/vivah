"""
Dynamic Pricing engine (Phase 5 Tier 1).

Deterministic, vendor-overridable, bilingually-explained pricing. Implements the
ADR-001 formula:

    raw      = muhurat * offSeason * demand
    clamped  = clamp(raw, floorMultiplier, ceilingMultiplier)
    suggested.paise = round_half_up(base.paise * clamped)

Clamp is mandatory and LAST — the suggestion never exits
[base_paise * floor, base_paise * ceiling]. Money is integer paise (never float):
the base * multiplier product is computed in Decimal and rounded half-up to an
integer paise. Pure math — no DB, no LLM, no randomness. Same input -> same output.

Reference pattern: src/services/calendar_service.py (pure deterministic functions).
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from src.schemas.pricing import PricingSuggestRequest, PricingSuggestResponse

# ── Demand multiplier STUB ────────────────────────────────────────────────────
# TODO(phase5-post-launch): replace with a live demand signal derived from recent
# lead/booking density for the vendor's category + region. No bookings exist
# pre-launch, so demand is pinned to 1.0 (price = base x muhurat x offSeason). The
# request schema accepts `demand_multiplier` for forward-compat but the engine
# ignores it until the real signal lands here.
DEMAND_STUB = 1.0


def _round_half_up(base_paise: int, multiplier: float) -> int:
    """
    base_paise (int) * multiplier (double) -> integer paise, rounded HALF_UP.

    Decimal keeps the product exact and the rounding deterministic — no binary
    float drift, no fractional paise. `str(multiplier)` yields the shortest exact
    decimal for the float, so equal floats always round identically.
    """
    product = Decimal(base_paise) * Decimal(str(multiplier))
    return int(product.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def compute_suggestion(req: PricingSuggestRequest) -> PricingSuggestResponse:
    """Deterministic suggested price + bounds + bilingual explanation."""
    muhurat = req.muhurat_multiplier
    off_season = req.off_season_multiplier
    demand = DEMAND_STUB  # stub — req.demand_multiplier intentionally ignored (v1)

    raw = muhurat * off_season * demand
    clamped = min(max(raw, req.floor_multiplier), req.ceiling_multiplier)
    clamp_hit = clamped != raw

    floor_paise = _round_half_up(req.base_paise, req.floor_multiplier)
    ceiling_paise = _round_half_up(req.base_paise, req.ceiling_multiplier)

    suggested_paise = _round_half_up(req.base_paise, clamped)

    # Defense-in-depth: the formula already clamps the multiplier, but rounding the
    # bounds independently could in principle drift by a paise — pin the result
    # into the rounded bounds so the surge guardrail is absolute.
    suggested_paise = min(max(suggested_paise, floor_paise), ceiling_paise)

    override_applied = False
    if req.override_paise is not None:
        # Vendor's manual price wins, but still cannot breach the vendor's own
        # declared bounds (ADR-001: bounds are the anti-surge guardrail).
        suggested_paise = min(max(req.override_paise, floor_paise), ceiling_paise)
        override_applied = True

    assert floor_paise <= suggested_paise <= ceiling_paise, "bounds invariant breached"

    applied_factors = {
        "MUHURAT": muhurat,
        "OFFSEASON": off_season,
        "DEMAND": demand,
    }

    explanation_en = _explain_en(
        req, clamped, clamp_hit, floor_paise, ceiling_paise,
        suggested_paise, override_applied,
    )
    explanation_hi = _explain_hi(
        req, clamped, clamp_hit, floor_paise, ceiling_paise,
        suggested_paise, override_applied,
    )

    return PricingSuggestResponse(
        base_paise=req.base_paise,
        currency=req.currency,
        applied_factors=applied_factors,
        raw_multiplier=raw,
        clamped_multiplier=clamped,
        floor_paise=floor_paise,
        ceiling_paise=ceiling_paise,
        suggested_paise=suggested_paise,
        clamp_hit=clamp_hit,
        override_applied=override_applied,
        explanation_en=explanation_en,
        explanation_hi=explanation_hi,
    )


# ── Explanation builders (deterministic strings, no LLM) ──────────────────────

def _rupees(paise: int) -> str:
    """Integer paise -> display rupees, e.g. 125000 -> '₹1,250', 125050 -> '₹1,250.50'."""
    if paise % 100 == 0:
        return f"₹{paise // 100:,}"
    return f"₹{paise / 100:,.2f}"


def _pct(multiplier: float) -> str:
    """Multiplier -> signed percent delta from base, e.g. 1.25 -> '+25%', 0.9 -> '-10%'."""
    delta = round((multiplier - 1.0) * 100)
    sign = "+" if delta >= 0 else "-"
    return f"{sign}{abs(delta)}%"


def _fmt_mult(multiplier: float) -> str:
    """Multiplier -> compact string, e.g. 1.125 -> '1.125', 2.0 -> '2'."""
    return f"{round(multiplier, 4):g}"


def _explain_en(
    req: PricingSuggestRequest,
    clamped: float,
    clamp_hit: bool,
    floor_paise: int,
    ceiling_paise: int,
    suggested_paise: int,
    override_applied: bool,
) -> str:
    parts = [f"Base {_rupees(req.base_paise)}."]
    factors = []
    if req.muhurat_multiplier != 1.0:
        factors.append(f"muhurat {_pct(req.muhurat_multiplier)}")
    if req.off_season_multiplier != 1.0:
        factors.append(f"off-season {_pct(req.off_season_multiplier)}")
    # demand is the stub (1.0) — only mentioned if a real signal ever moves it.
    if DEMAND_STUB != 1.0:
        factors.append(f"demand {_pct(DEMAND_STUB)}")

    if factors:
        parts.append(f"{', '.join(factors).capitalize()} -> x{_fmt_mult(clamped)}")
    else:
        parts.append(f"No adjustments -> x{_fmt_mult(clamped)}")

    if clamp_hit:
        bound = "ceiling" if clamped >= req.ceiling_multiplier else "floor"
        parts[-1] += f" (clamped to your {bound})."
    else:
        parts[-1] += " (within bounds)."

    if override_applied:
        parts.append(f"Vendor override applied: {_rupees(suggested_paise)}.")
    else:
        parts.append(f"Suggested {_rupees(suggested_paise)}.")
    return " ".join(parts)


def _explain_hi(
    req: PricingSuggestRequest,
    clamped: float,
    clamp_hit: bool,
    floor_paise: int,
    ceiling_paise: int,
    suggested_paise: int,
    override_applied: bool,
) -> str:
    parts = [f"मूल {_rupees(req.base_paise)}।"]
    factors = []
    if req.muhurat_multiplier != 1.0:
        factors.append(f"मुहूर्त {_pct(req.muhurat_multiplier)}")
    if req.off_season_multiplier != 1.0:
        factors.append(f"ऑफ-सीज़न {_pct(req.off_season_multiplier)}")
    if DEMAND_STUB != 1.0:
        factors.append(f"मांग {_pct(DEMAND_STUB)}")

    if factors:
        parts.append(f"{', '.join(factors)} → ×{_fmt_mult(clamped)}")
    else:
        parts.append(f"कोई समायोजन नहीं → ×{_fmt_mult(clamped)}")

    if clamp_hit:
        bound = "अधिकतम सीमा" if clamped >= req.ceiling_multiplier else "न्यूनतम सीमा"
        parts[-1] += f" (आपकी {bound} तक सीमित)।"
    else:
        parts[-1] += " (सीमा के भीतर)।"

    if override_applied:
        parts.append(f"विक्रेता मूल्य लागू: {_rupees(suggested_paise)}।")
    else:
        parts.append(f"सुझाव {_rupees(suggested_paise)}।")
    return " ".join(parts)
