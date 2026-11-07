import numpy as np
import pandas as pd

FEATURE_COLUMNS = [
    "screen_time",
    "social_media_minutes",
    "late_night_usage",
    "notifications_count",
    "sleep_duration",
    "sleep_consistency",
    "physical_activity_minutes",
    "exercise_frequency",
    "study_work_minutes",
    "break_frequency",
    "screen_to_sleep_ratio",
    "high_late_night_usage",
    "day_of_week",
    "is_weekend",
]


def create_features(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df

    out = df.copy()

    def col(*names: str) -> str | None:
        for name in names:
            if name in out.columns:
                return name
        return None

    screen = col("screen_time", "total_screen_time_minutes")
    sleep = col("sleep_duration", "sleep_duration_minutes")
    late = col("late_night_usage", "late_night_usage_minutes")

    if screen and "screen_time" not in out.columns:
        out["screen_time"] = out[screen]
    if sleep and "sleep_duration" not in out.columns:
        out["sleep_duration"] = out[sleep]
    if late and "late_night_usage" not in out.columns:
        out["late_night_usage"] = out[late]
    if "social_media_minutes" not in out.columns and "social_media_usage" in out.columns:
        out["social_media_minutes"] = out["social_media_usage"]

    for name in FEATURE_COLUMNS:
        if name not in out.columns:
            out[name] = 0

    safe_sleep = out["sleep_duration"].replace(0, np.nan)
    out["screen_to_sleep_ratio"] = (out["screen_time"] / safe_sleep).fillna(0)
    out["high_late_night_usage"] = (out["late_night_usage"] > 60).astype(int)

    if "date" in out.columns:
        dt = pd.to_datetime(out["date"], errors="coerce")
        out["day_of_week"] = dt.dt.dayofweek.fillna(0).astype(int)
        out["is_weekend"] = out["day_of_week"].isin([5, 6]).astype(int)

    return out
