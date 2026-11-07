import pandas as pd
from typing import Dict, Any, Tuple
from training import ModelTrainer
from preprocessing import clean_data, validate_input
from feature_engineering import create_features
import os

class InferenceEngine:
    def __init__(self, model_dir: str = 'models/'):
        self.model_dir = model_dir
        self.models = {}
        # Pre-load known models if they exist
        self._load_available_models()

    def _load_available_models(self):
        """Loads available models from the model directory."""
        if not os.path.exists(self.model_dir):
            return
            
        for file in os.listdir(self.model_dir):
            if file.endswith('.joblib'):
                model_name = file.replace('.joblib', '')
                try:
                    # Defaulting task based on name for now, in a real system metadata should be stored alongside
                    task = 'classification' if 'classifier' in model_name else 'regression'
                    # The exact model_type isn't strictly needed for prediction using sklearn's predict()
                    # but required by our ModelTrainer wrapper init. We use 'linear' as a dummy to load.
                    trainer = ModelTrainer(model_type='linear', task=task)
                    trainer.load_model(os.path.join(self.model_dir, file))
                    self.models[model_name] = trainer
                except Exception as e:
                    print(f"Error loading model {file}: {e}")

    def predict(self, model_name: str, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Runs the full inference pipeline for a given model and raw data.
        """
        if model_name not in self.models:
            return {"error": f"Model {model_name} not found or not loaded.", "status": "error"}
            
        if not validate_input(raw_data):
            return {"error": "Invalid input format or missing required fields.", "status": "error"}
            
        # 1. Convert to DataFrame
        # Wrap single record in list
        df_raw = pd.DataFrame([raw_data])
        
        # 2. Preprocessing
        df_clean = clean_data(df_raw)
        
        # 3. Feature Engineering
        df_features = create_features(df_clean)
        
        # Drop columns that are not features (e.g. user_id, date)
        cols_to_drop = ['user_id', 'date', 'id']
        X = df_features.drop(columns=[col for col in cols_to_drop if col in df_features.columns])
        
        # 4. Inference
        try:
            model = self.models[model_name].model
            prediction = model.predict(X)[0]
            
            # For classification, optionally return probabilities
            probabilities = None
            if hasattr(model, "predict_proba"):
                probs = model.predict_proba(X)[0]
                probabilities = probs.tolist()
                
            return {
                "prediction": float(prediction),
                "probabilities": probabilities,
                "status": "success"
            }
            
        except Exception as e:
            return {"error": str(e), "status": "error"}
