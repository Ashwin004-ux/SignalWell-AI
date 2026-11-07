import shap
import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple


def _feature_matrix(values: Any, feature_count: int, positive_class: bool = False) -> np.ndarray:
    """Normalize SHAP's version-dependent outputs to (samples, features)."""
    array = np.asarray(values)
    if array.ndim == 3:
        class_index = 1 if positive_class and array.shape[-1] > 1 else 0
        array = array[:, :, class_index]
    elif array.ndim == 1:
        array = array.reshape(1, -1)

    if array.ndim != 2:
        raise ValueError("Unexpected SHAP output dimensions.")
    if array.shape[1] != feature_count and array.shape[0] == feature_count:
        array = array.T
    if array.shape[1] != feature_count:
        raise ValueError("SHAP output does not match the feature columns.")
    return array


def get_feature_importance(model: Any, X: pd.DataFrame, model_type: str = 'rf') -> Dict[str, float]:
    """
    Computes global feature importance using SHAP or native methods.
    """
    if X.empty:
        return {}
        
    try:
        if model_type in ['rf', 'xgboost']:
            explainer = shap.TreeExplainer(model)
            shap_values = explainer.shap_values(X)
            
            positive_class = model_type in ['rf', 'xgboost'] and hasattr(model, 'classes_')
            if isinstance(shap_values, list):
                shap_values = shap_values[1] if positive_class and len(shap_values) > 1 else shap_values[0]
            shap_values = _feature_matrix(shap_values, len(X.columns), positive_class)
            mean_abs_shap = np.abs(shap_values).mean(axis=0)
            importance_dict = {feat: float(imp) for feat, imp in zip(X.columns, mean_abs_shap)}
            
            # Sort by importance descending
            return dict(sorted(importance_dict.items(), key=lambda item: item[1], reverse=True))
            
        elif model_type in ['linear', 'logistic']:
            explainer = shap.LinearExplainer(model, X)
            shap_values = explainer.shap_values(X)
            shap_values = _feature_matrix(shap_values, len(X.columns), model_type == 'logistic')
            mean_abs_shap = np.abs(shap_values).mean(axis=0)
            importance_dict = {feat: float(imp) for feat, imp in zip(X.columns, mean_abs_shap)}
            return dict(sorted(importance_dict.items(), key=lambda item: item[1], reverse=True))
            
    except Exception as e:
        print(f"SHAP explanation failed: {e}")
        # Fallback to native feature importance if available
        if hasattr(model, 'feature_importances_'):
            return {feat: float(imp) for feat, imp in zip(X.columns, model.feature_importances_)}
            
    return {}

def get_individual_explanation(model: Any, x_instance: pd.DataFrame, X_background: pd.DataFrame, model_type: str = 'rf') -> Dict[str, float]:
    """
    Explains a single prediction using SHAP.
    """
    if x_instance.empty:
        return {}
        
    try:
        if model_type in ['rf', 'xgboost']:
            explainer = shap.TreeExplainer(model)
            shap_values = explainer.shap_values(x_instance)
            
            positive_class = model_type in ['rf', 'xgboost'] and hasattr(model, 'classes_')
            if isinstance(shap_values, list):
                shap_values = shap_values[1] if positive_class and len(shap_values) > 1 else shap_values[0]
            shap_values = _feature_matrix(shap_values, len(x_instance.columns), positive_class)
            return {feat: float(val) for feat, val in zip(x_instance.columns, shap_values[0])}
            
        elif model_type in ['linear', 'logistic']:
            explainer = shap.LinearExplainer(model, X_background)
            shap_values = explainer.shap_values(x_instance)
            shap_values = _feature_matrix(shap_values, len(x_instance.columns), model_type == 'logistic')
            return {feat: float(val) for feat, val in zip(x_instance.columns, shap_values[0])}
            
    except Exception as e:
        print(f"Individual SHAP explanation failed: {e}")
        
    return {}
