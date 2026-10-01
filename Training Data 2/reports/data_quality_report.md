# Data Quality Report: Dataset 2 (Oyetunde et al.)

**Source:** Oyetunde et al. (2018) E. coli Metabolic Engineering Literature Dataset  
**Process Type:** Heterogeneous microbial fermentation literature dataset  
**Rows:** 1209 | **Columns:** 60 | **Unique Papers:** 107 | **Duplicates:** 0

## Target Variables
- **Primary Target:** `titer` (g/L) | Missing: 81 (6.7%)
- **Secondary Target:** `rate` (g/L/h) | Missing: 427 (35.3%)
- **Secondary Target:** `yield` (g/g) | Missing: 440 (36.4%)

## Variable Schema & Canonical Mappings (Key Variables)

| Original Column | Canonical Variable | Mapping Status | Unit | Data Type | Missing (%) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `paper_number` | `paper_id` | **DIRECT** | dimensionless | categorical | 0.0% |
| `no_of_designs` | `design_id` | **DIRECT** | dimensionless | categorical | 0.0% |
| `cs_conc1` | `substrate_concentration` | **DIRECT** | g/L | numeric | 2.81% |
| `rxt_volume` | `reactor_volume_l` | **DIRECT** | L | numeric | 11.41% |
| `media` | `media_type` | **DIRECT** | categorical | categorical | 0.58% |
| `temp` | `temperature` | **DIRECT** | °C | numeric | 4.14% |
| `oxygen` | `aerobic_flag` | **RELATED_BUT_NOT_EQUIVALENT** | indicator (0/1) | numeric | 9.26% |
| `product_name` | `product_name` | **DIRECT** | categorical | categorical | 0.0% |
| `yield` | `product_yield` | **DIRECT** | g/g | numeric | 36.39% |
| `titer` | `product_titer` | **DIRECT** | g/L | numeric | 6.7% |
| `rate` | `volumetric_rate` | **DIRECT** | g/L/h | numeric | 35.32% |
| `fermentation_time` | `fermentation_duration_hours` | **DIRECT** | hours | numeric | 19.35% |
| `bio_growth_rate` | `specific_growth_rate` | **DIRECT** | h⁻¹ | categorical | 87.51% |

## Key Findings
1. **Target Availability:** `titer` is available for 1,128 of 1,209 observations (93.3% complete).
2. **Missingness:** High missingness in genetic features (40%-70% missing).
3. **Paper-aware Grouping:** Splitting should group by `paper_number` to prevent literature data leakage across train/val/test splits.
