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
        # 2026: 52 base + 4 January (promoted, region-tagged "South India").
        # muhurats_for_year returns ALL muhurats with region tags; filtering happens
        # in events_in_range. Four disputed July dates (01/06/11/12) held out pending
        # panchang-authority ruling on the Devshayani convention.
        assert len(cal.muhurats_for_year(2026)) == 60  # 52 base + 4 Jan (all promoted)
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
                hits = [
                    m for m in cal.muhurats_for_year(year)
                    if m.date.startswith(f"{year}-{month}")
                ]
                assert hits == [], f"{year}-{month} should have no muhurats"


class TestKharmas:
    def test_jan_2026_fail_safe_region_filtering(self) -> None:
        # January muhurats are region-tagged "South India" but filtered fail-safe in events_in_range:
        # when caller's region is unknown, they are excluded (prevents Kharmas reaching North Indians).

        # Case 1: No region specified (unknown) in events_in_range → January muhurats EXCLUDED
        jan_no_region = cal.events_in_range("2026-01-01", "2026-01-31", "MUHURAT")
        jan_dates_no_region = [m for m in jan_no_region if m.event_date.startswith("2026-01")]
        assert len(jan_dates_no_region) == 0, "January muhurats must be excluded when region unknown"

        # Case 2: South India specified → January muhurats INCLUDED
        jan_south = cal.events_in_range("2026-01-01", "2026-01-31", "MUHURAT", region="South India")
        jan_dates_south = [m for m in jan_south if m.event_date.startswith("2026-01")]
        assert len(jan_dates_south) == 4, "South India should see all 4 January muhurats"
        assert all(m.region == "South India" for m in jan_dates_south)

        # Case 3: North India specified → January muhurats EXCLUDED
        jan_north = cal.events_in_range("2026-01-01", "2026-01-31", "MUHURAT", region="North India")
        jan_dates_north = [m for m in jan_north if m.event_date.startswith("2026-01")]
        assert len(jan_dates_north) == 0, "North India should not see January muhurats"

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
        # /muhurats endpoint returns all muhurats (no region filtering at this layer)
        r = client.get("/ai/calendar/muhurats", params={"year": 2026})
        assert r.status_code == 200
        body = r.json()
        assert body["count"] == 60  # 52 base + 4 Jan promoted
        assert body["chaturmas"]["devshayani"] == "2026-07-25"
        assert len(body["muhurats"]) == 60

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


class TestRegionalCommunity:
    """Regional / community festival variants + national-inclusive filtering."""

    def test_regional_festivals_seeded(self) -> None:
        # 24 curated regional/community rows (8 states + Jain community).
        regional = [e for e in cal.events_in_range(None, None, "FESTIVAL") if e.region is not None]
        assert len(regional) == 23  # region-tagged (the 24th is the region-null Jain row)
        names = {e.name for e in cal.events_in_range(None, None, "FESTIVAL")}
        assert {"Pongal", "Lohri", "Magh Bihu", "Ugadi", "Vaisakhi", "Chhath Puja"} <= names

    def test_region_filter_is_national_inclusive(self) -> None:
        # A Tamil user sees Pongal AND national Diwali — never one at the cost of the other.
        events = cal.events_in_range("2026-01-01", "2026-12-31", None, region="Tamil Nadu")
        names = {e.name for e in events}
        assert "Pongal" in names  # Tamil Nadu regional
        assert "Diwali" in names  # national (region None) survives
        assert "Puthandu" in names  # Tamil New Year
        # other regions' rows are excluded
        assert "Lohri" not in names
        assert "Magh Bihu" not in names

    def test_punjab_sees_lohri_not_pongal(self) -> None:
        names = {e.name for e in cal.events_in_range(None, None, None, region="Punjab")}
        assert "Lohri" in names
        assert "Vaisakhi" in names
        assert "Pongal" not in names
        assert "Diwali" in names  # national still present

    def test_unknown_region_returns_national_only(self) -> None:
        events = cal.events_in_range("2026-01-01", "2026-12-31", "FESTIVAL", region="Atlantis")
        assert all(e.region is None for e in events)
        assert "Diwali" in {e.name for e in events}

    def test_community_filter_national_inclusive(self) -> None:
        events = cal.events_in_range(None, None, None, community="Jain")
        names = {e.name for e in events}
        assert "Paryushan (Samvatsari)" in names  # Jain community row
        assert "Diwali" in names  # untagged national rows stay visible
        # a region-tagged row carrying no community tag is still included
        assert "Pongal" in names

    def test_pongal_anchored_to_makar_sankranti(self) -> None:
        pongal = [
            e for e in cal.events_in_range(None, None, "FESTIVAL", region="Tamil Nadu")
            if e.name == "Pongal"
        ]
        assert pongal[0].event_date == "2026-01-14"
        assert pongal[0].metadata is not None
        assert pongal[0].metadata.get("astronomicalEvent") == "Makar Sankranti"

    def test_disputed_regional_not_seeded(self) -> None:
        # Vishu / Onam are held out pending a panchang-authority ruling.
        names = {e.name for e in cal.events_in_range(None, None, "FESTIVAL")}
        assert "Vishu" not in names
        assert not any("Onam" in n for n in names)

    def test_region_filter_determinism(self) -> None:
        a = [(e.name, e.event_date) for e in cal.events_in_range(None, None, None, region="Assam")]
        b = [(e.name, e.event_date) for e in cal.events_in_range(None, None, None, region="Assam")]
        assert a == b

    def test_regional_rows_are_festival_kind(self) -> None:
        # Regional variants are kind=FESTIVAL (NOT REGIONAL) so kind=FESTIVAL surfaces them.
        for e in cal.events_in_range(None, None, None, region="Karnataka"):
            if e.name == "Ugadi":
                assert e.kind == "FESTIVAL"

    def test_events_endpoint_region_param(self) -> None:
        r = client.get(
            "/ai/calendar/events",
            params={"from": "2026-01-01", "to": "2026-12-31", "region": "Tamil Nadu"},
        )
        assert r.status_code == 200
        names = {e["name"] for e in r.json()["events"]}
        assert "Pongal" in names and "Diwali" in names and "Lohri" not in names

    def test_events_endpoint_community_param(self) -> None:
        r = client.get("/ai/calendar/events", params={"community": "Jain"})
        assert r.status_code == 200
        assert "Paryushan (Samvatsari)" in {e["name"] for e in r.json()["events"]}


class TestConventions:
    """Disputed-date promotion is a one-value convention flip + deterministic."""

    _JULY = {"2026-07-01", "2026-07-06", "2026-07-11", "2026-07-12"}
    _JAN = {"2026-01-14", "2026-01-23", "2026-01-25", "2026-01-28"}

    def test_defaults_promote_january_hold_july(self) -> None:
        # Dataset defaults now ADMIT January South Indian dates (promoted, region-tagged).
        # Filtering (fail-safe) happens in events_in_range, not muhurats_for_year.
        assert len(cal.muhurats_for_year(2026)) == 60  # 52 base + 4 Jan (all promoted)
        assert len(cal.muhurats_for_year(2027)) == 96
        july = {m.date for m in cal.muhurats_for_year(2026) if m.date.startswith("2026-07")}
        assert july == {"2026-07-07"}  # only the corroborated date (July 4 still held)

    def test_devshayani_flip_adds_four_july(self) -> None:
        # With convention override to promote July, we get Jan (4) + July (4) in muhurats_for_year
        flipped = cal.muhurats_for_year(2026, conventions={"devshayani": "drik-25jul"})
        dates = {m.date for m in flipped}
        assert len(flipped) == 64  # 52 base + 4 Jan (default promoted) + 4 July (flipped)
        assert self._JULY <= dates
        # flipping back (default) removes July but keeps Jan — no leakage via lru_cache
        assert len(cal.muhurats_for_year(2026)) == 60

    def test_january_admits_south_indian_post_sankranti(self) -> None:
        # January muhurats are admitted by default (promoted, region-tagged "South India").
        # Sourced from ProKerala (South Indian tradition post-Makar-Sankranti), rejected
        # by Drik/mPanchang (Kharmas / North Indian tradition). Verify all 4 dates are
        # present with sourced panchang values and region-tagged.
        # This test checks muhurats_for_year, which returns all promoted muhurats.
        # Filtering by region happens in events_in_range (see test_jan_2026_fail_safe_region_filtering).
        promoted = cal.muhurats_for_year(2026)
        dates = {m.date for m in promoted}
        assert len(promoted) == 60  # 52 base + 4 Jan
        assert self._JAN <= dates
        jan = [m for m in promoted if m.date in self._JAN]
        assert len(jan) == 4
        # Verify sourced panchang values and South India region tagging
        panchang_map = {
            "2026-01-14": ("Ekadashi", "Anuradha"),
            "2026-01-23": ("Navami", "Uttara Bhadrapada"),
            "2026-01-25": ("Ekadashi", "Revati"),
            "2026-01-28": ("Dashami", "Rohini"),
        }
        for m in jan:
            expected_tithi, expected_nakshatra = panchang_map[m.date]
            assert m.tithi == expected_tithi, f"{m.date} tithi mismatch"
            assert m.nakshatra == expected_nakshatra, f"{m.date} nakshatra mismatch"
            assert m.region == "South India", f"{m.date} region should be South India"

    def test_both_flips_are_independent(self) -> None:
        # Both conventions flipped: January already promoted by default, so only July is new
        both = cal.muhurats_for_year(
            2026, conventions={"devshayani": "drik-25jul", "january_post_sankranti": "include"}
        )
        assert len(both) == 64  # 52 base + 4 Jan (default) + 4 July (flipped)

    def test_vishu_flip_picks_chosen_date(self) -> None:
        default = {e.name for e in cal.events_in_range(None, None, "FESTIVAL", region="Kerala")}
        assert "Vishu" not in default  # held out by default
        flipped = cal.events_in_range(
            None, None, "FESTIVAL", region="Kerala", conventions={"vishu_day": "apr-15"}
        )
        vishu = [e for e in flipped if e.name == "Vishu"]
        assert len(vishu) == 1
        assert vishu[0].event_date == "2026-04-15"
        assert vishu[0].region == "Kerala"

    def test_onam_flip_picks_chosen_date(self) -> None:
        flipped = cal.events_in_range(
            None, None, "FESTIVAL", region="Kerala", conventions={"onam_reckoning": "sep-01"}
        )
        onam = [e for e in flipped if e.name.startswith("Onam")]
        assert len(onam) == 1
        assert onam[0].event_date == "2026-09-01"

    def test_unset_regional_stays_held_out(self) -> None:
        # explicit 'unset' (the default) promotes neither Vishu nor Onam
        names = {
            e.name
            for e in cal.events_in_range(
                None, None, "FESTIVAL",
                conventions={"vishu_day": "unset", "onam_reckoning": "unset"},
            )
        }
        assert "Vishu" not in names
        assert not any(n.startswith("Onam") for n in names)

    def test_convention_determinism(self) -> None:
        conv = {"devshayani": "drik-25jul"}
        a = [m.date for m in cal.muhurats_for_year(2026, conventions=conv)]
        b = [m.date for m in cal.muhurats_for_year(2026, conventions=conv)]
        assert a == b


class TestSchoolWindows:
    """School-calendar blackout windows — SCHOOL kind, date -> end_date, sourced."""

    def test_school_windows_present(self) -> None:
        school = cal.events_in_range(None, None, "SCHOOL")
        assert len(school) == 4
        names = {e.name for e in school}
        assert "CBSE Board Exams (Class 10 & 12)" in names
        assert "Summer Vacation (Delhi schools)" in names
        assert "Winter Vacation (Delhi schools)" in names

    def test_school_windows_have_end_date(self) -> None:
        for e in cal.events_in_range(None, None, "SCHOOL"):
            assert e.end_date is not None
            assert e.end_date >= e.event_date

    def test_cbse_2026_window_dates(self) -> None:
        cbse = [
            e
            for e in cal.events_in_range(None, None, "SCHOOL")
            if e.name.startswith("CBSE") and e.event_date.startswith("2026")
        ]
        assert len(cbse) == 1
        assert cbse[0].event_date == "2026-02-17"
        assert cbse[0].end_date == "2026-04-10"
        assert cbse[0].region is None  # national board

    def test_school_region_national_inclusive(self) -> None:
        # Delhi user sees Delhi breaks AND national CBSE windows.
        delhi = cal.events_in_range(None, None, "SCHOOL", region="Delhi")
        assert len(delhi) == 4
        # Tamil Nadu user sees only the national CBSE windows (no Delhi-tagged breaks).
        tn = cal.events_in_range(None, None, "SCHOOL", region="Tamil Nadu")
        assert {e.name for e in tn} == {"CBSE Board Exams (Class 10 & 12)"}
        assert len(tn) == 2  # 2026 + 2027 CBSE

    def test_school_endpoint(self) -> None:
        r = client.get("/ai/calendar/events", params={"kind": "SCHOOL"})
        assert r.status_code == 200
        events = r.json()["events"]
        assert len(events) == 4
        assert all(e["end_date"] for e in events)
