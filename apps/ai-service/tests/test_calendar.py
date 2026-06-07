"""
Tests for the Calendar Intelligence engine (Phase 5 Tier 1).

Covers determinism, the computed Chaturmas exclusion guard, the Jan-2026
near-zero expectation, festival/govt overlays, and the read endpoints.
Pure data + math — no ML, no LLM.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from src.main import app
from src.services import calendar_service as cal
from src.services.guna_milan import NAKSHATRAS

client = TestClient(app, headers={"X-Internal-Key": "dev-internal-key-change-in-prod"})

_VIVAH_NAK = set(NAKSHATRAS)


class TestDeterminism:
    def test_same_year_same_dates(self) -> None:
        a = [m.date for m in cal.muhurats_for_year(2026)]
        b = [m.date for m in cal.muhurats_for_year(2026)]
        assert a == b

    def test_muhurats_sorted_and_unique(self) -> None:
        dates = [m.date for m in cal.muhurats_for_year(2027)]
        assert dates == sorted(dates)
        assert len(dates) == len(set(dates))

    def test_known_counts(self) -> None:
        # 2026 trimmed from 60 -> 56: four disputed July dates (01/06/11/12) held
        # out pending a panchang-authority ruling on the Devshayani convention.
        # See docs/calendar-muhurat-conventions.md.
        assert len(cal.muhurats_for_year(2026)) == 56
        assert len(cal.muhurats_for_year(2027)) == 96

    def test_disputed_july_not_seeded(self) -> None:
        july = {m.date for m in cal.muhurats_for_year(2026) if m.date.startswith("2026-07")}
        assert july == {"2026-07-07"}  # only the independently-corroborated date

    def test_nakshatra_names_known(self) -> None:
        for year in (2026, 2027):
            for m in cal.muhurats_for_year(year):
                for token in m.nakshatra.replace("/", ",").split(","):
                    name = token.strip()
                    assert not name or name in _VIVAH_NAK


class TestChaturmasExclusion:
    def test_guard_passes_both_years(self) -> None:
        assert cal.assert_no_muhurat_in_chaturmas(2026) is True
        assert cal.assert_no_muhurat_in_chaturmas(2027) is True

    def test_no_muhurat_inside_window(self) -> None:
        for year in (2026, 2027):
            w = cal.chaturmas_window(year)
            assert w is not None
            for m in cal.muhurats_for_year(year):
                assert not (w.devshayani <= m.date < w.devuthani)

    def test_window_anchors(self) -> None:
        w26 = cal.chaturmas_window(2026)
        assert w26 is not None
        assert w26.devshayani == "2026-07-25"
        assert w26.devuthani == "2026-11-21"

    def test_aug_sep_oct_empty(self) -> None:
        # Chaturmas covers Aug-Oct entirely in both years.
        for year in (2026, 2027):
            for month in ("08", "09", "10"):
                hits = [m for m in cal.muhurats_for_year(year) if m.date.startswith(f"{year}-{month}")]
                assert hits == [], f"{year}-{month} should have no muhurats"


class TestKharmas:
    def test_jan_2026_near_zero(self) -> None:
        # Jan 2026 is Kharmas/Dhanurmas — expect zero vivah muhurats.
        jan = [m for m in cal.muhurats_for_year(2026) if m.date.startswith("2026-01")]
        assert len(jan) == 0

    def test_jan_2027_resumes(self) -> None:
        # By 2027 the sun exits Sagittarius mid-Jan, so muhurats resume.
        jan = [m for m in cal.muhurats_for_year(2027) if m.date.startswith("2027-01")]
        assert len(jan) > 0


class TestOverlays:
    def test_festivals_present(self) -> None:
        names = {e.name for e in cal.events_in_range("2026-01-01", "2026-12-31", "FESTIVAL")}
        assert "Holi" in names
        assert "Diwali" in names

    def test_govt_holidays(self) -> None:
        events = cal.events_in_range("2026-01-01", "2026-12-31", "GOVT")
        names = {e.name for e in events}
        assert {"Republic Day", "Independence Day", "Gandhi Jayanti"} <= names
        assert all(e.region is None for e in events)

    def test_range_filter_bounds(self) -> None:
        events = cal.events_in_range("2026-03-01", "2026-03-31", None)
        assert all("2026-03-01" <= e.event_date <= "2026-03-31" for e in events)

    def test_muhurat_band_set(self) -> None:
        bands = {m.band for m in cal.muhurats_for_year(2026)}
        assert bands <= {"NONE", "LOW", "MEDIUM", "HIGH", "PEAK"}
        assert "PEAK" in bands or "HIGH" in bands


class TestEndpoints:
    def test_muhurats_endpoint(self) -> None:
        r = client.get("/ai/calendar/muhurats", params={"year": 2026})
        assert r.status_code == 200
        body = r.json()
        assert body["count"] == 56
        assert body["chaturmas"]["devshayani"] == "2026-07-25"
        assert len(body["muhurats"]) == 56

    def test_events_endpoint_kind_filter(self) -> None:
        r = client.get(
            "/ai/calendar/events",
            params={"from": "2026-01-01", "to": "2026-12-31", "kind": "GOVT"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["count"] == 3
        assert {e["name"] for e in body["events"]} == {
            "Republic Day",
            "Independence Day",
            "Gandhi Jayanti",
        }

    def test_requires_auth(self) -> None:
        r = TestClient(app).get("/ai/calendar/muhurats", params={"year": 2026})
        assert r.status_code == 401

    def test_out_of_range_year_rejected(self) -> None:
        r = client.get("/ai/calendar/muhurats", params={"year": 2099})
        assert r.status_code == 422

    def test_bad_date_rejected(self) -> None:
        r = client.get("/ai/calendar/events", params={"from": "2026-1-1"})
        assert r.status_code == 422
