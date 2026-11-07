"""
Feature engineering for the wellbeing-estimation pipeline.

Turns validated daily rows (one per user_id+date) into the feature matrix
the models train on. Features are built per-user from that user's own
history (rolling averages, day-over-day deltas), never across users, so a
user's prediction is never leaked information from someone else's data —
this matters both statistically (avoids target leakage across the group
k-fold boundary in train.py) and for privacy.

FEATURE_SET_VERSION must be bumped any time the feature list or its
definition changes, and is stored alongside every trained model and every
prediction (see models/registry.py) so a model is always traceable to
exactly what features it expects.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

FEATURE_SET_VERSION = "v1"

# The feature columns a model trained with this feature set expects, in a
# fixed order. Keeping this explicit (rather than "whatever columns happen
# to be in the dataframe") means a mismatch between training-time and
# inference-time features raises an error instead of silently training or
# predicting on the wrong thing.
FEATURE_COLUMNS = [
    "total_screen_time_minutes",
    "social_media_minutes",
    "late_night_usage_minutes",
    "notifications_count",
    "app_switches",
    "sleep_duration_minutes",
    "social_media_share_of_screen_time",
    "late_night_share_of_screen_time",
    "screen_time_7d_avg",
    "screen_time_delta_from_7d_avg",
    "sleep_duration_7d_avg",
    "sleep_duration_delta_from_7d_avg",
    "sleep_consistency_7d_std",
    "mood_score_7d_avg",
    "stress_score_7d_avg",
    "anxiety_score_7d_avg",
    "day_of_week",
    "is_weekend",
]

TARGET_COLUMN_REGRESSION = "wellbeing_score"

# For the optional classification experiments: a coarse 3-level label
# derived from wellbeing_score, mirroring the app's own stable/monitor/
# elevated language (see Section 11 of the spec) rather than inventing a
# separate clinical-sounding scale. This is a modeling convenience label,
# not a diagnosis, and the app must never present it as one.
RISK_LABEL_COLUMN = "wellbeing_risk_label"


def _rolling_user_stat(df: pd.DataFrame, col: str, window: int, stat: str) -> pd.Series:
    """
    Rolling statistic over a user's own prior days only (shift(1) before
    rolling), so a row's features never include that same day's own target
    — the classic leakage bug in longitudinal feature engineering.
    """
    grouped = df.sort_values(["user_id", "date"]).groupby("user_id")[col]
    shifted = grouped.shift(1)
    rolled = shifted.groupby(df["user_id"]).rolling(window, min_periods=3).agg(stat)
    return rolled.reset_index(level=0, drop=True).reindex(df.index)


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Input: validated flat rows (output of data.validation.validate).
    Output: df with FEATURE_COLUMNS + TARGET_COLUMN_REGRESSION + identifying
    columns (user_id, date), one row per user-day that has enough prior
    history to compute the rolling features. Rows without enough prior
    history (a user's first few recorded days) are dropped — they're
    reported, not silently estimated with placeholder values.
    """
    df = df.sort_values(["user_id", "date"]).reset_index(drop=True)

    screen_time = df["total_screen_time_minutes"].replace(0, np.nan)
    df["social_media_share_of_screen_time"] = (
        df["social_media_minutes"] / screen_time
    ).clip(0, 1)
    df["late_night_share_of_screen_time"] = (
        df["late_night_usage_minutes"] / screen_time
    ).clip(0, 1)

    df["screen_time_7d_avg"] = _rolling_user_stat(df, "total_screen_time_minutes", 7, "mean")
    df["screen_time_delta_from_7d_avg"] = (
        df["total_screen_time_minutes"] - df["screen_time_7d_avg"]
    )

    df["sleep_duration_7d_avg"] = _rolling_user_stat(df, "sleep_duration_minutes", 7, "mean")
    df["sleep_duration_delta_from_7d_avg"] = (
        df["sleep_duration_minutes"] - df["sleep_duration_7d_avg"]
    )
    df["sleep_consistency_7d_std"] = _rolling_user_stat(df, "sleep_duration_minutes", 7, "std")

    df["mood_score_7d_avg"] = _rolling_user_stat(df, "mood_score", 7, "mean")
    df["stress_score_7d_avg"] = _rolling_user_stat(df, "stress_score", 7, "mean")
    df["anxiety_score_7d_avg"] = _rolling_user_stat(df, "anxiety_score", 7, "mean")

    df["day_of_week"] = df["date"].dt.dayofweek
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)

    df[RISK_LABEL_COLUMN] = pd.cut(
        df[TARGET_COLUMN_REGRESSION],
        bins=[0, 4, 7, 10],
        labels=["elevated", "monitor", "stable"],
        include_lowest=True,
    )

    before = len(df)
    df = df.dropna(subset=FEATURE_COLUMNS + [TARGET_COLUMN_REGRESSION])
    n_dropped_for_history = before - len(df)

    df.attrs["feature_set_version"] = FEATURE_SET_VERSION
    df.attrs["n_dropped_for_insufficient_history"] = n_dropped_for_history

    return df.reset_index(drop=True)
