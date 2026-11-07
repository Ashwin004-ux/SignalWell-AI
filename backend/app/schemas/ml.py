from __future__ import annotations

from pydantic import BaseModel


class PredictionResponse(BaseModel):
    date: str
    model_name: str
    model_version: str
    task: str
    predicted_value_numeric: float | None = None
    predicted_value_label: str | None = None
    confidence: float | None = None
    top_contributing_features: list[str] = []
    feature_contributions: dict[str, float] = {}


class PredictionListResponse(BaseModel):
    predictions: list[PredictionResponse]


class NotEnoughDataResponse(BaseModel):
    error: str = "Model evaluation requires sufficient research data."
    rows_available: int
    rows_required: int


class TrainingRunSummary(BaseModel):
    task: str
    n_rows: int
    n_users: int
    best_model_name: str
    skipped_models: list[str]
    models: list[dict]
