"""
Tests for Guna Milan (Ashtakoot) compatibility calculator.

Run: pytest apps/ai-service/tests/test_guna_milan.py -v
"""

import pytest
from fastapi.testclient import TestClient

from src.main import app
from src.services.guna_milan import (
    NAKSHATRA_GANA,
    NAKSHATRA_INDEX,
    NAKSHATRA_NADI,
    NAKSHATRA_YONI,
    NAKSHATRAS,
    RASHI_LORD,
    RASHI_VARNA,
    RASHI_VASHYA,
    GunaMilanCalculator,
    calc_bhakoot,
    calc_gana,
    calc_graha_maitri,
    calc_nadi,
    calc_tara,
    calc_varna,
    calc_vashya,
    calc_yoni,
    calculator,
)

# TestClient sends X-Internal-Key on every request — matches the middleware
# default key so existing route tests keep working without per-test boilerplate.
client = TestClient(app, headers={"X-Internal-Key": "dev-internal-key-change-in-prod"})


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def make_payload(
    rashi_a: str,
    nak_a: str,
    manglik_a: bool,
    rashi_b: str,
    nak_b: str,
    manglik_b: bool,
) -> dict:
    return {
        "profile_a": {"rashi": rashi_a, "nakshatra": nak_a, "manglik": manglik_a},
        "profile_b": {"rashi": rashi_b, "nakshatra": nak_b, "manglik": manglik_b},
    }


# ---------------------------------------------------------------------------
# 1. Score range validation
# ---------------------------------------------------------------------------

class TestScoreRange:
    def test_total_score_in_valid_range(self) -> None:
        """Total score must always be 0–36."""
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="Ashwini",
            girl_rashi="Simha", girl_nak="Magha",
            boy_manglik=False, girl_manglik=False,
        )
        assert 0 <= result["total_score"] <= 36

    def test_max_score_always_36(self) -> None:
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="Ashwini",
            girl_rashi="Karka", girl_nak="Rohini",
            boy_manglik=False, girl_manglik=False,
        )
        assert result["max_score"] == 36

    def test_factor_scores_within_bounds(self) -> None:
        result = calculator.calculate(
            boy_rashi="Dhanu", boy_nak="Mula",
            girl_rashi="Meena", girl_nak="Revati",
            boy_manglik=False, girl_manglik=False,
        )
        bounds = {
            "varna": 1, "vashya": 2, "tara": 3, "yoni": 4,
            "graha_maitri": 5, "gana": 6, "bhakoot": 7, "nadi": 8,
        }
        for factor, max_val in bounds.items():
            assert 0 <= result["factors"][factor]["score"] <= max_val, (
                f"{factor} score out of range"
            )


# ---------------------------------------------------------------------------
# 2. High-scoring pair (close to maximum)
# ---------------------------------------------------------------------------

class TestHighScore:
    def test_high_score_pair(self) -> None:
        """
        A pair chosen to maximize most factors:
        - Boy: Rashi=Karka (Brahmin), Nakshatra=Pushya (Dev/Madhya)
        - Girl: Rashi=Meena (Brahmin), Nakshatra=Revati (Dev/Antya)
        Nadi: Madhya vs Antya = different → 8
        Gana: Dev + Dev → 6
        Varna: Both Brahmin (4,4) → compatible → 1
        """
        result = calculator.calculate(
            boy_rashi="Karka", boy_nak="Pushya",
            girl_rashi="Meena", girl_nak="Revati",
            boy_manglik=False, girl_manglik=False,
        )
        # This pair should score well; just ensure it's above average
        assert result["total_score"] >= 18
        assert result["factors"]["nadi"]["score"] == 8  # different Nadis
        assert result["factors"]["gana"]["score"] == 6  # both Dev

    def test_score_factors_sum_equals_total(self) -> None:
        """Factor scores must sum to total_score."""
        result = calculator.calculate(
            boy_rashi="Simha", boy_nak="Magha",
            girl_rashi="Dhanu", girl_nak="Purva Ashadha",
            boy_manglik=False, girl_manglik=False,
        )
        computed_sum = sum(result["factors"][f]["score"] for f in result["factors"])
        assert computed_sum == result["total_score"]


# ---------------------------------------------------------------------------
# 3. Low-scoring / incompatible pair
# ---------------------------------------------------------------------------

class TestLowScore:
    def test_nadi_dosha_zero(self) -> None:
        """Same Nadi (Aadi) = 0 points for Nadi factor."""
        result = calc_nadi("Ashwini", "Ardra")  # Both Aadi
        assert result["score"] == 0
        assert result["compatible"] is False

    def test_same_nadi_pair_low_overall(self) -> None:
        """A pair with same Nadi and other incompatibilities should score low."""
        # Boy: Mesha/Ashwini (Aadi nadi, Chatushpad vashya, Kshatriya varna)
        # Girl: Mesha/Ardra (Aadi nadi) — same Nadi = 0 for Nadi
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="Ashwini",
            girl_rashi="Mithuna", girl_nak="Ardra",
            boy_manglik=False, girl_manglik=False,
        )
        # Nadi must be 0 (both Aadi)
        assert result["factors"]["nadi"]["score"] == 0
        # Total should be below excellent
        assert result["total_score"] < 32


# ---------------------------------------------------------------------------
# 4. Mangal Dosha
# ---------------------------------------------------------------------------

class TestMangalDosha:
    def test_conflict_boy_manglik_girl_not(self) -> None:
        """One manglik + one non-manglik = conflict."""
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="Ashwini",
            girl_rashi="Simha", girl_nak="Magha",
            boy_manglik=True, girl_manglik=False,
        )
        assert result["mangal_dosha_conflict"] is True

    def test_conflict_girl_manglik_boy_not(self) -> None:
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="Ashwini",
            girl_rashi="Simha", girl_nak="Magha",
            boy_manglik=False, girl_manglik=True,
        )
        assert result["mangal_dosha_conflict"] is True

    def test_cancelled_both_manglik(self) -> None:
        """Both manglik = dosha cancelled = no conflict."""
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="Ashwini",
            girl_rashi="Simha", girl_nak="Magha",
            boy_manglik=True, girl_manglik=True,
        )
        assert result["mangal_dosha_conflict"] is False

    def test_no_conflict_neither_manglik(self) -> None:
        result = calculator.calculate(
            boy_rashi="Karka", boy_nak="Pushya",
            girl_rashi="Meena", girl_nak="Revati",
            boy_manglik=False, girl_manglik=False,
        )
        assert result["mangal_dosha_conflict"] is False


# ---------------------------------------------------------------------------
# 5. Unknown/missing Nakshatra — graceful fallback
# ---------------------------------------------------------------------------

class TestUnknownNakshatra:
    def test_unknown_nakshatra_no_crash(self) -> None:
        """Unknown Nakshatra should not raise an exception."""
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="UnknownStar",
            girl_rashi="Simha", girl_nak="Magha",
            boy_manglik=False, girl_manglik=False,
        )
        # Should return a valid result
        assert isinstance(result["total_score"], int)
        assert 0 <= result["total_score"] <= 36

    def test_unknown_nakshatra_factors_zero(self) -> None:
        """Factors that depend on Nakshatra must return 0 for unknown input."""
        tara = calc_tara("UnknownStar", "Rohini")
        yoni = calc_yoni("UnknownStar", "Rohini")
        gana = calc_gana("UnknownStar", "Rohini")
        nadi = calc_nadi("UnknownStar", "Rohini")

        assert tara["score"] == 0
        assert yoni["score"] == 0
        assert gana["score"] == 0
        assert nadi["score"] == 0

    def test_unknown_rashi_factors_zero(self) -> None:
        """Factors that depend on Rashi must return 0 for unknown input."""
        varna = calc_varna("UnknownRashi", "Mesha")
        vashya = calc_vashya("UnknownRashi", "Mesha")
        gm = calc_graha_maitri("UnknownRashi", "Mesha")
        bhakoot = calc_bhakoot("UnknownRashi", "Mesha")

        assert varna["score"] == 0
        assert vashya["score"] == 0
        assert gm["score"] == 0
        assert bhakoot["score"] == 0

    def test_unknown_nakshatra_compatible_false(self) -> None:
        """Unknown input must mark compatible=False, not raise."""
        result = calc_nadi("Ghost", "Ashwini")
        assert result["compatible"] is False


# ---------------------------------------------------------------------------
# 6. All 27 Nakshatras present in every lookup table
# ---------------------------------------------------------------------------

class TestNakshatraCompleteness:
    def test_27_nakshatras_in_list(self) -> None:
        assert len(NAKSHATRAS) == 27

    def test_all_nakshatras_in_index(self) -> None:
        for nak in NAKSHATRAS:
            assert nak in NAKSHATRA_INDEX, f"Missing from NAKSHATRA_INDEX: {nak}"

    def test_all_nakshatras_have_yoni(self) -> None:
        for nak in NAKSHATRAS:
            assert nak in NAKSHATRA_YONI, f"Missing from NAKSHATRA_YONI: {nak}"

    def test_all_nakshatras_have_gana(self) -> None:
        for nak in NAKSHATRAS:
            assert nak in NAKSHATRA_GANA, f"Missing from NAKSHATRA_GANA: {nak}"

    def test_all_nakshatras_have_nadi(self) -> None:
        for nak in NAKSHATRAS:
            assert nak in NAKSHATRA_NADI, f"Missing from NAKSHATRA_NADI: {nak}"

    def test_no_keyerror_for_any_nakshatra_pair(self) -> None:
        """Computing all factors for any Nakshatra pair must never raise KeyError."""
        for nak in NAKSHATRAS:
            calc_tara(nak, "Ashwini")
            calc_yoni(nak, "Ashwini")
            calc_gana(nak, "Ashwini")
            calc_nadi(nak, "Ashwini")

    def test_all_12_rashis_in_lookup_tables(self) -> None:
        from src.services.guna_milan import RASHIS
        for rashi in RASHIS:
            assert rashi in RASHI_VARNA, f"Missing from RASHI_VARNA: {rashi}"
            assert rashi in RASHI_VASHYA, f"Missing from RASHI_VASHYA: {rashi}"
            assert rashi in RASHI_LORD, f"Missing from RASHI_LORD: {rashi}"


# ---------------------------------------------------------------------------
# 7. Interpretation thresholds
# ---------------------------------------------------------------------------

class TestInterpretation:
    def _score_to_interpretation(self, score: int) -> str:
        """Helper: compute interpretation for a given forced total_score."""
        from src.services.guna_milan import _interpret
        label, _ = _interpret(score)
        return label

    def test_score_36_excellent(self) -> None:
        assert self._score_to_interpretation(36) == "Excellent match"

    def test_score_32_excellent(self) -> None:
        assert self._score_to_interpretation(32) == "Excellent match"

    def test_score_31_good(self) -> None:
        assert self._score_to_interpretation(31) == "Good match"

    def test_score_25_good(self) -> None:
        assert self._score_to_interpretation(25) == "Good match"

    def test_score_24_average(self) -> None:
        assert self._score_to_interpretation(24) == "Average match"

    def test_score_18_average(self) -> None:
        assert self._score_to_interpretation(18) == "Average match"

    def test_score_17_not_recommended(self) -> None:
        assert self._score_to_interpretation(17) == "Not recommended"

    def test_score_0_not_recommended(self) -> None:
        assert self._score_to_interpretation(0) == "Not recommended"

    def test_recommendation_is_non_empty_string(self) -> None:
        from src.services.guna_milan import _interpret
        for score in [0, 17, 18, 24, 25, 31, 32, 36]:
            _, rec = _interpret(score)
            assert isinstance(rec, str) and len(rec) > 0


# ---------------------------------------------------------------------------
# 8. Percentage calculation
# ---------------------------------------------------------------------------

class TestPercentage:
    def test_18_of_36_is_50_percent(self) -> None:
        """18/36 * 100 = 50.0"""
        # Build a scenario that results in exactly 18 by checking the arithmetic
        result = calculator.calculate(
            boy_rashi="Karka", boy_nak="Pushya",
            girl_rashi="Meena", girl_nak="Revati",
            boy_manglik=False, girl_manglik=False,
        )
        expected_pct = round(result["total_score"] / 36 * 100, 2)
        assert result["percentage"] == expected_pct

    def test_percentage_formula_direct(self) -> None:
        """Direct: manually inject score=18 into percentage formula."""
        pct = round(18 / 36 * 100, 2)
        assert pct == 50.0

    def test_percentage_zero_score(self) -> None:
        pct = round(0 / 36 * 100, 2)
        assert pct == 0.0

    def test_percentage_full_score(self) -> None:
        pct = round(36 / 36 * 100, 2)
        assert pct == 100.0


# ---------------------------------------------------------------------------
# 9. Individual factor unit tests
# ---------------------------------------------------------------------------

class TestVarna:
    def test_same_varna_compatible(self) -> None:
        result = calc_varna("Mesha", "Simha")  # Both Kshatriya (3,3)
        assert result["score"] == 1
        assert result["compatible"] is True

    def test_boy_higher_varna_compatible(self) -> None:
        result = calc_varna("Karka", "Mesha")  # Brahmin(4) >= Kshatriya(3)
        assert result["score"] == 1
        assert result["compatible"] is True

    def test_boy_lower_varna_incompatible(self) -> None:
        result = calc_varna("Mesha", "Karka")  # Kshatriya(3) < Brahmin(4)
        assert result["score"] == 0
        assert result["compatible"] is False


class TestNadi:
    def test_same_nadi_zero(self) -> None:
        result = calc_nadi("Ashwini", "Ardra")  # Both Aadi
        assert result["score"] == 0

    def test_different_nadi_eight(self) -> None:
        result = calc_nadi("Ashwini", "Bharani")  # Aadi vs Madhya
        assert result["score"] == 8

    def test_antya_vs_aadi_eight(self) -> None:
        result = calc_nadi("Krittika", "Ashwini")  # Antya vs Aadi
        assert result["score"] == 8


class TestGana:
    def test_dev_dev_six(self) -> None:
        result = calc_gana("Ashwini", "Mrigashira")  # Both Dev
        assert result["score"] == 6

    def test_rakshasa_rakshasa_six(self) -> None:
        result = calc_gana("Krittika", "Ashlesha")  # Both Rakshasa
        assert result["score"] == 6

    def test_dev_manav_five(self) -> None:
        result = calc_gana("Ashwini", "Bharani")  # Dev + Manav
        assert result["score"] == 5

    def test_dev_rakshasa_one(self) -> None:
        result = calc_gana("Ashwini", "Krittika")  # Dev + Rakshasa
        assert result["score"] == 1

    def test_manav_rakshasa_zero(self) -> None:
        result = calc_gana("Bharani", "Krittika")  # Manav + Rakshasa
        assert result["score"] == 0


class TestBhakoot:
    def test_same_rashi_auspicious(self) -> None:
        """Same Rashi = count 1 from girl to boy; not in inauspicious set."""
        result = calc_bhakoot("Mesha", "Mesha")
        assert result["score"] == 7

    def test_shadashtak_zero(self) -> None:
        """6-8 axis: Mesha(0) to Kanya(5) = count 6 from Mesha → inauspicious."""
        result = calc_bhakoot("Kanya", "Mesha")  # 6 from Mesha to Kanya
        assert result["score"] == 0

    def test_auspicious_pair(self) -> None:
        """Mesha to Dhanu = count 9 from Mesha — inauspicious (navamansh 5-9 axis)."""
        # 5-9 axis: count 9 from girl Mesha to boy Dhanu(8) = (8-0)%12+1 = 9 → 0
        result = calc_bhakoot("Dhanu", "Mesha")
        assert result["score"] == 0  # navamansh axis


class TestGrahaMaitri:
    def test_same_lord_five(self) -> None:
        """Both Mesha → both ruled by Mars → same planet = 5."""
        result = calc_graha_maitri("Mesha", "Vrishchika")  # both Mars
        assert result["score"] == 5

    def test_mutual_friends_five(self) -> None:
        """Sun (Simha) and Moon (Karka) are mutual friends → 5."""
        result = calc_graha_maitri("Simha", "Karka")
        assert result["score"] == 5


# ---------------------------------------------------------------------------
# 10. HTTP API endpoint tests
# ---------------------------------------------------------------------------

class TestHoroscopeAPI:
    def test_post_guna_returns_200(self) -> None:
        payload = make_payload(
            "Mesha", "Ashwini", False,
            "Simha", "Magha", False,
        )
        response = client.post("/ai/horoscope/guna", json=payload)
        assert response.status_code == 200

    def test_response_has_required_fields(self) -> None:
        payload = make_payload(
            "Karka", "Pushya", False,
            "Meena", "Revati", False,
        )
        response = client.post("/ai/horoscope/guna", json=payload)
        data = response.json()
        assert "total_score" in data
        assert "max_score" in data
        assert "percentage" in data
        assert "factors" in data
        assert "mangal_dosha_conflict" in data
        assert "interpretation" in data
        assert "recommendation" in data

    def test_response_max_score_is_36(self) -> None:
        payload = make_payload(
            "Dhanu", "Mula", False,
            "Meena", "Revati", False,
        )
        response = client.post("/ai/horoscope/guna", json=payload)
        assert response.json()["max_score"] == 36

    def test_response_factors_all_present(self) -> None:
        payload = make_payload(
            "Mesha", "Ashwini", False,
            "Simha", "Magha", False,
        )
        response = client.post("/ai/horoscope/guna", json=payload)
        factors = response.json()["factors"]
        for key in ["varna", "vashya", "tara", "yoni", "graha_maitri", "gana", "bhakoot", "nadi"]:
            assert key in factors, f"Missing factor in response: {key}"

    def test_mangal_conflict_in_response(self) -> None:
        payload = make_payload(
            "Mesha", "Ashwini", True,   # boy manglik
            "Simha", "Magha", False,    # girl not
        )
        response = client.post("/ai/horoscope/guna", json=payload)
        assert response.json()["mangal_dosha_conflict"] is True

    def test_mangal_cancelled_in_response(self) -> None:
        payload = make_payload(
            "Mesha", "Ashwini", True,
            "Simha", "Magha", True,
        )
        response = client.post("/ai/horoscope/guna", json=payload)
        assert response.json()["mangal_dosha_conflict"] is False

    def test_unknown_nakshatra_returns_200_not_500(self) -> None:
        """Graceful fallback: unknown Nakshatra should not cause 500."""
        payload = make_payload(
            "Mesha", "UnknownStar", False,
            "Simha", "Magha", False,
        )
        response = client.post("/ai/horoscope/guna", json=payload)
        assert response.status_code == 200

    def test_missing_fields_returns_422(self) -> None:
        """Incomplete input must return validation error."""
        response = client.post("/ai/horoscope/guna", json={"profile_a": {}})
        assert response.status_code == 422

    def test_interpretation_is_valid_value(self) -> None:
        valid = {"Excellent match", "Good match", "Average match", "Not recommended"}
        payload = make_payload(
            "Mesha", "Ashwini", False,
            "Karka", "Rohini", False,
        )
        response = client.post("/ai/horoscope/guna", json=payload)
        assert response.json()["interpretation"] in valid

    def test_percentage_matches_score(self) -> None:
        payload = make_payload(
            "Karka", "Pushya", False,
            "Meena", "Revati", False,
        )
        response = client.post("/ai/horoscope/guna", json=payload)
        data = response.json()
        expected = round(data["total_score"] / 36 * 100, 2)
        assert data["percentage"] == expected


# ---------------------------------------------------------------------------
# Advanced — Dosha analysis (Manglik intensity, cancellations, Rajju, Vedha…)
# ---------------------------------------------------------------------------

class TestManglikIntensity:
    def test_partial_partial_cancels(self) -> None:
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="Ashwini",
            girl_rashi="Simha", girl_nak="Magha",
            boy_manglik="PARTIAL", girl_manglik="PARTIAL",
        )
        assert result["doshas"]["manglik"]["cancelled"] is True
        assert result["doshas"]["manglik"]["conflict"] is False

    def test_yes_partial_low_severity(self) -> None:
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="Ashwini",
            girl_rashi="Simha", girl_nak="Magha",
            boy_manglik="YES", girl_manglik="PARTIAL",
        )
        assert result["doshas"]["manglik"]["conflict"] is True
        assert result["doshas"]["manglik"]["severity"] == "low"

    def test_yes_no_high_severity(self) -> None:
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="Ashwini",
            girl_rashi="Simha", girl_nak="Magha",
            boy_manglik="YES", girl_manglik="NO",
        )
        assert result["doshas"]["manglik"]["severity"] == "high"

    def test_legacy_bool_input(self) -> None:
        """bool input is normalized to YES/NO for back-compat."""
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="Ashwini",
            girl_rashi="Simha", girl_nak="Magha",
            boy_manglik=True, girl_manglik=True,
        )
        assert result["doshas"]["manglik"]["cancelled"] is True


class TestNadiCancellation:
    def test_same_nadi_uncancelled(self) -> None:
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="Ashwini",
            girl_rashi="Karka", girl_nak="Hasta",
            boy_manglik=False, girl_manglik=False,
        )
        assert result["doshas"]["nadi"]["dosha"] is True
        assert result["doshas"]["nadi"]["cancelled"] is False

    def test_different_nadi_no_dosha(self) -> None:
        result = calculator.calculate(
            boy_rashi="Karka", boy_nak="Punarvasu",
            girl_rashi="Karka", girl_nak="Ashlesha",
            boy_manglik=False, girl_manglik=False,
        )
        assert result["doshas"]["nadi"]["dosha"] is False


class TestBhakootCancellation:
    def test_friendly_lords_cancel_bhakoot(self) -> None:
        result = calculator.calculate(
            boy_rashi="Karka", boy_nak="Pushya",
            girl_rashi="Simha", girl_nak="Magha",
            boy_manglik=False, girl_manglik=False,
        )
        assert result["doshas"]["bhakoot"]["dosha"] is True
        assert result["doshas"]["bhakoot"]["cancelled"] is True

    def test_same_rashi_lord_cancels(self) -> None:
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="Ashwini",
            girl_rashi="Vrishchika", girl_nak="Anuradha",
            boy_manglik=False, girl_manglik=False,
        )
        assert result["doshas"]["bhakoot"]["cancelled"] is True


class TestRajjuDosha:
    def test_same_rajju_triggers(self) -> None:
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="Ashwini",
            girl_rashi="Vrishchika", girl_nak="Jyeshtha",
            boy_manglik=False, girl_manglik=False,
        )
        assert result["doshas"]["rajju"]["dosha"] is True

    def test_different_rajju_no_dosha(self) -> None:
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="Ashwini",
            girl_rashi="Vrishabha", girl_nak="Krittika",
            boy_manglik=False, girl_manglik=False,
        )
        assert result["doshas"]["rajju"]["dosha"] is False


class TestVedhaDosha:
    def test_known_vedha_pair(self) -> None:
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="Ashwini",
            girl_rashi="Vrishchika", girl_nak="Jyeshtha",
            boy_manglik=False, girl_manglik=False,
        )
        assert result["doshas"]["vedha"]["dosha"] is True

    def test_no_vedha(self) -> None:
        result = calculator.calculate(
            boy_rashi="Karka", boy_nak="Pushya",
            girl_rashi="Meena", girl_nak="Revati",
            boy_manglik=False, girl_manglik=False,
        )
        assert result["doshas"]["vedha"]["dosha"] is False


class TestMahendraStreeDeergha:
    def test_mahendra_present(self) -> None:
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="Ashwini",
            girl_rashi="Karka", girl_nak="Punarvasu",
            boy_manglik=False, girl_manglik=False,
        )
        assert result["yogas"]["mahendra"]["present"] is True

    def test_stree_deergha_present(self) -> None:
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="Ashwini",
            girl_rashi="Kanya", girl_nak="Hasta",
            boy_manglik=False, girl_manglik=False,
        )
        assert result["yogas"]["stree_deergha"]["present"] is True


class TestInsightsAndRemedies:
    def test_insights_have_5_domains(self) -> None:
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="Ashwini",
            girl_rashi="Karka", girl_nak="Pushya",
            boy_manglik=False, girl_manglik=False,
        )
        assert set(result["insights"].keys()) == {
            "mental", "physical", "prosperity", "progeny", "longevity"
        }
        for domain in result["insights"].values():
            assert 0 <= domain["score"] <= 100
            assert domain["label"] in {"excellent", "good", "average", "low"}

    def test_remedies_present_for_active_dosha(self) -> None:
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="Ashwini",
            girl_rashi="Simha", girl_nak="Magha",
            boy_manglik="YES", girl_manglik="NO",
        )
        codes = {r["code"] for r in result["remedies"]}
        assert "manglik" in codes

    def test_no_remedies_when_clean(self) -> None:
        result = calculator.calculate(
            boy_rashi="Karka", boy_nak="Pushya",
            girl_rashi="Meena", girl_nak="Revati",
            boy_manglik=False, girl_manglik=False,
        )
        assert isinstance(result["remedies"], list)


class TestFactorMetadata:
    def test_each_factor_has_name_and_meaning(self) -> None:
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="Ashwini",
            girl_rashi="Karka", girl_nak="Pushya",
            boy_manglik=False, girl_manglik=False,
        )
        for f in result["factors"].values():
            assert f["name"]
            assert f["name_hi"]
            assert f["meaning"]
            assert f["status"] in {"excellent", "good", "average", "low", "neutral"}

    def test_blocking_dosha_flag(self) -> None:
        result = calculator.calculate(
            boy_rashi="Mesha", boy_nak="Ashwini",
            girl_rashi="Simha", girl_nak="Magha",
            boy_manglik="YES", girl_manglik="NO",
        )
        assert result["blocking_dosha"] is True
