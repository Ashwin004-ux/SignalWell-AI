"""
Inference: turns one user-day's features into a structured prediction.

This is the ONLY output of the ML layer. It is a plain dataclass of
numbers and strings — no prose, no "explanation" written by anything other
than SHAP's numerical attributions. The LLM analysis layer
(app/services/llm_analysis_service.py) takes a WellbeingPrediction as
read-only input and writes a plain-language explanation of it; nothing
downstream is permitted to edit prediction.value, prediction.confidence, or
prediction.feature_contributions — see that service's docstring for how
this boundary is enforced in code, not just by convention.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline

from app.ml.data.features import FEATURE_COLUMNS
from app.ml.explain.shap_explain import explain_local


@dataclass(frozen=True)
class WellbeingPrediction:
    user_id: str
    date: str
    model_name: str
    model_version: str
    task: str  # "regression" | "classification"
    value: float | str  # predicted wellbeing_score, or predicted risk label
    confidence: float | None  # see _confidence() docstring for how this is derived
    feature_contributions: dict[str, float]  # from SHAP; signed, this prediction only
    top_contributing_features: list[str]


def _confidence(pipeline: Pipeline, row_X: pd.DataFrame, task: str) -> float | None:
    """
    Confidence is derived, never a number the model is simply asked to
    output (models aren't reliably calibrated to do that honestly).
      - Classification: the predicted class's own predict_proba value.
      - Regression: no principled single-point confidence exists for an
        arbitrary regressor without a calibrated interval model (e.g.
        quantile regression or conformal prediction), which isn't in scope
        yet (see docs/ROADMAP.md). Returning None here is deliberate —
        better to omit a confidence figure than fabricate one, per this
        project's "never fabricate" requirement.
    """
    model = pipeline.named_steps["model"]
    if task == "classification" and hasattr(model, "predict_proba"):
        scaler = pipeline.named_steps["scaler"]
        proba = model.predict_proba(scaler.transform(row_X))[0]
        return float(np.max(proba))
    return None


def predict_one(
    pipeline: Pipeline,
    background_X: pd.DataFrame,
    row: pd.Series,
    model_name: str,
    model_version: str,
    task: str,
) -> WellbeingPrediction:
    """
    row must contain user_id, date, and every column in FEATURE_COLUMNS
    (i.e. one row out of ml.data.features.build_features's output for a
    single user-day). Raises KeyError loudly if a required feature is
    missing rather than silently predicting on a partial/misaligned vector.
    """
    row_X = row[FEATURE_COLUMNS].to_frame().T
    scaler = pipeline.named_steps["scaler"]
    model = pipeline.named_steps["model"]

    raw_prediction = model.predict(scaler.transform(row_X))[0]
    value: float | str = float(raw_prediction) if task == "regression" else str(raw_prediction)

    try:
        local = explain_local(pipeline, background_X, row_X)
        contributions = local.feature_contributions
        top = [name for name, _ in local.top_contributors(5)]
    except ImportError:
        # shap isn't installed in this environment — degrade to "no
        # explanation available" rather than crash the whole prediction,
        # but never substitute fabricated contribution values.
        contributions = {}
        top = []

    return WellbeingPrediction(
        user_id=str(row["user_id"]),
        date=str(row["date"]),
        model_name=model_name,
        model_version=model_version,
        task=task,
        value=value,
        confidence=_confidence(pipeline, row_X, task),
        feature_contributions=contributions,
        top_contributing_features=top,
    )
