"""
Calendar Intelligence schemas (Phase 5 Tier 1).

Pydantic models for the deterministic muhurat / festival calendar.
Mirrors packages/schemas/src/calendar.ts (kind + auspicious_band enums).
No ML, no LLM — pure data + math.
"""

from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

CalendarEventKind = Literal["MUHURAT", "FESTIVAL", "SCHOOL", "GOVT", "REGIONAL", "BLACKOUT"]
AuspiciousBand = Literal["NONE", "LOW", "MEDIUM", "HIGH", "PEAK"]


class CalendarEvent(BaseModel):
    """A single calendar overlay row (muhurat / festival / govt holiday)."""

    kind: CalendarEventKind
    name: str
    event_date: str = Field(description="ISO date YYYY-MM-DD")
    end_date: Optional[str] = None
    region: Optional[str] = None  # None = national
    source: str
    auspicious_band: AuspiciousBand = "NONE"
    metadata: Optional[Dict[str, str]] = None  # tithi / nakshatra for muhurats


class MuhuratEvent(BaseModel):
    """A vivah (marriage) muhurat date with panchang metadata."""

    date: str = Field(description="ISO date YYYY-MM-DD")
    band: AuspiciousBand
    # Optional: convention-promoted disputed dates (e.g. the Jan Kharmas dates)
    # may not yet have sourced tithi/nakshatra. Live dataset rows always carry them.
    tithi: Optional[str] = None
    nakshatra: Optional[str] = None


class ChaturmasWindow(BaseModel):
    """
    The Chaturmas blackout for a year. Weddings are blocked in
    [devshayani, devuthani) — weddings resume on the devuthani date.
    """

    year: int
    devshayani: str  # Ashadha Shukla Ekadashi — Chaturmas begins
    devuthani: str  # Kartika Shukla (Prabodhini) Ekadashi — Chaturmas ends


class MuhuratListResponse(BaseModel):
    year: int
    count: int
    chaturmas: ChaturmasWindow
    muhurats: List[MuhuratEvent]


class CalendarEventsResponse(BaseModel):
    count: int
    events: List[CalendarEvent]
