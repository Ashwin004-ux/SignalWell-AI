from typing import Any, Dict, List, Optional


def _mean(values: List[float]) -> Optional[float]:
    if not values:
        return None
    return sum(values) / len(values)


def build_insights(lifestyle: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    if not lifestyle:
        return [
            {
                "id": "empty",
                "category": "general",
                "message": "No wellbeing data available yet. Complete your first check-in to begin your analysis.",
            }
        ]

    sorted_rows = sorted(lifestyle, key=lambda row: row.get("date") or "")
    latest = sorted_rows[-1]
    prior = sorted_rows[:-1]
    insights: List[Dict[str, str]] = []

    screen_base = _mean([float(row.get("total_screen_time_minutes") or 0) for row in prior])
    latest_screen = float(latest.get("total_screen_time_minutes") or 0)
    if screen_base is not None and latest_screen > screen_base * 1.2 and latest_screen - screen_base >= 30:
        insights.append(
            {
                "id": "screen-high",
                "category": "screen",
                "message": "Your screen use was higher than your recent pattern.",
            }
        )

    sleep_base = _mean(
        [float(row.get("sleep_duration_minutes") or 0) for row in prior if float(row.get("sleep_duration_minutes") or 0) > 0]
    )
    latest_sleep = float(latest.get("sleep_duration_minutes") or 0)
    if sleep_base is not None and latest_sleep > 0 and latest_sleep < sleep_base * 0.9:
        insights.append(
            {
                "id": "sleep-down",
                "category": "sleep",
                "message": "Your reported sleep duration has decreased compared with your recent average.",
            }
        )

    late_base = _mean([float(row.get("late_night_usage_minutes") or 0) for row in prior])
    latest_late = float(latest.get("late_night_usage_minutes") or 0)
    if late_base is not None and latest_late > late_base * 1.2 and latest_late - late_base >= 15:
        insights.append(
            {
                "id": "late-up",
                "category": "late-night",
                "message": "Late-night device usage has increased over your recent observations.",
            }
        )

    breaks = latest.get("break_frequency")
    if breaks is not None and float(breaks) == 0 and latest_screen >= 240:
        insights.append(
            {
                "id": "breaks",
                "category": "breaks",
                "message": "Long periods of device use were logged without recorded breaks.",
            }
        )

    if not insights:
        insights.append(
            {
                "id": "stable",
                "category": "general",
                "message": "Your latest day is close to your recent recorded pattern. Keep logging so trends remain interpretable.",
            }
        )
    return insights


def build_notifications(lifestyle: List[Dict[str, Any]], enabled: bool) -> List[Dict[str, str]]:
    if not enabled:
        return []
    return [
        {"id": item["id"], "message": item["message"]}
        for item in build_insights(lifestyle)
        if item["id"] not in {"empty", "stable"}
    ]
