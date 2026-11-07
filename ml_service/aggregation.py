from typing import Any, Dict, List, Optional


def merge_daily_features(
    lifestyle: Optional[Dict[str, Any]],
    checkin: Optional[Dict[str, Any]],
    sleep: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    features: Dict[str, Any] = {}
    if lifestyle:
        features.update(
            {
                "total_screen_time_minutes": lifestyle.get("total_screen_time_minutes", 0),
                "social_media_minutes": lifestyle.get("social_media_minutes", 0),
                "late_night_usage_minutes": lifestyle.get("late_night_usage_minutes", 0),
                "sleep_duration_minutes": lifestyle.get("sleep_duration_minutes", 0),
                "physical_activity_minutes": lifestyle.get("physical_activity_minutes", 0),
                "study_work_minutes": lifestyle.get("study_work_minutes", 0),
                "notifications_count": lifestyle.get("notifications_count", 0),
                "sleep_consistency": lifestyle.get("sleep_consistency_minutes", 0),
                "exercise_frequency": lifestyle.get("exercise_frequency", 0),
                "break_frequency": lifestyle.get("break_frequency", 0),
                "date": lifestyle.get("date"),
            }
        )
    if sleep and not features.get("sleep_duration_minutes"):
        features["sleep_duration_minutes"] = sleep.get("sleep_duration_minutes") or 0
        features["date"] = features.get("date") or sleep.get("date")
    if checkin:
        features["mood_score"] = checkin.get("mood_score")
        features["stress_score"] = checkin.get("stress_score")
        features["energy_score"] = checkin.get("energy_score")
        features["wellbeing_score"] = checkin.get("wellbeing_score")
        features["date"] = features.get("date") or checkin.get("date")
    return features


def completeness(rows: List[Dict[str, Any]], required: List[str]) -> float:
    if not rows:
        return 0.0
    filled = 0
    total = len(rows) * len(required)
    for row in rows:
        for key in required:
            value = row.get(key)
            if value not in (None, ""):
                filled += 1
    return round(filled / total, 3) if total else 0.0
