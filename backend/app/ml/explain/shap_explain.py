"""
SHAP-based explainability for trained wellbeing models.

NOTE ON THIS FILE'S TESTING STATUS: `shap` is not installed in the sandbox
this project was authored in (no network access to pip install it), so
unlike validation.py, features.py, train.py, and registry.py, this module
could not be executed and verified end-to-end here. It's written against
the real documented SHAP API (TreeExplainer for tree models, LinearExplainer
for linear models) and follows SHAP's standard usage pattern, but install
`shap` and run tests/test_shap_explain.py (included) before relying on it.

Explanations are per-prediction (local) and per-model (global, via mean
|SHAP value| across the training set) — see Section 37A: "identify which
behavioral features contribute most to model estimates." Both are
structured data the LLM layer can describe in words, never numbers the LLM
is allowed to invent or adjust.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.pipeline import Pipeline

from app.ml.data.features import FEATURE_COLUMNS


@dataclass
class LocalExplanation:
    """Why the model produced this specific prediction for this specific row."""

    base_value: float
    prediction: float
    feature_contributions: dict[str, float]  # signed SHAP values, this row only

    def top_contributors(self, n: int = 5) -> list[tuple[str, float]]:
        return sorted(self.feature_contributions.items(), key=lambda kv: -abs(kv[1]))[:n]


@dataclass
class GlobalExplanation:
    """Which features matter most for this model across the training set."""

    mean_abs_shap_by_feature: dict[str, float]  # already sorted, descending


def _unwrap(pipeline: Pipeline):
    """Pipelines here are always [('scaler', StandardScaler), ('model', estimator)]."""
    return pipeline.named_steps["scaler"], pipeline.named_steps["model"]


def _make_explainer(pipeline: Pipeline, background_X: pd.DataFrame):
    """
    Picks the appropriate SHAP explainer for the model type. TreeExplainer
    is exact and fast for tree ensembles (RandomForest, XGBoost);
    LinearExplainer is exact for linear/logistic models. We deliberately do
    NOT fall back to the slower, approximate KernelExplainer for model
    types we don't explicitly support, since an approximate explanation
    presented with the same confidence as an exact one is misleading.
    """
    import shap  # imported lazily so the rest of the package works without shap installed

    scaler, model = _unwrap(pipeline)
    background_scaled = scaler.transform(background_X)

    model_type = type(model).__name__
    if model_type in ("RandomForestRegressor", "RandomForestClassifier", "XGBRegressor", "XGBClassifier"):
        return shap.TreeExplainer(model), scaler
    if model_type in ("LinearRegression", "LogisticRegression"):
        return shap.LinearExplainer(model, background_scaled), scaler
    raise ValueError(
        f"No supported SHAP explainer for model type {model_type}. "
        f"Add a case above rather than silently using an approximate explainer."
    )


def explain_global(pipeline: Pipeline, background_X: pd.DataFrame) -> GlobalExplanation:
    """
    background_X should be the training set (or a representative sample of
    it, e.g. shap.sample(X_train, 200) for large datasets) — NOT the single
    row being predicted for. Mean |SHAP value| per feature over this set is
    the global importance ranking.
    """
    explainer, scaler = _make_explainer(pipeline, background_X)
    X_scaled = scaler.transform(background_X)
    shap_values = explainer.shap_values(X_scaled)

    # Classification models return one array per class; average the
    # magnitude across classes for a single global ranking.
    if isinstance(shap_values, list):
        stacked = np.mean([np.abs(sv) for sv in shap_values], axis=0)
    else:
        stacked = np.abs(shap_values)

    mean_abs = stacked.mean(axis=0)
    ranked = sorted(zip(FEATURE_COLUMNS, mean_abs), key=lambda kv: -kv[1])
    return GlobalExplanation(mean_abs_shap_by_feature={k: float(v) for k, v in ranked})


def explain_local(pipeline: Pipeline, background_X: pd.DataFrame, row_X: pd.DataFrame) -> LocalExplanation:
    """
    Explains a single prediction (row_X must be exactly one row, with the
    same FEATURE_COLUMNS the pipeline was trained on, in the same order).
    This is what backs the "which behavioral features contributed most to
    THIS estimate" shown alongside an individual prediction.
    """
    if len(row_X) != 1:
        raise ValueError("explain_local expects exactly one row.")

    explainer, scaler = _make_explainer(pipeline, background_X)
    row_scaled = scaler.transform(row_X)
    shap_values = explainer.shap_values(row_scaled)

    if isinstance(shap_values, list):
        # Classification: explain the predicted class specifically, not an
        # average across classes — a local explanation should answer "why
        # THIS predicted label", not blend in evidence for labels that
        # weren't predicted.
        _, model = _unwrap(pipeline)
        predicted_class_idx = int(model.predict(row_scaled)[0]) if not hasattr(model, "classes_") else list(
            model.classes_
        ).index(model.predict(row_scaled)[0])
        values = shap_values[predicted_class_idx][0]
        base = float(np.atleast_1d(explainer.expected_value)[predicted_class_idx])
    else:
        values = shap_values[0]
        base = float(np.atleast_1d(explainer.expected_value)[0])

    contributions = {name: float(v) for name, v in zip(FEATURE_COLUMNS, values)}
    prediction = base + sum(contributions.values())

    return LocalExplanation(base_value=base, prediction=prediction, feature_contributions=contributions)
