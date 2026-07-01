"""
Profile Optimizer service — rule-based scorer.

Evaluates three dimensions (photo, bio, completeness) and produces
overall_score + tier + field_suggestions. No ML model — pure heuristics.
Per agreement: "rule-based first, machine learning second."
"""

from __future__ import annotations

import structlog

from src.schemas.profile_optimizer import (
    DimensionScores,
    FieldSuggestion,
    ProfileOptimizerRequest,
    ProfileOptimizerResponse,
)

log = structlog.get_logger("ai-service.profile-optimizer")

# High-signal keywords that indicate a well-written bio
_HIGH_SIGNAL_KEYWORDS: list[str] = [
    "family",
    "education",
    "career",
    "values",
    "hobbies",
    "travel",
    "cooking",
    "music",
    "reading",
    "fitness",
    "parents",
    "partner",
    "children",
    "looking for",
    "enjoy",
    "passion",
]


def _compute_photo_score(photo_count: int, has_primary_photo: bool) -> float:
    """
    Photo sub-score (0–1).

    Weights:
      50% photo_count_score  (4+ photos → 1.0)
      30% has_primary_score  (primary photo set)
      20% face_visible_score (STUB — 0.9 until AWS Rekognition is wired)
    """
    photo_count_score = min(1.0, photo_count / 4)
    has_primary_score = 1.0 if has_primary_photo else 0.0
    face_visible_score = 0.9  # STUB — swap for Rekognition result later

    return 0.5 * photo_count_score + 0.3 * has_primary_score + 0.2 * face_visible_score


def _compute_bio_score(bio_text: str) -> tuple[float, float, float]:
    """
    Bio sub-score (0–1). Returns (bio_score, length_score, keyword_score).

    Weights:
      40% bio_length_score
      40% bio_keyword_score
      20% bio_grammar_score (STUB — 0.85 until LLM is wired)
    """
    bio_length = len(bio_text)

    if bio_length < 50:
        bio_length_score = 0.2
    elif bio_length < 100:
        bio_length_score = 0.5
    elif bio_length < 200:
        bio_length_score = 0.85
    elif bio_length < 400:
        bio_length_score = 1.0
    else:
        bio_length_score = 0.7  # too long

    found_count = sum(
        1
        for kw in _HIGH_SIGNAL_KEYWORDS
        if kw.lower() in bio_text.lower()
    )
    bio_keyword_score = min(1.0, found_count / 5)

    bio_grammar_score = 0.85  # STUB — LLM swap later

    bio_score = (
        0.4 * bio_length_score
        + 0.4 * bio_keyword_score
        + 0.2 * bio_grammar_score
    )

    return bio_score, bio_length_score, bio_keyword_score


def _tier_from_score(overall_score: int) -> str:
    if overall_score >= 85:
        return "excellent"
    if overall_score >= 70:
        return "good"
    if overall_score >= 50:
        return "needs_work"
    return "incomplete"


def _build_suggestions(
    photo_count: int,
    bio_length: int,
    bio_keyword_score: float,
    completeness_frac: float,
) -> list[FieldSuggestion]:
    """
    Build up to 5 field suggestions ordered by priority (lowest-scoring first).
    """
    items: list[tuple[int, str, str, int]] = []  # (score, field, suggestion, priority_key)

    if photo_count < 4:
        missing = 4 - photo_count
        photo_score_pct = max(0, min(100, int((photo_count / 4) * 100)))
        items.append((
            photo_score_pct,
            "photos",
            f"Add {missing} more photo(s) — profiles with 4+ photos get 3x more responses",
        ))

    if bio_length < 100:
        items.append((
            int(min(1.0, bio_length / 100) * 50),
            "bio",
            "Your bio is too short. Aim for 150-300 characters covering career, values, hobbies.",
        ))

    if bio_keyword_score < 0.6:
        items.append((
            int(bio_keyword_score * 100),
            "bio_keywords",
            "Mention specifics: your work, interests, what you're looking for in a partner.",
        ))

    if completeness_frac < 0.8:
        completeness_pct = int(completeness_frac * 100)
        items.append((
            completeness_pct,
            "completeness",
            "Complete remaining profile sections — partner preferences, family details, lifestyle.",
        ))

    # Sort by score ascending (lowest-scoring = highest priority)
    items.sort(key=lambda x: x[0])

    return [
        FieldSuggestion(
            field=item[1],
            score=item[0],
            priority=idx + 1,
            suggestion=item[2],
        )
        for idx, item in enumerate(items[:5])
    ]


def compute_profile_optimizer(
    request: ProfileOptimizerRequest,
) -> ProfileOptimizerResponse:
    """
    Rule-based profile optimizer. No model call — pure heuristics.
    """
    # ── 1. Photo score ────────────────────────────────────────────────────────
    photo_score_raw = _compute_photo_score(
        request.photo_count,
        request.has_primary_photo,
    )

    # ── 2. Bio score ─────────────────────────────────────────────────────────
    bio_text = request.bio_text or ""
    bio_score_raw, bio_length_score, bio_keyword_score = _compute_bio_score(bio_text)

    # ── 3. Completeness score ─────────────────────────────────────────────────
    completeness_frac = request.profile_completeness / 100.0

    # ── 4. Overall ────────────────────────────────────────────────────────────
    overall_frac = (
        0.35 * photo_score_raw
        + 0.35 * bio_score_raw
        + 0.30 * completeness_frac
    )
    overall_score = max(0, min(100, int(round(overall_frac * 100))))

    # ── 5. Tier ───────────────────────────────────────────────────────────────
    tier = _tier_from_score(overall_score)

    # ── 6. Dimension scores (0–100 ints) ─────────────────────────────────────
    dimensions = DimensionScores(
        photo_score=max(0, min(100, int(round(photo_score_raw * 100)))),
        bio_score=max(0, min(100, int(round(bio_score_raw * 100)))),
        completeness_score=max(0, min(100, int(round(completeness_frac * 100)))),
    )

    # ── 7. Suggestions ────────────────────────────────────────────────────────
    bio_length = len(bio_text)
    field_suggestions = _build_suggestions(
        photo_count=request.photo_count,
        bio_length=bio_length,
        bio_keyword_score=bio_keyword_score,
        completeness_frac=completeness_frac,
    )

    log.info(
        "profile_optimizer_computed",
        user_id=request.user_id,
        overall_score=overall_score,
        tier=tier,
        photo_score=dimensions.photo_score,
        bio_score=dimensions.bio_score,
        completeness_score=dimensions.completeness_score,
    )

    return ProfileOptimizerResponse(
        user_id=request.user_id,
        overall_score=overall_score,
        tier=tier,  # type: ignore[arg-type]
        dimensions=dimensions,
        field_suggestions=field_suggestions,
        version="profile-optimizer-v1.0",
    )
