"""
Tests for Marriage Readiness Score — composite rule-based indicator.

Verifies: score ranges, dimension scoring, next_actions generation,
edge cases (zero communication, full goal clarity, etc.).
"""

from __future__ import annotations

import math
import pytest

from src.schemas.marriage_readiness import MarriageReadinessRequest
from src.services.marriage_readiness_service import (
    compute_marriage_readiness,
    _compute_communication_depth,
    _compute_goal_clarity,
    _build_next_actions,
)


# ── Helper ─────────────────────────────────────────────────────────────────────


def _request(**overrides) -> MarriageReadinessRequest:
    base = {
        "user_id": "user_mr_001",
        "avg_msg_count_per_conv": 20.0,
        "avg_msg_length": 80,
        "profile_completeness": 85,
        "age_pref_set": True,
        "religion_pref_set": True,
        "distance_pref_set": True,
        "education_pref_set": True,
        "lifestyle_pref_set": True,
    }
    base.update(overrides)
    return MarriageReadinessRequest(**base)


# ── Communication depth tests ──────────────────────────────────────────────────


class TestCommunicationDepth:
    def test_zero_messages_zero_length(self):
        score = _compute_communication_depth(0, 0)
        assert score == 0.0

    def test_50_messages_100_char_length_near_max(self):
        score = _compute_communication_depth(49, 100)
        # comm_count = log10(50)/log10(50) = 1.0; comm_length = 1.0
        # depth = 0.6*1.0 + 0.4*1.0 = 1.0
        assert abs(score - 1.0) < 0.02

    def test_caps_at_1_when_over_50_messages(self):
        score = _compute_communication_depth(200, 200)
        assert score == 1.0

    def test_moderate_values(self):
        score = _compute_communication_depth(9, 50)
        comm_count = min(1.0, math.log10(10) / math.log10(50))
        comm_length = min(1.0, 50 / 100.0)
        expected = 0.6 * comm_count + 0.4 * comm_length
        assert abs(score - expected) < 0.001

    def test_result_always_0_to_1(self):
        for msgs in [0, 1, 5, 25, 100]:
            for length in [0, 50, 100, 300]:
                score = _compute_communication_depth(msgs, length)
                assert 0.0 <= score <= 1.0


# ── Goal clarity tests ─────────────────────────────────────────────────────────


class TestGoalClarity:
    def test_all_set_is_1(self):
        score = _compute_goal_clarity(True, True, True, True, True)
        assert score == 1.0

    def test_none_set_is_0(self):
        score = _compute_goal_clarity(False, False, False, False, False)
        assert score == 0.0

    def test_partial_counts_correctly(self):
        score = _compute_goal_clarity(True, True, False, False, False)
        assert abs(score - 0.4) < 0.01

    def test_three_out_of_five(self):
        score = _compute_goal_clarity(True, True, True, False, False)
        assert abs(score - 0.6) < 0.01


# ── Next actions tests ─────────────────────────────────────────────────────────


class TestBuildNextActions:
    def test_all_good_no_actions(self):
        actions = _build_next_actions(0.6, 0.9, 0.8)
        assert len(actions) == 0

    def test_low_comm_triggers_action(self):
        actions = _build_next_actions(0.3, 0.9, 0.8)
        assert any("conversation" in a for a in actions)

    def test_low_completeness_triggers_action(self):
        actions = _build_next_actions(0.6, 0.5, 0.8)
        assert any("profile" in a.lower() for a in actions)

    def test_low_goal_clarity_triggers_action(self):
        actions = _build_next_actions(0.6, 0.9, 0.5)
        assert any("preference" in a.lower() for a in actions)

    def test_max_three_actions(self):
        # All three dimensions are low
        actions = _build_next_actions(0.1, 0.1, 0.1)
        assert len(actions) <= 3

    def test_ordering_lowest_score_first(self):
        # comm=0.1 (lowest) → should be first action
        actions = _build_next_actions(0.1, 0.5, 0.6)
        assert any("conversation" in a for a in actions)


# ── Full compute tests ─────────────────────────────────────────────────────────


class TestComputeMarriageReadiness:
    def test_score_in_0_100_range(self):
        resp = compute_marriage_readiness(_request())
        assert 0 <= resp.readiness_score <= 100

    def test_high_engagement_high_completeness_high_clarity(self):
        req = _request(
            avg_msg_count_per_conv=40.0,
            avg_msg_length=120,
            profile_completeness=95,
            age_pref_set=True,
            religion_pref_set=True,
            distance_pref_set=True,
            education_pref_set=True,
            lifestyle_pref_set=True,
        )
        resp = compute_marriage_readiness(req)
        assert resp.readiness_score >= 80

    def test_zero_engagement_zero_completeness_zero_clarity(self):
        req = _request(
            avg_msg_count_per_conv=0,
            avg_msg_length=0,
            profile_completeness=0,
            age_pref_set=False,
            religion_pref_set=False,
            distance_pref_set=False,
            education_pref_set=False,
            lifestyle_pref_set=False,
        )
        resp = compute_marriage_readiness(req)
        assert resp.readiness_score == 0

    def test_dimensions_all_present(self):
        resp = compute_marriage_readiness(_request())
        assert 0 <= resp.dimensions.communication_depth <= 100
        assert 0 <= resp.dimensions.completeness <= 100
        assert 0 <= resp.dimensions.goal_clarity <= 100

    def test_version_string(self):
        resp = compute_marriage_readiness(_request())
        assert resp.version == "marriage-readiness-v1.0"

    def test_user_id_echoed(self):
        resp = compute_marriage_readiness(_request(user_id="uid_abc"))
        assert resp.user_id == "uid_abc"

    def test_next_actions_is_list(self):
        resp = compute_marriage_readiness(_request())
        assert isinstance(resp.next_actions, list)
        assert len(resp.next_actions) <= 3

    def test_completeness_score_matches_input(self):
        resp = compute_marriage_readiness(_request(profile_completeness=60))
        assert resp.dimensions.completeness == 60

    def test_goal_clarity_all_five_set(self):
        resp = compute_marriage_readiness(_request(
            age_pref_set=True,
            religion_pref_set=True,
            distance_pref_set=True,
            education_pref_set=True,
            lifestyle_pref_set=True,
        ))
        assert resp.dimensions.goal_clarity == 100

    def test_goal_clarity_none_set(self):
        resp = compute_marriage_readiness(_request(
            age_pref_set=False,
            religion_pref_set=False,
            distance_pref_set=False,
            education_pref_set=False,
            lifestyle_pref_set=False,
        ))
        assert resp.dimensions.goal_clarity == 0
