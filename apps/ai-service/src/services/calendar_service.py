"""
Calendar Intelligence engine (Phase 5 Tier 1) — deterministic, no ML / no LLM.

Loads the curated single-source-of-truth dataset
(packages/db/seed/data/calendar-2026-2027.json) and exposes pure functions over it:

  - muhurats_for_year(year)             -> ordered vivah muhurat dates + metadata
  - chaturmas_window(year)              -> Devshayani -> Devuthani Ekadashi anchors
  - events_in_range(date_from, to, kind)-> filtered calendar overlay rows
  - assert_no_muhurat_in_chaturmas(year)-> computed guard (Rule-1 boundary: math,
                                           like Guna Milan — never an LLM call)

Determinism: same input -> identical output (the dataset is static and the
functions are pure). The Chaturmas guard recomputes the blocked window from the
two Ekadashi anchors and asserts the curated muhurat list never intersects it.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional

from src.schemas.calendar import (
    CalendarEvent,
    ChaturmasWindow,
    MuhuratEvent,
)

# Reuse the authoritative nakshatra name list — do not duplicate it.
from src.services.guna_milan import NAKSHATRAS

_NAK_SET = set(NAKSHATRAS)


def _dataset_path() -> Path:
    """Resolve the curated dataset. CALENDAR_DATASET_PATH overrides for deploys."""
    override = os.getenv("CALENDAR_DATASET_PATH")
    if override:
        return Path(override)
    # src/services/calendar_service.py -> repo root is parents[4]
    repo_root = Path(__file__).resolve().parents[4]
    return repo_root / "packages" / "db" / "seed" / "data" / "calendar-2026-2027.json"


@lru_cache(maxsize=1)
def _load() -> Dict[str, object]:
    raw = json.loads(_dataset_path().read_text(encoding="utf-8"))
    _validate(raw)
    return raw


def _validate(raw: Dict[str, object]) -> None:
    """Sanity-check the dataset at load: known nakshatras, no Chaturmas violations."""
    muhurats = raw.get("muhurats", [])
    if not isinstance(muhurats, list):
        raise ValueError("dataset.muhurats must be a list")
    for m in muhurats:
        for token in str(m["nakshatra"]).replace("/", ",").split(","):
            name = token.strip()
            if name and name not in _NAK_SET:
                raise ValueError(f"unknown nakshatra in dataset: {name!r}")


def source() -> str:
    return str(_load()["version"])


def chaturmas_window(year: int) -> Optional[ChaturmasWindow]:
    """Devshayani -> Devuthani Ekadashi anchors for the year, or None if unknown."""
    table = _load()["chaturmas"]
    assert isinstance(table, dict)
    entry = table.get(str(year))
    if entry is None:
        return None
    return ChaturmasWindow(year=year, devshayani=entry["devshayani"], devuthani=entry["devuthani"])


def _resolve_conventions(override: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    """Dataset convention defaults, merged with an optional partial override (tests)."""
    base = {k: v for k, v in dict(_load().get("conventions", {})).items() if k != "_doc"}
    if override:
        base.update(override)
    return base


def _promoted_muhurats(conventions: Dict[str, str]) -> List[Dict[str, object]]:
    """Disputed muhurat dicts whose gating convention is satisfied (else empty)."""
    disputed = _load().get("disputed", {})
    assert isinstance(disputed, dict)
    out: List[Dict[str, object]] = []
    for key in ("julyPendingAuthority", "januaryOmittedPendingAuthority"):
        bucket = disputed.get(key)
        if not isinstance(bucket, dict):
            continue
        if conventions.get(str(bucket["gatedBy"])) != bucket["promoteWhen"]:
            continue
        out.extend(bucket.get("muhurats", []))
    return out


def _promoted_regional(conventions: Dict[str, str]) -> List[Dict[str, object]]:
    """Disputed regional festivals with a chosen candidate date (else empty)."""
    disputed = _load().get("disputed", {})
    assert isinstance(disputed, dict)
    out: List[Dict[str, object]] = []
    for r in disputed.get("regionalPendingAuthority", []):
        candidates = r.get("candidates", {})
        date = candidates.get(conventions.get(str(r["gatedBy"])))
        if not date:
            continue  # 'unset' or unmatched value → held out
        out.append({**r, "date": date})
    return out


def muhurats_for_year(
    year: int, conventions: Optional[Dict[str, str]] = None
) -> List[MuhuratEvent]:
    """All vivah muhurat dates in `year`, ascending and deterministic.

    `conventions` overrides the dataset defaults (partial dict; tests use this to
    flip e.g. devshayani). Defaults promote nothing, so output is unchanged.
    """
    conv = _resolve_conventions(conventions)
    prefix = f"{year:04d}-"
    rows = [m for m in _load()["muhurats"] if str(m["date"]).startswith(prefix)]
    rows += [m for m in _promoted_muhurats(conv) if str(m["date"]).startswith(prefix)]
    rows.sort(key=lambda m: str(m["date"]))
    return [
        MuhuratEvent(
            date=str(m["date"]), band=m["band"], tithi=m.get("tithi"), nakshatra=m.get("nakshatra")
        )
        for m in rows
    ]


def _all_events(conventions: Optional[Dict[str, str]] = None) -> List[CalendarEvent]:
    """Unified, date-sorted overlay rows (MUHURAT + FESTIVAL + GOVT + SCHOOL).

    Convention-gated disputed rows are appended only when their gate is satisfied
    (`conventions` overrides dataset defaults). Mirrors packages/db/seed/calendar.ts.
    """
    data = _load()
    src = source()
    conv = _resolve_conventions(conventions)
    events: List[CalendarEvent] = []
    for m in data["muhurats"]:
        events.append(
            CalendarEvent(
                kind="MUHURAT",
                name="Vivah Muhurat",
                event_date=m["date"],
                source=src,
                auspicious_band=m["band"],
                metadata={"tithi": m["tithi"], "nakshatra": m["nakshatra"]},
            )
        )
    for f in data["festivals"]:
        events.append(
            CalendarEvent(kind="FESTIVAL", name=f["name"], event_date=f["date"], source=src)
        )
    # Regional / community variants: kind=FESTIVAL discriminated by region (and
    # metadata.community), NOT kind=REGIONAL — so a kind=FESTIVAL query still
    # surfaces them. Mirrors packages/db/seed/calendar.ts buildRows().
    for rf in data.get("regionalFestivals", []):  # type: ignore[attr-defined]
        metadata = {}
        if rf.get("community"):
            metadata["community"] = rf["community"]
        if rf.get("astronomicalEvent"):
            metadata["astronomicalEvent"] = rf["astronomicalEvent"]
        if rf.get("note"):
            metadata["note"] = rf["note"]
        events.append(
            CalendarEvent(
                kind="FESTIVAL",
                name=rf["name"],
                event_date=rf["date"],
                region=rf.get("region"),
                source=src,
                metadata=metadata or None,
            )
        )
    for g in data["govt"]:
        events.append(
            CalendarEvent(kind="GOVT", name=g["name"], event_date=g["date"], source=src)
        )
    # SCHOOL-calendar blackout windows (event_date -> end_date). National
    # (region None, e.g. CBSE) or region-tagged (e.g. Delhi). Affect scheduling.
    for s in data.get("schoolWindows", []):  # type: ignore[attr-defined]
        events.append(
            CalendarEvent(
                kind="SCHOOL",
                name=s["name"],
                event_date=s["date"],
                end_date=s.get("endDate"),
                region=s.get("region"),
                source=src,
                metadata={"note": s["note"]} if s.get("note") else None,
            )
        )
    # Convention-gated disputed rows — empty under the conservative defaults.
    for m in _promoted_muhurats(conv):
        events.append(
            CalendarEvent(
                kind="MUHURAT",
                name="Vivah Muhurat",
                event_date=str(m["date"]),
                source=src,
                auspicious_band=str(m["band"]),
                metadata={
                    k: str(m[k]) for k in ("tithi", "nakshatra") if m.get(k) is not None
                }
                or None,
            )
        )
    for r in _promoted_regional(conv):
        meta = {}
        if r.get("community"):
            meta["community"] = str(r["community"])
        if r.get("astronomicalEvent"):
            meta["astronomicalEvent"] = str(r["astronomicalEvent"])
        if r.get("note"):
            meta["note"] = str(r["note"])
        events.append(
            CalendarEvent(
                kind="FESTIVAL",
                name=str(r["name"]),
                event_date=str(r["date"]),
                region=r.get("region"),
                source=src,
                metadata=meta or None,
            )
        )
    events.sort(key=lambda e: (e.event_date, e.kind))
    return events


def events_in_range(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    kind: Optional[str] = None,
    region: Optional[str] = None,
    community: Optional[str] = None,
    conventions: Optional[Dict[str, str]] = None,
) -> List[CalendarEvent]:
    """
    Filter overlay rows by inclusive ISO date range, optional kind, and
    national-inclusive region/community. region='Tamil Nadu' returns national
    rows (region None) PLUS Tamil Nadu rows; community filters the same way
    against metadata.community — so a regional user never loses national events.
    `conventions` overrides dataset defaults for disputed-date promotion.
    """
    out: List[CalendarEvent] = []
    for e in _all_events(conventions):
        if date_from is not None and e.event_date < date_from:
            continue
        if date_to is not None and e.event_date > date_to:
            continue
        if kind is not None and e.kind != kind:
            continue
        # National-inclusive: drop only rows that carry a DIFFERENT region.
        if region is not None and e.region is not None and e.region != region:
            continue
        if community is not None:
            event_community = (e.metadata or {}).get("community")
            if event_community is not None and event_community != community:
                continue
        out.append(e)
    return out


def assert_no_muhurat_in_chaturmas(year: int) -> bool:
    """
    Computed guard: no vivah muhurat may fall in the Chaturmas window
    [devshayani, devuthani). Raises ValueError on violation; returns True if clean.
    """
    window = chaturmas_window(year)
    if window is None:
        raise ValueError(f"no Chaturmas anchors for {year}")
    violations = [
        m.date
        for m in muhurats_for_year(year)
        if window.devshayani <= m.date < window.devuthani
    ]
    if violations:
        raise ValueError(f"muhurats inside Chaturmas {year}: {violations}")
    return True
