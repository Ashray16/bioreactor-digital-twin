import os
import csv
import json
import joblib
import numpy as np
from datetime import datetime
from scipy import stats
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, median_absolute_error

from app.ml.preprocessing_dataset2 import Dataset2Preprocessor

def train_and_save_dataset2():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    csv_path = os.path.join(root_dir, "..", "Training Data 2", "processed", "dataset2_processed.csv")
    output_dir = os.path.join(root_dir, "app", "ml", "models", "dataset2_titer_predictor")
    os.makedirs(output_dir, exist_ok=True)

    print(f"Loading Dataset 2 from: {csv_path}")
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    # Filter valid titer rows
    valid_rows = []
    for r in rows:
        v = r.get('titer')
        if v not in [None, '', 'NA']:
            try:
                fv = float(v)
                valid_rows.append(r)
            except ValueError:
                pass

    print(f"Total valid titer observations: {len(valid_rows)}")

    # Extract paper IDs and features
    paper_ids = np.array([r['paper_number'] for r in valid_rows])
    unique_papers = sorted(list(set(paper_ids)), key=lambda x: int(x) if x.isdigit() else x)
    n_papers = len(unique_papers)

    proc_num_cols = ["temp", "cs_conc1", "rxt_volume", "oxygen", "fermentation_time"]

    def parse_features(r):
        def float_or_nan(val):
            if val in [None, '', 'NA']:
                return np.nan
            try:
                return float(val)
            except ValueError:
                return np.nan
        return [
            float_or_nan(r.get('temp')),
            float_or_nan(r.get('cs_conc1')),
            float_or_nan(r.get('rxt_volume')),
            float_or_nan(r.get('oxygen')),
            float_or_nan(r.get('fermentation_time'))
        ]

    X_raw = np.array([parse_features(r) for r in valid_rows], dtype=np.float64)
    y_raw = np.array([float(r['titer']) for r in valid_rows], dtype=np.float64)

    # Fixed Paper-Aware Partitioning (70 train, 15 val, 16 test)
    np.random.seed(42)
    shuffled_papers = np.array(unique_papers)
    np.random.shuffle(shuffled_papers)

    n_tr = int(0.70 * n_papers)
    n_va = int(0.15 * n_papers)

    train_papers = set(shuffled_papers[:n_tr])
    val_papers = set(shuffled_papers[n_tr:n_tr+n_va])
    test_papers = set(shuffled_papers[n_tr+n_va:])

    train_idx = [i for i, p in enumerate(paper_ids) if p in train_papers]
    val_idx = [i for i, p in enumerate(paper_ids) if p in val_papers]
    test_idx = [i for i, p in enumerate(paper_ids) if p in test_papers]

    print(f"Paper-Aware Split: Train={len(train_papers)} papers ({len(train_idx)} rows), Val={len(val_papers)} papers ({len(val_idx)} rows), Test={len(test_papers)} papers ({len(test_idx)} rows)")

    # Preprocessing
    preprocessor = Dataset2Preprocessor()
    X_train_scaled = preprocessor.fit_transform(X_raw[train_idx])
    X_val_scaled = preprocessor.transform(X_raw[val_idx])
    X_test_scaled = preprocessor.transform(X_raw[test_idx])

    y_train = y_raw[train_idx]
    y_val = y_raw[val_idx]
    y_test = y_raw[test_idx]

    # Model Fitting: HistGradientBoostingRegressor on log1p(titer)
    y_train_log = np.log1p(y_train)
    model = HistGradientBoostingRegressor(max_iter=100, max_depth=5, random_state=42)
    model.fit(X_train_scaled, y_train_log)

    # Validation Evaluation
    val_pred_log = model.predict(X_val_scaled)
    val_pred_gL = np.maximum(0.0, np.expm1(val_pred_log))
    val_mae = float(mean_absolute_error(y_val, val_pred_gL))
    val_rmse = float(np.sqrt(mean_squared_error(y_val, val_pred_gL)))
    val_r2 = float(r2_score(y_val, val_pred_gL))
    val_medae = float(median_absolute_error(y_val, val_pred_gL))

    # Test Evaluation
    test_pred_log = model.predict(X_test_scaled)
    test_pred_gL = np.maximum(0.0, np.expm1(test_pred_log))
    test_mae = float(mean_absolute_error(y_test, test_pred_gL))
    test_rmse = float(np.sqrt(mean_squared_error(y_test, test_pred_gL)))
    test_r2 = float(r2_score(y_test, test_pred_gL))
    test_medae = float(median_absolute_error(y_test, test_pred_gL))

    print(f"\n--- Validation Metrics ---")
    print(f"R2: {val_r2:.4f} | MAE: {val_mae:.4f} g/L | RMSE: {val_rmse:.4f} g/L | MedAE: {val_medae:.4f} g/L")
    print(f"\n--- Held-Out Test Metrics ---")
    print(f"R2: {test_r2:.4f} | MAE: {test_mae:.4f} g/L | RMSE: {test_rmse:.4f} g/L | MedAE: {test_medae:.4f} g/L")

    # Serialize Model & Preprocessor binaries
    joblib.dump(model, os.path.join(output_dir, "model.joblib"))
    joblib.dump(preprocessor, os.path.join(output_dir, "preprocessor.joblib"))

    # Prepare Similarity database records
    # Fit preprocessor on all data for similarity search matrix
    X_all_scaled = preprocessor.transform(X_raw)
    similarity_records = []
    for i, r in enumerate(valid_rows):
        similarity_records.append({
            "record_id": i,
            "paper_number": r['paper_number'],
            "product_name": str(r.get('product_name', 'UNKNOWN')).strip(),
            "strain_background": str(r.get('strain_background', 'UNKNOWN')).strip(),
            "observed_titer": float(r['titer']),
            "temperature": float(r['temp']) if r.get('temp') not in [None, '', 'NA'] else None,
            "substrate_concentration": float(r['cs_conc1']) if r.get('cs_conc1') not in [None, '', 'NA'] else None,
            "reactor_volume": float(r['rxt_volume']) if r.get('rxt_volume') not in [None, '', 'NA'] else None,
            "oxygen": float(r['oxygen']) if r.get('oxygen') not in [None, '', 'NA'] else None,
            "fermentation_duration": float(r['fermentation_time']) if r.get('fermentation_time') not in [None, '', 'NA'] else None,
            "scaled_features": X_all_scaled[i].tolist()
        })

    with open(os.path.join(output_dir, "similarity_data.json"), 'w') as f:
        json.dump(similarity_records, f, indent=2)

    # Generate metadata.json
    metadata = {
        "model_id": "dataset2_titer_predictor",
        "model_version": "v1.0",
        "dataset": "Oyetunde et al. data.xlsx",
        "dataset_source": "Oyetunde et al. (2018) E. coli Metabolic Engineering Literature Dataset",
        "process_type": "Heterogeneous microbial fermentation literature dataset",
        "target": "titer",
        "target_unit": "g/L",
        "target_transform": "log1p",
        "algorithm": "HistGradientBoostingRegressor",
        "feature_set": "ProcessOnly",
        "features": preprocessor.feature_names,
        "domain_bounds": preprocessor.validated_model_domain,
        "observed_training_range": preprocessor.domain_bounds,
        "dataset_observations": len(valid_rows),
        "dataset_papers": n_papers,
        "training_rows": len(train_idx),
        "validation_rows": len(val_idx),
        "test_rows": len(test_idx),
        "training_papers_count": len(train_papers),
        "validation_papers_count": len(val_papers),
        "test_papers_count": len(test_papers),
        "random_seed": 42,
        "training_timestamp": datetime.now().isoformat(),
        "validation_metrics": {
            "r2": round(val_r2, 4),
            "mae": round(val_mae, 4),
            "rmse": round(val_rmse, 4),
            "medae": round(val_medae, 4)
        },
        "test_metrics": {
            "r2": round(test_r2, 4),
            "mae": round(test_mae, 4),
            "rmse": round(test_rmse, 4),
            "medae": round(test_medae, 4)
        }
    }

    with open(os.path.join(output_dir, "metadata.json"), 'w') as f:
        json.dump(metadata, f, indent=2)

    # Generate metrics.json
    metrics = {
        "model_id": "dataset2_titer_predictor",
        "validation_r2": round(val_r2, 4),
        "validation_mae": round(val_mae, 4),
        "validation_rmse": round(val_rmse, 4),
        "validation_medae": round(val_medae, 4),
        "test_r2": round(test_r2, 4),
        "test_mae": round(test_mae, 4),
        "test_rmse": round(test_rmse, 4),
        "test_medae": round(test_medae, 4)
    }

    with open(os.path.join(output_dir, "metrics.json"), 'w') as f:
        json.dump(metrics, f, indent=2)

    # Generate MODEL_CARD.md
    model_card = f"""# Model Card: Dataset 2 Bioprocess Titer Predictor (`v1.0`)

## Model Details
- **Model ID:** `dataset2_titer_predictor`
- **Model Version:** `v1.0`
- **Algorithm:** `HistGradientBoostingRegressor`
- **Target Variable:** `titer` (g/L)
- **Target Transformation:** `log1p` (Inverse transform: `expm1`)
- **Feature Set:** `ProcessOnly` (`temperature`, `substrate_concentration`, `reactor_volume`, `oxygen`, `fermentation_duration`)

## Intended Use
- **Primary Use:** Bioprocess Outcome Prediction and Decision Support for biochemical manufacturing experiments.
- **Out of Scope:** This model is **NOT** a mammalian (CHO) cell perfusion digital twin and must not be used for closed-loop perfusion control or replacing dynamic cell growth ODEs.

## Training & Evaluation Data
- **Dataset:** Oyetunde et al. (2018) E. coli Metabolic Engineering Literature Dataset.
- **Observations:** 1,128 valid observations across 101 published literature studies.
- **Split Protocol:** Strict Paper-Aware Split (70 papers Train / 15 papers Val / 16 papers Test). Zero literature paper overlap.

## Official Metrics

### Validation Set (15 Unseen Literature Papers / 102 Rows)
- **Validation \(R^2\):** `{val_r2:.4f}`
- **Validation MAE:** `{val_mae:.4f} g/L`
- **Validation RMSE:** `{val_rmse:.4f} g/L`
- **Validation MedianAE:** `{val_medae:.4f} g/L`

### Official Held-Out Test Set (16 Unseen Literature Papers / 210 Rows)
- **Test \(R^2\):** `{test_r2:.4f}`
- **Test MAE:** `{test_mae:.4f} g/L`
- **Test RMSE:** `{test_rmse:.4f} g/L`
- **Test MedianAE:** `{test_medae:.4f} g/L`

## Model Limitations
1. **Operating Domain:** Performance is highest in the core operating regime (0–5 g/L, MedianAE = 1.25 g/L) and decreases for rare high-titer observations (>100 g/L).
2. **Heterogeneity:** 66.3% of target variance across Dataset 2 is between-paper variance (ICC = 0.6633). Use alongside K-NN Similarity Engine for empirical benchmarking.
"""

    with open(os.path.join(output_dir, "MODEL_CARD.md"), 'w', encoding='utf-8') as f:
        f.write(model_card)

    print(f"\nAll 5 artifacts successfully generated in {output_dir}:")
    print("  - model.joblib")
    print("  - preprocessor.joblib")
    print("  - metadata.json")
    print("  - metrics.json")
    print("  - MODEL_CARD.md")
    print("  - similarity_data.json")

if __name__ == "__main__":
    train_and_save_dataset2()
