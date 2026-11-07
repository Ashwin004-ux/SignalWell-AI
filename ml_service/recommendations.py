from typing import Any, Dict, List


def recommend_from_features(features: Dict[str, Any]) -> List[Dict[str, str]]:
    screen = float(features.get("total_screen_time_minutes") or features.get("screen_time") or 0)
    sleep = float(features.get("sleep_duration_minutes") or features.get("sleep_duration") or 0)
    activity = float(features.get("physical_activity_minutes") or 0)
    late = float(features.get("late_night_usage_minutes") or features.get("late_night_usage") or 0)

    items: List[Dict[str, str]] = []
    if sleep and sleep < 420:
        items.append({
            "category": "sleep",
            "suggestion": "Consider keeping a consistent sleep and wake schedule.",
        })
    if screen >= 300:
        items.append({
            "category": "screen",
            "suggestion": "Consider taking regular screen-free breaks during long periods of device use.",
        })
    if activity < 20:
        items.append({
            "category": "activity",
            "suggestion": "Consider incorporating regular physical activity into your routine.",
        })
    if late >= 45:
        items.append({
            "category": "late-night",
            "suggestion": "Late-night device usage has increased over your recent observations. Consider a device-free wind-down period.",
        })
    if not items:
        items.append({
            "category": "general",
            "suggestion": "Start tracking to see your first daily analysis." if not screen and not sleep else "No specific lifestyle rule fired for these values.",
        })
    return items
