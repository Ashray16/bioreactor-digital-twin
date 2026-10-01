import numpy as np
from sklearn.preprocessing import StandardScaler

class Dataset1Preprocessor:
    """
    Deterministic preprocessor pipeline for Dataset 1 bioprocess outcome features.
    Ensures exact consistency between training and inference data preprocessing.
    """
    def __init__(self):
        self.scaler = StandardScaler()
        self.feature_names = [
            'temperature',
            'pH',
            'dissolved_oxygen_min',
            'inoculum_volume_ml',
            'agitation_rpm',
            'lactose_feed_volume_ml',
            'culture_duration_days',
            'media_volume_ml'
        ]
        self.is_fitted = False

    def fit(self, X):
        X_arr = np.array(X, dtype=np.float64)
        self.scaler.fit(X_arr)
        self.is_fitted = True
        return self

    def transform(self, X):
        if not self.is_fitted:
            raise ValueError("Preprocessor is not fitted yet!")
        X_arr = np.array(X, dtype=np.float64)
        return self.scaler.transform(X_arr)

    def fit_transform(self, X):
        self.fit(X)
        return self.transform(X)
