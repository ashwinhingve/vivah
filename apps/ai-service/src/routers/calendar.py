"""
Calendar Intelligence router (Phase 5 Tier 1).

Routes:
  GET /ai/calendar/muhurats?year=YYYY        -> vivah muhurat dates + Chaturmas window
  GET /ai/calendar/events?from=&to=&kind=    -> filtered overlay rows

Deterministic — pure data + math, NO LLM call (Rule-1 boundary, like Guna Milan).
Protected by X-Internal-Key (global middleware + per-route Depends).
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from src.deps.auth import verify_internal_key
from src.schemas.calendar import CalendarEventsResponse, MuhuratListResponse
from src.services import calendar_service

router = APIRouter(prefix="/ai/calendar", tags=["calendar"])

_ISO_DATE_LEN = 10  # YYYY-MM-DD


@router.get(
    "/muhurats",
    response_model=MuhuratListResponse,
    dependencies=[Depends(verify_internal_key)],
)
def get_muhurats(year: int = Query(ge=2026, le=2027)) -> MuhuratListResponse:
    """All vivah muhurat dates for `year`, with the Chaturmas blackout window."""
    window = calendar_service.chaturmas_window(year)
    if window is None:
        raise HTTPException(status_code=404, detail=f"No calendar data for {year}")
    muhurats = calendar_service.muhurats_for_year(year)
    return MuhuratListResponse(
        year=year, count=len(muhurats), chaturmas=window, muhurats=muhurats
    )


@router.get(
    "/events",
    response_model=CalendarEventsResponse,
    dependencies=[Depends(verify_internal_key)],
)
def get_events(
    date_from: Optional[str] = Query(default=None, alias="from"),
    date_to: Optional[str] = Query(default=None, alias="to"),
    kind: Optional[str] = Query(default=None),
    region: Optional[str] = Query(default=None),
    community: Optional[str] = Query(default=None),
) -> CalendarEventsResponse:
    """
    Overlay rows by inclusive ISO date range + optional kind. region/community
    are national-inclusive (a regional user keeps national rows; see
    calendar_service.events_in_range).
    """
    for label, value in (("from", date_from), ("to", date_to)):
        if value is not None and len(value) != _ISO_DATE_LEN:
            raise HTTPException(status_code=422, detail=f"{label} must be YYYY-MM-DD")
    events = calendar_service.events_in_range(date_from, date_to, kind, region, community)
    return CalendarEventsResponse(count=len(events), events=events)
