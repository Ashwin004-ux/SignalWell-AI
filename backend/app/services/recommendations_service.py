"""
Personalized recommendations (spec Section 17: "Do not give the same
generic recommendations to every user"). Rule-based, not LLM-written, for
the same reasoning as notifications_service.py — and deliberately reuses
its threshold logic rather than re-deriving separate thresholds, so a
"high screen time" notification and a "reduce screen time" recommendation
can't disagree about what counts as high for this user.

Takes an explicit list of notification candidates (from
notifications_service.py) plus, optionally, a trained model's
top_contributing_features (from app/ml/predict.py's WellbeingPrediction)
so a recommendation can be prioritized when the ML layer's SHAP
explanation and a rule both point at the same behavior — e.g. late-night
usage showing up as both a triggered notification AND a top SHAP
contributor is stronger signal than either alone, and is surfaced first.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.services.notifications_service import NotificationCandidate

_RULE_TO_RECOMMENDATION = {
    "high_screen_time": "Consider setting a daily screen time goal a bit below your recent average.",
    "late_night_usage": "Try setting a cutoff time for your phone in the evening — even 30 minutes earlier can help.",
    "sleep_pattern": "A consistent sleep and wake time, even on weekends, tends to help sleep duration recover.",
}

_FEATURE_TO_RECOMMENDATION = {
    "late_night_usage_minutes": "Reducing late-night device use may be worth prioritizing — it's been a notable factor in your recent pattern.",
    "social_media_minutes": "Scheduled breaks from social media, even short ones, may be worth trying.",
    "social_media_share_of_screen_time": "Scheduled breaks from social media, even short ones, may be worth trying.",
    "sleep_duration_minutes": "Sleep duration has shown up as a significant factor — a consistent sleep schedule may help.",
    "sleep_consistency_7d_std": "Your sleep timing has been inconsistent recently — a steadier schedule may help more than duration alone.",
    "notifications_count": "Reducing non-essential notifications could cut down on app-switching and interruptions.",
}

_GENERIC_FALLBACK = [
    "Take short breaks during long screen sessions.",
    "Record your mood consistently — a few days of entries makes trends easier to see.",
]


@dataclass(frozen=True)
class Recommendation:
    text: str
    source: str  # "rule" | "model" | "fallback"


def build_recommendations(
    notification_candidates: list[NotificationCandidate],
    top_contributing_features: list[str] | None = None,
    max_recommendations: int = 4,
) -> list[Recommendation]:
    recs: list[Recommendation] = []
    seen_texts: set[str] = set()

    def _add(text: str, source: str) -> None:
        if text not in seen_texts:
            recs.append(Recommendation(text=text, source=source))
            seen_texts.add(text)

    # Rule-triggered recommendations first — these reflect what's actually
    # happening in the user's own recent data right now.
    for candidate in notification_candidates:
        rec_text = _RULE_TO_RECOMMENDATION.get(candidate.type)
        if rec_text:
            _add(rec_text, "rule")

    # Then model-driven ones, for behaviors the rules didn't already catch.
    for feature in top_contributing_features or []:
        rec_text = _FEATURE_TO_RECOMMENDATION.get(feature)
        if rec_text:
            _add(rec_text, "model")

    # Never leave someone with zero recommendations just because nothing
    # crossed a threshold this week — but fallbacks are clearly marked as
    # such and only fill remaining slots, never replace a personalized one.
    for fallback in _GENERIC_FALLBACK:
        if len(recs) >= max_recommendations:
            break
        _add(fallback, "fallback")

    return recs[:max_recommendations]
