import os
import joblib
import numpy as np
from app.ml.schemas import FPUInputSchema, FPUPredictionResponse

class FPUInferenceEngine:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FPUInferenceEngine, cls).__new__(cls)
            cls._instance._load_artifacts()
        return cls._instance

    def _load_artifacts(self):
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
        model_dir = os.path.join(root_dir, "backend", "app", "ml", "models", "dataset1_fpu_predictor")
        
        model_path = os.path.join(model_dir, "model.joblib")
        preprocessor_path = os.path.join(model_dir, "preprocessor.joblib")

        if not os.path.exists(model_path) or not os.path.exists(preprocessor_path):
            raise FileNotFoundError(f"Model artifacts not found in {model_dir}. Please run training first.")

        self.model = joblib.load(model_path)
        self.preprocessor = joblib.load(preprocessor_path)

    def predict(self, input_data: FPUInputSchema) -> FPUPredictionResponse:
        # Convert input schema to feature array
        features = [
            input_data.temperature,
            input_data.pH,
            input_data.dissolved_oxygen_min,
            input_data.inoculum_volume_ml,
            input_data.agitation_rpm,
            input_data.lactose_feed_volume_ml,
            input_data.culture_duration_days,
            input_data.media_volume_ml
        ]

        # Transform using preprocessor
        X_scaled = self.preprocessor.transform([features])

        # Model inference
        prediction_val = float(self.model.predict(X_scaled)[0])
        prediction_val = max(0.0, prediction_val) # Physical boundary: yield cannot be negative

        return FPUPredictionResponse(
            prediction=round(prediction_val, 4),
            target="Max FPU/ml",
            unit="FPU/ml",
            model="dataset1_fpu_predictor",
            version="v1.0",
            process_type="Trichoderma reesei cellulase fermentation",
            dataset_source="Kaggle Fungal Cellulase Bioreactor Dataset (1,000 runs)"
        )

# Module-level helper function
def predict_fpu(input_data: FPUInputSchema) -> FPUPredictionResponse:
    engine = FPUInferenceEngine()
    return engine.predict(input_data)
