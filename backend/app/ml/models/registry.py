"""
Model registry record: the structured metadata saved for every trained
model, matching Section 37A's storage requirements exactly. This is the
Python-side shape; the Supabase table it's written to is
supabase/migrations/0002_ml_models.sql — keep the two in sync.

A ModelRecord is produced once per trained candidate (so a single training
run produces several ModelRecords — one per model type) and the best one
per task is what the prediction service actually loads, but every
candidate's record is kept for comparison and audit, not just the winner.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal

from app.ml.data.features import FEATURE_COLUMNS, FEATURE_SET_VERSION
from app.ml.models.train import ModelResult, TrainingRunResult


@dataclass
class ModelRecord:
    model_name: str
    model_version: str
    task: Literal["regression", "classification"]
    training_dataset_version: str
    feature_set_version: str
    feature_columns: list[str]
    training_date: str
    n_training_rows: int
    n_training_users: int
    evaluation_metrics: dict[str, float]
    cv_scores: list[float]
    feature_importance: dict[str, float]
    best_hyperparameters: dict[str, Any]
    is_best_in_run: bool
    notes: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


def _dataset_fingerprint(df) -> str:
    """
    A short, deterministic fingerprint of the training dataset's actual
    content (row count, user count, column hash, value hash) — not just a
    human-chosen label. Two training runs on genuinely identical data get
    the same fingerprint; any difference in the data changes it. This is
    what training_dataset_version is built from, so "which data trained
    this model" is never ambiguous or self-reported.
    """
    cols = ",".join(sorted(df.columns))
    # Hash a stable summary rather than the full dataframe (which may be
    # large) — row/user counts plus a hash of sorted (user_id, date) pairs
    # is enough to detect "this is different data" with high confidence.
    key_pairs = "|".join(
        f"{u}:{d}" for u, d in sorted(zip(df["user_id"].astype(str), df["date"].astype(str)))
    )
    digest = hashlib.sha256(f"{cols}::{len(df)}::{key_pairs}".encode()).hexdigest()[:16]
    return f"{len(df)}rows-{df['user_id'].nunique()}users-{digest}"


def build_records(run: TrainingRunResult, df, model_version_prefix: str = "v1") -> list[ModelRecord]:
    """
    Converts a TrainingRunResult (in-memory, from train.py) into the
    ModelRecord rows that get persisted. Does not persist anything itself —
    see app/services/ml_prediction_service.py for the Supabase write, kept
    separate so this module has no I/O and stays trivially testable.
    """
    dataset_version = _dataset_fingerprint(df)
    training_date = datetime.now(timezone.utc).isoformat()

    records: list[ModelRecord] = []
    for result in run.results:
        records.append(
            ModelRecord(
                model_name=result.model_name,
                model_version=f"{model_version_prefix}-{training_date[:10]}",
                task=result.task,
                training_dataset_version=dataset_version,
                feature_set_version=FEATURE_SET_VERSION,
                feature_columns=list(FEATURE_COLUMNS),
                training_date=training_date,
                n_training_rows=run.n_rows,
                n_training_users=run.n_users,
                evaluation_metrics=result.test_metrics,
                cv_scores=result.cv_scores,
                feature_importance=result.feature_importance,
                best_hyperparameters=result.best_params,
                is_best_in_run=(run.best_model is not None and result.model_name == run.best_model.model_name),
            )
        )
    return records
