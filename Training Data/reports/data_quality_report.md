# Data Quality Report: Dataset 1 (Aggregated 1000 Runs)

**Source:** Kaggle Fungal Cellulase Bioreactor Dataset (Trichoderma reesei)  
**Process Type:** Batch / Fed-batch cellulase enzyme bioprocess  
**Rows:** 1000 | **Columns:** 12 | **Unique Batches:** 999 | **Duplicates:** 0

## Target Variable
- **Primary Target:** `Max FPU/ml`
- **Unit:** `FPU/mL` (Filter Paper Units per mL)
- **Missingness:** 0 missing values (100% complete)
- **Biological Context:** Cellulase activity yield from *Trichoderma reesei* fermentation.

## Variable Schema & Canonical Mappings

| Original Column | Canonical Variable | Mapping Status | Unit | Data Type | Missing (%) | Outliers (IQR) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `Run_ID` | `batch_id` | **DIRECT** | dimensionless | categorical | 0.0% | N/A |
| `Avg_temp` | `temperature` | **DIRECT** | °C | numeric | 0.0% | 6 |
| `Avg_pH` | `pH` | **DIRECT** | pH units | numeric | 0.0% | 3 |
| `Min_DO %` | `dissolved_oxygen_min` | **RELATED_BUT_NOT_EQUIVALENT** | % saturation | numeric | 0.0% | 2 |
| `Inoculum size (mL)` | `inoculum_volume_ml` | **DIRECT** | mL | numeric | 0.0% | 10 |
| `Max_RPM` | `agitation_rpm_max` | **DIRECT** | RPM | numeric | 0.0% | 5 |
| `Total feed of Lactose (mL)` | `lactose_feed_volume_ml` | **DIRECT** | mL | numeric | 0.0% | 9 |
| `Total culture duration (days)` | `culture_duration_days` | **DIRECT** | days | numeric | 0.0% | 12 |
| `Contamination (Y/N)` | `contamination_flag` | **DIRECT** | categorical (Y/N) | categorical | 0.0% | N/A |
| `Total media volume (mL)` | `media_volume_ml` | **DIRECT** | mL | numeric | 0.0% | 14 |
| `Max FPU/ml` | `max_fpu_per_ml` | **DIRECT** | FPU/mL | numeric | 0.0% | 10 |
| `Notes` | `yield_category` | **DIRECT** | categorical | categorical | 0.0% | N/A |

## Key Findings
1. **Data Completeness:** 100% complete across all 12 columns (0 missing values).
2. **Batch ID:** `Run_ID` provides explicit batch isolation (`TRICH_01` to `TRICH_1000`).
3. **Data Splitting Strategy:** Batch-aware train/val/test splitting (70% train / 15% val / 15% test).
