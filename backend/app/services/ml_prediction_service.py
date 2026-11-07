"""
Bridges the pure ML pipeline (app/ml/*, no I/O) to Supabase: persisting
training results and fitted model artifacts, loading the current best
model, and generating + saving individual predictions.

This is the ONLY module in the ML layer that talks to the database or
storage — everything in app/ml/ stays pure Python/pandas/sklearn, which is
what made it possible to test app/ml/ directly in this environment without
a live Supabase project (see tests/test_pipeline.py). This module itself
could not be executed here (it needs a real Supabase project), so treat it
as reviewed-but-unverified code, same caveat as the FastAPI routers.
"""
from __future__ import annotations

import io
import joblib
import pandas as pd

from app.core.supabase import get_service_role_client
from app.ml.data.features import FEATURE_COLUMNS
from app.ml.models.registry import ModelRecord
from app.ml.models.train import ModelResult, TrainingRunResult
from app.ml.predict import predict_one

MODEL_BUCKET = "ml-models"


def save_training_run(records: list[ModelRecord], results_by_name: dict[str, ModelResult] | None = None) -> None:
    """
    Persists every candidate's metrics (ml_models row) and, for the best
    model in the run, its serialized fitted pipeline to Storage. Called by
    scripts/train_wellbeing_model.py --save. results_by_name, when given,
    lets the caller also serialize the fitted pipeline; without it, only
    metrics are saved (useful for recording a comparison run without
    committing a new model to production).
    """
    client = get_service_role_client()

    for record in records:
        row = record.to_dict()

        if results_by_name and record.is_best_in_run:
            result = results_by_name[record.model_name]
            buffer = io.BytesIO()
            joblib.dump(result.fitted_pipeline, buffer)
            buffer.seek(0)
            storage_path = f"{record.task}/{record.model_name}/{record.model_version}.joblib"
            client.storage.from_(MODEL_BUCKET).upload(
                storage_path, buffer.read(), {"content-type": "application/octet-stream", "upsert": "true"}
            )
            row["storage_path"] = storage_path

        client.table("ml_models").upsert(row, on_conflict="model_name,model_version").execute()


def load_current_best_model(task: str) -> tuple[ModelRecord | None, object | None]:
    """
    Loads the metadata + deserialized fitted pipeline for the most recently
    trained "best" model for a task. Returns (None, None) if no model has
    ever been saved for this task — callers must handle that by reporting
    "no model available yet", never by fabricating a prediction.
    """
    client = get_service_role_client()
    resp = (
        client.table("ml_models")
        .select("*")
        .eq("task", task)
        .eq("is_best_in_run", True)
        .not_.is_("storage_path", "null")
        .order("training_date", desc=True)
        .limit(1)
        .execute()
    )
    if not resp.data:
        return None, None

    row = resp.data[0]
    file_bytes = client.storage.from_(MODEL_BUCKET).download(row["storage_path"])
    pipeline = joblib.load(io.BytesIO(file_bytes))
    return row, pipeline


def generate_and_save_prediction(user_id: str, task: str, feature_row: pd.Series, background_X: pd.DataFrame) -> dict | None:
    """
    Generates today's prediction for one user using the current best saved
    model for `task`, and upserts it into ml_predictions. Returns the saved
    row as a dict, or None if no trained model is available yet for this
    task — the caller (the API route) is responsible for turning that into
    the "not enough data / no model yet" response, never a fabricated one.
    """
    model_row, pipeline = load_current_best_model(task)
    if model_row is None or pipeline is None:
        return None

    prediction = predict_one(
        pipeline=pipeline,
        background_X=background_X,
        row=feature_row,
        model_name=model_row["model_name"],
        model_version=model_row["model_version"],
        task=task,
    )

    client = get_service_role_client()
    row = {
        "user_id": user_id,
        "model_id": model_row["id"],
        "date": prediction.date,
        "task": task,
        "predicted_value_numeric": prediction.value if task == "regression" else None,
        "predicted_value_label": prediction.value if task == "classification" else None,
        "confidence": prediction.confidence,
        "feature_contributions": prediction.feature_contributions,
        "top_contributing_features": prediction.top_contributing_features,
    }
    client.table("ml_predictions").upsert(row, on_conflict="user_id,model_id,date").execute()
    return row
