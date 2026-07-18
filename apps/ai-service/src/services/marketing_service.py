"""
Marketing Content Generation service.

Generates warm, premium marketing copy for Smart Shaadi campaigns.
Uses Gemini/Claude via the LLM adapter; caches in Redis (TTL=7d).
Handles malformed JSON gracefully with one retry; then 502 on persistent failure.
"""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone

import structlog

from src.schemas.marketing import (
    GenerateMarketingRequest,
    GenerateMarketingResponse,
    GeneratedCopy,
)
from src.services.llm_client import get_llm_client, strip_code_fences
from src.services.observability import capture_exception

log = structlog.get_logger("marketing-service")

_redis_client = None


def _get_redis():
    """Return a lazy-initialized async Redis client. Returns None on failure."""
    global _redis_client  # noqa: PLW0603
    if _redis_client is not None:
        return _redis_client
    try:
        import redis.asyncio as aioredis

        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        _redis_client = aioredis.from_url(redis_url, decode_responses=True)
        return _redis_client
    except Exception as exc:  # noqa: BLE001
        log.warning("redis_init_failed", error=str(exc))
        return None


def _get_llm():
    """Lazy-initialize LLM client."""
    return get_llm_client(is_async=False)


def _compute_cache_key(req: GenerateMarketingRequest) -> str:
    """
    Compute a stable cache key from request parameters.

    Hash includes campaign_name, segment_key, template_key, conversion_goal, brief.
    Ensures cache invalidation when inputs change.
    """
    key_data = f"{req.campaign_name}|{req.segment_key}|{req.template_key}|{req.conversion_goal}|{req.brief or ''}"
    key_hash = hashlib.sha256(key_data.encode()).hexdigest()[:12]
    return f"marketing:gen:{key_hash}"


async def generate_campaign_content(
    request: GenerateMarketingRequest,
    use_mock: bool = True,
) -> GenerateMarketingResponse:
    """
    Generate marketing copy (en + hi) for a Smart Shaadi campaign.

    Flow:
    1. Check Redis cache (TTL=7 days).
    2. If mock mode → return MOCK_CONTENT instantly.
    3. Build prompt context from campaign metadata.
    4. Call LLM (Gemini/Claude) with structured output.
    5. Parse JSON response (retry once on parse failure).
    6. Write result to Redis (TTL=7 days).
    7. Return GenerateMarketingResponse.

    On parse failure after retry → raise exception (502 to caller).
    On LLM error → log and raise (caller handles retry via BullMQ).
    """
    redis_client = _get_redis()

    # ── 1. Redis cache check ─────────────────────────────────────────────────
    cache_key = _compute_cache_key(request)
    if redis_client is not None:
        try:
            cached_raw = await redis_client.get(cache_key)
            if cached_raw:
                cached_data = json.loads(cached_raw)
                return GenerateMarketingResponse(
                    en=GeneratedCopy(**cached_data["en"]),
                    hi=GeneratedCopy(**cached_data["hi"]),
                    modelVersion=cached_data["modelVersion"],
                )
        except Exception as exc:  # noqa: BLE001
            log.warning("marketing_cache_read_failed", error=str(exc))

    # ── 2. Mock mode ─────────────────────────────────────────────────────────
    if use_mock:
        return _mock_content()

    # ── 3. Build prompt ──────────────────────────────────────────────────────
    llm_client = _get_llm()
    if llm_client is None:
        log.error("llm_client_unavailable")
        raise RuntimeError("LLM client not available")

    system_prompt = _build_system_prompt()
    user_prompt = _build_user_prompt(request)

    # ── 4. Call LLM (with retry) ─────────────────────────────────────────────
    result = None
    for attempt in range(2):
        try:
            response = llm_client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2000,
                temperature=0.7,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
                extra_headers={
                    "Helicone-Property-Feature": "marketing-generation",
                    "Helicone-Cache-Enabled": "true",
                },
            )
            raw_text: str = response.content[0].text

            # ── 5. Parse JSON response ──────────────────────────────────────
            result = _parse_marketing_response(raw_text)
            if result:
                break
            log.warning("marketing_parse_retry", attempt=attempt)

        except json.JSONDecodeError as exc:
            log.warning("marketing_json_parse_failed", attempt=attempt, error=str(exc))
            if attempt == 1:
                raise
        except Exception as exc:  # noqa: BLE001
            log.error("llm_call_failed", error=str(exc), attempt=attempt)
            capture_exception(exc, feature="marketing-content-generation")
            raise

    if not result:
        log.error("marketing_parse_final_failure")
        raise ValueError("Failed to parse marketing copy after retries")

    # ── 6. Write to Redis ────────────────────────────────────────────────────
    if redis_client is not None:
        try:
            payload = {
                "en": result.en.model_dump(),
                "hi": result.hi.model_dump(),
                "modelVersion": result.modelVersion,
            }
            await redis_client.setex(cache_key, 7 * 24 * 3600, json.dumps(payload))
        except Exception as exc:  # noqa: BLE001
            log.warning("marketing_cache_write_failed", error=str(exc))

    return result


def _build_system_prompt() -> str:
    """Build the system prompt for marketing copy generation."""
    return """You are a premium wedding-focused marketing copywriter for Smart Shaadi,
a matrimonial platform connecting families across India.

Your tone is:
- WARM and GENUINE — never pushy, always respectful of the matrimonial context
- PREMIUM — elegant language, cultural sensitivity (wedding customs matter)
- HINDI AUTHENTIC — when writing Hindi, use real Devanagari script, not transliteration;
  capture warmth and respect appropriate for families seeking marriages

Each piece of copy must:
1. Speak to the specific segment (e.g., incomplete profiles, inactive users, vendors)
2. Honor the conversion goal (complete profile, make a booking, start subscription)
3. Include a clear, action-oriented CTA
4. Fit the character limits (subject: ≤255 chars, bodyShort: ≤400 chars, ctaText: ≤100 chars)

You MUST respond with valid JSON (no markdown fences, plain JSON object).
Never include JSON code fences like ```json ... ``` — return raw JSON only."""


def _build_user_prompt(req: GenerateMarketingRequest) -> str:
    """Build the user prompt with campaign metadata."""
    brief_note = f"\nExtra guidance: {req.brief}" if req.brief else ""
    description_note = f"Description: {req.description}" if req.description else ""

    return f"""Generate marketing copy for:
Campaign: {req.campaign_name}
{description_note}
Segment: {req.segment_key}
Template/Theme: {req.template_key}
Conversion Goal: {req.conversion_goal}{brief_note}

Respond with this exact JSON structure (no markdown, raw JSON):
{{
  "en": {{
    "subjectLine": "...",
    "bodyShort": "...",
    "bodyLong": "...",
    "ctaText": "..."
  }},
  "hi": {{
    "subjectLine": "...",
    "bodyShort": "...",
    "bodyLong": "...",
    "ctaText": "..."
  }},
  "modelVersion": "claude-sonnet-4-6"
}}"""


def _parse_marketing_response(raw_text: str) -> GenerateMarketingResponse | None:
    """
    Parse the LLM response as JSON and return GenerateMarketingResponse.

    Strips code fences if present. Returns None on parse failure.
    """
    try:
        # Remove markdown fences if present
        text = strip_code_fences(raw_text)
        data = json.loads(text)

        # Validate shape
        if not data.get("en") or not data.get("hi"):
            log.warning("marketing_response_missing_languages")
            return None

        en_data = data["en"]
        hi_data = data["hi"]

        # Ensure all required fields
        for lang_data in [en_data, hi_data]:
            if not all(k in lang_data for k in ["subjectLine", "bodyShort", "bodyLong", "ctaText"]):
                log.warning("marketing_response_missing_fields", lang_data=lang_data)
                return None

        return GenerateMarketingResponse(
            en=GeneratedCopy(
                subjectLine=en_data["subjectLine"],
                bodyShort=en_data["bodyShort"],
                bodyLong=en_data["bodyLong"],
                ctaText=en_data["ctaText"],
            ),
            hi=GeneratedCopy(
                subjectLine=hi_data["subjectLine"],
                bodyShort=hi_data["bodyShort"],
                bodyLong=hi_data["bodyLong"],
                ctaText=hi_data["ctaText"],
            ),
            modelVersion=data.get("modelVersion", "claude-sonnet-4-6"),
        )

    except json.JSONDecodeError as exc:
        log.warning("marketing_json_decode_failed", error=str(exc))
        return None
    except Exception as exc:  # noqa: BLE001
        log.warning("marketing_parse_exception", error=str(exc))
        return None


def _mock_content() -> GenerateMarketingResponse:
    """Return mock marketing copy for development/testing."""
    return GenerateMarketingResponse(
        en=GeneratedCopy(
            subjectLine="Find Your Perfect Match on Smart Shaadi",
            bodyShort="Join thousands of families finding meaningful connections. Complete your profile today.",
            bodyLong="Smart Shaadi brings families together to find genuine matches grounded in values and compatibility. Start your matrimonial journey today.",
            ctaText="Complete My Profile",
        ),
        hi=GeneratedCopy(
            subjectLine="स्मार्ट शादी पर अपना जीवन साथी खोजें",
            bodyShort="हजारों परिवार गहरे संबंध ढूंढ रहे हैं। अपनी प्रोफाइल पूरी करें।",
            bodyLong="स्मार्ट शादी परिवारों को एक साथ लाता है ताकि सार्थक रिश्ते खोजें। आज ही अपनी शादी की यात्रा शुरू करें।",
            ctaText="मेरी प्रोफाइल भरें",
        ),
        modelVersion="mock-v1",
    )
