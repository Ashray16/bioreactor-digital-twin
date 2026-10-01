# Model Card: Dataset 2 Bioprocess Titer Predictor (`v1.0`)

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
- **Validation \(R^2\):** `0.2086`
- **Validation MAE:** `20.5603 g/L`
- **Validation RMSE:** `30.5088 g/L`
- **Validation MedianAE:** `6.4786 g/L`

### Official Held-Out Test Set (16 Unseen Literature Papers / 210 Rows)
- **Test \(R^2\):** `0.1479`
- **Test MAE:** `7.1464 g/L`
- **Test RMSE:** `18.1362 g/L`
- **Test MedianAE:** `1.4676 g/L`

## Model Limitations
1. **Operating Domain:** Performance is highest in the core operating regime (0–5 g/L, MedianAE = 1.25 g/L) and decreases for rare high-titer observations (>100 g/L).
2. **Heterogeneity:** 66.3% of target variance across Dataset 2 is between-paper variance (ICC = 0.6633). Use alongside K-NN Similarity Engine for empirical benchmarking.
