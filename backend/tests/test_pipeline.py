"""
Tests for the ML pipeline's mechanics, not its real-world accuracy.

Every fixture here is synthetic and exists only to verify the code does
what it claims to do (drops the right rows, computes the right shapes,
respects the minimum-data guard, etc.). None of these numbers represent,
or should ever be quoted as, SignalWell's actual model performance — that
can only come from scripts/train_wellbeing_model.py run against a real
exported dataset.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.ml.data.validation import MIN_ROWS_FOR_TRAINING, validate
from app.ml.data.features import FEATURE_COLUMNS, TARGET_COLUMN_REGRESSION, build_features
from app.ml.models.train import train_classification_models, train_regression_models
from app.ml.models.registry import build_records


def synthetic_rows(n_users: int, n_days: int, seed: int = 0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    for u in range(n_users):
        user_id = f"user-{u}"
        base_screen = rng.uniform(120, 360)
        sensitivity = rng.uniform(0.01, 0.03)
        for d in range(n_days):
            date = pd.Timestamp("2026-01-01") + pd.Timedelta(days=d)
            screen = max(0, base_screen + rng.normal(0, 40))
            late_night = max(0, rng.normal(20, 15))
            wellbeing = np.clip(7 - sensitivity * late_night + rng.normal(0, 1.2), 1, 10)
            rows.append(
                {
                    "user_id": user_id,
                    "date": date,
                    "total_screen_time_minutes": screen,
                    "social_media_minutes": max(0, screen * 0.2),
                    "late_night_usage_minutes": late_night,
                    "notifications_count": 50,
                    "app_switches": 80,
                    "sleep_duration_minutes": max(0, rng.normal(420, 50)),
                    "mood_score": np.clip(rng.normal(6, 1.5), 1, 10),
                    "stress_score": np.clip(rng.normal(5, 1.5), 1, 10),
                    "anxiety_score": np.clip(rng.normal(5, 1.5), 1, 10),
                    "wellbeing_score": wellbeing,
                    "energy_score": np.clip(rng.normal(6, 1.5), 1, 10),
                }
            )
    return pd.DataFrame(rows)


def test_validate_rejects_missing_columns():
    df = pd.DataFrame({"user_id": ["a"], "date": ["2026-01-01"]})
    clean, report = validate(df)
    assert len(clean) == 0
    assert "total_screen_time_minutes" in report.missing_columns
    assert not report.sufficient_for_training


def test_validate_drops_out_of_range_scores():
    df = synthetic_rows(n_users=2, n_days=10)
    df.loc[0, "mood_score"] = 999  # impossible value
    clean, report = validate(df)
    assert len(clean) == len(df) - 1
    assert report.out_of_range_counts.get("mood_score") == 1


def test_validate_flags_insufficient_rows():
    df = synthetic_rows(n_users=1, n_days=5)
    clean, report = validate(df)
    assert len(clean) < MIN_ROWS_FOR_TRAINING
    assert not report.sufficient_for_training
    assert "sufficient research data" in report.summary()


def test_build_features_drops_rows_without_history():
    df = synthetic_rows(n_users=3, n_days=20)
    clean, _ = validate(df)
    feats = build_features(clean)
    # Each user's first 2 rows have min_periods=3 unmet for the 7d rolling
    # stats, so at least 2 rows per user should be dropped.
    assert feats.attrs["n_dropped_for_insufficient_history"] >= 3 * 2
    assert set(FEATURE_COLUMNS).issubset(feats.columns)
    assert feats[FEATURE_COLUMNS].isna().sum().sum() == 0


def test_build_features_no_target_leakage_into_rolling_avg():
    # A row's own screen_time_7d_avg must not include that row's own
    # total_screen_time_minutes.
    df = synthetic_rows(n_users=1, n_days=10)
    clean, _ = validate(df)
    feats = build_features(clean)
    row = feats.iloc[-1]
    prior_rows = clean[clean["date"] < row["date"]].tail(7)
    expected_avg = prior_rows["total_screen_time_minutes"].mean()
    assert row["screen_time_7d_avg"] == pytest.approx(expected_avg)


def test_train_regression_raises_below_minimum():
    df = synthetic_rows(n_users=1, n_days=10)
    clean, _ = validate(df)
    feats = build_features(clean)
    with pytest.raises(ValueError, match="sufficient research data"):
        train_regression_models(feats)


def test_train_regression_runs_and_evaluates():
    df = synthetic_rows(n_users=15, n_days=45, seed=7)
    clean, _ = validate(df)
    feats = build_features(clean)
    run = train_regression_models(feats)

    assert {"linear_regression", "random_forest_regressor"} <= {r.model_name for r in run.results}
    for result in run.results:
        assert set(result.test_metrics) == {"mae", "rmse", "r2"}
        assert result.test_metrics["mae"] >= 0
        assert result.test_metrics["rmse"] >= 0
    assert run.best_model is not None
    assert run.best_model.model_name == min(run.results, key=lambda r: r.test_metrics["mae"]).model_name


def test_train_classification_runs_and_evaluates():
    df = synthetic_rows(n_users=15, n_days=45, seed=7)
    clean, _ = validate(df)
    feats = build_features(clean)
    run = train_classification_models(feats)

    for result in run.results:
        for metric in ("accuracy", "precision_macro", "recall_macro", "f1_macro"):
            assert 0 <= result.test_metrics[metric] <= 1
    assert run.best_model is not None


def test_registry_records_are_traceable():
    df = synthetic_rows(n_users=15, n_days=45, seed=7)
    clean, _ = validate(df)
    feats = build_features(clean)
    run = train_regression_models(feats)
    records = build_records(run, feats)

    assert len(records) == len(run.results)
    assert sum(r.is_best_in_run for r in records) == 1
    for record in records:
        assert record.feature_columns == FEATURE_COLUMNS
        assert record.n_training_rows == len(feats)
        # Same dataset in -> same fingerprint out, every time.
    second_run_records = build_records(run, feats)
    assert records[0].training_dataset_version == second_run_records[0].training_dataset_version
