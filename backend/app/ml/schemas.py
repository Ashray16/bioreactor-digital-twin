from pydantic import BaseModel, Field, field_validator
from typing import Dict, Any, List, Optional

class FPUInputSchema(BaseModel):
    temperature: float = Field(..., description="Average temperature in °C", ge=10.0, le=50.0)
    pH: float = Field(..., description="Average culture pH", ge=2.0, le=12.0)
    dissolved_oxygen_min: float = Field(..., description="Minimum dissolved oxygen percentage (%)", ge=0.0, le=100.0)
    inoculum_volume_ml: float = Field(..., description="Inoculum volume in mL", ge=0.0, le=1000.0)
    agitation_rpm: float = Field(..., description="Maximum agitation speed in RPM", ge=0.0, le=2000.0)
    lactose_feed_volume_ml: float = Field(..., description="Total feed of lactose in mL", ge=0.0, le=10000.0)
    culture_duration_days: float = Field(..., description="Total culture duration in days", ge=0.1, le=30.0)
    media_volume_ml: float = Field(..., description="Total working media volume in mL", ge=100.0, le=50000.0)

    @field_validator('*', mode='before')
    def check_finite(cls, v):
        if isinstance(v, (int, float)):
            import math
            if math.isnan(v) or math.isinf(v):
                raise ValueError("Numerical inputs must be finite numbers (not NaN or Inf)")
        return v

class FPUPredictionResponse(BaseModel):
    prediction: float = Field(..., description="Predicted Max FPU/ml yield")
    target: str = Field("Max FPU/ml", description="Target variable name")
    unit: str = Field("FPU/ml", description="Target measurement unit")
    model: str = Field("dataset1_fpu_predictor", description="Trained model identifier")
    version: str = Field("v1.0", description="Model version")
    process_type: str = Field("Trichoderma reesei cellulase fermentation", description="Biological process context")
    dataset_source: str = Field("Kaggle Fungal Cellulase Bioreactor Dataset (1,000 runs)", description="Training data provenance")

class ModelMetrics(BaseModel):
    mae: float
    rmse: float
    r2: float

class ModelMetadataSchema(BaseModel):
    model_id: str
    model_version: str
    dataset: str
    dataset_source: str
    process_type: str
    target: str
    target_unit: str
    features: List[str]
    algorithm: str
    training_rows: int
    validation_rows: int
    test_rows: int
    random_seed: int
    training_timestamp: str
    validation_metrics: ModelMetrics
    test_metrics: ModelMetrics
    cross_validation_r2_mean: float
    cross_validation_r2_std: float
    feature_importances: Optional[Dict[str, float]] = None
