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
}

export interface SimulationHistoryItem {
  time: number;
  viable_cell_density: number;
  nonviable_cell_density: number;
  cell_viability: number;
  nutrient_concentration: number;
  metabolite_concentration: number;
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
}

export interface FaultConfig {
  fault_type: 'nutrient_reduction' | 'cell_death_surge' | 'fouling_surge' | 'perfusion_disruption';
  severity: number;
  start_time: number;
  duration: number;
}
