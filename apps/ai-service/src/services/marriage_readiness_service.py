"""
Marriage Readiness Score service — rule-based composite indicator.

Three dimensions (communication depth, completeness, goal clarity) are
each scored 0-1, then combined into a single 0-100 readiness_score.
Per agreement: user-controlled, not ML.
"""

from __future__ import annotations

import math

import structlog

from src.schemas.marriage_readiness import (
    MarriageReadinessRequest,
    MarriageReadinessResponse,
    ReadinessDimensions,
)

log = structlog.get_logger("ai-service.marriage-readiness")


def _compute_communication_depth(
    avg_msg_count_per_conv: float,
    avg_msg_length: int,
) -> float:
    """
    Communication depth sub-score (0–1).

    comm_count_score = log10(avg_msg_count_per_conv + 1) / log10(50), capped at 1.0
    comm_length_score = min(1.0, avg_msg_length / 100)
    communication_depth = 0.6 * comm_count_score + 0.4 * comm_length_score
    """
    comm_count_score = min(
        1.0,
        math.log10(avg_msg_count_per_conv + 1) / math.log10(50),
    )
    comm_length_score = min(1.0, avg_msg_length / 100.0)
    return 0.6 * comm_count_score + 0.4 * comm_length_score


def _compute_goal_clarity(
    age_pref_set: bool,
    religion_pref_set: bool,
    distance_pref_set: bool,
    education_pref_set: bool,
    lifestyle_pref_set: bool,
) -> float:
    """
    Goal clarity sub-score (0–1).

    5 boolean checks on partner_preferences:
      1. age_range set
      2. religion preference set
      3. max_distance_km set
      4. education_preferences set
      5. lifestyle_tags preference set

    goal_clarity = filled_count / 5
    """
    filled = sum([
        age_pref_set,
        religion_pref_set,
        distance_pref_set,
        education_pref_set,
        lifestyle_pref_set,
    ])
    return filled / 5.0


def _build_next_actions(
    communication_depth: float,
    completeness_frac: float,
    goal_clarity: float,
) -> list[str]:
    """
    Return up to 3 action strings for the lowest-scoring dimensions.
    """
    scored: list[tuple[float, str]] = [
        (
            communication_depth,
            "Have more meaningful conversations to demonstrate communication depth",
        ),
        (completeness_frac, "Complete remaining profile sections — every section adds clarity"),
        (
            goal_clarity,
            "Set clear partner preferences (age, religion, location, education, lifestyle)",
        ),
    ]

    # Only include actions for dimensions that are below threshold
    actions: list[str] = []
    if communication_depth < 0.5:
        actions.append(scored[0][1])
    if completeness_frac < 0.8:
        actions.append(scored[1][1])
    if goal_clarity < 0.7:
        actions.append(scored[2][1])

    # Sort by score ascending so lowest-scoring comes first, then cap at 3
    low_dims = sorted(
        [(s, msg) for s, msg in scored if msg in actions],
        key=lambda x: x[0],
    )
    return [msg for _, msg in low_dims[:3]]


def compute_marriage_readiness(
    request: MarriageReadinessRequest,
) -> MarriageReadinessResponse:
    """
    Compute the Marriage Readiness Score.

    readiness_score = (0.4 * communication_depth + 0.3 * completeness + 0.3 * goal_clarity) * 100
    """
    # ── 1. Communication depth ────────────────────────────────────────────────
    communication_depth = _compute_communication_depth(
        request.avg_msg_count_per_conv,
        request.avg_msg_length,
    )

    # ── 2. Profile completeness ───────────────────────────────────────────────
    completeness_frac = request.profile_completeness / 100.0

    # ── 3. Goal clarity ───────────────────────────────────────────────────────
    goal_clarity = _compute_goal_clarity(
        age_pref_set=request.age_pref_set,
        religion_pref_set=request.religion_pref_set,
        distance_pref_set=request.distance_pref_set,
        education_pref_set=request.education_pref_set,
        lifestyle_pref_set=request.lifestyle_pref_set,
    )

    # ── 4. Overall ────────────────────────────────────────────────────────────
    readiness_frac = (
        0.4 * communication_depth
        + 0.3 * completeness_frac
        + 0.3 * goal_clarity
    )
    readiness_score = max(0, min(100, int(round(readiness_frac * 100))))

    # ── 5. Dimension scores (0–100 ints) ─────────────────────────────────────
    dimensions = ReadinessDimensions(
        communication_depth=max(0, min(100, int(round(communication_depth * 100)))),
        completeness=max(0, min(100, int(round(completeness_frac * 100)))),
        goal_clarity=max(0, min(100, int(round(goal_clarity * 100)))),
    )

    # ── 6. Next actions ───────────────────────────────────────────────────────
    next_actions = _build_next_actions(
        communication_depth=communication_depth,
        completeness_frac=completeness_frac,
        goal_clarity=goal_clarity,
    )

    log.info(
        "marriage_readiness_computed",
        user_id=request.user_id,
        readiness_score=readiness_score,
        communication_depth=dimensions.communication_depth,
        completeness=dimensions.completeness,
        goal_clarity=dimensions.goal_clarity,
    )

    return MarriageReadinessResponse(
        user_id=request.user_id,
        readiness_score=readiness_score,
        dimensions=dimensions,
        next_actions=next_actions,
        version="marriage-readiness-v1.0",
    )
