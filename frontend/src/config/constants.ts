/**
 * Digital Twin Configuration Constants & Single Source of Truth
 *
 * All bioprocess default parameters, control limits, and operational thresholds
 * are defined here to guarantee mathematical consistency across all UI components,
 * ODE simulation models, and analytical tools.
 */

import { BioreactorConfig, FaultConfig } from '../types/simulation';

// --- Operational & Biological Single Source of Truth ---
export const NOMINAL_FEED_GLUCOSE = 7.0; // g/L (Substrate feed concentration)
export const GLUCOSE_THRESHOLD_LOW = 2.0; // g/L (Closed-loop controller trip threshold)
export const LACTATE_THRESHOLD_HIGH = 3.5; // g/L (Metabolite toxicity warning threshold)
export const FOULING_THRESHOLD_HIGH = 70.0; // 0–100 index (Membrane fouling upper limit)
export const BASELINE_PERFUSION_VVD = 0.4; // VVD (Nominal continuous perfusion rate)
export const BASELINE_DEATH_RATE = 0.002; // h⁻¹ (Specific baseline cell mortality rate)
export const TARGET_CELL_DENSITY = 1.0e8; // cells/mL (High-density culture setpoint: 100M/mL)
export const INOCULUM_CELL_DENSITY = 5.0e5; // cells/mL (0.5 × 10⁶ cells/mL)
export const NOMINAL_SIMULATION_DURATION = 240.0; // hours (10-day continuous perfusion run)
export const NOMINAL_TIMESTEP = 0.5; // hours

/**
 * Standard Default Bioreactor Configuration
 */
export const DEFAULT_BIOREACTOR_CONFIG: BioreactorConfig = {
  reactor_volume: 2.0,
  initial_cell_density: INOCULUM_CELL_DENSITY,
  target_cell_density: TARGET_CELL_DENSITY,
  initial_viability: 98.0,
  initial_nutrient: 3.0,
  initial_metabolite: 0.2,
  initial_product: 0.0,
  feed_nutrient_concentration: NOMINAL_FEED_GLUCOSE,
  perfusion_rate: BASELINE_PERFUSION_VVD,
  min_perfusion_rate: 0.2,
  max_perfusion_rate: 3.5,
  nutrient_threshold_low: GLUCOSE_THRESHOLD_LOW,
  metabolite_threshold_high: LACTATE_THRESHOLD_HIGH,
  fouling_threshold_high: FOULING_THRESHOLD_HIGH,
  step_increment_vvd: 0.2,
  simulation_duration: NOMINAL_SIMULATION_DURATION,
  timestep: NOMINAL_TIMESTEP,
  max_growth_rate: 0.035,
  cell_nutrient_consumption_rate: 5e-9,
  cell_metabolite_yield: 6e-9,
  specific_productivity_qp: 2e-9,
  death_rate_base: BASELINE_DEATH_RATE,
  monod_constant_nutrient: 0.5,
  metabolite_inhibition_constant: 8.0,
  max_sustainable_density: 1.5e8,
  filter_area: 0.1,
  fouling_sensitivity: 1.0,
  fouling_warning_threshold: FOULING_THRESHOLD_HIGH,
  temperature: 37.0,
  ph: 7.0,
  control_enabled: false,
  control_mode: 'rule_based',
};

/**
 * Standard Disturbance Presets
 */
export const DISTURBANCE_PRESETS: Record<string, FaultConfig> = {
  nutrient_stress: {
    fault_type: 'nutrient_reduction',
    severity: 0.85,
    start_time: 60.0,
    duration: 40.0, // 60h – 100h window
  },
  fouling_surge: {
    fault_type: 'fouling_surge',
    severity: 0.85,
    start_time: 72.0,
    duration: 40.0, // 72h – 112h window
  },
  perfusion_disruption: {
    fault_type: 'perfusion_disruption',
    severity: 0.85,
    start_time: 60.0,
    duration: 40.0,
  },
};

/**
 * Format cell density values cleanly (e.g. 500,000 -> 5.0 × 10⁵)
 */
export function formatCellDensity(cellsPerMl: number): string {
  if (cellsPerMl >= 1e8) {
    return `${(cellsPerMl / 1e8).toFixed(2)} × 10⁸`;
  }
  if (cellsPerMl >= 1e6) {
    return `${(cellsPerMl / 1e6).toFixed(2)} × 10⁶`;
  }
  if (cellsPerMl >= 1e5) {
    return `${(cellsPerMl / 1e5).toFixed(1)} × 10⁵`;
  }
  return cellsPerMl.toLocaleString();
}

/**
 * Format small kinetic rates cleanly (e.g. 5e-9 -> 5.0 × 10⁻⁹)
 */
export function formatKineticRate(val: number): string {
  if (val === 0) return '0';
  if (Math.abs(val) < 1e-4) {
    const expStr = val.toExponential(1);
    const [coeff, exp] = expStr.split('e');
    const expNum = parseInt(exp, 10);
    const superscriptDigits: Record<string, string> = {
      '-': '⁻',
      '0': '⁰',
      '1': '¹',
      '2': '²',
      '3': '³',
      '4': '⁴',
      '5': '⁵',
      '6': '⁶',
      '7': '⁷',
      '8': '⁸',
      '9': '⁹',
    };
    const supExp = String(expNum)
      .split('')
      .map((c) => superscriptDigits[c] || c)
      .join('');
    return `${coeff} × 10${supExp}`;
  }
  return val.toFixed(3);
}
