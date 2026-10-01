import os
import json
from fastapi import APIRouter, HTTPException, status, Query
from app.ml.schemas import FPUInputSchema, FPUPredictionResponse
from app.ml.inference import predict_fpu

from app.ml.inference_dataset2 import (
    TiterInputSchema,
    TiterPredictionResponse,
    SimilarityQuerySchema,
    SimilarityResponse,
    TiterInferenceEngine,
    predict_titer,
    get_similarity
)

router = APIRouter(prefix="/ai", tags=["AI Bioprocess Models"])

# ---------------------------------------------------------
# Dataset 1 Endpoints (Cellulase FPU Predictor)
# ---------------------------------------------------------
@router.post(
    "/predict/fpu",
    response_model=FPUPredictionResponse,
    status_code=status.HTTP_200_OK,
    summary="Predict Cellulase Enzyme Activity Yield (Max FPU/ml)",
    description="Inference endpoint for Bioprocess Outcome Prediction trained on Dataset 1 (Trichoderma reesei fermentation runs). Accepts 8 process parameters."
)
def predict_fpu_endpoint(input_data: FPUInputSchema):
    try:
        response = predict_fpu(input_data)
        return response
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Inference failed: {str(e)}")

@router.get(
    "/model-info/fpu",
    summary="Get FPU Predictor Model Provenance & Metrics",
    description="Returns metadata, training dataset provenance, validation metrics, test metrics, and feature importances for dataset1_fpu_predictor."
)
def get_fpu_model_info():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    meta_path = os.path.join(root_dir, "app", "ml", "models", "dataset1_fpu_predictor", "metadata.json")
    
    if not os.path.exists(meta_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model metadata not found.")

    with open(meta_path, 'r', encoding='utf-8') as f:
        meta = json.load(f)

    return meta

# ---------------------------------------------------------
# Dataset 2 Endpoints (Bioprocess Titer & Similarity Engine)
# ---------------------------------------------------------
@router.post(
    "/predict/titer",
    response_model=TiterPredictionResponse,
    status_code=status.HTTP_200_OK,
    summary="Predict Biochemical Product Titer (g/L)",
    description="Inference endpoint for Dataset 2 bioprocess outcome prediction (HistGradientBoosting on log1p titer, process-only features)."
)
def predict_titer_endpoint(input_data: TiterInputSchema):
    try:
        engine = TiterInferenceEngine()
        response = engine.predict(input_data)
        return response
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Titer inference failed: {str(e)}")

@router.get(
    "/model-info/titer",
    summary="Get Titer Predictor Metadata",
    description="Returns metadata, training details, and paper-aware split info for dataset2_titer_predictor."
)
def get_titer_model_info():
    try:
        engine = TiterInferenceEngine()
        return engine.get_model_info()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get(
    "/model-performance/titer",
    summary="Get Titer Predictor Official Metrics",
    description="Returns official validation and held-out test set performance metrics for dataset2_titer_predictor."
)
def get_titer_model_performance():
    try:
        engine = TiterInferenceEngine()
        return engine.get_model_performance()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post(
    "/similarity",
    response_model=SimilarityResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve Top 5 Similar Historical Bioprocess Literature Runs",
    description="K-NN Euclidean similarity retrieval over normalized physical process parameters across 1,128 observations in 101 literature studies."
)
def get_similarity_endpoint(query_data: SimilarityQuerySchema, top_k: int = Query(5, ge=1, le=20)):
    try:
        engine = TiterInferenceEngine()
        response = engine.get_similarity(query_data, top_k=top_k)
        return response
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Similarity retrieval failed: {str(e)}")
