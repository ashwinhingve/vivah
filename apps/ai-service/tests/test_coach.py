"""
Tests for the Conversation Coach service and router.

Run: pytest tests/test_coach.py -v

All 10 tests are mandatory per spec. Anthropic and Redis clients are mocked
so no real network calls are made during testing.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from src.main import app
from src.schemas.coach import CoachRequest, CoachResponse, CoachSuggestion, Message, ProfileSnapshot
from src.services.coach_service import (
    MOCK_SUGGESTIONS,
    _parse_xml_suggestions,
    build_prompt_context,
    detect_conversation_state,
    extract_shared_interests,
    get_suggestions,
)

# ---------------------------------------------------------------------------
# Shared TestClient — sends X-Internal-Key on every request
# ---------------------------------------------------------------------------

client = TestClient(app, headers={"X-Internal-Key": "dev-internal-key-change-in-prod"})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _iso_hours_ago(hours: float) -> str:
    return (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()


def _make_message(sender: str, text: str, hours_ago: float = 1.0) -> Message:
    return Message(sender=sender, text=text, timestamp=_iso_hours_ago(hours_ago))


def _make_profile(
    profile_id: str = "profile-a",
    interests: list[str] | None = None,
    hobbies: list[str] | None = None,
) -> ProfileSnapshot:
    return ProfileSnapshot(
        profile_id=profile_id,
        interests=interests or [],
        hobbies=hobbies or [],
    )


def _make_request(
    history: list[Message] | None = None,
    interests_a: list[str] | None = None,
    hobbies_a: list[str] | None = None,
    interests_b: list[str] | None = None,
    hobbies_b: list[str] | None = None,
) -> CoachRequest:
    return CoachRequest(
        profile_a=_make_profile("prof-a", interests_a or [], hobbies_a or []),
        profile_b=_make_profile("prof-b", interests_b or [], hobbies_b or []),
        conversation_history=history or [],
        match_id="match-001",
    )


# ---------------------------------------------------------------------------
# 1. test_detect_state_starting_empty_history
# ---------------------------------------------------------------------------

def test_detect_state_starting_empty_history() -> None:
    """Empty history → STARTING."""
    state = detect_conversation_state([])
    assert state == "STARTING"


# ---------------------------------------------------------------------------
# 2. test_detect_state_starting_few_messages
# ---------------------------------------------------------------------------

def test_detect_state_starting_few_messages() -> None:
    """Fewer than 6 messages → STARTING regardless of recency."""
    history = [_make_message("A", f"msg {i}", hours_ago=0.5) for i in range(5)]
    state = detect_conversation_state(history)
    assert state == "STARTING"


# ---------------------------------------------------------------------------
# 3. test_detect_state_cooling_old_last_message
# ---------------------------------------------------------------------------

def test_detect_state_cooling_old_last_message() -> None:
    """Last message > 48h ago → COOLING."""
    # Build 6 messages where the last one (index -1) is 72 hours old.
    # Timestamps must be in ascending order so history[-1] is the most-recently
    # positioned element — but here we want it to be the OLDEST wall-clock time,
    # which means we put a very-old timestamp at the end of the list (the service
    # reads history[-1] as "last sent", trusting the caller orders oldest→newest).
    history = [_make_message("A", f"msg {i}", hours_ago=float(100 - i)) for i in range(5)]
    # Append a message that is 72 hours old as the "last" entry (most recent slot)
    history.append(_make_message("B", "old message", hours_ago=72))
    state = detect_conversation_state(history)
    assert state == "COOLING"


# ---------------------------------------------------------------------------
# 4. test_detect_state_active
# ---------------------------------------------------------------------------

def test_detect_state_active() -> None:
    """6+ recent messages with short gaps → ACTIVE."""
    history = [_make_message("A" if i % 2 == 0 else "B", f"msg {i}", hours_ago=float(i)) for i in range(7)]
    history.sort(key=lambda m: m.timestamp)
    state = detect_conversation_state(history)
    assert state == "ACTIVE"


# ---------------------------------------------------------------------------
# 5. test_extract_shared_interests_with_overlap
# ---------------------------------------------------------------------------

def test_extract_shared_interests_with_overlap() -> None:
    """Shared interests are returned (case-insensitive, max 5)."""
    profile_a = _make_profile(interests=["Music", "Travel", "Cooking"], hobbies=["Hiking"])
    profile_b = _make_profile(interests=["music", "travel", "Yoga"], hobbies=["hiking", "Reading"])

    shared = extract_shared_interests(profile_a, profile_b)

    assert "music" in shared
    assert "travel" in shared
    assert "hiking" in shared
    assert len(shared) <= 5


# ---------------------------------------------------------------------------
# 6. test_extract_shared_interests_no_overlap_returns_defaults
# ---------------------------------------------------------------------------

def test_extract_shared_interests_no_overlap_returns_defaults() -> None:
    """No overlap → defaults returned."""
    profile_a = _make_profile(interests=["Chess"], hobbies=["Painting"])
    profile_b = _make_profile(interests=["Cricket"], hobbies=["Gardening"])

    shared = extract_shared_interests(profile_a, profile_b)

    assert shared == ["general life goals", "family values"]


# ---------------------------------------------------------------------------
# 7. test_get_suggestions_mock_mode_no_api_call
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_suggestions_mock_mode_no_api_call() -> None:
    """In mock mode, Anthropic is never called and MOCK_SUGGESTIONS are returned."""
    mock_anthropic = MagicMock()
    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=None)

    request = _make_request()
    result = await get_suggestions(
        request=request,
        redis_client=mock_redis,
        anthropic_client=mock_anthropic,
        use_mock=True,
    )

    mock_anthropic.messages.create.assert_not_called()
    assert isinstance(result, CoachResponse)
    assert len(result.suggestions) == 3
    assert result.cached is False


# ---------------------------------------------------------------------------
# 8. test_get_suggestions_response_structure_valid
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_suggestions_response_structure_valid() -> None:
    """Mock mode response has correct types for all fields."""
    request = _make_request()
    result = await get_suggestions(
        request=request,
        redis_client=AsyncMock(get=AsyncMock(return_value=None)),
        anthropic_client=MagicMock(),
        use_mock=True,
    )

    assert result.state in {"STARTING", "ACTIVE", "COOLING"}
    assert isinstance(result.cached, bool)
    for s in result.suggestions:
        assert isinstance(s.text, str) and s.text
        assert isinstance(s.reason, str) and s.reason
        assert s.tone in {"warm", "curious", "light"}


# ---------------------------------------------------------------------------
# 9. test_suggestion_xml_parsing_with_valid_response
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_suggestion_xml_parsing_with_valid_response() -> None:
    """Anthropic XML response is parsed into 3 CoachSuggestion objects."""
    valid_xml = """
<suggestions>
  <suggestion>
    <text>Aap ka favourite travel destination kaunsa hai?</text>
    <reason>Opens travel topic naturally</reason>
    <tone>curious</tone>
  </suggestion>
  <suggestion>
    <text>Family ke saath koi special tradition follow karte hain?</text>
    <reason>Family-oriented, warm opener</reason>
    <tone>warm</tone>
  </suggestion>
  <suggestion>
    <text>Agar ek week ki chhutti mile toh kya karoge?</text>
    <reason>Reveals aspirations lightly</reason>
    <tone>light</tone>
  </suggestion>
</suggestions>
"""
    # Build a fake Anthropic response object
    fake_content = MagicMock()
    fake_content.text = valid_xml
    fake_response = MagicMock()
    fake_response.content = [fake_content]

    mock_anthropic = MagicMock()
    mock_anthropic.messages.create.return_value = fake_response

    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=None)
    mock_redis.setex = AsyncMock()

    request = _make_request(
        interests_a=["travel", "music"],
        interests_b=["travel", "cooking"],
    )

    with patch(
        "src.services.coach_service.Path.read_text",
        return_value="You are a culturally intelligent matchmaking assistant. {state_context} {shared_interests}",
    ):
        result = await get_suggestions(
            request=request,
            redis_client=mock_redis,
            anthropic_client=mock_anthropic,
            use_mock=False,
        )

    assert len(result.suggestions) == 3
    assert result.suggestions[0].tone == "curious"
    assert result.suggestions[1].tone == "warm"
    assert result.suggestions[2].tone == "light"
    assert result.cached is False
    mock_anthropic.messages.create.assert_called_once()


# ---------------------------------------------------------------------------
# 10. test_cache_hit_returns_cached_true
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cache_hit_returns_cached_true() -> None:
    """When Redis has a cached result, cached=True and Anthropic is NOT called."""
    cached_payload = {
        "suggestions": [s.model_dump() for s in MOCK_SUGGESTIONS],
        "state": "ACTIVE",
    }

    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=json.dumps(cached_payload))

    mock_anthropic = MagicMock()

    request = _make_request()
    result = await get_suggestions(
        request=request,
        redis_client=mock_redis,
        anthropic_client=mock_anthropic,
        use_mock=False,
    )

    assert result.cached is True
    assert result.state == "ACTIVE"
    assert len(result.suggestions) == 3
    mock_anthropic.messages.create.assert_not_called()
