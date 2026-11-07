"""
Rule-based notification generation — a direct port of the Next.js app's
src/lib/notifications/rules.ts, kept deliberately NOT AI-generated for the
same reason as the original: plain threshold comparisons against a user's
own recent average, with messages that state the actual numbers rather
than vague alarm language (spec Section 18).

Whether the Next.js routes or this FastAPI service is the system of
record for notification generation is an architecture decision the
project owner needs to make (see backend/README.md) — right now BOTH
exist with equivalent logic; this is not meant to run alongside the
Next.js version in production without picking one.
"""
from __future__ import annotations

from dataclasses import dataclass
from statistics import mean
from typing import Literal

HIGH_SCREEN_TIME_THRESHOLD = 1.3
POSITIVE_CHANGE_THRESHOLD = 0.85
SLEEP_DROP_THRESHOLD_MINUTES = 45
MIN_PRIOR_DAYS = 3


@dataclass(frozen=True)
class NotificationCandidate:
    type: Literal["high_screen_time", "late_night_usage", "sleep_pattern", "positive_change"]
    title: str
    message: str
    severity: Literal["info", "notice", "elevated"]


def _format_minutes(total_minutes: float) -> str:
    h, m = divmod(round(total_minutes), 60)
    return f"{h}h {m}m" if h else f"{m}m"


def evaluate_activity_notifications(today: dict | None, prior_days: list[dict]) -> list[NotificationCandidate]:
    if not today or len(prior_days) < MIN_PRIOR_DAYS:
        return []

    candidates: list[NotificationCandidate] = []
    avg_screen_time = mean(d["total_screen_time_minutes"] for d in prior_days)
    avg_late_night = mean(d["late_night_usage_minutes"] for d in prior_days)

    if avg_screen_time > 0 and today["total_screen_time_minutes"] > avg_screen_time * HIGH_SCREEN_TIME_THRESHOLD:
        candidates.append(
            NotificationCandidate(
                type="high_screen_time",
                title="High screen time",
                message=(
                    f"Your screen time today ({_format_minutes(today['total_screen_time_minutes'])}) is "
                    f"higher than your recent average ({_format_minutes(avg_screen_time)}). "
                    "Consider taking a short break."
                ),
                severity="notice",
            )
        )
    elif avg_screen_time > 0 and today["total_screen_time_minutes"] < avg_screen_time * POSITIVE_CHANGE_THRESHOLD:
        candidates.append(
            NotificationCandidate(
                type="positive_change",
                title="Screen time decreased",
                message=(
                    f"Your screen time today ({_format_minutes(today['total_screen_time_minutes'])}) is "
                    f"lower than your recent average ({_format_minutes(avg_screen_time)})."
                ),
                severity="info",
            )
        )

    if today["late_night_usage_minutes"] > 0 and today["late_night_usage_minutes"] > max(avg_late_night, 15) * 1.5:
        candidates.append(
            NotificationCandidate(
                type="late_night_usage",
                title="Late-night usage",
                message=(
                    f"You were active on your device later than usual tonight "
                    f"({_format_minutes(today['late_night_usage_minutes'])} after 11pm)."
                ),
                severity="notice",
            )
        )

    return candidates


def evaluate_sleep_notifications(today: dict | None, prior_days: list[dict]) -> list[NotificationCandidate]:
    if not today or len(prior_days) < MIN_PRIOR_DAYS:
        return []

    avg_sleep = mean(d["sleep_duration_minutes"] for d in prior_days)
    if avg_sleep - today["sleep_duration_minutes"] > SLEEP_DROP_THRESHOLD_MINUTES:
        return [
            NotificationCandidate(
                type="sleep_pattern",
                title="Sleep pattern",
                message=(
                    f"Your sleep last night ({_format_minutes(today['sleep_duration_minutes'])}) was "
                    f"shorter than your recent average ({_format_minutes(avg_sleep)})."
                ),
                severity="notice",
            )
        ]
    return []
