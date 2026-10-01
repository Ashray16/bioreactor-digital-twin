import os
import json
import joblib
import numpy as np
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, field_validator

# ---------------------------------------------------------
# Pydantic Schemas for Dataset 2 Titer & Similarity API
# ---------------------------------------------------------
class TiterInputSchema(BaseModel):
    temperature: float = Field(..., description="Operating temperature in °C", ge=0.0, le=100.0)
    substrate_concentration: float = Field(..., description="Substrate concentration in g/L", ge=0.0, le=10000.0)
    reactor_volume: float = Field(..., description="Reactor working volume in Liters", ge=0.0001, le=10000.0)
    oxygen: float = Field(..., description="Aerobic (1.0) or Anaerobic (0.0) indicator", ge=0.0, le=1.0)
    fermentation_duration: float = Field(..., description="Fermentation duration in hours", ge=0.01, le=2000.0)

    @field_validator('*', mode='before')
    def check_finite(cls, v):
        if isinstance(v, (int, float)):
            import math
            if math.isnan(v) or math.isinf(v):
                raise ValueError("Numerical inputs must be finite real numbers (not NaN or Inf)")
        return v

class TiterPredictionResponse(BaseModel):
    prediction: float = Field(..., description="Predicted product titer in g/L")
    unit: str = Field("g/L", description="Measurement unit")
    target: str = Field("titer", description="Target variable name")
    target_transform: str = Field("log1p", description="Transformation used during model training")
    model: str = Field("hist_gradient_boosting", description="Algorithm name")
    version: str = Field("v1.0", description="Model version")
    dataset: str = Field("Oyetunde et al.", description="Source dataset")
    dataset_observations: int = Field(1128, description="Valid dataset records count")
    dataset_papers: int = Field(101, description="Source literature studies count")
    domain_status: str = Field("IN_DOMAIN", description="IN_DOMAIN or EXTRAPOLATIVE")
    domain_notes: Optional[str] = None
    validated_model_domain: Optional[Dict[str, Any]] = None
    observed_training_range: Optional[Dict[str, Any]] = None

class SimilarityQuerySchema(BaseModel):
    temperature: float = Field(..., ge=0.0, le=100.0)
    substrate_concentration: float = Field(..., ge=0.0, le=10000.0)
    reactor_volume: float = Field(..., ge=0.0001, le=10000.0)
    oxygen: float = Field(..., ge=0.0, le=1.0)
    fermentation_duration: float = Field(..., ge=0.01, le=2000.0)

    @field_validator('*', mode='before')
    def check_finite(cls, v):
        if isinstance(v, (int, float)):
            import math
            if math.isnan(v) or math.isinf(v):
                raise ValueError("Numerical inputs must be finite real numbers")
        return v

class SimilarityMatchItem(BaseModel):
    rank: int
    paper_id: str
    product_name: str
    strain_background: str
    observed_titer: float
    temperature: Optional[float]
    substrate_concentration: Optional[float]
    reactor_volume: Optional[float]
    oxygen: Optional[float]
    fermentation_duration: Optional[float]
    distance: float
    is_self_match: bool = False

class SimilarityResponse(BaseModel):
    query: Dict[str, float]
    matches_count: int
    domain_status: str
    matches: List[SimilarityMatchItem]

# ---------------------------------------------------------
# Singleton Inference Engine
# ---------------------------------------------------------
class TiterInferenceEngine:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(TiterInferenceEngine, cls).__new__(cls)
            cls._instance._load_artifacts()
        return cls._instance

    def _load_artifacts(self):
        ml_dir = os.path.abspath(os.path.dirname(__file__))
        model_dir = os.path.join(ml_dir, "models", "dataset2_titer_predictor")

        model_path = os.path.join(model_dir, "model.joblib")
        preprocessor_path = os.path.join(model_dir, "preprocessor.joblib")
        meta_path = os.path.join(model_dir, "metadata.json")
        metrics_path = os.path.join(model_dir, "metrics.json")
        similarity_path = os.path.join(model_dir, "similarity_data.json")

        for p in [model_path, preprocessor_path, meta_path, metrics_path, similarity_path]:
            if not os.path.exists(p):
                raise FileNotFoundError(f"Required model artifact missing: {p}. Run train_dataset2 first.")

        self.model = joblib.load(model_path)
        self.preprocessor = joblib.load(preprocessor_path)

        with open(meta_path, 'r', encoding='utf-8') as f:
            self.metadata = json.load(f)

        with open(metrics_path, 'r', encoding='utf-8') as f:
            self.metrics = json.load(f)

        with open(similarity_path, 'r', encoding='utf-8') as f:
            self.similarity_db = json.load(f)

        # Pre-extract normalized matrix for K-NN search
        self.similarity_matrix = np.array([item["scaled_features"] for item in self.similarity_db], dtype=np.float64)

    def predict(self, input_data: TiterInputSchema) -> TiterPredictionResponse:
        feat_dict = {
            "temperature": input_data.temperature,
            "substrate_concentration": input_data.substrate_concentration,
            "reactor_volume": input_data.reactor_volume,
            "oxygen": input_data.oxygen,
            "fermentation_duration": input_data.fermentation_duration
        }

        # Domain Boundary Validation
        val_res = self.preprocessor.validate_domain(feat_dict)
        domain_status = "IN_DOMAIN"
        domain_notes = None

        if not val_res["is_valid"]:
            domain_status = "EXTRAPOLATIVE"
            domain_notes = "Input parameters fall outside the validated model domain: " + "; ".join(val_res["violations"])

        # Scale features
        raw_feat_array = np.array([[
            input_data.temperature,
            input_data.substrate_concentration,
            input_data.reactor_volume,
            input_data.oxygen,
            input_data.fermentation_duration
        ]], dtype=np.float64)

        scaled_X = self.preprocessor.transform(raw_feat_array)

        # Predict in log-space & inverse transform
        pred_log = float(self.model.predict(scaled_X)[0])
        pred_gL = max(0.0, float(np.expm1(pred_log)))

        return TiterPredictionResponse(
            prediction=round(pred_gL, 4),
            unit="g/L",
            target="titer",
            target_transform="log1p",
            model="hist_gradient_boosting",
            version="v1.0",
            dataset="Oyetunde et al.",
            dataset_observations=self.metadata.get("dataset_observations", 1128),
            dataset_papers=self.metadata.get("dataset_papers", 101),
            domain_status=domain_status,
            domain_notes=domain_notes,
            validated_model_domain=val_res.get("domain_bounds"),
            observed_training_range=val_res.get("observed_training_range")
        )

    def get_similarity(self, query_data: SimilarityQuerySchema, top_k: int = 5) -> SimilarityResponse:
        feat_dict = {
            "temperature": query_data.temperature,
            "substrate_concentration": query_data.substrate_concentration,
            "reactor_volume": query_data.reactor_volume,
            "oxygen": query_data.oxygen,
            "fermentation_duration": query_data.fermentation_duration
        }

        val_res = self.preprocessor.validate_domain(feat_dict)
        domain_status = "IN_DOMAIN" if val_res["is_valid"] else "OUT_OF_DOMAIN"

        raw_feat_array = np.array([[
            query_data.temperature,
            query_data.substrate_concentration,
            query_data.reactor_volume,
            query_data.oxygen,
            query_data.fermentation_duration
        ]], dtype=np.float64)

        query_scaled = self.preprocessor.transform(raw_feat_array)

        # Euclidean distances across scaled feature matrix
        dists = np.linalg.norm(self.similarity_matrix - query_scaled, axis=1)
        nearest_idx = np.argsort(dists)[:top_k]

        matches = []
        for rank, idx in enumerate(nearest_idx, 1):
            db_item = self.similarity_db[idx]
            dist_val = float(dists[idx])
            is_self = dist_val < 1e-6

            matches.append(SimilarityMatchItem(
                rank=rank,
                paper_id=f"P{db_item['paper_number']}",
                product_name=db_item['product_name'],
                strain_background=db_item['strain_background'],
                observed_titer=db_item['observed_titer'],
                temperature=db_item['temperature'],
                substrate_concentration=db_item['substrate_concentration'],
                reactor_volume=db_item['reactor_volume'],
                oxygen=db_item['oxygen'],
                fermentation_duration=db_item['fermentation_duration'],
                distance=round(dist_val, 4),
                is_self_match=is_self
            ))

        # Ensure strict sorting by distance (dist_1 <= dist_2 <= ...)
        matches.sort(key=lambda m: m.distance)

        return SimilarityResponse(
            query=feat_dict,
            matches_count=len(matches),
            domain_status=domain_status,
            matches=matches
        )

    def get_model_info(self) -> Dict[str, Any]:
        return self.metadata

    def get_model_performance(self) -> Dict[str, Any]:
        return {
            "model_id": self.metadata.get("model_id"),
            "model_version": self.metadata.get("model_version"),
            "target": self.metadata.get("target"),
            "target_unit": self.metadata.get("target_unit"),
            "target_transform": self.metadata.get("target_transform"),
            "algorithm": self.metadata.get("algorithm"),
            "dataset_observations": self.metadata.get("dataset_observations"),
            "dataset_papers": self.metadata.get("dataset_papers"),
            "validation_metrics": self.metadata.get("validation_metrics"),
            "test_metrics": self.metadata.get("test_metrics")
        }

# Module-level entry points
def predict_titer(input_data: TiterInputSchema) -> TiterPredictionResponse:
    return TiterInferenceEngine().predict(input_data)

def get_similarity(query_data: SimilarityQuerySchema, top_k: int = 5) -> SimilarityResponse:
    return TiterInferenceEngine().get_similarity(query_data, top_k)
