"""
Data validation for the wellbeing-estimation ML pipeline.

This runs before feature engineering or training. Its job is to catch bad
data early and loudly rather than let it silently become a bad model: wrong
dtypes, out-of-range scores, duplicate (user_id, date) rows, and — the
requirement that matters most for this project — too few real rows to
train or evaluate anything meaningfully.

Nothing in this module invents, imputes with fabricated plausible-looking
values, or silently drops large amounts of data without reporting it.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

# Minimum number of real (user_id, date) rows with a non-null wellbeing_score
# required before we'll even attempt a train/val/test split. This is
# deliberately conservative: below this, a train/val/test split plus
# cross-validation doesn't produce a trustworthy estimate, it produces
# noise that looks like a number. Tune this only with a documented reason,
# never just to get a model to "pass".
MIN_ROWS_FOR_TRAINING = 150

# Below this, we won't even report descriptive statistics as if they
# characterize a population — just enough to run a basic sanity check.
MIN_ROWS_FOR_ANY_ANALYSIS = 20

REQUIRED_COLUMNS = {
    "user_id": "object",
    "date": "object",  # parsed to datetime during validation
    "total_screen_time_minutes": "number",
    "social_media_minutes": "number",
    "late_night_usage_minutes": "number",
    "notifications_count": "number",
    "app_switches": "number",
    "sleep_duration_minutes": "number",
    "mood_score": "number",
    "stress_score": "number",
    "anxiety_score": "number",
    "wellbeing_score": "number",  # the regression target
}

# (column, min, max) — inclusive. Matches the CHECK constraints in
# supabase/schema.sql; kept in sync manually since this pipeline reads a
# flat export rather than the live schema.
SCORE_RANGES = [
    ("mood_score", 1, 10),
    ("stress_score", 1, 10),
    ("anxiety_score", 1, 10),
    ("wellbeing_score", 1, 10),
    ("energy_score", 1, 10),
]


@dataclass
class ValidationReport:
    n_rows_in: int
    n_rows_valid: int
    n_duplicate_keys: int
    missing_columns: list[str] = field(default_factory=list)
    out_of_range_counts: dict[str, int] = field(default_factory=dict)
    dropped_reasons: dict[str, int] = field(default_factory=dict)

    @property
    def sufficient_for_training(self) -> bool:
        return not self.missing_columns and self.n_rows_valid >= MIN_ROWS_FOR_TRAINING

    @property
    def sufficient_for_any_analysis(self) -> bool:
        return not self.missing_columns and self.n_rows_valid >= MIN_ROWS_FOR_ANY_ANALYSIS

    def summary(self) -> str:
        if self.missing_columns:
            return f"Missing required columns: {', '.join(self.missing_columns)}"
        if not self.sufficient_for_training:
            return (
                f"Model evaluation requires sufficient research data. "
                f"Got {self.n_rows_valid} valid rows; need at least "
                f"{MIN_ROWS_FOR_TRAINING}."
            )
        return (
            f"{self.n_rows_valid}/{self.n_rows_in} rows valid "
            f"({self.n_duplicate_keys} duplicate keys dropped)."
        )


def validate(df: pd.DataFrame) -> tuple[pd.DataFrame, ValidationReport]:
    """
    Validates a flat export (one row per user_id+date, already joined from
    daily_activity / sleep_records / mood_records — see
    scripts/export_training_data.sql for the query this expects).

    Returns (clean_df, report). clean_df contains only rows that passed
    every check; report explains exactly what was dropped and why, so a
    human can inspect data quality rather than trust a silent pass.
    """
    n_rows_in = len(df)
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        return df.iloc[0:0], ValidationReport(
            n_rows_in=n_rows_in, n_rows_valid=0, n_duplicate_keys=0, missing_columns=missing
        )

    df = df.copy()
    dropped_reasons: dict[str, int] = {}

    # Parse dates; invalid dates become NaT and get dropped below.
    df["date"] = pd.to_datetime(df["date"], errors="coerce")

    # Coerce numeric columns; anything non-numeric becomes NaN.
    numeric_cols = [c for c, kind in REQUIRED_COLUMNS.items() if kind == "number"]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    before = len(df)
    df = df.dropna(subset=["user_id", "date", "wellbeing_score"])
    dropped_reasons["missing_key_or_target"] = before - len(df)

    # Duplicate (user_id, date) rows are a data-pipeline bug upstream
    # (e.g. a backfill double-run) — keep the most recently created one if
    # a created_at column is present, otherwise the first, and report the
    # count so it can be investigated rather than silently normalized away.
    n_duplicate_keys = int(df.duplicated(subset=["user_id", "date"]).sum())
    sort_col = "created_at" if "created_at" in df.columns else None
    if sort_col:
        df = df.sort_values(sort_col).drop_duplicates(subset=["user_id", "date"], keep="last")
    else:
        df = df.drop_duplicates(subset=["user_id", "date"], keep="first")

    out_of_range_counts: dict[str, int] = {}
    for col, lo, hi in SCORE_RANGES:
        if col not in df.columns:
            continue
        mask = df[col].notna() & ((df[col] < lo) | (df[col] > hi))
        count = int(mask.sum())
        if count:
            out_of_range_counts[col] = count
            df = df.loc[~mask]

    # Negative durations are impossible and indicate an upstream bug, not a
    # value to clip-and-continue silently.
    duration_cols = [
        "total_screen_time_minutes",
        "social_media_minutes",
        "late_night_usage_minutes",
        "sleep_duration_minutes",
    ]
    before = len(df)
    for col in duration_cols:
        if col in df.columns:
            df = df.loc[(df[col].isna()) | (df[col] >= 0)]
    dropped_reasons["negative_duration"] = before - len(df)

    report = ValidationReport(
        n_rows_in=n_rows_in,
        n_rows_valid=len(df),
        n_duplicate_keys=n_duplicate_keys,
        missing_columns=[],
        out_of_range_counts=out_of_range_counts,
        dropped_reasons={k: v for k, v in dropped_reasons.items() if v},
    )
    return df.reset_index(drop=True), report
