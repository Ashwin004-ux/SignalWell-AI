import pandas as pd
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
)
import numpy as np
from typing import Dict, Any


def evaluate_model(y_true: np.ndarray, y_pred: np.ndarray, task: str = "regression") -> Dict[str, float]:
    metrics: Dict[str, Any] = {}
    if task == "regression":
        metrics["MAE"] = float(mean_absolute_error(y_true, y_pred))
        metrics["RMSE"] = float(np.sqrt(mean_squared_error(y_true, y_pred)))
        metrics["R2"] = float(r2_score(y_true, y_pred))
        metrics["mae"] = metrics["MAE"]
        metrics["rmse"] = metrics["RMSE"]
        metrics["r2"] = metrics["R2"]
    elif task == "classification":
        metrics["Accuracy"] = float(accuracy_score(y_true, y_pred))
        metrics["Precision"] = float(precision_score(y_true, y_pred, zero_division=0))
        metrics["Recall"] = float(recall_score(y_true, y_pred, zero_division=0))
        metrics["F1"] = float(f1_score(y_true, y_pred, zero_division=0))
    return metrics
