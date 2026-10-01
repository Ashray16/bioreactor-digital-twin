import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from typing import Dict, Any, List

class Dataset2Preprocessor:
    """
    Deterministic preprocessor pipeline for Dataset 2 bioprocess features.
    Tracks feature training domain boundaries for domain validation.
    """
    def __init__(self):
        self.imputer = SimpleImputer(strategy='median')
        self.scaler = StandardScaler()
        self.feature_names = [
            'temperature',
            'substrate_concentration',
            'reactor_volume',
            'oxygen',
            'fermentation_duration'
        ]
        self.domain_bounds: Dict[str, Dict[str, float]] = {}  # Will hold observed training ranges
        self.validated_model_domain = {
            "temperature": {"min": 20.0, "max": 60.0},
            "substrate_concentration": {"min": 0.0, "max": 500.0},
            "reactor_volume": {"min": 0.001, "max": 1000.0},
            "oxygen": {"min": 0.0, "max": 1.0, "type": "binary", "values": [0.0, 1.0]},
            "fermentation_duration": {"min": 0.1, "max": 500.0}
        }
        self.is_fitted = False

    def fit(self, X: np.ndarray) -> "Dataset2Preprocessor":
        X_arr = np.array(X, dtype=np.float64)
        
        # Track training domain boundaries before scaling
        for i, fname in enumerate(self.feature_names):
            if fname == 'oxygen':
                # Dataset 2 oxygen is a binary indicator: 0.0 = Anaerobic, 1.0 = Aerobic
                self.domain_bounds[fname] = {
                    "min": 0.0,
                    "max": 1.0,
                    "type": "binary",
                    "values": [0.0, 1.0]
                }
            else:
                col_valid = X_arr[:, i][~np.isnan(X_arr[:, i])]
                if len(col_valid) > 0:
                    self.domain_bounds[fname] = {
                        "min": float(np.min(col_valid)),
                        "max": float(np.max(col_valid))
                    }
                else:
                    self.domain_bounds[fname] = {"min": 0.0, "max": 100.0}

        X_imp = self.imputer.fit_transform(X_arr)
        self.scaler.fit(X_imp)
        self.is_fitted = True
        return self

    def transform(self, X: np.ndarray) -> np.ndarray:
        if not self.is_fitted:
            raise ValueError("Dataset2Preprocessor is not fitted!")
        X_arr = np.array(X, dtype=np.float64)
        X_imp = self.imputer.transform(X_arr)
        return self.scaler.transform(X_imp)

    def fit_transform(self, X: np.ndarray) -> np.ndarray:
        self.fit(X)
        return self.transform(X)

    def validate_domain(self, feature_dict: Dict[str, float]) -> Dict[str, Any]:
        """
        Check if feature_dict input values fall within the validated model domain bounds.
        Returns detailed validation result per feature.
        """
        if not self.is_fitted:
            raise ValueError("Preprocessor not fitted!")
        
        violations = []
        is_valid = True

        for fname in self.feature_names:
            val = feature_dict.get(fname)
            if val is None or not np.isfinite(val):
                is_valid = False
                violations.append(f"{fname} must be a finite numerical value")
                continue

            if fname == 'oxygen':
                # Oxygen is binary: 0.0 = Anaerobic, 1.0 = Aerobic
                if val not in (0.0, 1.0):
                    is_valid = False
                    violations.append(f"oxygen value {val} is not a valid binary indicator {{0.0 = Anaerobic, 1.0 = Aerobic}}")
                continue

            bounds = self.validated_model_domain.get(fname)
            if bounds:
                b_min, b_max = bounds["min"], bounds["max"]
                if val < b_min or val > b_max:
                    is_valid = False
                    violations.append(f"{fname} value {val} is outside validated range [{b_min}, {b_max}]")

        return {
            "is_valid": is_valid,
            "violations": violations,
            "domain_bounds": self.validated_model_domain,
            "observed_training_range": self.domain_bounds
        }
