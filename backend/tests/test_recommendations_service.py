from __future__ import annotations

from app.services.notifications_service import evaluate_activity_notifications
from app.services.recommendations_service import build_recommendations


def test_recommendations_never_empty():
    recs = build_recommendations([], None)
    assert len(recs) > 0
    assert all(r.source == "fallback" for r in recs)


def test_recommendations_prioritize_rule_then_model_then_fallback():
    prior = [{"total_screen_time_minutes": 200, "late_night_usage_minutes": 10} for _ in range(5)]
    today = {"total_screen_time_minutes": 350, "late_night_usage_minutes": 40}
    candidates = evaluate_activity_notifications(today, prior)

    recs = build_recommendations(candidates, top_contributing_features=["sleep_duration_minutes"])
    sources = [r.source for r in recs]
    assert sources[0] == "rule"
    assert "model" in sources


def test_recommendations_deduplicate_across_rule_and_model():
    prior = [{"total_screen_time_minutes": 200, "late_night_usage_minutes": 10} for _ in range(5)]
    today = {"total_screen_time_minutes": 200, "late_night_usage_minutes": 40}
    candidates = evaluate_activity_notifications(today, prior)

    recs = build_recommendations(candidates, top_contributing_features=["late_night_usage_minutes"])
    texts = [r.text for r in recs]
    assert len(texts) == len(set(texts))


def test_recommendations_respect_max():
    prior = [{"total_screen_time_minutes": 200, "late_night_usage_minutes": 10} for _ in range(5)]
    today = {"total_screen_time_minutes": 350, "late_night_usage_minutes": 40}
    candidates = evaluate_activity_notifications(today, prior)
    recs = build_recommendations(
        candidates,
        top_contributing_features=["sleep_duration_minutes", "notifications_count", "social_media_minutes"],
        max_recommendations=2,
    )
    assert len(recs) == 2
