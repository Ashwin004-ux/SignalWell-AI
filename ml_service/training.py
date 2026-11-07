import pandas as pd
from typing import Tuple, Any, Dict
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
import xgboost as xgb
import joblib
import os

class ModelTrainer:
    def __init__(self, model_type: str = 'linear', task: str = 'regression'):
        self.model_type = model_type
        self.task = task
        self.model = self._initialize_model()
        
    def _initialize_model(self) -> Any:
        if self.task == 'regression':
            if self.model_type == 'linear':
                return LinearRegression()
            elif self.model_type == 'rf':
                return RandomForestRegressor(n_estimators=100, random_state=42)
            elif self.model_type == 'xgboost':
                return xgb.XGBRegressor(n_estimators=100, random_state=42)
            else:
                raise ValueError(f"Unsupported regression model: {self.model_type}")
        elif self.task == 'classification':
            if self.model_type == 'logistic':
                return LogisticRegression(max_iter=1000)
            elif self.model_type == 'rf':
                return RandomForestClassifier(n_estimators=100, random_state=42)
            elif self.model_type == 'xgboost':
                return xgb.XGBClassifier(n_estimators=100, random_state=42)
            else:
                raise ValueError(f"Unsupported classification model: {self.model_type}")
        else:
            raise ValueError(f"Unsupported task: {self.task}")

    def train(self, X: pd.DataFrame, y: pd.Series) -> None:
        """Trains the internal model."""
        self.model.fit(X, y)
        
    def save_model(self, path: str) -> None:
        """Saves the trained model to disk."""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        joblib.dump(self.model, path)
        
    def load_model(self, path: str) -> None:
        """Loads a model from disk."""
        if not os.path.exists(path):
            raise FileNotFoundError(f"Model file not found at {path}")
        self.model = joblib.load(path)
