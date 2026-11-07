from __future__ import annotations

import os
from functools import lru_cache
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GridSearchCV, GroupKFold, GroupShuffleSplit, KFold, StratifiedKFold, TimeSeriesSplit, train_test_split
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier, XGBRegressor

from evaluation import evaluate_model
from feature_engineering import FEATURE_COLUMNS, create_features
from preprocessing import clean_data, validate_frame
from temporal import TEMPORAL_MODELS

MIN_SAMPLES = int(os.getenv("MIN_TRAINING_SAMPLES", "50"))

ABLATION_SETS = {
    "all": FEATURE_COLUMNS,
    "digital-only": ["screen_time", "social_media_minutes", "late_night_usage", "notifications_count"],
    "sleep-only": ["sleep_duration", "sleep_consistency"],
    "activity-only": ["physical_activity_minutes", "exercise_frequency"],
    "digital+sleep": ["screen_time", "social_media_minutes", "late_night_usage", "sleep_duration", "sleep_consistency"],
    "digital+activity": ["screen_time", "physical_activity_minutes", "late_night_usage"],
    "full": FEATURE_COLUMNS,
}


@dataclass
class PipelineResult:
    status: str
    message: str
    metrics: List[Dict[str, Any]] = field(default_factory=list)
    feature_importance: Dict[str, Any] = field(default_factory=dict)
    ablation: Dict[str, Any] = field(default_factory=dict)
    best_model: Optional[str] = None
    mode: str = "research/training"


def _regression_models() -> Dict[str, Any]:
    return {
        "linear_regression": LinearRegression(),
        "random_forest": RandomForestRegressor(n_estimators=200, random_state=42),
        "xgboost": XGBRegressor(n_estimators=200, random_state=42, n_jobs=1, verbosity=0),
    }


def _classification_models() -> Dict[str, Any]:
    return {
        "logistic_regression": LogisticRegression(max_iter=2000),
        "random_forest_classifier": RandomForestClassifier(n_estimators=200, random_state=42),
        "xgboost_classifier": XGBClassifier(n_estimators=200, random_state=42, n_jobs=1, verbosity=0, eval_metric="logloss"),
    }


def _available_columns(df: pd.DataFrame, requested: Sequence[str]) -> List[str]:
    return [c for c in requested if c in df.columns]


def prepare_xy(raw: pd.DataFrame, target: str = "wellbeing_score") -> tuple[pd.DataFrame, pd.Series]:
    if raw is None or raw.empty or target not in raw.columns:
        raise ValueError("Input frame failed validation.")
    # Do not let generic numeric imputation invent wellbeing labels for unlabelled rows.
    labelled = raw.loc[raw[target].notna()].copy()
    if not validate_frame(labelled):
        raise ValueError("Input frame failed validation.")
    numeric_inputs = set(FEATURE_COLUMNS) | {
        "total_screen_time_minutes", "sleep_duration_minutes", "late_night_usage_minutes",
        "social_media_usage", target,
    }
    for column in numeric_inputs.intersection(labelled.columns):
        labelled[column] = pd.to_numeric(labelled[column], errors="coerce")
    labelled = labelled.loc[labelled[target].notna()].copy()
    if labelled.empty:
        raise ValueError("No numeric wellbeing target labels are available.")
    featured = create_features(labelled)
    if target not in featured.columns:
        raise ValueError(f"Target {target} is missing.")
    y = pd.to_numeric(featured[target], errors="coerce")
    if not y.between(1, 10).all():
        raise ValueError("wellbeing_score labels must be numeric values from 1 to 10.")
    X = featured[_available_columns(featured, FEATURE_COLUMNS)]
    mask = y.notna()
    return X.loc[mask], y.loc[mask]


def insufficient_message() -> str:
    return "Model evaluation requires sufficient research data."


def _holdout_plan(raw: pd.DataFrame, X: pd.DataFrame, y: pd.Series, task: str):
    """Prefer a participant-group split, then a chronological split, then a shuffled split."""
    metadata = raw.reindex(X.index)
    positions = np.arange(len(X))
    if "user_id" in metadata:
        groups = metadata["user_id"].fillna("__missing_user__").astype(str).to_numpy()
        if len(np.unique(groups)) >= 2:
            splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
            train_idx, test_idx = next(splitter.split(X, y, groups))
            return train_idx, test_idx, "80/20 GroupShuffleSplit by user_id; random_state=42", "group", groups

    if "date" in metadata:
        dates = pd.to_datetime(metadata["date"], errors="coerce")
        valid_dates = dates.notna()
        unique_dates = np.sort(dates.loc[valid_dates].unique())
        if len(unique_dates) >= 2:
            cutoff_index = min(max(int(len(unique_dates) * 0.8), 1), len(unique_dates) - 1)
            cutoff = unique_dates[cutoff_index]
            train_idx = np.flatnonzero((valid_dates & (dates < cutoff)).to_numpy())
            test_idx = np.flatnonzero((valid_dates & (dates >= cutoff)).to_numpy())
            if len(train_idx) and len(test_idx):
                train_idx = train_idx[np.argsort(dates.iloc[train_idx].to_numpy(), kind="stable")]
                test_idx = test_idx[np.argsort(dates.iloc[test_idx].to_numpy(), kind="stable")]
                return train_idx, test_idx, f"Chronological 80/20 date holdout; test begins {pd.Timestamp(cutoff).date()}", "time", None

    split_options = {"stratify": y} if task == "classification" else {}
    train_idx, test_idx = train_test_split(positions, test_size=0.2, random_state=42, **split_options)
    return train_idx, test_idx, "Shuffled 80/20 split; random_state=42 (no usable user_id/date grouping field)", "random", None


def train_and_evaluate(
    raw: pd.DataFrame,
    task: str = "regression",
    model_dir: str = "models",
    run_ablation: bool = True,
) -> PipelineResult:
    if task not in {"regression", "classification"}:
        return PipelineResult(
            status="unavailable",
            message="Task must be either regression or classification.",
            mode="research/training",
        )

    try:
        X, y = prepare_xy(raw)
    except ValueError as exc:
        return PipelineResult(status="unavailable", message=str(exc), mode="research/training")

    if len(X) < MIN_SAMPLES:
        return PipelineResult(
            status="unavailable",
            message=insufficient_message(),
            mode="research/training",
        )

    if task == "classification":
        y = (y >= 6).astype(int)
        class_counts = y.value_counts()
        if len(class_counts) < 2 or class_counts.min() < 2:
            return PipelineResult(
                status="unavailable",
                message="Classification requires at least two classes with two records in each class.",
                mode="research/training",
            )
        models = _classification_models()
        scoring = "f1"
    else:
        models = _regression_models()
        scoring = "neg_mean_absolute_error"

    train_idx, test_idx, split_method, cv_mode, groups = _holdout_plan(raw, X, y, task)
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
    train_groups = groups[train_idx] if groups is not None else None
    if task == "classification" and y_train.nunique() < 2:
        return PipelineResult(status="unavailable", message="The selected holdout split leaves fewer than two classes in training; collect more varied labelled records.", mode="research/training")

    if task == "classification" and cv_mode in {"group", "time"}:
        # Default estimator settings are safer here than a CV search whose folds may
        # omit a rare class or mix the temporal grouping convention.
        cv = None
    elif cv_mode == "group" and train_groups is not None and len(np.unique(train_groups)) >= 2:
        cv = GroupKFold(n_splits=min(5, len(np.unique(train_groups))))
    elif cv_mode == "time" and len(X_train) >= 3:
        cv = TimeSeriesSplit(n_splits=min(5, len(X_train) - 1))
    elif task == "classification":
        cv = StratifiedKFold(n_splits=min(5, int(y_train.value_counts().min())), shuffle=True, random_state=42)
    else:
        cv = KFold(n_splits=min(5, len(X_train)), shuffle=True, random_state=42)

    metrics_rows: List[Dict[str, Any]] = []
    fitted: Dict[str, Any] = {}
    importances: Dict[str, Any] = {}

    param_grids = {
        "random_forest": {"model__n_estimators": [100, 200]},
        "xgboost": {"model__n_estimators": [100, 200]},
        "random_forest_classifier": {"model__n_estimators": [100, 200]},
        "xgboost_classifier": {"model__n_estimators": [100, 200]},
    }

    numeric = list(X.columns)
    numeric_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median", keep_empty_features=True)),
        ("scaler", StandardScaler()),
    ])
    preprocessor = ColumnTransformer([("num", numeric_pipeline, numeric)], remainder="drop")

    for name, estimator in models.items():
        pipe = Pipeline([("prep", preprocessor), ("model", estimator)])
        grid = param_grids.get(name)
        search = GridSearchCV(pipe, grid or {}, cv=cv, scoring=scoring, n_jobs=1) if grid and cv is not None and len(X_train) >= 3 else None
        if search:
            fit_args = {"groups": train_groups} if cv_mode == "group" and train_groups is not None else {}
            model = search.fit(X_train, y_train, **fit_args).best_estimator_
        else:
            model = pipe.fit(X_train, y_train)
        fitted[name] = model
        pred = model.predict(X_test)
        if task == "regression":
            row = evaluate_model(y_test.to_numpy(), pred, task="regression")
            row["name"] = name
        else:
            proba = model.predict_proba(X_test)[:, 1] if hasattr(model, "predict_proba") else None
            row = {
                "name": name,
                "Accuracy": float(accuracy_score(y_test, pred)),
                "Precision": float(precision_score(y_test, pred, zero_division=0)),
                "Recall": float(recall_score(y_test, pred, zero_division=0)),
                "F1": float(f1_score(y_test, pred, zero_division=0)),
            }
            if proba is not None and y_test.nunique() > 1:
                row["ROC-AUC"] = float(roc_auc_score(y_test, proba))
                row["PR-AUC"] = float(average_precision_score(y_test, proba))
        metrics_rows.append(row)

        try:
            from explainability import get_feature_importance

            inner = model.named_steps["model"]
            model_type = "linear" if "linear" in name or "logistic" in name else "rf" if "forest" in name else "xgboost"
            transformed = model.named_steps["prep"].transform(X_train)
            transformed_df = pd.DataFrame(transformed, columns=numeric)
            importances[name] = get_feature_importance(inner, transformed_df, model_type=model_type)
        except Exception:
            importances[name] = {}

    if task == "regression":
        best = min(metrics_rows, key=lambda r: r.get("MAE", 1e9))
    else:
        best = max(metrics_rows, key=lambda r: r.get("F1", -1))

    ablation_out: Dict[str, Any] = {}
    if run_ablation and task == "regression":
        for label, cols in ABLATION_SETS.items():
            use = _available_columns(X, cols)
            if len(use) < 2:
                continue
            lr = Pipeline([
                ("prep", ColumnTransformer([("num", numeric_pipeline, use)], remainder="drop")),
                ("model", LinearRegression()),
            ])
            lr.fit(X_train[use], y_train)
            pred = lr.predict(X_test[use])
            ablation_out[label] = {
                "MAE": float(mean_absolute_error(y_test, pred)),
                "RMSE": float(np.sqrt(mean_squared_error(y_test, pred))),
                "R2": float(r2_score(y_test, pred)),
                "features": use,
            }

    sources = raw["source"].dropna().astype(str).unique().tolist() if "source" in raw.columns else []
    dataset_source = "synthetic_demo" if sources == ["synthetic_demo"] else "mixed_or_unspecified"
    interpretation_note = ("Synthetic demonstration only; these held-out results are not evidence of real-world accuracy." if dataset_source == "synthetic_demo" else "Held-out evaluation for the supplied dataset; it is not clinical validation.")

    os.makedirs(model_dir, exist_ok=True)
    best_name = best["name"]
    background = X_train.head(min(40, len(X_train)))
    joblib.dump(
        {
            "pipeline": fitted[best_name],
            "feature_columns": list(X.columns),
            "task": task,
            "mode": "production-inference",
            "metrics": metrics_rows,
            "feature_importance": importances,
            "ablation": ablation_out,
            "best_model": best_name,
            "artifact_version": "1.0.0",
            "evaluation": {
                "method": f"{split_method}; hyperparameter CV={type(cv).__name__ if cv is not None else 'not run'}; preprocessing fitted inside each training fold and the final training split",
                "target": "wellbeing_score",
                "held_out_records": int(len(y_test)),
                "dataset_source": dataset_source,
                "interpretation_note": interpretation_note,
                "metrics": metrics_rows,
            },
            "background": background.to_dict(orient="list"),
        },
        os.path.join(model_dir, "production.joblib"),
    )

    return PipelineResult(
        status="ok",
        message="Training complete.",
        metrics=metrics_rows,
        feature_importance=importances,
        ablation=ablation_out,
        best_model=best_name,
        mode="research/training",
    )


@lru_cache(maxsize=4)
def _load_bundle_cached(path: str, modified_ns: int, file_size: int) -> Optional[dict]:
    try:
        bundle = joblib.load(path)
    except Exception:
        return None
    if not isinstance(bundle, dict):
        return None
    pipeline = bundle.get("pipeline")
    columns = bundle.get("feature_columns")
    if not callable(getattr(pipeline, "predict", None)) or not isinstance(columns, list) or not columns:
        return None
    if bundle.get("task") not in {"regression", "classification"}:
        return None
    return bundle


def load_production_bundle(model_dir: str = "models") -> Optional[dict]:
    path = os.path.join(model_dir, "production.joblib")
    try:
        stat = os.stat(path)
    except OSError:
        return None
    return _load_bundle_cached(os.path.abspath(path), stat.st_mtime_ns, stat.st_size)


def predict_one(features: Dict[str, Any], model_dir: str = "models") -> Dict[str, Any]:
    bundle = load_production_bundle(model_dir)
    if bundle is None:
        return {"status": "unavailable", "message": insufficient_message(), "prediction": None}
    try:
        df = pd.DataFrame([features])
        featured = create_features(clean_data(df))
        cols = bundle.get("feature_columns", FEATURE_COLUMNS)
        X = featured.reindex(columns=cols, fill_value=0)
        pipe = bundle["pipeline"]
        pred = pipe.predict(X)[0]
    except Exception:
        return {"status": "unavailable", "message": "The production model could not process these features.", "prediction": None}
    shap_values: Dict[str, float] = {}
    try:
        from explainability import get_individual_explanation

        inner = pipe.named_steps["model"] if hasattr(pipe, "named_steps") else pipe
        prep = pipe.named_steps.get("prep") if hasattr(pipe, "named_steps") else None
        x_trans = pd.DataFrame(prep.transform(X), columns=cols) if prep is not None else X
        background_raw = bundle.get("background")
        if background_raw:
            bg = pd.DataFrame(background_raw)
            bg_trans = pd.DataFrame(prep.transform(bg), columns=cols) if prep is not None else bg
        else:
            bg_trans = x_trans
        model_name = bundle.get("best_model") or ""
        model_type = "linear" if "linear" in model_name or "logistic" in model_name else "rf" if "forest" in model_name else "xgboost"
        shap_values = get_individual_explanation(inner, x_trans, bg_trans, model_type=model_type)
    except Exception:
        shap_values = {}
    return {
        "status": "ok",
        "prediction": float(pred),
        "model_mode": "production-inference",
        "task": bundle.get("task"),
        "model_name": bundle.get("best_model"),
        "artifact_version": bundle.get("artifact_version", "unversioned"),
        "shap": shap_values,
        "language": "The model identified listed features as important in this estimate. This is not a causal claim.",
    }


def temporal_status() -> Dict[str, str]:
    return {name: "architecture-only" for name in TEMPORAL_MODELS}
