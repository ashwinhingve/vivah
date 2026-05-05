"""
Conversation Coach service — AI-powered suggestion generation.

Uses claude-sonnet-4-6 via Helicone proxy for suggestion quality.
Caches results in Redis (TTL=3600) to avoid redundant LLM calls.
Falls back to MOCK_SUGGESTIONS on any error — never fails the user.
"""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import structlog

from src.schemas.coach import CoachRequest, CoachResponse, CoachSuggestion, Message, ProfileSnapshot

log = structlog.get_logger("coach-service")

# ---------------------------------------------------------------------------
# Lazy singletons
# ---------------------------------------------------------------------------

_redis_client = None
_anthropic_client = None


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


def _get_anthropic():
    """Return a lazy-initialized Anthropic client."""
    global _anthropic_client  # noqa: PLW0603
    if _anthropic_client is not None:
        return _anthropic_client
    try:
        import anthropic

        helicone_api_key = os.getenv("HELICONE_API_KEY", "")
        if helicone_api_key:
            # Route through Helicone proxy for observability
            _anthropic_client = anthropic.Anthropic(
                api_key=os.getenv("ANTHROPIC_API_KEY", ""),
                base_url="https://anthropic.helicone.ai",
                default_headers={
                    "Helicone-Auth": f"Bearer {helicone_api_key}",
                },
            )
        else:
            _anthropic_client = anthropic.Anthropic(
                api_key=os.getenv("ANTHROPIC_API_KEY", ""),
            )
        return _anthropic_client
    except Exception as exc:  # noqa: BLE001
        log.warning("anthropic_init_failed", error=str(exc))
        return None


# ---------------------------------------------------------------------------
# Mock suggestions (used in mock mode and as error fallback)
# ---------------------------------------------------------------------------

MOCK_SUGGESTIONS: list[CoachSuggestion] = [
    CoachSuggestion(
        text="Aap dono ko music pasand hai — kaunsa last concert ya performance attend ki?",
        reason="Shared music interest opens personal storytelling",
        tone="curious",
    ),
    CoachSuggestion(
        text="Family ke saath weekends kaisa spend karte hain aap generally?",
        reason="Family-oriented question, natural in matrimonial context",
        tone="warm",
    ),
    CoachSuggestion(
        text="Agar ek baar budget ki chinta na ho toh — kahan travel karna chahoge?",
        reason="Dream question reveals values and aspirations",
        tone="light",
    ),
]

# ---------------------------------------------------------------------------
# Core helper functions
# ---------------------------------------------------------------------------


def detect_conversation_state(
    history: list[Message],
) -> Literal["STARTING", "ACTIVE", "COOLING"]:
    """
    Classify conversation state from message history.

    STARTING: fewer than 6 messages, or empty history
    COOLING:  last message > 48 hours ago, OR average gap of last 5 messages > 24h with > 6 messages
    ACTIVE:   everything else
    """
    if len(history) < 6:
        return "STARTING"

    now = datetime.now(timezone.utc)

    def parse_ts(ts: str) -> datetime:
        dt = datetime.fromisoformat(ts)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt

    last_ts = parse_ts(history[-1].timestamp)
    hours_since_last = (now - last_ts).total_seconds() / 3600

    if hours_since_last > 48:
        return "COOLING"

    if len(history) > 6:
        recent = history[-5:]
        if len(recent) >= 2:
            gaps: list[float] = []
            for i in range(1, len(recent)):
                gap = (parse_ts(recent[i].timestamp) - parse_ts(recent[i - 1].timestamp)).total_seconds() / 3600
                gaps.append(abs(gap))
            avg_gap = sum(gaps) / len(gaps) if gaps else 0
            if avg_gap > 24:
                return "COOLING"

    return "ACTIVE"


def extract_shared_interests(
    profile_a: ProfileSnapshot,
    profile_b: ProfileSnapshot,
) -> list[str]:
    """
    Return up to 5 shared interests/hobbies between two profiles.

    Falls back to ["general life goals", "family values"] if no overlap.
    """
    set_a = {item.lower().strip() for item in (profile_a.interests + profile_a.hobbies) if item.strip()}
    set_b = {item.lower().strip() for item in (profile_b.interests + profile_b.hobbies) if item.strip()}

    shared = sorted(set_a & set_b)[:5]
    if not shared:
        return ["general life goals", "family values"]
    return shared


def build_prompt_context(
    state: str,
    shared: list[str],
    history: list[Message],
) -> str:
    """
    Build the user-turn content string for the Anthropic messages call.

    Includes the state context phrase, shared interests, and last 3 messages.
    Each message is truncated to 200 chars.
    """
    state_phrases: dict[str, str] = {
        "STARTING": "This is an early conversation — they have just started talking.",
        "ACTIVE": "This is an engaged, ongoing conversation.",
        "COOLING": "The conversation has slowed down — they haven't talked in a while.",
    }
    state_context = state_phrases.get(state, state_phrases["ACTIVE"])
    shared_str = ", ".join(shared) if shared else "none identified"

    if history:
        last_three = history[-3:]
        lines: list[str] = []
        for msg in last_three:
            label = "Profile A" if msg.sender == "A" else "Profile B"
            text = msg.text[:200]
            lines.append(f"[{label}]: {text}")
        history_text = "\n".join(lines)
    else:
        history_text = "No messages yet."

    return (
        f"State context: {state_context}\n"
        f"Shared interests: {shared_str}\n\n"
        f"Recent conversation:\n{history_text}\n\n"
        f"Generate 3 conversation suggestions."
    )


# ---------------------------------------------------------------------------
# XML parser
# ---------------------------------------------------------------------------


def _parse_xml_suggestions(xml_text: str) -> list[CoachSuggestion]:
    """
    Extract suggestions from the model's XML output using regex.

    Returns up to 3 CoachSuggestion objects. Falls back to MOCK_SUGGESTIONS
    if parsing fails or fewer than 3 valid suggestions are found.
    """
    pattern = re.compile(
        r"<suggestion>\s*"
        r"<text>(.*?)</text>\s*"
        r"<reason>(.*?)</reason>\s*"
        r"<tone>(warm|curious|light)</tone>\s*"
        r"</suggestion>",
        re.DOTALL,
    )
    matches = pattern.findall(xml_text)

    suggestions: list[CoachSuggestion] = []
    for text, reason, tone in matches[:3]:
        suggestions.append(
            CoachSuggestion(
                text=text.strip(),
                reason=reason.strip(),
                tone=tone.strip(),  # type: ignore[arg-type]
            )
        )

    if len(suggestions) < 3:
        log.warning("xml_parse_incomplete", found=len(suggestions), returning_mock=True)
        return MOCK_SUGGESTIONS

    return suggestions


# ---------------------------------------------------------------------------
# Main service function
# ---------------------------------------------------------------------------


async def get_suggestions(
    request: CoachRequest,
    redis_client=None,
    anthropic_client=None,
    use_mock: bool = True,
) -> CoachResponse:
    """
    Generate 3 conversation suggestions for the given match pair.

    Flow:
    1. Check Redis cache (key: "coach:{min_id}:{max_id}")
    2. If use_mock → return MOCK_SUGGESTIONS instantly, no cache write
    3. Detect state, extract shared interests, build prompt context
    4. Load prompt from prompts/conversation-coach-v1.md
    5. Call Anthropic claude-sonnet-4-6 with Helicone headers
    6. Parse XML response
    7. Write result to Redis (TTL=3600)
    8. Return CoachResponse

    On any Anthropic exception → log error, return MOCK_SUGGESTIONS (never fail user).
    """
    # Use lazy singletons if callers pass None (e.g. the router)
    if redis_client is None:
        redis_client = _get_redis()
    if anthropic_client is None:
        anthropic_client = _get_anthropic()

    # ── 1. Redis cache check ─────────────────────────────────────────────────
    ids = sorted([request.profile_a.profile_id, request.profile_b.profile_id])
    cache_key = f"coach:{ids[0]}:{ids[1]}"

    if redis_client is not None:
        try:
            cached_raw = await redis_client.get(cache_key)
            if cached_raw:
                cached_data = json.loads(cached_raw)
                return CoachResponse(
                    suggestions=[CoachSuggestion(**s) for s in cached_data["suggestions"]],
                    state=cached_data["state"],
                    cached=True,
                )
        except Exception as exc:  # noqa: BLE001
            log.warning("redis_cache_read_failed", error=str(exc))

    # ── 2. Mock mode ─────────────────────────────────────────────────────────
    if use_mock:
        state = detect_conversation_state(request.conversation_history)
        return CoachResponse(
            suggestions=MOCK_SUGGESTIONS,
            state=state,
            cached=False,
        )

    # ── 3. Detect state + shared interests ───────────────────────────────────
    state = detect_conversation_state(request.conversation_history)
    shared = extract_shared_interests(request.profile_a, request.profile_b)
    user_content = build_prompt_context(state, shared, request.conversation_history)

    # ── 4. Load prompt template ───────────────────────────────────────────────
    prompt_path = Path(__file__).parents[4] / "prompts" / "conversation-coach-v1.md"
    try:
        system_prompt = prompt_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        log.error("prompt_file_not_found", path=str(prompt_path))
        return CoachResponse(suggestions=MOCK_SUGGESTIONS, state=state, cached=False)

    # ── 5. Call Anthropic ────────────────────────────────────────────────────
    helicone_api_key = os.getenv("HELICONE_API_KEY", "")
    extra_headers: dict[str, str] = {
        "Helicone-Property-Feature": "conversation-coach",
        "Helicone-User-Id": request.profile_a.profile_id,
        "Helicone-Cache-Enabled": "true",
    }
    if helicone_api_key:
        extra_headers["Helicone-Auth"] = f"Bearer {helicone_api_key}"

    try:
        if anthropic_client is None:
            raise RuntimeError("Anthropic client not available")

        response = anthropic_client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=800,
            temperature=0.7,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content}],
            extra_headers=extra_headers,
        )
        raw_text: str = response.content[0].text
        suggestions = _parse_xml_suggestions(raw_text)

    except Exception as exc:  # noqa: BLE001
        log.error("anthropic_call_failed", error=str(exc), fallback="mock_suggestions")
        return CoachResponse(suggestions=MOCK_SUGGESTIONS, state=state, cached=False)

    # ── 6. Write to Redis ────────────────────────────────────────────────────
    result = CoachResponse(suggestions=suggestions, state=state, cached=False)
    if redis_client is not None:
        try:
            payload = {
                "suggestions": [s.model_dump() for s in suggestions],
                "state": state,
            }
            await redis_client.setex(cache_key, 3600, json.dumps(payload))
        except Exception as exc:  # noqa: BLE001
            log.warning("redis_cache_write_failed", error=str(exc))

    return result
