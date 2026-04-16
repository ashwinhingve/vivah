"""
Horoscope router — Guna Milan (Ashtakoot) compatibility calculation.

Route: POST /ai/horoscope/guna
"""

from fastapi import APIRouter, HTTPException

from src.schemas.horoscope import GunaInput, GunaResultResponse
from src.services.guna_milan import calculator

router = APIRouter(prefix="/ai/horoscope", tags=["horoscope"])


@router.post("/guna", response_model=GunaResultResponse)
def calculate_guna_milan(payload: GunaInput) -> dict:
    """
    Calculate Ashtakoot Guna Milan score for two horoscope profiles.

    - profile_a: groom (boy)
    - profile_b: bride (girl)

    Returns a 36-point compatibility breakdown with all 8 Ashtakoot factors,
    Mangal Dosha conflict flag, and a plain-language interpretation.
    """
    try:
        result = calculator.calculate(
            boy_rashi=payload.profile_a.rashi,
            boy_nak=payload.profile_a.nakshatra,
            girl_rashi=payload.profile_b.rashi,
            girl_nak=payload.profile_b.nakshatra,
            boy_manglik=payload.profile_a.manglik,
            girl_manglik=payload.profile_b.manglik,
        )
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"Calculation error: {exc}") from exc

    return result
