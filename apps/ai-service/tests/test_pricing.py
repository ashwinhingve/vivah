"""
Tests for the Dynamic Pricing engine (Phase 5 Tier 1).

Covers the ADR-001 formula on a snapshot grid, proves the vendor bounds are never
breached (even when factors would push past them), determinism, vendor override
(also bound-clamped), half-up paise rounding, the bilingual explanation, and the
read endpoint. Pure math — no ML, no LLM.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from src.main import app
from src.schemas.pricing import PricingSuggestRequest
from src.services import pricing_service as ps

client = TestClient(app, headers={"X-Internal-Key": "dev-internal-key-change-in-prod"})
noauth_client = TestClient(app)

_BASE = 1_000_000  # ₹10,000 in paise


def _req(**kw) -> PricingSuggestRequest:
    defaults = dict(
        base_paise=_BASE,
        floor_multiplier=0.7,
        ceiling_multiplier=2.5,
        muhurat_multiplier=1.0,
        off_season_multiplier=1.0,
    )
    defaults.update(kw)
    return PricingSuggestRequest(**defaults)


# (muhurat, off_season) -> (raw, clamped, suggested_paise) with floor 0.7, ceil 2.5
_GRID = {
    (1.00, 1.0): (1.000, 1.000, 1_000_000),
    (1.00, 0.9): (0.900, 0.900, 900_000),
    (1.00, 0.5): (0.500, 0.700, 700_000),   # clamp: 0.5 < floor 0.7
    (1.25, 1.0): (1.250, 1.250, 1_250_000),
    (1.25, 0.9): (1.125, 1.125, 1_125_000),
    (1.25, 0.5): (0.625, 0.700, 700_000),   # clamp
    (2.00, 1.0): (2.000, 2.000, 2_000_000),
    (2.00, 0.9): (1.800, 1.800, 1_800_000),
    (2.00, 0.5): (1.000, 1.000, 1_000_000),
}


class TestFormula:
    def test_snapshot_grid(self) -> None:
        for (muhurat, off), (raw, clamped, suggested) in _GRID.items():
            r = ps.compute_suggestion(
                _req(muhurat_multiplier=muhurat, off_season_multiplier=off)
            )
            assert r.raw_multiplier == pytest.approx(raw), (muhurat, off)
            assert r.clamped_multiplier == pytest.approx(clamped), (muhurat, off)
            assert r.suggested_paise == suggested, (muhurat, off)

    def test_clamp_hit_flag(self) -> None:
        for (muhurat, off), (raw, clamped, _s) in _GRID.items():
            r = ps.compute_suggestion(
                _req(muhurat_multiplier=muhurat, off_season_multiplier=off)
            )
            assert r.clamp_hit == (raw != clamped), (muhurat, off)

    def test_demand_is_stub(self) -> None:
        # Caller-supplied demand is ignored; engine uses DEMAND_STUB (1.0).
        r = ps.compute_suggestion(_req(demand_multiplier=3.0))
        assert r.applied_factors["DEMAND"] == 1.0
        assert r.suggested_paise == _BASE  # unchanged by the ignored demand


class TestBoundsNeverBreached:
    def test_grid_within_bounds(self) -> None:
        for (muhurat, off) in _GRID:
            r = ps.compute_suggestion(
                _req(muhurat_multiplier=muhurat, off_season_multiplier=off)
            )
            assert r.floor_paise <= r.suggested_paise <= r.ceiling_paise

    def test_extreme_muhurat_clamped_to_ceiling(self) -> None:
        r = ps.compute_suggestion(
            _req(floor_multiplier=0.8, ceiling_multiplier=1.5, muhurat_multiplier=5.0)
        )
        assert r.raw_multiplier == pytest.approx(5.0)
        assert r.clamped_multiplier == 1.5
        assert r.clamp_hit is True
        assert r.suggested_paise == r.ceiling_paise == 1_500_000

    def test_extreme_offseason_clamped_to_floor(self) -> None:
        r = ps.compute_suggestion(
            _req(floor_multiplier=0.8, ceiling_multiplier=2.0, off_season_multiplier=0.1)
        )
        assert r.raw_multiplier == pytest.approx(0.1)
        assert r.clamped_multiplier == 0.8
        assert r.clamp_hit is True
        assert r.suggested_paise == r.floor_paise == 800_000

    def test_full_sweep_invariant(self) -> None:
        # Dense sweep including factors far outside the bounds — never breach.
        mults = [0.05, 0.1, 0.5, 0.7, 0.9, 1.0, 1.25, 1.8, 2.5, 5.0, 9.9]
        for m in mults:
            for o in mults:
                r = ps.compute_suggestion(
                    _req(
                        floor_multiplier=0.7,
                        ceiling_multiplier=2.5,
                        muhurat_multiplier=m,
                        off_season_multiplier=o,
                    )
                )
                assert r.floor_paise <= r.suggested_paise <= r.ceiling_paise, (m, o)


class TestDeterminism:
    def test_same_input_same_output(self) -> None:
        a = ps.compute_suggestion(_req(muhurat_multiplier=1.25, off_season_multiplier=0.9))
        b = ps.compute_suggestion(_req(muhurat_multiplier=1.25, off_season_multiplier=0.9))
        assert a.model_dump() == b.model_dump()


class TestOverride:
    def test_override_within_bounds_wins(self) -> None:
        r = ps.compute_suggestion(
            _req(floor_multiplier=0.7, ceiling_multiplier=1.5, override_paise=1_200_000)
        )
        assert r.override_applied is True
        assert r.suggested_paise == 1_200_000  # verbatim, inside [700k, 1.5M]

    def test_override_above_ceiling_clamped(self) -> None:
        r = ps.compute_suggestion(
            _req(floor_multiplier=0.7, ceiling_multiplier=1.5, override_paise=2_000_000)
        )
        assert r.override_applied is True
        assert r.suggested_paise == r.ceiling_paise == 1_500_000

    def test_override_below_floor_clamped(self) -> None:
        r = ps.compute_suggestion(
            _req(floor_multiplier=0.7, ceiling_multiplier=1.5, override_paise=100_000)
        )
        assert r.override_applied is True
        assert r.suggested_paise == r.floor_paise == 700_000

    def test_no_override_flag_false(self) -> None:
        r = ps.compute_suggestion(_req())
        assert r.override_applied is False


class TestRounding:
    def test_half_up_not_bankers(self) -> None:
        # 100 * 1.005 = 100.5 -> HALF_UP gives 101 (banker's would give 100).
        r = ps.compute_suggestion(
            _req(base_paise=100, floor_multiplier=0.5, ceiling_multiplier=2.0,
                 muhurat_multiplier=1.005)
        )
        assert r.suggested_paise == 101
        assert isinstance(r.suggested_paise, int)

    def test_no_fractional_paise(self) -> None:
        r = ps.compute_suggestion(
            _req(base_paise=101, floor_multiplier=0.5, ceiling_multiplier=2.0,
                 muhurat_multiplier=1.005)
        )
        # 101 * 1.005 = 101.505 -> 102
        assert r.suggested_paise == 102
        assert isinstance(r.suggested_paise, int)


class TestExplanation:
    def test_both_non_empty(self) -> None:
        r = ps.compute_suggestion(_req(muhurat_multiplier=1.25, off_season_multiplier=0.9))
        assert r.explanation_en.strip()
        assert r.explanation_hi.strip()

    def test_hindi_is_devanagari(self) -> None:
        r = ps.compute_suggestion(_req(muhurat_multiplier=1.25))
        assert any(0x900 <= ord(c) <= 0x97F for c in r.explanation_hi)

    def test_clamp_mentioned_when_hit(self) -> None:
        r = ps.compute_suggestion(
            _req(floor_multiplier=0.8, ceiling_multiplier=1.5, muhurat_multiplier=5.0)
        )
        assert "clamped" in r.explanation_en.lower()
        assert "सीमित" in r.explanation_hi

    def test_within_bounds_phrasing(self) -> None:
        r = ps.compute_suggestion(_req(muhurat_multiplier=1.25))
        assert "within bounds" in r.explanation_en.lower()
        assert "सीमा के भीतर" in r.explanation_hi

    def test_override_phrasing(self) -> None:
        r = ps.compute_suggestion(_req(override_paise=1_100_000))
        assert "override" in r.explanation_en.lower()


class TestEndpoint:
    def test_suggest_ok(self) -> None:
        body = {
            "base_paise": 1_000_000,
            "floor_multiplier": 0.7,
            "ceiling_multiplier": 2.5,
            "muhurat_multiplier": 1.25,
            "off_season_multiplier": 0.9,
        }
        res = client.post("/ai/pricing/suggest", json=body)
        assert res.status_code == 200
        data = res.json()
        assert data["suggested_paise"] == 1_125_000
        assert data["overridable"] is True
        assert data["explanation_hi"]

    def test_requires_internal_key(self) -> None:
        res = noauth_client.post(
            "/ai/pricing/suggest",
            json={"base_paise": 1000, "floor_multiplier": 0.7, "ceiling_multiplier": 2.5},
        )
        assert res.status_code == 401  # global InternalKeyAuthMiddleware

    def test_ceiling_below_floor_422(self) -> None:
        res = client.post(
            "/ai/pricing/suggest",
            json={"base_paise": 1000, "floor_multiplier": 2.0, "ceiling_multiplier": 1.0},
        )
        assert res.status_code == 422

    def test_negative_base_422(self) -> None:
        res = client.post(
            "/ai/pricing/suggest",
            json={"base_paise": -1, "floor_multiplier": 0.7, "ceiling_multiplier": 2.5},
        )
        assert res.status_code == 422
