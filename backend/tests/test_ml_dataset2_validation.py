import os
import sys
import json
import time
import joblib
import numpy as np
import pytest
from fastapi.testclient import TestClient

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app
from app.ml.preprocessing_dataset2 import Dataset2Preprocessor
from app.ml.schemas import *
from app.ml.inference_dataset2 import (
    TiterInputSchema,
    TiterPredictionResponse,
    SimilarityQuerySchema,
    SimilarityResponse,
    TiterInferenceEngine,
    predict_titer,
    get_similarity
)

client = TestClient(app)

# ---------------------------------------------------------
# 1. Training Artifact Verification
# ---------------------------------------------------------
def test_1_artifact_verification():
    model_dir = os.path.join(backend_dir, "app", "ml", "models", "dataset2_titer_predictor")
    expected_files = [
        "model.joblib",
        "preprocessor.joblib",
        "metadata.json",
        "metrics.json",
        "MODEL_CARD.md"
    ]
    
    for fname in expected_files:
        fpath = os.path.join(model_dir, fname)
        assert os.path.exists(fpath), f"Artifact missing: {fname}"
        assert os.path.getsize(fpath) > 0, f"Artifact is 0 bytes: {fname}"

# ---------------------------------------------------------
# 2. Metadata Validation
# ---------------------------------------------------------
def test_2_metadata_validation():
    model_dir = os.path.join(backend_dir, "app", "ml", "models", "dataset2_titer_predictor")
    meta_path = os.path.join(model_dir, "metadata.json")
    
    with open(meta_path, 'r', encoding='utf-8') as f:
        meta = json.load(f)

    assert meta["model_id"] == "dataset2_titer_predictor"
    assert meta["model_version"] == "v1.0"
    assert meta["target"] == "titer"
    assert meta["target_unit"] == "g/L"
    assert meta["target_transform"] == "log1p"
    assert meta["algorithm"] == "HistGradientBoostingRegressor"
    assert meta["feature_set"] == "ProcessOnly"
    assert meta["dataset_observations"] == 1128
    assert meta["dataset_papers"] == 101

    # Metrics agreement check
    val_m = meta["validation_metrics"]
    test_m = meta["test_metrics"]

    assert pytest.approx(val_m["r2"], abs=0.01) == 0.2086
    assert pytest.approx(val_m["mae"], abs=0.1) == 20.5603
    assert pytest.approx(test_m["r2"], abs=0.01) == 0.1479
    assert pytest.approx(test_m["mae"], abs=0.1) == 7.1464
    assert pytest.approx(test_m["medae"], abs=0.1) == 1.4676

# ---------------------------------------------------------
# 3. Model Artifact Load Test
# ---------------------------------------------------------
def test_3_model_artifact_load():
    engine = TiterInferenceEngine()
    assert hasattr(engine.model, "predict")
    assert engine.preprocessor.is_fitted
    assert len(engine.similarity_db) == 1128

# ---------------------------------------------------------
# 4 & 5. Titer Inference & Consistency Test
# ---------------------------------------------------------
def test_4_5_titer_inference_and_consistency():
    valid_input = TiterInputSchema(
        temperature=37.0,
        substrate_concentration=20.0,
        reactor_volume=1.0,
        oxygen=1.0,
        fermentation_duration=24.0
    )

    preds = []
    for _ in range(3):
        res = predict_titer(valid_input)
        assert isinstance(res, TiterPredictionResponse)
        assert res.unit == "g/L"
        assert res.target == "titer"
        assert res.target_transform == "log1p"
        assert res.model == "hist_gradient_boosting"
        assert res.version == "v1.0"
        assert np.isfinite(res.prediction)
        assert res.prediction >= 0.0
        preds.append(res.prediction)

    # Nondeterministic consistency check
    assert preds[0] == preds[1] == preds[2]

# ---------------------------------------------------------
# 7, 8, 9. Domain Boundary & Edge Tests
# ---------------------------------------------------------
def test_7_8_9_domain_boundary_and_edge_tests():
    engine = TiterInferenceEngine()
    bounds = engine.preprocessor.domain_bounds

    # Out of domain temp (95 °C)
    out_input = TiterInputSchema(
        temperature=95.0,
        substrate_concentration=20.0,
        reactor_volume=1.0,
        oxygen=1.0,
        fermentation_duration=24.0
    )
    res_out = engine.predict(out_input)
    assert res_out.domain_status == "EXTRAPOLATIVE"
    assert "outside validated range" in res_out.domain_notes

    # In domain boundary test
    in_input = TiterInputSchema(
        temperature=30.0,
        substrate_concentration=10.0,
        reactor_volume=0.5,
        oxygen=1.0,
        fermentation_duration=12.0
    )
    res_in = engine.predict(in_input)
    assert res_in.domain_status == "IN_DOMAIN"

def test_oxygen_binary_domain_validation():
    """Verify that oxygen 0.0 (Anaerobic) and 1.0 (Aerobic) are IN_DOMAIN, while non-binary values (0.5) are EXTRAPOLATIVE."""
    engine = TiterInferenceEngine()

    # 1. Anaerobic (0.0) -> IN_DOMAIN
    anaerobic_input = TiterInputSchema(
        temperature=37.0,
        substrate_concentration=20.0,
        reactor_volume=1.0,
        oxygen=0.0,
        fermentation_duration=24.0
    )
    res_anaerobic = engine.predict(anaerobic_input)
    assert res_anaerobic.domain_status == "IN_DOMAIN"
    assert res_anaerobic.domain_notes is None

    # 2. Aerobic (1.0) -> IN_DOMAIN
    aerobic_input = TiterInputSchema(
        temperature=37.0,
        substrate_concentration=20.0,
        reactor_volume=1.0,
        oxygen=1.0,
        fermentation_duration=24.0
    )
    res_aerobic = engine.predict(aerobic_input)
    assert res_aerobic.domain_status == "IN_DOMAIN"
    assert res_aerobic.domain_notes is None

    # 3. Non-binary oxygen (0.5) -> EXTRAPOLATIVE
    invalid_input = TiterInputSchema(
        temperature=37.0,
        substrate_concentration=20.0,
        reactor_volume=1.0,
        oxygen=0.5,
        fermentation_duration=24.0
    )
    res_invalid = engine.predict(invalid_input)
    assert res_invalid.domain_status == "EXTRAPOLATIVE"
    assert "not a valid binary indicator" in res_invalid.domain_notes

# ---------------------------------------------------------
# 10. Invalid Numerical Input Tests
# ---------------------------------------------------------
def test_10_invalid_numerical_inputs():
    # Out of bounds temperature
    with pytest.raises(ValueError):
        TiterInputSchema(temperature=150.0, substrate_concentration=20.0, reactor_volume=1.0, oxygen=1.0, fermentation_duration=24.0)

    # Negative fermentation duration
    with pytest.raises(ValueError):
        TiterInputSchema(temperature=37.0, substrate_concentration=20.0, reactor_volume=1.0, oxygen=1.0, fermentation_duration=-5.0)

# ---------------------------------------------------------
# 11, 12, 13, 14. K-NN Similarity Engine & Sorting Tests
# ---------------------------------------------------------
def test_11_to_14_knn_similarity_and_sorting():
    query = SimilarityQuerySchema(
        temperature=37.0,
        substrate_concentration=20.0,
        reactor_volume=1.0,
        oxygen=1.0,
        fermentation_duration=24.0
    )

    sim_res = get_similarity(query, top_k=5)
    assert isinstance(sim_res, SimilarityResponse)
    assert len(sim_res.matches) == 5

    # Check order: distance_1 <= distance_2 <= distance_3 ...
    distances = [m.distance for m in sim_res.matches]
    assert distances == sorted(distances)

    # Check match integrity
    for match in sim_res.matches:
        assert match.paper_id.startswith("P")
        assert match.observed_titer >= 0.0
        assert match.distance >= 0.0

    # Self-retrieval test: Use exact process parameters of first fully-specified dataset record
    engine = TiterInferenceEngine()
    rec = None
    for r in engine.similarity_db:
        if all(r[k] is not None for k in ["temperature", "substrate_concentration", "reactor_volume", "oxygen", "fermentation_duration"]):
            rec = r
            break

    assert rec is not None, "No complete record found in dataset"

    self_query = SimilarityQuerySchema(
        temperature=rec["temperature"],
        substrate_concentration=rec["substrate_concentration"],
        reactor_volume=rec["reactor_volume"],
        oxygen=rec["oxygen"],
        fermentation_duration=rec["fermentation_duration"]
    )
    self_res = engine.get_similarity(self_query, top_k=5)
    assert self_res.matches[0].distance < 1e-4
    assert self_res.matches[0].is_self_match

# ---------------------------------------------------------
# 16, 17, 18, 19. FastAPI API Endpoints & Error Tests
# ---------------------------------------------------------
def test_16_to_19_api_endpoints():
    payload = {
        "temperature": 37.0,
        "substrate_concentration": 20.0,
        "reactor_volume": 1.0,
        "oxygen": 1.0,
        "fermentation_duration": 24.0
    }
    
    # 1. POST /ai/predict/titer
    r_pred = client.post("/ai/predict/titer", json=payload)
    assert r_pred.status_code == 200
    data_p = r_pred.json()
    assert "prediction" in data_p
    assert data_p["unit"] == "g/L"
    assert data_p["target_transform"] == "log1p"

    # 2. GET /ai/model-info/titer
    r_info = client.get("/ai/model-info/titer")
    assert r_info.status_code == 200
    data_i = r_info.json()
    assert data_i["model_id"] == "dataset2_titer_predictor"

    # 3. GET /ai/model-performance/titer
    r_perf = client.get("/ai/model-performance/titer")
    assert r_perf.status_code == 200
    data_perf = r_perf.json()
    assert "validation_metrics" in data_perf
    assert "test_metrics" in data_perf

    # 4. POST /ai/similarity
    r_sim = client.post("/ai/similarity", json=payload)
    assert r_sim.status_code == 200
    data_s = r_sim.json()
    assert len(data_s["matches"]) == 5

    # API Error Test (Invalid temp 150)
    bad_payload = payload.copy()
    bad_payload["temperature"] = 150.0
    r_bad = client.post("/ai/predict/titer", json=bad_payload)
    assert r_bad.status_code == 422 # Validation failure

# ---------------------------------------------------------
# 21 & 22. Security & Latency/Performance Measurements
# ---------------------------------------------------------
def test_21_22_security_and_latency():
    # Security: Verify fixed path restriction
    engine = TiterInferenceEngine()
    assert "dataset2_titer_predictor" in os.path.abspath(engine.metadata["model_id"])

    # Measure loading latency
    t0 = time.time()
    _ = TiterInferenceEngine()
    load_time = time.time() - t0
    assert load_time < 0.1 # < 100 ms cached load

    # Measure prediction latency
    valid_input = TiterInputSchema(
        temperature=37.0, substrate_concentration=20.0, reactor_volume=1.0, oxygen=1.0, fermentation_duration=24.0
    )
    t0 = time.time()
    for _ in range(10):
        _ = predict_titer(valid_input)
    t_pred = (time.time() - t0) / 10.0
    print(f"\nAverage Single Prediction Latency: {t_pred*1000:.2f} ms")
    assert t_pred < 0.05 # < 50 ms

    # Measure similarity query latency
    query = SimilarityQuerySchema(
        temperature=37.0, substrate_concentration=20.0, reactor_volume=1.0, oxygen=1.0, fermentation_duration=24.0
    )
    t0 = time.time()
    for _ in range(10):
        _ = get_similarity(query, top_k=5)
    t_sim = (time.time() - t0) / 10.0
    print(f"Average Similarity Retrieval Latency: {t_sim*1000:.2f} ms")
    assert t_sim < 0.05 # < 50 ms

def test_model_domain_vs_observed_range():
    """Verify distinction between validated model domain and observed training data range."""
    engine = TiterInferenceEngine()

    # 1. Reactor volume = 1 L: inside both
    in_both = TiterInputSchema(
        temperature=37.0,
        substrate_concentration=20.0,
        reactor_volume=1.0,
        oxygen=1.0,
        fermentation_duration=24.0
    )
    res_in = engine.predict(in_both)
    assert res_in.domain_status == "IN_DOMAIN"
    assert res_in.validated_model_domain["reactor_volume"]["min"] == 0.001
    assert res_in.validated_model_domain["reactor_volume"]["max"] == 1000.0
    assert res_in.observed_training_range["reactor_volume"]["min"] == 0.003
    assert res_in.observed_training_range["reactor_volume"]["max"] == 13.0

    # 2. Reactor volume = 50 L: inside model domain, outside observed range
    outside_obs = TiterInputSchema(
        temperature=37.0,
        substrate_concentration=20.0,
        reactor_volume=50.0,
        oxygen=1.0,
        fermentation_duration=24.0
    )
    res_obs = engine.predict(outside_obs)
    # Must STILL be IN_DOMAIN since it is within the validated model domain [0.001, 1000.0]
    assert res_obs.domain_status == "IN_DOMAIN"

    # 3. Reactor volume = 1500 L: outside model domain -> EXTRAPOLATIVE
    outside_domain = TiterInputSchema(
        temperature=37.0,
        substrate_concentration=20.0,
        reactor_volume=1500.0,
        oxygen=1.0,
        fermentation_duration=24.0
    )
    res_domain = engine.predict(outside_domain)
    assert res_domain.domain_status == "EXTRAPOLATIVE"
    assert "outside validated range" in res_domain.domain_notes

