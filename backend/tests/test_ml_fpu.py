import os
import sys
import joblib
import numpy as np
import pytest
from fastapi.testclient import TestClient

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app
from app.ml.preprocessing import Dataset1Preprocessor
from app.ml.schemas import FPUInputSchema, FPUPredictionResponse
from app.ml.inference import predict_fpu

client = TestClient(app)

def test_1_preprocessing():
    preprocessor = Dataset1Preprocessor()
    sample_data = np.array([
        [28.5, 5.1, 0.5, 50.0, 300.0, 0.0, 5.0, 3000.0],
        [29.3, 4.95, 0.6, 50.0, 250.0, 0.0, 5.0, 3000.0]
    ])
    preprocessor.fit(sample_data)
    assert preprocessor.is_fitted
    transformed = preprocessor.transform(sample_data)
    assert transformed.shape == (2, 8)

def test_2_feature_schema():
    valid_data = {
        "temperature": 28.5,
        "pH": 5.1,
        "dissolved_oxygen_min": 0.5,
        "inoculum_volume_ml": 50.0,
        "agitation_rpm": 300.0,
        "lactose_feed_volume_ml": 0.0,
        "culture_duration_days": 5.0,
        "media_volume_ml": 3000.0
    }
    schema = FPUInputSchema(**valid_data)
    assert schema.temperature == 28.5
    assert schema.pH == 5.1

def test_3_inference():
    valid_input = FPUInputSchema(
        temperature=28.5,
        pH=5.1,
        dissolved_oxygen_min=0.5,
        inoculum_volume_ml=50.0,
        agitation_rpm=300.0,
        lactose_feed_volume_ml=0.0,
        culture_duration_days=5.0,
        media_volume_ml=3000.0
    )
    res = predict_fpu(valid_input)
    assert res.target == "Max FPU/ml"
    assert res.unit == "FPU/ml"
    assert res.prediction >= 0.0

def test_4_invalid_input_rejection():
    with pytest.raises(ValueError):
        FPUInputSchema(
            temperature=99.0, # max 50
            pH=5.1,
            dissolved_oxygen_min=0.5,
            inoculum_volume_ml=50.0,
            agitation_rpm=300.0,
            lactose_feed_volume_ml=0.0,
            culture_duration_days=5.0,
            media_volume_ml=3000.0
        )

    with pytest.raises(ValueError):
        FPUInputSchema(
            temperature=28.5,
            pH=14.0, # max 12
            dissolved_oxygen_min=0.5,
            inoculum_volume_ml=50.0,
            agitation_rpm=300.0,
            lactose_feed_volume_ml=0.0,
            culture_duration_days=5.0,
            media_volume_ml=3000.0
        )

def test_5_model_save_load():
    model_path = os.path.join(backend_dir, "app", "ml", "models", "dataset1_fpu_predictor", "model.joblib")
    preprocessor_path = os.path.join(backend_dir, "app", "ml", "models", "dataset1_fpu_predictor", "preprocessor.joblib")

    assert os.path.exists(model_path)
    assert os.path.exists(preprocessor_path)

    model = joblib.load(model_path)
    preprocessor = joblib.load(preprocessor_path)
    assert hasattr(model, "predict")
    assert preprocessor.is_fitted

def test_6_api_endpoint_post():
    payload = {
        "temperature": 28.5,
        "pH": 5.1,
        "dissolved_oxygen_min": 0.5,
        "inoculum_volume_ml": 50.0,
        "agitation_rpm": 300.0,
        "lactose_feed_volume_ml": 0.0,
        "culture_duration_days": 5.0,
        "media_volume_ml": 3000.0
    }
    response = client.post("/ai/predict/fpu", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "prediction" in data
    assert data["target"] == "Max FPU/ml"
    assert data["unit"] == "FPU/ml"
    assert data["model"] == "dataset1_fpu_predictor"

def test_7_api_endpoint_invalid():
    payload = {
        "temperature": 150.0, # Invalid > 50
        "pH": 5.1,
        "dissolved_oxygen_min": 0.5,
        "inoculum_volume_ml": 50.0,
        "agitation_rpm": 300.0,
        "lactose_feed_volume_ml": 0.0,
        "culture_duration_days": 5.0,
        "media_volume_ml": 3000.0
    }
    response = client.post("/ai/predict/fpu", json=payload)
    assert response.status_code == 422 # Validation failure
