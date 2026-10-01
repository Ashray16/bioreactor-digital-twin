import os
import csv
import json
import joblib
import numpy as np
from datetime import datetime
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from app.ml.preprocessing import Dataset1Preprocessor

def load_dataset1_processed(csv_path):
    features = []
    targets = []
    run_ids = []

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            run_ids.append(row['Run_ID'])
            features.append([
                float(row['Avg_temp']),
                float(row['Avg_pH']),
                float(row['Min_DO %']),
                float(row['Inoculum size (mL)']),
                float(row['Max_RPM']),
                float(row['Total feed of Lactose (mL)']),
                float(row['Total culture duration (days)']),
                float(row['Total media volume (mL)'])
            ])
            targets.append(float(row['Max FPU/ml']))

    return np.array(features, dtype=np.float64), np.array(targets, dtype=np.float64), run_ids

def create_plots(y_actual, y_pred, output_dir):
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt

        # 1. Actual vs Predicted Plot
        plt.figure(figsize=(7, 6))
        plt.scatter(y_actual, y_pred, alpha=0.7, color='#2563eb', edgecolors='k', linewidth=0.5)
        min_v = min(min(y_actual), min(y_pred))
        max_v = max(max(y_actual), max(y_pred))
        plt.plot([min_v, max_v], [min_v, max_v], 'r--', linewidth=2, label='Ideal y = x')
        plt.xlabel('Actual Max FPU/ml', fontsize=12)
        plt.ylabel('Predicted Max FPU/ml', fontsize=12)
        plt.title('Actual vs Predicted Max FPU/ml (Test Set)', fontsize=13, fontweight='bold')
        plt.legend(loc='upper left')
        plt.grid(True, linestyle=':', alpha=0.6)
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, 'actual_vs_predicted.png'), dpi=200)
        plt.close()

        # 2. Residual Plot
        residuals = y_actual - y_pred
        plt.figure(figsize=(7, 6))
        plt.scatter(y_pred, residuals, alpha=0.7, color='#059669', edgecolors='k', linewidth=0.5)
        plt.axhline(0, color='red', linestyle='--', linewidth=2)
        plt.xlabel('Predicted Max FPU/ml', fontsize=12)
        plt.ylabel('Residual (Actual - Predicted)', fontsize=12)
        plt.title('Residual Plot (Test Set)', fontsize=13, fontweight='bold')
        plt.grid(True, linestyle=':', alpha=0.6)
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, 'residual_plot.png'), dpi=200)
        plt.close()
        print("Matplotlib plots generated successfully!")
    except Exception as e:
        print(f"Warning: Matplotlib plot generation failed ({e}). Plots omitted or saved as data.")

def train_and_evaluate():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    csv_path = os.path.join(root_dir, "Training Data", "processed", "dataset1_processed.csv")
    output_dir = os.path.join(root_dir, "backend", "app", "ml", "models", "dataset1_fpu_predictor")
    os.makedirs(output_dir, exist_ok=True)

    print(f"Loading dataset from: {csv_path}")
    X, y, run_ids = load_dataset1_processed(csv_path)
    total_samples = len(y)

    # Deterministic Split: 70% Train, 15% Val, 15% Test
    # Step 1: 85% train_val, 15% test
    X_train_val, X_test, y_train_val, y_test, ids_train_val, ids_test = train_test_split(
        X, y, run_ids, test_size=0.15, random_state=42
    )
    # Step 2: 70/85 = 0.8235 train, 15/85 = 0.1765 val
    X_train, X_val, y_train, y_val, ids_train, ids_val = train_test_split(
        X_train_val, y_train_val, ids_train_val, test_size=(0.15 / 0.85), random_state=42
    )

    print(f"Data Split -> Train: {len(y_train)} (70%), Val: {len(y_val)} (15%), Test: {len(y_test)} (15%)")

    # Fit Preprocessor on Train set only
    preprocessor = Dataset1Preprocessor()
    X_train_scaled = preprocessor.fit_transform(X_train)
    X_val_scaled = preprocessor.transform(X_val)
    X_test_scaled = preprocessor.transform(X_test)

    # 1. Baseline: Linear Regression
    lr = LinearRegression()
    lr.fit(X_train_scaled, y_train)
    val_pred_lr = lr.predict(X_val_scaled)
    lr_val_mae = float(mean_absolute_error(y_val, val_pred_lr))
    lr_val_rmse = float(np.sqrt(mean_squared_error(y_val, val_pred_lr)))
    lr_val_r2 = float(r2_score(y_val, val_pred_lr))

    # 2. Candidate A: Random Forest Regressor
    rf = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42)
    rf.fit(X_train_scaled, y_train)
    val_pred_rf = rf.predict(X_val_scaled)
    rf_val_mae = float(mean_absolute_error(y_val, val_pred_rf))
    rf_val_rmse = float(np.sqrt(mean_squared_error(y_val, val_pred_rf)))
    rf_val_r2 = float(r2_score(y_val, val_pred_rf))

    # 3. Candidate B: Gradient Boosting Regressor
    gb = GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=5, random_state=42)
    gb.fit(X_train_scaled, y_train)
    val_pred_gb = gb.predict(X_val_scaled)
    gb_val_mae = float(mean_absolute_error(y_val, val_pred_gb))
    gb_val_rmse = float(np.sqrt(mean_squared_error(y_val, val_pred_gb)))
    gb_val_r2 = float(r2_score(y_val, val_pred_gb))

    print("\n--- Validation Set Comparison ---")
    print(f"Linear Regression: MAE={lr_val_mae:.4f}, RMSE={lr_val_rmse:.4f}, R2={lr_val_r2:.4f}")
    print(f"Random Forest:     MAE={rf_val_mae:.4f}, RMSE={rf_val_rmse:.4f}, R2={rf_val_r2:.4f}")
    print(f"Gradient Boosting: MAE={gb_val_mae:.4f}, RMSE={gb_val_rmse:.4f}, R2={gb_val_r2:.4f}")

    # Model Selection
    models = {
        "Linear Regression": (lr, lr_val_r2, lr_val_mae, lr_val_rmse),
        "Random Forest": (rf, rf_val_r2, rf_val_mae, rf_val_rmse),
        "Gradient Boosting": (gb, gb_val_r2, gb_val_mae, gb_val_rmse)
    }

    best_name = max(models, key=lambda k: models[k][1])
    best_model, best_val_r2, best_val_mae, best_val_rmse = models[best_name]
    print(f"\nSELECTED BEST MODEL: {best_name} (Val R2 = {best_val_r2:.4f})")

    # Cross-validation on Train Set
    cv_scores = cross_val_score(best_model, X_train_scaled, y_train, cv=5, scoring='r2')
    cv_mean = float(np.mean(cv_scores))
    cv_std = float(np.std(cv_scores))
    print(f"5-Fold CV R2 on Train Set: {cv_mean:.4f} ± {cv_std:.4f}")

    # Final Test Set Evaluation (Held-out, evaluated once)
    test_pred = best_model.predict(X_test_scaled)
    test_mae = float(mean_absolute_error(y_test, test_pred))
    test_rmse = float(np.sqrt(mean_squared_error(y_test, test_pred)))
    test_r2 = float(r2_score(y_test, test_pred))

    print("\n--- Official Test Set Performance ---")
    print(f"Test MAE:  {test_mae:.4f}")
    print(f"Test RMSE: {test_rmse:.4f}")
    print(f"Test R2:   {test_r2:.4f}")

    # Feature Importances
    feature_names = preprocessor.feature_names
    feat_importances = {}
    if hasattr(best_model, 'feature_importances_'):
        importances = best_model.feature_importances_
        for name, imp in zip(feature_names, importances):
            feat_importances[name] = round(float(imp), 4)
        
        # Sort
        feat_importances = dict(sorted(feat_importances.items(), key=lambda x: x[1], reverse=True))
        print("\n--- Feature Importances ---")
        for f_name, imp in feat_importances.items():
            bar = "█" * int(imp * 30)
            print(f"  {f_name:<25} {imp:.4f} {bar}")

    # Generate Plots
    create_plots(y_test, test_pred, output_dir)

    # Save Artifacts
    joblib.dump(best_model, os.path.join(output_dir, "model.joblib"))
    joblib.dump(preprocessor, os.path.join(output_dir, "preprocessor.joblib"))

    # Metadata & Metrics JSONs
    metrics_data = {
        "validation": {
            "linear_regression": {"mae": lr_val_mae, "rmse": lr_val_rmse, "r2": lr_val_r2},
            "random_forest": {"mae": rf_val_mae, "rmse": rf_val_rmse, "r2": rf_val_r2},
            "gradient_boosting": {"mae": gb_val_mae, "rmse": gb_val_rmse, "r2": gb_val_r2}
        },
        "selected_model": best_name,
        "test_metrics": {
            "mae": round(test_mae, 4),
            "rmse": round(test_rmse, 4),
            "r2": round(test_r2, 4)
        },
        "cross_validation": {
            "cv_folds": 5,
            "cv_r2_mean": round(cv_mean, 4),
            "cv_r2_std": round(cv_std, 4)
        }
    }

    metadata = {
        "model_id": "dataset1_fpu_predictor",
        "model_version": "v1.0",
        "dataset": "Aggregated_data_with_1000_runs.xlsx",
        "dataset_source": "Kaggle Fungal Cellulase Bioreactor Dataset (Trichoderma reesei)",
        "process_type": "Trichoderma reesei cellulase enzyme fermentation",
        "target": "Max FPU/ml",
        "target_unit": "FPU/ml",
        "features": feature_names,
        "algorithm": best_name,
        "training_rows": len(y_train),
        "validation_rows": len(y_val),
        "test_rows": len(y_test),
        "random_seed": 42,
        "training_timestamp": datetime.now().isoformat(),
        "validation_metrics": {
            "mae": round(best_val_mae, 4),
            "rmse": round(best_val_rmse, 4),
            "r2": round(best_val_r2, 4)
        },
        "test_metrics": {
            "mae": round(test_mae, 4),
            "rmse": round(test_rmse, 4),
            "r2": round(test_r2, 4)
        },
        "cross_validation_r2_mean": round(cv_mean, 4),
        "cross_validation_r2_std": round(cv_std, 4),
        "feature_importances": feat_importances
    }

    with open(os.path.join(output_dir, "metrics.json"), 'w') as f:
        json.dump(metrics_data, f, indent=2)

    with open(os.path.join(output_dir, "metadata.json"), 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"\nAll artifacts successfully saved to: {output_dir}")
    return metadata, metrics_data

if __name__ == "__main__":
    train_and_evaluate()
