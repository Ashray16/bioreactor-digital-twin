export interface BioreactorConfig {
  reactor_volume: number;
  initial_cell_density: number;
  target_cell_density: number;
  initial_viability: number;
  max_growth_rate: number;
  death_rate_base: number;
  max_sustainable_density: number;
  initial_nutrient: number;
  feed_nutrient_concentration: number;
  cell_nutrient_consumption_rate: number;
  monod_constant_nutrient: number;
  initial_metabolite: number;
  cell_metabolite_yield: number;
  metabolite_inhibition_constant: number;
  initial_product: number;
  specific_productivity_qp: number;
  perfusion_rate: number;
  min_perfusion_rate: number;
  max_perfusion_rate: number;
  filter_area: number;
  fouling_sensitivity: number;
  fouling_warning_threshold: number;
  temperature: number;
  ph: number;
  simulation_duration: number;
  timestep: number;
  control_enabled: boolean;
  control_mode: 'rule_based' | 'pid' | 'uncontrolled';
  nutrient_threshold_low?: number;
  metabolite_threshold_high?: number;
  fouling_threshold_high?: number;
  step_increment_vvd?: number;
}


export interface ControllerActionInfo {
  timestamp: number;
  action_type: string;
  reason: string;
  previous_perfusion: number;
  current_perfusion: number;
}

export interface BioreactorState {
  simulation_time: number;
  viable_cell_density: number;
  nonviable_cell_density: number;
  cell_viability: number;
  total_cell_density: number;
  nutrient_concentration: number;
  metabolite_concentration: number;
  product_concentration: number;
  reactor_volume: number;
  perfusion_rate: number;
  fouling_index: number;
  fouling_state: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  target_cell_density: number;
  target_achieved: boolean;
  time_to_target: number | null;
  controller_enabled: boolean;
  latest_controller_action: ControllerActionInfo | null;
  active_fault: string | null;
  controller_actions?: ControllerActionInfo[];
}

export interface SimulationHistoryItem {
  time: number;
  viable_cell_density: number;
  nonviable_cell_density: number;
  cell_viability: number;
  nutrient_concentration: number;
  metabolite_concentration: number;
  product_concentration: number;
  perfusion_rate: number;
  fouling_index: number;
  controller_enabled: boolean;
  active_fault?: string | null;
}

export interface SimulationResponse {
  config: BioreactorConfig;
  current_state: BioreactorState;
  history: SimulationHistoryItem[];
  summary_metrics: Record<string, any>;
  controller_actions?: ControllerActionInfo[];
}


export interface ScenarioComparisonItem {
  metric_name: string;
  uncontrolled_val: number;
  controlled_val: number;
  unit: string;
  improved: boolean;
  difference: number;
}

export interface ScenarioComparisonResponse {
  config: BioreactorConfig;
  uncontrolled_scenario: SimulationResponse;
  controlled_scenario: SimulationResponse;
  comparison_table: ScenarioComparisonItem[];
  total_media_consumed_uncontrolled_L: number;
  total_media_consumed_controlled_L: number;
  overall_outcome: 'IMPROVED' | 'TRADE-OFF' | 'NO_SIGNIFICANT_CHANGE' | 'DEGRADED';
  outcome_summary: string;
  divergence_cause?: string | null;
}

export interface FaultConfig {
  fault_type: 'nutrient_reduction' | 'cell_death_surge' | 'fouling_surge' | 'perfusion_disruption';
  severity: number;
  start_time: number;
  duration: number;
}

export interface QuantileBand {
  p5: number;
  p25: number;
  median: number;
  p75: number;
  p95: number;
}

export interface FanPoint {
  time: number;
  uncontrolled: QuantileBand;
  controlled: QuantileBand;
}

export interface DistributionStats {
  n: number;
  mean: number;
  median: number;
  std_dev: number;
  ci_90_low: number;
  ci_90_high: number;
  min: number;
  max: number;
  unit: string;
}

export interface HistogramBin {
  bin_index: number;
  bin_min: number;
  bin_max: number;
  bin_center: number;
  label: string;
  uncontrolled_count: number;
  controlled_count: number;
  uncontrolled_pct: number;
  controlled_pct: number;
}

export interface ParameterPerturbationMeta {
  parameter: string;
  symbol: string;
  range: string;
  nominal: number;
  unit: string;
}

export interface MonteCarloResponse {
  num_runs: number;
  simulation_duration_hours: number;
  timestep_hours: number;
  parameters_perturbed: ParameterPerturbationMeta[];
  fan_chart: FanPoint[];
  uncontrolled_stats: DistributionStats;
  controlled_stats: DistributionStats;
  histogram_bins: HistogramBin[];
  summary_insight: string;
}

export interface TornadoParameterResult {
  param_key: string;
  name: string;
  symbol: string;
  unit: string;
  category: string;
  nominal_value: number;
  low_value: number;
  high_value: number;
  vcc_low: number;
  vcc_high: number;
  delta_low: number;
  delta_high: number;
  swing: number;
  impact_share_pct: number;
}

export interface SensitivityResponse {
  analysis_type: string;
  perturbation_pct: number;
  baseline_vcc: number;
  unit: string;
  parameters: TornadoParameterResult[];
  total_swing: number;
  top_two_share_pct: number;
  insight_summary: string;
}
