"""
Training pipeline for wellbeing-score estimation.

Pipeline order (per the spec):
  data validation -> missing-value handling -> feature engineering (done
  upstream in ml/data/) -> feature scaling where required -> train/val/test
  split -> cross-validation -> model training -> hyperparameter tuning ->
  evaluation -> feature importance -> explainability (ml/explain/) ->
  prediction (predict.py).

Models are grouped by user_id, not by row, for every split (GroupShuffleSplit
/ GroupKFold) — a model estimating wellbeing from behavioral patterns must be
evaluated on users it has never seen, otherwise "accuracy" partly measures
how well it memorized a specific person's baseline rather than learning a
generalizable relationship.

xgboost is an optional dependency here: if it isn't installed, the
corresponding candidate model is skipped (reported, not silently ignored),
not substituted with fabricated results.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupKFold, GroupShuffleSplit, GridSearchCV
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.ml.data.features import FEATURE_COLUMNS, RISK_LABEL_COLUMN, TARGET_COLUMN_REGRESSION
from app.ml.data.validation import MIN_ROWS_FOR_TRAINING

try:
    from xgboost import XGBClassifier, XGBRegressor

    XGBOOST_AVAILABLE = True
except ImportError:  # pragma: no cover - environment-dependent
    XGBOOST_AVAILABLE = False

RANDOM_STATE = 42
TEST_SIZE = 0.2
CV_FOLDS = 5


@dataclass
class ModelResult:
    model_name: str
    task: Literal["regression", "classification"]
    fitted_pipeline: Any
    cv_scores: list[float]
    test_metrics: dict[str, float]
    feature_importance: dict[str, float]
    best_params: dict[str, Any]


@dataclass
class TrainingRunResult:
    task: Literal["regression", "classification"]
    n_rows: int
    n_users: int
    results: list[ModelResult] = field(default_factory=list)
    skipped_models: list[str] = field(default_factory=list)
    best_model: ModelResult | None = None

    def summary_table(self) -> pd.DataFrame:
        rows = []
        for r in self.results:
            row = {"model": r.model_name, **r.test_metrics}
            rows.append(row)
        return pd.DataFrame(rows)


def _group_train_test_split(X: pd.DataFrame, y: pd.Series, groups: pd.Series):
    splitter = GroupShuffleSplit(n_splits=1, test_size=TEST_SIZE, random_state=RANDOM_STATE)
    train_idx, test_idx = next(splitter.split(X, y, groups=groups))
    return (
        X.iloc[train_idx], X.iloc[test_idx],
        y.iloc[train_idx], y.iloc[test_idx],
        groups.iloc[train_idx], groups.iloc[test_idx],
    )


def _feature_importance(pipeline: Pipeline, feature_names: list[str]) -> dict[str, float]:
    model = pipeline.named_steps["model"]
    if hasattr(model, "feature_importances_"):
        values = model.feature_importances_
    elif hasattr(model, "coef_"):
        coef = model.coef_
        values = np.abs(coef[0] if coef.ndim > 1 else coef)
    else:  # pragma: no cover - defensive
        return {}
    total = float(np.sum(values)) or 1.0
    return {name: float(v) / total for name, v in sorted(zip(feature_names, values), key=lambda t: -abs(t[1]))}


def _fit_with_cv(
    estimator, param_grid: dict, X_train, y_train, groups_train, scoring: str
) -> tuple[Pipeline, list[float], dict]:
    pipeline = Pipeline([("scaler", StandardScaler()), ("model", estimator)])
    cv = GroupKFold(n_splits=min(CV_FOLDS, groups_train.nunique()))

    if param_grid:
        search = GridSearchCV(
            pipeline,
            param_grid={f"model__{k}": v for k, v in param_grid.items()},
            scoring=scoring,
            cv=cv,
            n_jobs=None,
        )
        search.fit(X_train, y_train, groups=groups_train)
        fitted = search.best_estimator_
        cv_scores = [search.best_score_]
        best_params = search.best_params_
    else:
        from sklearn.model_selection import cross_val_score

        cv_scores = list(
            cross_val_score(pipeline, X_train, y_train, groups=groups_train, cv=cv, scoring=scoring)
        )
        fitted = pipeline.fit(X_train, y_train)
        best_params = {}

    return fitted, cv_scores, best_params


def train_regression_models(df: pd.DataFrame) -> TrainingRunResult:
    """
    Trains Linear Regression, Random Forest Regressor, and (if available)
    XGBoost Regressor to estimate TARGET_COLUMN_REGRESSION from
    FEATURE_COLUMNS. Raises ValueError rather than training anything if
    there isn't enough real data — this function is never called with
    insufficient data by the CLI entrypoint (scripts/train_wellbeing_model.py),
    which checks first, but it re-checks here too so it's safe to call
    directly.
    """
    if len(df) < MIN_ROWS_FOR_TRAINING:
        raise ValueError(
            f"Model evaluation requires sufficient research data. "
            f"Got {len(df)} feature rows; need at least {MIN_ROWS_FOR_TRAINING}."
        )

    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN_REGRESSION]
    groups = df["user_id"]

    X_train, X_test, y_train, y_test, groups_train, _ = _group_train_test_split(X, y, groups)

    candidates: list[tuple[str, Any, dict]] = [
        ("linear_regression", LinearRegression(), {}),
        (
            "random_forest_regressor",
            RandomForestRegressor(random_state=RANDOM_STATE),
            {"n_estimators": [100, 300], "max_depth": [4, 8, None]},
        ),
    ]
    if XGBOOST_AVAILABLE:
        candidates.append((
            "xgboost_regressor",
            XGBRegressor(random_state=RANDOM_STATE, objective="reg:squarederror"),
            {"n_estimators": [100, 300], "max_depth": [3, 6], "learning_rate": [0.05, 0.1]},
        ))

    run = TrainingRunResult(task="regression", n_rows=len(df), n_users=df["user_id"].nunique())
    if not XGBOOST_AVAILABLE:
        run.skipped_models.append("xgboost_regressor (xgboost not installed in this environment)")

    for name, estimator, grid in candidates:
        fitted, cv_scores, best_params = _fit_with_cv(
            estimator, grid, X_train, y_train, groups_train, scoring="neg_mean_absolute_error"
        )
        y_pred = fitted.predict(X_test)
        mae = mean_absolute_error(y_test, y_pred)
        rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
        r2 = float(r2_score(y_test, y_pred))

        run.results.append(
            ModelResult(
                model_name=name,
                task="regression",
                fitted_pipeline=fitted,
                cv_scores=cv_scores,
                test_metrics={"mae": mae, "rmse": rmse, "r2": r2},
                feature_importance=_feature_importance(fitted, FEATURE_COLUMNS),
                best_params=best_params,
            )
        )

    # Lower MAE is better; this is the agreed selection criterion for the
    # regression task. Documented here rather than left implicit.
    run.best_model = min(run.results, key=lambda r: r.test_metrics["mae"])
    return run


def train_classification_models(df: pd.DataFrame) -> TrainingRunResult:
    """
    Classification experiments, per Section 37A: predicts the coarse
    stable/monitor/elevated wellbeing band (RISK_LABEL_COLUMN, derived from
    wellbeing_score in feature engineering — see data/features.py) rather
    than any clinical label. Offered as a secondary, "where scientifically
    appropriate" experiment alongside the primary regression task, not a
    replacement for it.
    """
    if len(df) < MIN_ROWS_FOR_TRAINING:
        raise ValueError(
            f"Model evaluation requires sufficient research data. "
            f"Got {len(df)} feature rows; need at least {MIN_ROWS_FOR_TRAINING}."
        )

    label_counts = df[RISK_LABEL_COLUMN].value_counts()
    if (label_counts < 10).any():
        sparse = label_counts[label_counts < 10].to_dict()
        raise ValueError(
            "Model evaluation requires sufficient research data. "
            f"These wellbeing bands have fewer than 10 examples: {sparse}."
        )

    X = df[FEATURE_COLUMNS]
    y = df[RISK_LABEL_COLUMN].astype(str)
    groups = df["user_id"]

    X_train, X_test, y_train, y_test, groups_train, _ = _group_train_test_split(X, y, groups)

    candidates: list[tuple[str, Any, dict]] = [
        ("logistic_regression", LogisticRegression(max_iter=1000), {}),
        (
            "random_forest_classifier",
            RandomForestClassifier(random_state=RANDOM_STATE, class_weight="balanced"),
            {"n_estimators": [100, 300], "max_depth": [4, 8, None]},
        ),
    ]
    if XGBOOST_AVAILABLE:
        from sklearn.preprocessing import LabelEncoder
        from sklearn.base import BaseEstimator, ClassifierMixin

        class SafeXGBClassifier(BaseEstimator, ClassifierMixin):
            def __init__(self, random_state=None, eval_metric=None, n_estimators=None, max_depth=None, learning_rate=None):
                self.random_state = random_state
                self.eval_metric = eval_metric
                self.n_estimators = n_estimators
                self.max_depth = max_depth
                self.learning_rate = learning_rate

            def fit(self, X, y, **fit_params):
                self._le = LabelEncoder()
                y_encoded = self._le.fit_transform(y)
                self.classes_ = self._le.classes_
                self.model_ = XGBClassifier(
                    random_state=self.random_state,
                    eval_metric=self.eval_metric,
                    n_estimators=self.n_estimators,
                    max_depth=self.max_depth,
                    learning_rate=self.learning_rate
                )
                self.model_.fit(X, y_encoded, **fit_params)
                return self

            def predict(self, X, **kwargs):
                return self._le.inverse_transform(self.model_.predict(X, **kwargs))

            def predict_proba(self, X, **kwargs):
                return self.model_.predict_proba(X, **kwargs)

        candidates.append((
            "xgboost_classifier",
            SafeXGBClassifier(random_state=RANDOM_STATE, eval_metric="mlogloss"),
            {"n_estimators": [100, 300], "max_depth": [3, 6], "learning_rate": [0.05, 0.1]},
        ))

    run = TrainingRunResult(task="classification", n_rows=len(df), n_users=df["user_id"].nunique())
    if not XGBOOST_AVAILABLE:
        run.skipped_models.append("xgboost_classifier (xgboost not installed in this environment)")

    classes = sorted(y.unique())

    for name, estimator, grid in candidates:
        fitted, cv_scores, best_params = _fit_with_cv(
            estimator, grid, X_train, y_train, groups_train, scoring="f1_macro"
        )
        y_pred = fitted.predict(X_test)
        proba = fitted.predict_proba(X_test) if hasattr(fitted, "predict_proba") else None

        metrics = {
            "accuracy": accuracy_score(y_test, y_pred),
            "precision_macro": precision_score(y_test, y_pred, average="macro", zero_division=0),
            "recall_macro": recall_score(y_test, y_pred, average="macro", zero_division=0),
            "f1_macro": f1_score(y_test, y_pred, average="macro", zero_division=0),
        }
        if proba is not None and len(classes) > 1:
            try:
                metrics["roc_auc_ovr"] = roc_auc_score(y_test, proba, multi_class="ovr", labels=classes)
                metrics["pr_auc_macro"] = average_precision_score(
                    pd.get_dummies(y_test)[classes].to_numpy(), proba, average="macro"
                )
            except ValueError:
                pass  # e.g. a class entirely absent from this particular test split

        run.results.append(
            ModelResult(
                model_name=name,
                task="classification",
                fitted_pipeline=fitted,
                cv_scores=cv_scores,
                test_metrics=metrics,
                feature_importance=_feature_importance(fitted, FEATURE_COLUMNS),
                best_params=best_params,
            )
        )

    run.best_model = max(run.results, key=lambda r: r.test_metrics["f1_macro"])
    return run
