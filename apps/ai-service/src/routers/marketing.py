"""
Marketing Content Generation router.

Route: POST /ai/marketing/generate

Generates warm, premium wedding-context marketing copy (en + hi) for Smart Shaadi campaigns.
Caches results in Redis (TTL=7 days) and applies rate limiting.
Protected by X-Internal-Key.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from src.deps.auth import verify_internal_key
from src.schemas.marketing import GenerateMarketingRequest, GenerateMarketingResponse
from src.services.llm_client import ai_mock_enabled
from src.services.marketing_service import generate_campaign_content

router = APIRouter(prefix="/ai/marketing", tags=["marketing"])


@router.post(
    "/generate",
    response_model=GenerateMarketingResponse,
    dependencies=[Depends(verify_internal_key)],
)
async def generate(request: GenerateMarketingRequest) -> GenerateMarketingResponse:
    """
    Generate marketing copy (en + hi) for a Smart Shaadi campaign.

    - Checks Redis cache first (TTL=7 days).
    - Mock mode when LLM_PROVIDER key is unset or AI_FORCE_MOCK=true.
    - Calls configured provider (Gemini/Claude) via the adapter.
    - On parse error, retries once; if still malformed, returns 502.
    - Never falls back to deterministic copy (callers use templates.ts fallback).
    """
    return await generate_campaign_content(
        request=request,
        use_mock=ai_mock_enabled(),
    )
