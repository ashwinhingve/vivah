"""
Tests for Profile Optimizer — rule-based scorer.

Verifies: score ranges, tier assignment, suggestion generation,
edge cases (empty bio, max completeness, photo thresholds).
"""

from __future__ import annotations

from src.schemas.profile_optimizer import ProfileOptimizerRequest
from src.services.profile_optimizer_service import (
    _build_suggestions,
    _compute_bio_score,
    _compute_photo_score,
    compute_profile_optimizer,
)

# ── Helper ─────────────────────────────────────────────────────────────────────


def _request(**overrides) -> ProfileOptimizerRequest:
    """Build a ProfileOptimizerRequest with sensible defaults."""
    base = {
        "user_id": "user_test_001",
        "photo_count": 4,
        "has_primary_photo": True,
        "bio_text": (
            "I love travel and family values. I work in career tech and enjoy "
            "reading and cooking. Looking for a partner who shares my passion for fitness."
        ),
        "profile_completeness": 85,
    }
    base.update(overrides)
    return ProfileOptimizerRequest(**base)


# ── Photo score tests ──────────────────────────────────────────────────────────


class TestPhotoScore:
    def test_four_photos_with_primary_near_max(self):
        score = _compute_photo_score(4, True)
        # 0.5*1.0 + 0.3*1.0 + 0.2*0.9 = 0.98
        assert abs(score - 0.98) < 0.01

    def test_zero_photos_no_primary(self):
        score = _compute_photo_score(0, False)
        # 0.5*0.0 + 0.3*0.0 + 0.2*0.9 = 0.18
        assert abs(score - 0.18) < 0.01

    def test_two_photos_no_primary(self):
        score = _compute_photo_score(2, False)
        # 0.5*(0.5) + 0.3*0.0 + 0.2*0.9 = 0.25+0+0.18 = 0.43
        assert abs(score - 0.43) < 0.01

    def test_more_than_four_caps_at_four(self):
        score = _compute_photo_score(10, True)
        expected = _compute_photo_score(4, True)
        assert abs(score - expected) < 0.01


# ── Bio score tests ────────────────────────────────────────────────────────────


class TestBioScore:
    def test_empty_bio_lowest_length_score(self):
        bio_score, length_score, kw_score = _compute_bio_score("")
        assert length_score == 0.2
        assert kw_score == 0.0

    def test_short_bio_under_50_chars(self):
        _, length_score, _ = _compute_bio_score("Hello world")
        assert length_score == 0.2

    def test_bio_100_to_200_chars(self):
        text = "I " + "x" * 148  # ~150 chars
        _, length_score, _ = _compute_bio_score(text)
        assert length_score == 0.85

    def test_bio_400_plus_too_long(self):
        text = "a" * 401
        _, length_score, _ = _compute_bio_score(text)
        assert length_score == 0.7

    def test_keyword_score_counts_correctly(self):
        # Contains 'family', 'career', 'hobbies', 'travel', 'reading' = 5 → 1.0
        text = "I love family and my career. My hobbies include travel and reading."
        _, _, kw_score = _compute_bio_score(text)
        assert kw_score == 1.0

    def test_keyword_score_caps_at_1(self):
        # Include all 16 keywords — still capped at 1.0
        text = " ".join([
            "family education career values hobbies travel cooking music reading",
            "fitness parents partner children looking for enjoy passion",
        ])
        _, _, kw_score = _compute_bio_score(text)
        assert kw_score == 1.0


# ── Suggestions tests ──────────────────────────────────────────────────────────


class TestBuildSuggestions:
    def test_all_good_no_suggestions(self):
        suggestions = _build_suggestions(
            photo_count=4,
            bio_length=200,
            bio_keyword_score=0.8,
            completeness_frac=0.9,
        )
        assert len(suggestions) == 0

    def test_missing_photos_triggers_suggestion(self):
        suggestions = _build_suggestions(
            photo_count=1,
            bio_length=200,
            bio_keyword_score=0.8,
            completeness_frac=0.9,
        )
        photo_sug = next((s for s in suggestions if s.field == "photos"), None)
        assert photo_sug is not None
        assert "3 more photo" in photo_sug.suggestion

    def test_short_bio_triggers_suggestion(self):
        suggestions = _build_suggestions(
            photo_count=4,
            bio_length=50,
            bio_keyword_score=0.8,
            completeness_frac=0.9,
        )
        bio_sug = next((s for s in suggestions if s.field == "bio"), None)
        assert bio_sug is not None

    def test_low_keyword_score_triggers_suggestion(self):
        suggestions = _build_suggestions(
            photo_count=4,
            bio_length=200,
            bio_keyword_score=0.3,
            completeness_frac=0.9,
        )
        kw_sug = next((s for s in suggestions if s.field == "bio_keywords"), None)
        assert kw_sug is not None

    def test_low_completeness_triggers_suggestion(self):
        suggestions = _build_suggestions(
            photo_count=4,
            bio_length=200,
            bio_keyword_score=0.8,
            completeness_frac=0.5,
        )
        comp_sug = next((s for s in suggestions if s.field == "completeness"), None)
        assert comp_sug is not None

    def test_priority_ordering_lowest_score_first(self):
        suggestions = _build_suggestions(
            photo_count=0,          # score ~0  → priority 1
            bio_length=200,
            bio_keyword_score=0.0,  # score ~0  → priority 1 (tie — both low)
            completeness_frac=0.5,  # score 50  → lower priority
        )
        assert len(suggestions) > 1
        # priorities are 1, 2, 3...
        priorities = [s.priority for s in suggestions]
        assert priorities == sorted(priorities)

    def test_max_five_suggestions(self):
        suggestions = _build_suggestions(
            photo_count=0,
            bio_length=10,
            bio_keyword_score=0.0,
            completeness_frac=0.1,
        )
        assert len(suggestions) <= 5


# ── Full compute tests ─────────────────────────────────────────────────────────


class TestComputeProfileOptimizer:
    def test_excellent_tier_score_above_85(self):
        req = _request(
            photo_count=4,
            has_primary_photo=True,
            bio_text=(
                "I love family values and my career in education. I enjoy hobbies like "
                "travel, cooking, music, reading, fitness. Looking for a partner who "
                "shares my passion and values children."
            ),
            profile_completeness=95,
        )
        resp = compute_profile_optimizer(req)
        assert resp.overall_score >= 85
        assert resp.tier == "excellent"

    def test_incomplete_tier_score_below_50(self):
        req = _request(
            photo_count=0,
            has_primary_photo=False,
            bio_text="",
            profile_completeness=10,
        )
        resp = compute_profile_optimizer(req)
        assert resp.overall_score < 50
        assert resp.tier == "incomplete"

    def test_score_always_in_0_100_range(self):
        for pc in [0, 1, 3, 5, 10]:
            for comp in [0, 50, 100]:
                req = _request(photo_count=pc, profile_completeness=comp, bio_text="")
                resp = compute_profile_optimizer(req)
                assert 0 <= resp.overall_score <= 100

    def test_dimensions_all_present(self):
        resp = compute_profile_optimizer(_request())
        assert 0 <= resp.dimensions.photo_score <= 100
        assert 0 <= resp.dimensions.bio_score <= 100
        assert 0 <= resp.dimensions.completeness_score <= 100

    def test_version_string(self):
        resp = compute_profile_optimizer(_request())
        assert resp.version == "profile-optimizer-v1.0"

    def test_user_id_echoed(self):
        resp = compute_profile_optimizer(_request(user_id="uid_xyz"))
        assert resp.user_id == "uid_xyz"

    def test_needs_work_tier_midrange(self):
        req = _request(
            photo_count=1,
            has_primary_photo=False,
            bio_text="I like things",
            profile_completeness=55,
        )
        resp = compute_profile_optimizer(req)
        assert resp.tier in ("needs_work", "incomplete")

    def test_good_tier_band(self):
        # Craft inputs that should land ~75
        req = _request(
            photo_count=4,
            has_primary_photo=True,
            bio_text="I enjoy family, career, travel and reading books.",
            profile_completeness=70,
        )
        resp = compute_profile_optimizer(req)
        assert resp.tier in ("good", "excellent")
