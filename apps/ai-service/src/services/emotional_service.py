"""
Emotional Score computation service.

All 4 sub-scores are deterministic — no LLM calls, no external I/O.
The HuggingFace pipeline is injected (may be None — handled gracefully).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from src.schemas.emotional import (
    EmotionalBreakdown,
    EmotionalMessage,
    EmotionalScoreRequest,
    EmotionalScoreResponse,
)


def compute_sentiment_score(messages: list[EmotionalMessage], pipeline: Any) -> int:
    """
    Run last 20 messages through HuggingFace pipeline.
    Maps [-1.0, 1.0] sentiment value to [0, 100].
    Returns 50 (neutral) when messages empty or pipeline unavailable.
    """
    if not messages or pipeline is None:
        return 50

    recent = messages[-20:]
    total = 0.0
    for msg in recent:
        try:
            result = pipeline(msg.text[:512])
            label = result[0]["label"].lower()
            score = float(result[0]["score"])
            if label == "positive":
                value = score
            elif label == "negative":
                value = -score
            else:
                value = 0.0
            total += value
        except Exception:  # noqa: BLE001
            total += 0.0

    avg = total / len(recent)
    # Map [-1, 1] → [0, 100]
    return max(0, min(100, int((avg + 1.0) / 2.0 * 100)))


def compute_enthusiasm_score(messages: list[EmotionalMessage]) -> int:
    """
    Measures reply speed. Faster replies → higher score.
    Returns 50 for single message or empty input.
    """
    if len(messages) < 2:
        return 50

    gaps: list[float] = []
    for i in range(1, len(messages)):
        try:
            t_prev = datetime.fromisoformat(messages[i - 1].timestamp.replace("Z", "+00:00"))
            t_curr = datetime.fromisoformat(messages[i].timestamp.replace("Z", "+00:00"))
            gap_minutes = (t_curr - t_prev).total_seconds() / 60.0
            if gap_minutes >= 0:
                gaps.append(gap_minutes)
        except (ValueError, OverflowError):
            continue

    if not gaps:
        return 50

    avg_gap = sum(gaps) / len(gaps)

    if avg_gap <= 30:
        return 90
    elif avg_gap <= 120:
        return 60
    elif avg_gap <= 720:
        return 40
    else:
        return 20


def compute_engagement_score(messages: list[EmotionalMessage]) -> int:
    """
    Compares avg message length of last 10 vs previous 10.
    Increasing length → deeper engagement. Returns 50 for sparse input.
    """
    if len(messages) < 5:
        return 50

    # Need messages from both sides; filter if all from one sender
    senders = {m.sender for m in messages}
    if len(senders) < 2:
        return 50

    recent = messages[-10:]
    older = messages[-20:-10] if len(messages) >= 20 else messages[:-10]

    if not older:
        return 50

    recent_avg = sum(len(m.text) for m in recent) / len(recent)
    older_avg = sum(len(m.text) for m in older) / len(older)

    if older_avg == 0:
        return 50

    delta_pct = (recent_avg - older_avg) / older_avg * 100
    # Clamp to [-50, +50] then shift to [0, 100]
    clamped = max(-50.0, min(50.0, delta_pct))
    return int(clamped + 50)


def compute_curiosity_score(messages: list[EmotionalMessage]) -> int:
    """
    Measures question density across all messages.
    Returns 50 for empty input.
    """
    if not messages:
        return 50

    total_questions = sum(m.text.count("?") for m in messages)
    questions_per_message = total_questions / len(messages)

    if questions_per_message > 0.4:
        return 90
    elif questions_per_message >= 0.2:
        return 70
    elif questions_per_message >= 0.1:
        return 50
    else:
        return 30


def compute_combined_score(breakdown: EmotionalBreakdown) -> int:
    """Weighted: 30% sentiment + 25% enthusiasm + 25% engagement + 20% curiosity."""
    raw = (
        0.30 * breakdown.sentiment
        + 0.25 * breakdown.enthusiasm
        + 0.25 * breakdown.engagement
        + 0.20 * breakdown.curiosity
    )
    return max(0, min(100, round(raw)))


def determine_label(score: int) -> str:
    if score >= 70:
        return "WARM"
    elif score >= 40:
        return "STEADY"
    else:
        return "COOLING"


def determine_trend(current: int, historical_avg: float | None) -> str:
    if historical_avg is None:
        return "stable"
    delta = current - historical_avg
    if delta > 5:
        return "improving"
    elif delta < -5:
        return "declining"
    else:
        return "stable"


async def compute_emotional_score(
    request: EmotionalScoreRequest,
    pipeline: Any,
) -> EmotionalScoreResponse:
    """
    Main entry point. Returns neutral score for < 5 messages.
    """
    now_iso = datetime.now(timezone.utc).isoformat()

    if len(request.messages) < 5:
        return EmotionalScoreResponse(
            score=50,
            label="STEADY",
            trend="stable",
            breakdown=EmotionalBreakdown(
                sentiment=50,
                enthusiasm=50,
                engagement=50,
                curiosity=50,
            ),
            last_updated=now_iso,
        )

    breakdown = EmotionalBreakdown(
        sentiment=compute_sentiment_score(request.messages, pipeline),
        enthusiasm=compute_enthusiasm_score(request.messages),
        engagement=compute_engagement_score(request.messages),
        curiosity=compute_curiosity_score(request.messages),
    )
    score = compute_combined_score(breakdown)
    label = determine_label(score)
    trend = determine_trend(score, request.historical_avg)

    return EmotionalScoreResponse(
        score=score,
        label=label,
        trend=trend,
        breakdown=breakdown,
        last_updated=now_iso,
    )
