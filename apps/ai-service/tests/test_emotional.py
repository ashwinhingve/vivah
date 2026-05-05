"""
Tests for Emotional Score router + service.

HuggingFace pipeline is always mocked — no real model loading in tests.
Uses FastAPI dependency_overrides to inject mock pipeline cleanly.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from src.main import app
from src.routers.emotional import get_pipeline
from src.services.emotional_service import (
    compute_combined_score,
    compute_curiosity_score,
    compute_engagement_score,
    compute_enthusiasm_score,
    compute_sentiment_score,
    determine_label,
    determine_trend,
)
from src.schemas.emotional import EmotionalBreakdown, EmotionalMessage

# ── Helpers ───────────────────────────────────────────────────────────────────

INTERNAL_KEY = "dev-internal-key-change-in-prod"
AUTH_HEADERS = {"x-internal-key": INTERNAL_KEY}


def make_msg(sender: str, text: str, timestamp: str = "2026-05-05T10:00:00Z") -> dict:
    return {"sender": sender, "text": text, "timestamp": timestamp}


def make_msgs(n: int, include_questions: bool = False) -> list[dict]:
    """Generate n alternating A/B messages with sequential timestamps."""
    msgs = []
    for i in range(n):
        sender = "A" if i % 2 == 0 else "B"
        text = f"Hello message number {i}{'?' if include_questions else ''}"
        ts = f"2026-05-05T{10 + i // 60:02d}:{i % 60:02d}:00Z"
        msgs.append({"sender": sender, "text": text, "timestamp": ts})
    return msgs


def make_mock_pipeline(label: str = "positive", score: float = 0.85) -> MagicMock:
    mock = MagicMock()
    mock.return_value = [{"label": label, "score": score}]
    return mock


@pytest.fixture
def client_with_mock_pipeline(mock_pipeline=None):
    """Return a TestClient with the pipeline dependency overridden."""
    if mock_pipeline is None:
        mock_pipeline = make_mock_pipeline()

    def override():
        return mock_pipeline

    app.dependency_overrides[get_pipeline] = override
    with TestClient(app, headers=AUTH_HEADERS) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def positive_client():
    mock = make_mock_pipeline("positive", 0.9)

    def override():
        return mock

    app.dependency_overrides[get_pipeline] = override
    with TestClient(app, headers=AUTH_HEADERS) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def negative_client():
    mock = make_mock_pipeline("negative", 0.9)

    def override():
        return mock

    app.dependency_overrides[get_pipeline] = override
    with TestClient(app, headers=AUTH_HEADERS) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def none_pipeline_client():
    def override():
        return None

    app.dependency_overrides[get_pipeline] = override
    with TestClient(app, headers=AUTH_HEADERS) as c:
        yield c
    app.dependency_overrides.clear()


# ── Router tests ──────────────────────────────────────────────────────────────


def test_empty_messages_returns_neutral_steady(client_with_mock_pipeline):
    payload = {"match_id": "match-1", "messages": [], "historical_avg": None}
    resp = client_with_mock_pipeline.post(
        "/ai/emotional/score", json=payload
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["score"] == 50
    assert data["label"] == "STEADY"
    assert data["trend"] == "stable"


def test_few_messages_under_5_returns_neutral(client_with_mock_pipeline):
    msgs = make_msgs(4)
    payload = {"match_id": "match-2", "messages": msgs, "historical_avg": None}
    resp = client_with_mock_pipeline.post(
        "/ai/emotional/score", json=payload
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["score"] == 50
    assert data["label"] == "STEADY"
    assert data["trend"] == "stable"


def test_sentiment_positive_scores_high(positive_client):
    msgs = make_msgs(10)
    payload = {"match_id": "match-3", "messages": msgs, "historical_avg": None}
    resp = positive_client.post(
        "/ai/emotional/score", json=payload
    )
    assert resp.status_code == 200
    data = resp.json()
    # Positive pipeline should push sentiment sub-score above neutral
    assert data["breakdown"]["sentiment"] > 50


def test_sentiment_negative_scores_low(negative_client):
    msgs = make_msgs(10)
    payload = {"match_id": "match-4", "messages": msgs, "historical_avg": None}
    resp = negative_client.post(
        "/ai/emotional/score", json=payload
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["breakdown"]["sentiment"] < 50


def test_enthusiasm_fast_replies_high_score():
    # Replies 5 minutes apart → avg_gap=5 → score=90
    msgs = [
        EmotionalMessage(sender="A", text="Hi", timestamp="2026-05-05T10:00:00Z"),
        EmotionalMessage(sender="B", text="Hello!", timestamp="2026-05-05T10:05:00Z"),
        EmotionalMessage(sender="A", text="How are you?", timestamp="2026-05-05T10:10:00Z"),
        EmotionalMessage(sender="B", text="Great!", timestamp="2026-05-05T10:15:00Z"),
        EmotionalMessage(sender="A", text="Nice to hear!", timestamp="2026-05-05T10:20:00Z"),
    ]
    assert compute_enthusiasm_score(msgs) == 90


def test_enthusiasm_slow_replies_low_score():
    # Replies ~14 hours apart → avg_gap ≈ 840 min → score=20
    msgs = [
        EmotionalMessage(sender="A", text="Hi", timestamp="2026-05-05T08:00:00Z"),
        EmotionalMessage(sender="B", text="Hello", timestamp="2026-05-05T22:00:00Z"),
        EmotionalMessage(sender="A", text="Hey", timestamp="2026-05-06T12:00:00Z"),
        EmotionalMessage(sender="B", text="Yes?", timestamp="2026-05-07T02:00:00Z"),
        EmotionalMessage(sender="A", text="Nothing", timestamp="2026-05-07T16:00:00Z"),
    ]
    assert compute_enthusiasm_score(msgs) == 20


def test_engagement_increasing_length_high():
    # older msgs are short, recent are long
    older = [
        EmotionalMessage(sender="A" if i % 2 == 0 else "B", text="ok", timestamp=f"2026-05-05T{i:02d}:00:00Z")
        for i in range(10)
    ]
    recent = [
        EmotionalMessage(
            sender="A" if i % 2 == 0 else "B",
            text="This is a much longer message with more content and detail " * 3,
            timestamp=f"2026-05-06T{i:02d}:00:00Z",
        )
        for i in range(10)
    ]
    msgs = older + recent
    score = compute_engagement_score(msgs)
    assert score > 50


def test_engagement_decreasing_length_low():
    # older msgs are long, recent are very short
    older = [
        EmotionalMessage(
            sender="A" if i % 2 == 0 else "B",
            text="This is a very long detailed message with lots of interesting content " * 3,
            timestamp=f"2026-05-05T{i:02d}:00:00Z",
        )
        for i in range(10)
    ]
    recent = [
        EmotionalMessage(sender="A" if i % 2 == 0 else "B", text="k", timestamp=f"2026-05-06T{i:02d}:00:00Z")
        for i in range(10)
    ]
    msgs = older + recent
    score = compute_engagement_score(msgs)
    assert score < 50


def test_curiosity_many_questions_high():
    # > 0.4 questions per message → 90
    msgs = [
        EmotionalMessage(sender="A", text="How are you? What do you like?", timestamp="2026-05-05T10:00:00Z"),
        EmotionalMessage(sender="B", text="Good! What about you? Do you like hiking?", timestamp="2026-05-05T10:05:00Z"),
    ]
    score = compute_curiosity_score(msgs)
    assert score == 90


def test_combined_score_label_thresholds():
    # Boundary at 39/40: COOLING vs STEADY
    b_39 = EmotionalBreakdown(sentiment=39, enthusiasm=39, engagement=39, curiosity=39)
    score_39 = compute_combined_score(b_39)
    assert score_39 == 39
    assert determine_label(score_39) == "COOLING"

    # Exactly 40 → STEADY
    b_40 = EmotionalBreakdown(sentiment=40, enthusiasm=40, engagement=40, curiosity=40)
    score_40 = compute_combined_score(b_40)
    assert score_40 == 40
    assert determine_label(score_40) == "STEADY"

    # Boundary at 69/70: STEADY vs WARM
    b_69 = EmotionalBreakdown(sentiment=69, enthusiasm=69, engagement=69, curiosity=69)
    score_69 = compute_combined_score(b_69)
    assert score_69 == 69
    assert determine_label(score_69) == "STEADY"

    b_70 = EmotionalBreakdown(sentiment=70, enthusiasm=70, engagement=70, curiosity=70)
    score_70 = compute_combined_score(b_70)
    assert score_70 == 70
    assert determine_label(score_70) == "WARM"


def test_trend_improving():
    # current=80, historical=73 → delta=7 > 5 → improving
    assert determine_trend(80, 73.0) == "improving"


def test_trend_declining():
    # current=60, historical=68 → delta=-8 < -5 → declining
    assert determine_trend(60, 68.0) == "declining"


def test_trend_stable_when_no_historical():
    assert determine_trend(65, None) == "stable"


def test_pipeline_none_falls_back_to_neutral_sentiment(none_pipeline_client):
    msgs = make_msgs(10)
    payload = {"match_id": "match-5", "messages": msgs, "historical_avg": None}
    resp = none_pipeline_client.post(
        "/ai/emotional/score", json=payload
    )
    assert resp.status_code == 200
    data = resp.json()
    # Sentiment should fall back to 50 when pipeline is None
    assert data["breakdown"]["sentiment"] == 50
    # Overall score still computed from other sub-scores
    assert "score" in data
    assert "label" in data
    assert "trend" in data
