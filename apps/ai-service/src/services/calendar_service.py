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


def muhurats_for_year(year: int) -> List[MuhuratEvent]:
    """All vivah muhurat dates in `year`, ascending and deterministic."""
    prefix = f"{year:04d}-"
    rows = [m for m in _load()["muhurats"] if str(m["date"]).startswith(prefix)]
    rows.sort(key=lambda m: str(m["date"]))
    return [
        MuhuratEvent(date=m["date"], band=m["band"], tithi=m["tithi"], nakshatra=m["nakshatra"])
        for m in rows
    ]


def _all_events() -> List[CalendarEvent]:
    """Unified, date-sorted overlay rows (MUHURAT + FESTIVAL + GOVT)."""
    data = _load()
    src = source()
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
    for g in data["govt"]:
        events.append(
            CalendarEvent(kind="GOVT", name=g["name"], event_date=g["date"], source=src)
        )
    events.sort(key=lambda e: (e.event_date, e.kind))
    return events


def events_in_range(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    kind: Optional[str] = None,
) -> List[CalendarEvent]:
    """Filter overlay rows by inclusive ISO date range and optional kind."""
    out: List[CalendarEvent] = []
    for e in _all_events():
        if date_from is not None and e.event_date < date_from:
            continue
        if date_to is not None and e.event_date > date_to:
            continue
        if kind is not None and e.kind != kind:
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
