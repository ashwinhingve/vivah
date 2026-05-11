"""
Hindi <-> English translation router.

Route: POST /ai/translate

Called by apps/api/src/chat/router.ts on chat translate requests.
Protected by X-Internal-Key (global middleware + per-route Depends).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from src.deps.auth import verify_internal_key
from src.schemas.translate import TranslateRequest, TranslateResponse
from src.services.translate_service import translate

router = APIRouter(prefix="/ai/translate", tags=["translate"])


@router.post(
    "",
    response_model=TranslateResponse,
    dependencies=[Depends(verify_internal_key)],
)
async def translate_endpoint(request: TranslateRequest) -> TranslateResponse:
    """
    Translate text between Hindi and English.

    - Accepts `{ text, target }` where target is "hi" or "en".
    - Returns `{ translated, model, target }`.
    - First call per direction lazily downloads the Helsinki-NLP model.
    """
    return await translate(request)
