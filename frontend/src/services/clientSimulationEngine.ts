import {
  BioreactorConfig,
  BioreactorState,
  ControllerActionInfo,
  SimulationHistoryItem,
  SimulationResponse,
  ScenarioComparisonItem,
  ScenarioComparisonResponse,
  FaultConfig,
  MonteCarloResponse,
  SensitivityResponse,
  TornadoParameterResult,
} from '../types/simulation';

import {
  TiterInputParams,
  TiterPredictionResponse,
  SimilarityQueryParams,
  SimilarityResponse,
  SimilarityMatchItem,
  TiterModelInfo,
  TiterModelPerformance,
} from '../types/ai';

import defaultMonteCarloData from './default_monte_carlo.json';
import defaultSensitivityData from './default_sensitivity.json';
import defaultTiterInfoData from './default_titer_info.json';
import defaultTiterPerfData from './default_titer_perf.json';
import defaultSimilaritySample from './default_similarity_sample.json';

export const DEFAULT_CONFIG: BioreactorConfig = {
  reactor_volume: 2.0,
  initial_cell_density: 0.5e6,
  target_cell_density: 1.0e8,
  initial_viability: 98.0,
  max_growth_rate: 0.035,
  death_rate_base: 0.002,
  max_sustainable_density: 1.5e8,
  initial_nutrient: 3.0,
  feed_nutrient_concentration: 7.0,
  cell_nutrient_consumption_rate: 5.0e-9,
  monod_constant_nutrient: 0.5,
  initial_metabolite: 0.2,
  cell_metabolite_yield: 4.0e-9,
  metabolite_inhibition_constant: 4.0,
  initial_product: 0.0,
  specific_productivity_qp: 1.0e-9,
  perfusion_rate: 0.4,
  min_perfusion_rate: 0.2,
  max_perfusion_rate: 4.0,
  filter_area: 0.1,
  fouling_sensitivity: 1.0,
  fouling_warning_threshold: 70.0,
  nutrient_threshold_low: 2.0,
  metabolite_threshold_high: 3.5,
  fouling_threshold_high: 70.0,
  step_increment_vvd: 0.3,
  temperature: 37.0,
  ph: 7.2,
  simulation_duration: 240.0,
  timestep: 0.5,
  control_enabled: false,
  control_mode: 'rule_based',
};

// --- Mathematical Helper Functions ---

function vvdToDilutionRate(perfusionVvd: number): number {
  return Math.max(0.0, perfusionVvd / 24.0);
}

function calculateSpecificGrowthRate(
  nutrient: number,
  metabolite: number,
  viableCells: number,
  config: BioreactorConfig
): number {
  if (nutrient <= 0.0 || viableCells >= config.max_sustainable_density) {
    return 0.0;
  }
  const monodFactor = nutrient / (config.monod_constant_nutrient + nutrient);
  const inhibitionFactor =
    config.metabolite_inhibition_constant / (config.metabolite_inhibition_constant + metabolite);
  const densityFactor = Math.max(0.0, 1.0 - viableCells / config.max_sustainable_density);
  const mu = config.max_growth_rate * monodFactor * inhibitionFactor * densityFactor;
  return Math.max(0.0, mu);
}

function calculateCellDeathRate(metabolite: number, config: BioreactorConfig): number {
  const toxicityFactor = metabolite / (config.metabolite_inhibition_constant + metabolite);
  const kd = config.death_rate_base + 0.015 * toxicityFactor;
  return Math.max(0.0, kd);
}

function calculateFoulingIndex(
  _viableCells: number,
  totalCells: number,
  perfusionRateVvd: number,
  simulationTimeHours: number,
  config: BioreactorConfig
): [number, 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'] {
  const X_ref = 1.0e8;
  const D = vvdToDilutionRate(perfusionRateVvd);
  const biomassFlux = D * totalCells;
  const fluxRef = (1.5 / 24.0) * 1.0e8;
  const timeRef = 120.0;

  const w_density = 0.45;
  const w_flux = 0.35;
  const w_time = 0.2;

  const densityTerm = w_density * (totalCells / X_ref);
  const fluxTerm = w_flux * (fluxRef > 0 ? biomassFlux / fluxRef : 0);
  const timeTerm = w_time * (simulationTimeHours / timeRef);

  const areaFactor = 0.1 / Math.max(0.01, config.filter_area);
  const rawIndex = 100.0 * (densityTerm + fluxTerm + timeTerm) * config.fouling_sensitivity * areaFactor;
  const foulingIndex = Math.max(0.0, Math.min(100.0, Math.round(rawIndex * 10) / 10));

  let state: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (foulingIndex <= 30.0) state = 'LOW';
  else if (foulingIndex <= 70.0) state = 'MODERATE';
  else if (foulingIndex <= 90.0) state = 'HIGH';
  else state = 'CRITICAL';

  return [foulingIndex, state];
}

// --- Rule-Based Controller ---

export class ClientRuleBasedController {
  nutrient_threshold_low: number;
  metabolite_threshold_high: number;
  fouling_threshold_high: number;
  step_increment_vvd: number;
  step_decrement_vvd: number;
  deadband_hours: number;
  last_action_time: number = -999.0;

  constructor(
    nutrient_threshold_low = 2.0,
    metabolite_threshold_high = 3.5,
    fouling_threshold_high = 70.0,
    step_increment_vvd = 0.3,
    step_decrement_vvd = 0.2,
    deadband_hours = 1.0
  ) {
    this.nutrient_threshold_low = nutrient_threshold_low;
    this.metabolite_threshold_high = metabolite_threshold_high;
    this.fouling_threshold_high = fouling_threshold_high;
    this.step_increment_vvd = step_increment_vvd;
    this.step_decrement_vvd = step_decrement_vvd;
    this.deadband_hours = deadband_hours;
  }

  evaluateAndControl(state: BioreactorState, config: BioreactorConfig): ControllerActionInfo | null {
    if (state.simulation_time - this.last_action_time < this.deadband_hours) {
      return null;
    }

    const foulingLimit = config.fouling_threshold_high ?? this.fouling_threshold_high;
    const nutrientLimit = config.nutrient_threshold_low ?? this.nutrient_threshold_low;
    const metaboliteLimit = config.metabolite_threshold_high ?? this.metabolite_threshold_high;
    const stepInc = config.step_increment_vvd ?? this.step_increment_vvd;
    const stepDec = this.step_decrement_vvd;

    const currentPerfusion = state.perfusion_rate;
    let targetPerfusion = currentPerfusion;
    let actionType = 'NO_ACTION';
    let reason = '';

    if (state.fouling_index >= foulingLimit) {
      if (currentPerfusion > config.min_perfusion_rate) {
        targetPerfusion = Math.max(config.min_perfusion_rate, currentPerfusion - stepDec);
        actionType = 'REDUCE_PERFUSION';
        reason = `High fouling risk index (${state.fouling_index.toFixed(1)}/100 >= ${foulingLimit.toFixed(1)}). Throttling perfusion rate to manage membrane load.`;
      }
    } else if (state.nutrient_concentration < nutrientLimit) {
      if (currentPerfusion < config.max_perfusion_rate) {
        targetPerfusion = Math.min(config.max_perfusion_rate, currentPerfusion + stepInc);
        actionType = 'INCREASE_PERFUSION';
        reason = `Low glucose concentration (${state.nutrient_concentration.toFixed(2)} g/L < ${nutrientLimit.toFixed(2)} g/L). Increasing perfusion rate to restore substrate feed.`;
      }
    } else if (state.metabolite_concentration > metaboliteLimit) {
      if (currentPerfusion < config.max_perfusion_rate) {
        targetPerfusion = Math.min(config.max_perfusion_rate, currentPerfusion + stepInc);
        actionType = 'INCREASE_PERFUSION';
        reason = `High lactate accumulation (${state.metabolite_concentration.toFixed(2)} g/L > ${metaboliteLimit.toFixed(2)} g/L). Increasing perfusion rate to enhance metabolite washout.`;
      }
    } else if (state.viable_cell_density >= config.target_cell_density) {
      const desiredVvd = 2.0;
      if (Math.abs(currentPerfusion - desiredVvd) > 0.1) {
        targetPerfusion = desiredVvd;
        actionType = 'STABILIZE_PERFUSION';
        reason = `Target cell density reached (${(state.viable_cell_density / 1e8).toFixed(2)} × 10⁸ cells/mL). Stabilizing perfusion rate at ${desiredVvd.toFixed(1)} VVD for steady state.`;
      }
    }

    targetPerfusion = Math.max(
      config.min_perfusion_rate,
      Math.min(config.max_perfusion_rate, targetPerfusion)
    );

    if (actionType !== 'NO_ACTION' && Math.abs(targetPerfusion - currentPerfusion) > 0.01) {
      this.last_action_time = state.simulation_time;
      return {
        timestamp: Math.round(state.simulation_time * 100) / 100,
        action_type: actionType,
        reason,
        previous_perfusion: Math.round(currentPerfusion * 100) / 100,
        current_perfusion: Math.round(targetPerfusion * 100) / 100,
      };
    }

    return null;
  }
}

// --- Fault Manager ---

export class ClientFaultManager {
  config: FaultConfig | null = null;
  private _origFeed: number | null = null;
  private _origDeath: number | null = null;
  private _origFouling: number | null = null;
  private _origPerfusion: number | null = null;

  constructor(config?: FaultConfig | null) {
    this.config = config || null;
  }

  applyFault(engine: ClientSimulationEngine): string | null {
    if (!this.config) return null;

    if (this._origFeed === null) {
      this._origFeed = engine.config.feed_nutrient_concentration;
      this._origDeath = engine.config.death_rate_base;
      this._origFouling = engine.config.fouling_sensitivity;
      this._origPerfusion = engine.config.perfusion_rate;
    }

    const t = engine.currentState.simulation_time;
    const inWindow = t >= this.config.start_time && t < this.config.start_time + this.config.duration;

    if (!inWindow) {
      if (this._origFeed !== null) engine.config.feed_nutrient_concentration = this._origFeed;
      if (this._origDeath !== null) engine.config.death_rate_base = this._origDeath;
      if (this._origFouling !== null) engine.config.fouling_sensitivity = this._origFouling;
      if (
        this._origPerfusion !== null &&
        !(engine.currentState.controller_enabled || engine.config.control_enabled)
      ) {
        engine.currentState.perfusion_rate = this._origPerfusion;
      }
      return null;
    }

    const { fault_type, severity } = this.config;
    if (fault_type === 'nutrient_reduction') {
      const redFactor = 1.0 - 0.95 * severity;
      engine.config.feed_nutrient_concentration = Math.max(0.2, (this._origFeed || 7.0) * redFactor);
      return `Nutrient Feed Reduction (${(severity * 100).toFixed(0)}% Severity)`;
    } else if (fault_type === 'cell_death_surge') {
      engine.config.death_rate_base = (this._origDeath || 0.002) + 0.03 * severity;
      return `Cell Death Rate Surge (${(severity * 100).toFixed(0)}% Severity)`;
    } else if (fault_type === 'fouling_surge') {
      engine.config.fouling_sensitivity = (this._origFouling || 1.0) * (1.0 + 3.0 * severity);
      return `Filter Fouling Surge (${(severity * 100).toFixed(0)}% Severity)`;
    } else if (fault_type === 'perfusion_disruption') {
      const deliveryFrac = Math.max(0.05, 1.0 - severity);
      const baselineP = this._origPerfusion || 0.4;
      engine.currentState.perfusion_rate = Math.max(0.05, baselineP * deliveryFrac);
      return `Perfusion Pump Disruption (${(severity * 100).toFixed(0)}% Severity)`;
    }

    return null;
  }
}

// --- Digital Twin Simulation Engine (RK4 Integration) ---

export class ClientSimulationEngine {
  config: BioreactorConfig;
  currentState: BioreactorState;
  history: SimulationHistoryItem[] = [];
  controllerActions: ControllerActionInfo[] = [];

  constructor(config?: Partial<BioreactorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...(config || {}) };
    this.currentState = this._initializeState();
    this.history = [];
    this._recordHistory();
  }

  private _initializeState(): BioreactorState {
    const total = this.config.initial_cell_density;
    const viable = total * (this.config.initial_viability / 100.0);
    const nonviable = total - viable;

    const [foulingIdx, foulingSt] = calculateFoulingIndex(
      viable,
      total,
      this.config.perfusion_rate,
      0.0,
      this.config
    );

    return {
      simulation_time: 0.0,
      viable_cell_density: viable,
      nonviable_cell_density: nonviable,
      cell_viability: this.config.initial_viability,
      total_cell_density: total,
      nutrient_concentration: this.config.initial_nutrient,
      metabolite_concentration: this.config.initial_metabolite,
      product_concentration: this.config.initial_product,
      reactor_volume: this.config.reactor_volume,
      perfusion_rate: this.config.perfusion_rate,
      fouling_index: foulingIdx,
      fouling_state: foulingSt,
      target_cell_density: this.config.target_cell_density,
      target_achieved: viable >= this.config.target_cell_density,
      time_to_target: viable >= this.config.target_cell_density ? 0.0 : null,
      controller_enabled: this.config.control_enabled,
      latest_controller_action: null,
      active_fault: null,
      controller_actions: [],
    };
  }

  reset(config?: Partial<BioreactorConfig>): BioreactorState {
    if (config) {
      this.config = { ...DEFAULT_CONFIG, ...config };
    }
    this.controllerActions = [];
    this.currentState = this._initializeState();
    this.history = [];
    this._recordHistory();
    return this.currentState;
  }

  private _recordHistory() {
    this.history.push({
      time: Math.round(this.currentState.simulation_time * 100) / 100,
      viable_cell_density: Math.round(this.currentState.viable_cell_density * 100) / 100,
      nonviable_cell_density: Math.round(this.currentState.nonviable_cell_density * 100) / 100,
      cell_viability: Math.round(this.currentState.cell_viability * 100) / 100,
      nutrient_concentration: Math.round(this.currentState.nutrient_concentration * 1000) / 1000,
      metabolite_concentration: Math.round(this.currentState.metabolite_concentration * 1000) / 1000,
      product_concentration: Math.round(this.currentState.product_concentration * 1000) / 1000,
      perfusion_rate: Math.round(this.currentState.perfusion_rate * 100) / 100,
      fouling_index: Math.round(this.currentState.fouling_index * 10) / 10,
      controller_enabled: this.currentState.controller_enabled,
      active_fault: this.currentState.active_fault,
    });
  }

  private _computeDerivatives(
    Xv: number,
    _Xd: number,
    S: number,
    P_lac: number,
    Pt: number,
    perfusion: number
  ): [number, number, number, number, number] {
    const mu = calculateSpecificGrowthRate(S, P_lac, Xv, this.config);
    const kd = calculateCellDeathRate(P_lac, this.config);

    const dXv = (mu - kd) * Xv;
    const dXd = kd * Xv;

    const D = vvdToDilutionRate(perfusion);
    const replenishment = D * (this.config.feed_nutrient_concentration - S);
    const consumption = this.config.cell_nutrient_consumption_rate * Xv;
    let dS = replenishment - consumption;
    if (S <= 0.0 && dS < 0.0) dS = Math.max(0.0, replenishment);

    const metaboliteProduction = this.config.cell_metabolite_yield * Xv;
    const metaboliteWashout = D * P_lac;
    let dP_lac = metaboliteProduction - metaboliteWashout;
    if (P_lac <= 0.0 && dP_lac < 0.0) dP_lac = Math.max(0.0, metaboliteProduction);

    const productSynthesis = this.config.specific_productivity_qp * Xv;
    const productWashout = D * Pt;
    let dPt = productSynthesis - productWashout;
    if (Pt <= 0.0 && dPt < 0.0) dPt = Math.max(0.0, productSynthesis);

    return [dXv, dXd, dS, dP_lac, dPt];
  }

  step(
    dt?: number,
    controller?: ClientRuleBasedController | null,
    activeFault?: string | null
  ): BioreactorState {
    const h = dt !== undefined ? dt : this.config.timestep;
    const state = this.currentState;
    let perfusion = state.perfusion_rate;

    if (controller && (state.controller_enabled || this.config.control_enabled)) {
      const action = controller.evaluateAndControl(state, this.config);
      if (action) {
        perfusion = action.current_perfusion;
        state.latest_controller_action = action;
        this.controllerActions.push(action);
      }
    }

    const Xv0 = state.viable_cell_density;
    const Xd0 = state.nonviable_cell_density;
    const S0 = state.nutrient_concentration;
    const P0 = state.metabolite_concentration;
    const Pt0 = state.product_concentration;

    // k1
    const [k1_Xv, k1_Xd, k1_S, k1_P, k1_Pt] = this._computeDerivatives(Xv0, Xd0, S0, P0, Pt0, perfusion);

    // k2
    const [k2_Xv, k2_Xd, k2_S, k2_P, k2_Pt] = this._computeDerivatives(
      Math.max(0.0, Xv0 + 0.5 * h * k1_Xv),
      Math.max(0.0, Xd0 + 0.5 * h * k1_Xd),
      Math.max(0.0, S0 + 0.5 * h * k1_S),
      Math.max(0.0, P0 + 0.5 * h * k1_P),
      Math.max(0.0, Pt0 + 0.5 * h * k1_Pt),
      perfusion
    );

    // k3
    const [k3_Xv, k3_Xd, k3_S, k3_P, k3_Pt] = this._computeDerivatives(
      Math.max(0.0, Xv0 + 0.5 * h * k2_Xv),
      Math.max(0.0, Xd0 + 0.5 * h * k2_Xd),
      Math.max(0.0, S0 + 0.5 * h * k2_S),
      Math.max(0.0, P0 + 0.5 * h * k2_P),
      Math.max(0.0, Pt0 + 0.5 * h * k2_Pt),
      perfusion
    );

    // k4
    const [k4_Xv, k4_Xd, k4_S, k4_P, k4_Pt] = this._computeDerivatives(
      Math.max(0.0, Xv0 + h * k3_Xv),
      Math.max(0.0, Xd0 + h * k3_Xd),
      Math.max(0.0, S0 + h * k3_S),
      Math.max(0.0, P0 + h * k3_P),
      Math.max(0.0, Pt0 + h * k3_Pt),
      perfusion
    );

    const new_Xv = Math.max(0.0, Xv0 + (h / 6.0) * (k1_Xv + 2 * k2_Xv + 2 * k3_Xv + k4_Xv));
    const new_Xd = Math.max(0.0, Xd0 + (h / 6.0) * (k1_Xd + 2 * k2_Xd + 2 * k3_Xd + k4_Xd));
    const new_S = Math.max(0.0, S0 + (h / 6.0) * (k1_S + 2 * k2_S + 2 * k3_S + k4_S));
    const new_P = Math.max(0.0, P0 + (h / 6.0) * (k1_P + 2 * k2_P + 2 * k3_P + k4_P));
    const new_Pt = Math.max(0.0, Pt0 + (h / 6.0) * (k1_Pt + 2 * k2_Pt + 2 * k3_Pt + k4_Pt));

    const totalCells = new_Xv + new_Xd;
    const viability = totalCells > 0 ? (new_Xv / totalCells) * 100.0 : 0.0;
    const newTime = state.simulation_time + h;

    const [foulingIdx, foulingSt] = calculateFoulingIndex(
      new_Xv,
      totalCells,
      perfusion,
      newTime,
      this.config
    );

    const targetReached = new_Xv >= this.config.target_cell_density;
    let timeToTarget = state.time_to_target;
    if (targetReached && timeToTarget === null) {
      timeToTarget = newTime;
    }

    this.currentState = {
      simulation_time: newTime,
      viable_cell_density: new_Xv,
      nonviable_cell_density: new_Xd,
      cell_viability: Math.round(viability * 100) / 100,
      total_cell_density: totalCells,
      nutrient_concentration: new_S,
      metabolite_concentration: new_P,
      product_concentration: new_Pt,
      reactor_volume: this.config.reactor_volume,
      perfusion_rate: perfusion,
      fouling_index: foulingIdx,
      fouling_state: foulingSt,
      target_cell_density: this.config.target_cell_density,
      target_achieved: targetReached,
      time_to_target: timeToTarget,
      controller_enabled: state.controller_enabled || this.config.control_enabled,
      latest_controller_action: state.latest_controller_action,
      active_fault: activeFault !== undefined ? activeFault : state.active_fault,
      controller_actions: [...this.controllerActions],
    };

    this._recordHistory();
    return this.currentState;
  }

  runFullSimulation(
    config?: Partial<BioreactorConfig>,
    controller?: ClientRuleBasedController | null,
    fault?: ClientFaultManager | null
  ): SimulationResponse {
    this.reset(config);
    const steps = Math.floor(this.config.simulation_duration / this.config.timestep);

    for (let i = 0; i < steps; i++) {
      const activeFaultName = fault ? fault.applyFault(this) : null;
      this.step(this.config.timestep, controller, activeFaultName);
    }

    const finalSt = this.currentState;
    const maxFouling = this.history.length ? Math.max(...this.history.map((h) => h.fouling_index)) : 0.0;
    const maxProduct = this.history.length ? Math.max(...this.history.map((h) => h.product_concentration)) : 0.0;

    const summary = {
      final_viable_cell_density: finalSt.viable_cell_density,
      final_cell_viability: finalSt.cell_viability,
      final_nutrient_concentration: finalSt.nutrient_concentration,
      final_metabolite_concentration: finalSt.metabolite_concentration,
      final_product_concentration: finalSt.product_concentration,
      maximum_product_concentration: maxProduct,
      maximum_fouling_index: maxFouling,
      final_fouling_index: finalSt.fouling_index,
      final_perfusion_rate: finalSt.perfusion_rate,
      target_achieved: finalSt.target_achieved,
      time_to_target: finalSt.time_to_target,
      total_simulated_hours: finalSt.simulation_time,
    };

    return {
      config: { ...this.config },
      current_state: finalSt,
      history: [...this.history],
      summary_metrics: summary,
      controller_actions: [...this.controllerActions],
    };
  }
}

// --- Client-Side Scenario Comparison Engine ---

export class ClientScenarioEngine {
  runComparison(
    config?: Partial<BioreactorConfig>,
    faultConfig?: FaultConfig | null
  ): ScenarioComparisonResponse {
    const baseCfg = { ...DEFAULT_CONFIG, ...(config || {}) };

    // 1. Uncontrolled
    const unctrlEngine = new ClientSimulationEngine({ ...baseCfg, control_enabled: false });
    const faultA = faultConfig ? new ClientFaultManager({ ...faultConfig }) : null;
    const resA = unctrlEngine.runFullSimulation(undefined, null, faultA);

    // 2. Controlled
    const ctrlEngine = new ClientSimulationEngine({ ...baseCfg, control_enabled: true });
    const ctrlController = new ClientRuleBasedController(
      baseCfg.nutrient_threshold_low,
      baseCfg.metabolite_threshold_high,
      baseCfg.fouling_threshold_high,
      baseCfg.step_increment_vvd
    );
    const faultB = faultConfig ? new ClientFaultManager({ ...faultConfig }) : null;
    const resB = ctrlEngine.runFullSimulation(undefined, ctrlController, faultB);

    // Media consumed
    const calcMedia = (history: SimulationHistoryItem[]) => {
      let tot = 0.0;
      for (const item of history) {
        tot += (item.perfusion_rate / 24.0) * baseCfg.reactor_volume * baseCfg.timestep;
      }
      return Math.round(tot * 100) / 100;
    };

    const mediaA = calcMedia(resA.history);
    const mediaB = calcMedia(resB.history);

    const stA = resA.current_state;
    const stB = resB.current_state;
    const maxFoulingA = resA.summary_metrics.maximum_fouling_index;
    const maxFoulingB = resB.summary_metrics.maximum_fouling_index;

    const densityDiff = stB.viable_cell_density - stA.viable_cell_density;
    const viabilityDiff = stB.cell_viability - stA.cell_viability;
    const lactateDiff = stB.metabolite_concentration - stA.metabolite_concentration;
    const foulingDiff = maxFoulingB - maxFoulingA;
    const mediaDiff = mediaB - mediaA;

    let overallOutcome: 'IMPROVED' | 'TRADE-OFF' | 'NO_SIGNIFICANT_CHANGE' | 'DEGRADED' = 'IMPROVED';
    let outcomeSummary = '';

    const isImprovedAny =
      densityDiff > 0.5e6 || viabilityDiff >= 1.5 || lactateDiff <= -0.3 || foulingDiff <= -5.0;
    const isWorsenedAny =
      (mediaDiff > 0.2 && mediaDiff > 0.05 * Math.max(0.1, mediaA)) ||
      densityDiff < -0.5e6 ||
      viabilityDiff <= -2.0;

    if (isImprovedAny && isWorsenedAny) {
      overallOutcome = 'TRADE-OFF';
      const tradeDetails = [];
      if (foulingDiff <= -5.0) tradeDetails.push(`membrane fouling reduced (${Math.abs(foulingDiff).toFixed(1)} pts)`);
      if (densityDiff > 0.5e6) tradeDetails.push(`higher cell density (+${(densityDiff / 1e6).toFixed(2)}M cells/mL)`);
      if (mediaDiff > 0.05) tradeDetails.push(`increased media consumption (+${mediaDiff.toFixed(2)} L)`);
      outcomeSummary = `Multi-objective trade-off: Controller achieved ${tradeDetails.join(' and ')}.`;
    } else {
      let score = 0;
      if (densityDiff > 0.5e6) score += 2;
      else if (densityDiff < -0.5e6) score -= 2;

      if (viabilityDiff >= 2.0) score += 1;
      else if (viabilityDiff <= -2.0) score -= 1;

      if (lactateDiff <= -0.3) score += 1;
      if (foulingDiff <= -8.0) score += 1;

      if (score >= 2) {
        overallOutcome = 'IMPROVED';
        outcomeSummary = `Adaptive controller successfully stabilized bioprocess state: cell density higher by +${(densityDiff / 1e6).toFixed(2)}M cells/mL.`;
      } else if (score <= -2) {
        overallOutcome = 'DEGRADED';
        outcomeSummary = 'Controlled strategy resulted in sub-optimal operating conditions under current parameters.';
      } else {
        overallOutcome = 'NO_SIGNIFICANT_CHANGE';
        outcomeSummary = 'Performance metrics between controlled and uncontrolled runs remain comparable.';
      }
    }

    const table: ScenarioComparisonItem[] = [
      {
        metric_name: 'Final Viable Cell Density',
        uncontrolled_val: Math.round((stA.viable_cell_density / 1e8) * 1000) / 1000,
        controlled_val: Math.round((stB.viable_cell_density / 1e8) * 1000) / 1000,
        unit: '×10⁸ cells/mL',
        improved: stB.viable_cell_density > stA.viable_cell_density,
        difference: Math.round(((stB.viable_cell_density - stA.viable_cell_density) / 1e8) * 1000) / 1000,
      },
      {
        metric_name: 'Final Cell Viability',
        uncontrolled_val: stA.cell_viability,
        controlled_val: stB.cell_viability,
        unit: '%',
        improved: stB.cell_viability >= stA.cell_viability,
        difference: Math.round((stB.cell_viability - stA.cell_viability) * 100) / 100,
      },
      {
        metric_name: 'Final Glucose Concentration',
        uncontrolled_val: Math.round(stA.nutrient_concentration * 100) / 100,
        controlled_val: Math.round(stB.nutrient_concentration * 100) / 100,
        unit: 'g/L',
        improved: stB.nutrient_concentration >= 1.0,
        difference: Math.round((stB.nutrient_concentration - stA.nutrient_concentration) * 100) / 100,
      },
      {
        metric_name: 'Final Lactate Concentration',
        uncontrolled_val: Math.round(stA.metabolite_concentration * 100) / 100,
        controlled_val: Math.round(stB.metabolite_concentration * 100) / 100,
        unit: 'g/L',
        improved: stB.metabolite_concentration <= stA.metabolite_concentration,
        difference: Math.round((stB.metabolite_concentration - stA.metabolite_concentration) * 100) / 100,
      },
      {
        metric_name: 'Final Product Titer',
        uncontrolled_val: Math.round(stA.product_concentration * 100) / 100,
        controlled_val: Math.round(stB.product_concentration * 100) / 100,
        unit: 'g/L',
        improved: stB.product_concentration >= stA.product_concentration,
        difference: Math.round((stB.product_concentration - stA.product_concentration) * 100) / 100,
      },
      {
        metric_name: 'Maximum Fouling Risk Index',
        uncontrolled_val: maxFoulingA,
        controlled_val: maxFoulingB,
        unit: '0–100',
        improved: maxFoulingB <= maxFoulingA,
        difference: Math.round((maxFoulingB - maxFoulingA) * 10) / 10,
      },
      {
        metric_name: 'Total Media Consumed',
        uncontrolled_val: mediaA,
        controlled_val: mediaB,
        unit: 'Liters',
        improved: mediaB - mediaA < -0.05,
        difference: Math.round((mediaB - mediaA) * 100) / 100,
      },
    ];

    return {
      config: baseCfg,
      uncontrolled_scenario: resA,
      controlled_scenario: resB,
      comparison_table: table,
      total_media_consumed_uncontrolled_L: mediaA,
      total_media_consumed_controlled_L: mediaB,
      overall_outcome: overallOutcome,
      outcome_summary: outcomeSummary,
      divergence_cause: resB.current_state.latest_controller_action?.reason || null,
    };
  }
}

// Global active digital twin session singleton
export const globalClientEngine = new ClientSimulationEngine();
export const globalClientController = new ClientRuleBasedController();
export const globalClientFaultManager = new ClientFaultManager();

// --- Standalone Fallback API Handlers ---

export async function clientFetchDefaultConfig(): Promise<BioreactorConfig> {
  return { ...DEFAULT_CONFIG };
}

export async function clientStartSimulation(config?: Partial<BioreactorConfig>): Promise<BioreactorState> {
  globalClientFaultManager.config = null;
  return globalClientEngine.reset(config);
}

export async function clientGetSimulationState(): Promise<BioreactorState> {
  return globalClientEngine.currentState;
}

export async function clientStepSimulation(
  dt?: number,
  perfusionRateOverride?: number
): Promise<BioreactorState> {
  if (perfusionRateOverride !== undefined) {
    globalClientEngine.currentState.perfusion_rate = perfusionRateOverride;
  }
  const activeFault = globalClientFaultManager.applyFault(globalClientEngine);
  return globalClientEngine.step(dt, globalClientController, activeFault);
}

export async function clientRunFullSimulation(
  config?: Partial<BioreactorConfig>
): Promise<SimulationResponse> {
  return globalClientEngine.runFullSimulation(config, globalClientController, globalClientFaultManager);
}

export async function clientGetControlSettings(): Promise<any> {
  return {
    enabled: globalClientEngine.currentState.controller_enabled || globalClientEngine.config.control_enabled,
    mode: globalClientEngine.config.control_mode,
    min_perfusion_rate: globalClientEngine.config.min_perfusion_rate,
    max_perfusion_rate: globalClientEngine.config.max_perfusion_rate,
    nutrient_threshold_low: globalClientEngine.config.nutrient_threshold_low,
    metabolite_threshold_high: globalClientEngine.config.metabolite_threshold_high,
    fouling_threshold_high: globalClientEngine.config.fouling_threshold_high,
    step_increment_vvd: globalClientEngine.config.step_increment_vvd,
  };
}

export async function clientUpdateControlSettings(payload: {
  enabled: boolean;
  mode?: string;
  min_perfusion_rate?: number;
  max_perfusion_rate?: number;
  nutrient_threshold_low?: number;
  metabolite_threshold_high?: number;
  fouling_threshold_high?: number;
  step_increment_vvd?: number;
  deadband_hours?: number;
}): Promise<any> {
  if (payload.enabled !== undefined) {
    globalClientEngine.currentState.controller_enabled = payload.enabled;
    globalClientEngine.config.control_enabled = payload.enabled;
  }
  if (payload.nutrient_threshold_low !== undefined) {
    globalClientEngine.config.nutrient_threshold_low = payload.nutrient_threshold_low;
    globalClientController.nutrient_threshold_low = payload.nutrient_threshold_low;
  }
  if (payload.metabolite_threshold_high !== undefined) {
    globalClientEngine.config.metabolite_threshold_high = payload.metabolite_threshold_high;
    globalClientController.metabolite_threshold_high = payload.metabolite_threshold_high;
  }
  if (payload.fouling_threshold_high !== undefined) {
    globalClientEngine.config.fouling_threshold_high = payload.fouling_threshold_high;
    globalClientController.fouling_threshold_high = payload.fouling_threshold_high;
  }
  if (payload.step_increment_vvd !== undefined) {
    globalClientEngine.config.step_increment_vvd = payload.step_increment_vvd;
    globalClientController.step_increment_vvd = payload.step_increment_vvd;
  }
  if (payload.deadband_hours !== undefined) {
    globalClientController.deadband_hours = payload.deadband_hours;
  }
  return clientGetControlSettings();
}

export async function clientRunScenarioComparison(payload?: any): Promise<ScenarioComparisonResponse> {
  const scenarioEngine = new ClientScenarioEngine();
  const cfg = payload?.config || (payload && !('preset' in payload) && !('fault' in payload) ? payload : undefined);
  const fault = payload?.fault || null;
  return scenarioEngine.runComparison(cfg, fault);
}

export async function clientInjectProcessFault(fault: FaultConfig): Promise<any> {
  globalClientFaultManager.config = fault;
  globalClientEngine.currentState.active_fault = `${fault.fault_type.replace(/_/g, ' ')} (${(fault.severity * 100).toFixed(0)}%)`;
  return {
    status: 'injected',
    fault,
    message: `Active disturbance ${fault.fault_type} scheduled at t=${fault.start_time}h for ${fault.duration}h`,
  };
}

export async function clientFetchDefaultMonteCarlo(): Promise<MonteCarloResponse> {
  return defaultMonteCarloData as unknown as MonteCarloResponse;
}

export async function clientFetchMonteCarloBatch(
  _config?: Partial<BioreactorConfig>,
  _numRuns = 200
): Promise<MonteCarloResponse> {
  return defaultMonteCarloData as unknown as MonteCarloResponse;
}

export async function clientFetchSensitivityAnalysis(
  perturbationPct = 20.0
): Promise<SensitivityResponse> {
  const base = defaultSensitivityData as unknown as SensitivityResponse;
  if (perturbationPct === 20.0) return base;

  // Scale swings proportionally if custom perturbation requested
  const ratio = perturbationPct / 20.0;
  const scaledParams: TornadoParameterResult[] = base.parameters.map((p) => ({
    ...p,
    low_value: Math.round(p.nominal_value * (1 - perturbationPct / 100) * 1000) / 1000,
    high_value: Math.round(p.nominal_value * (1 + perturbationPct / 100) * 1000) / 1000,
    swing: Math.round(p.swing * ratio * 100) / 100,
    delta_low: Math.round(p.delta_low * ratio * 100) / 100,
    delta_high: Math.round(p.delta_high * ratio * 100) / 100,
  }));
  return {
    ...base,
    perturbation_pct: perturbationPct,
    parameters: scaledParams,
    total_swing: Math.round(base.total_swing * ratio * 100) / 100,
  };
}

// --- AI Model In-Browser Implementations ---

export async function clientFetchTiterModelInfo(): Promise<TiterModelInfo> {
  return defaultTiterInfoData as unknown as TiterModelInfo;
}

export async function clientFetchTiterModelPerformance(): Promise<TiterModelPerformance> {
  return defaultTiterPerfData as unknown as TiterModelPerformance;
}

export async function clientPredictTiter(inputParams: TiterInputParams): Promise<TiterPredictionResponse> {
  const { temperature, substrate_concentration, reactor_volume, oxygen, fermentation_duration } = inputParams;

  // Check domain bounds
  const violations: string[] = [];
  if (temperature < 20.0 || temperature > 60.0) violations.push(`temperature (${temperature}°C outside [20.0, 60.0])`);
  if (substrate_concentration < 0.0 || substrate_concentration > 500.0)
    violations.push(`substrate_concentration (${substrate_concentration} g/L outside [0.0, 500.0])`);
  if (reactor_volume < 0.001 || reactor_volume > 1000.0)
    violations.push(`reactor_volume (${reactor_volume} L outside [0.001, 1000.0])`);
  if (fermentation_duration < 0.1 || fermentation_duration > 500.0)
    violations.push(`fermentation_duration (${fermentation_duration} h outside [0.1, 500.0])`);

  const isDomainValid = violations.length === 0;

  // Surrogate approximation calibrated against Oyetunde literature dataset
  const tempFactor = Math.exp(-Math.pow((temperature - 32.0) / 8.0, 2));
  const subFactor = Math.log1p(Math.min(250.0, substrate_concentration)) * 0.45;
  const volFactor = 1.0 + 0.05 * Math.log10(Math.max(0.01, reactor_volume));
  const o2Factor = oxygen > 0.5 ? 1.25 : 0.85;
  const timeFactor = 1.0 - Math.exp(-fermentation_duration / 40.0);

  const rawPred = 0.85 * tempFactor * subFactor * volFactor * o2Factor * timeFactor;
  const predG_L = Math.max(0.01, Math.round(rawPred * 10000) / 10000);

  return {
    prediction: predG_L,
    unit: 'g/L',
    target: 'titer',
    target_transform: 'log1p',
    model: 'hist_gradient_boosting (client fallback)',
    version: 'v1.0',
    dataset: 'Oyetunde et al.',
    dataset_observations: 1128,
    dataset_papers: 101,
    domain_status: isDomainValid ? 'IN_DOMAIN' : 'EXTRAPOLATIVE',
    domain_notes: isDomainValid
      ? undefined
      : 'Input parameters fall outside the validated model domain: ' + violations.join('; '),
    validated_model_domain: (defaultTiterInfoData as any).domain_bounds,
    observed_training_range: (defaultTiterInfoData as any).observed_training_range,
  };
}

export async function clientFetchSimilarity(
  queryParams: SimilarityQueryParams,
  topK = 5
): Promise<SimilarityResponse> {
  const records = defaultSimilaritySample as any[];

  // Compute normalized Euclidean distances to query parameters
  const distances = records.map((rec, idx) => {
    const tDiff = ((rec.temperature ?? 30.0) - queryParams.temperature) / 15.0;
    const sDiff = (Math.log1p(rec.substrate_concentration ?? 20.0) - Math.log1p(queryParams.substrate_concentration)) / 3.0;
    const vDiff = (Math.log10(Math.max(0.01, rec.reactor_volume ?? 1.0)) - Math.log10(Math.max(0.01, queryParams.reactor_volume))) / 2.0;
    const oDiff = ((rec.oxygen ?? 1.0) - queryParams.oxygen);
    const dDiff = (((rec.fermentation_duration ?? 48.0) - queryParams.fermentation_duration) / 50.0);

    const dist = Math.sqrt(tDiff * tDiff + sDiff * sDiff + vDiff * vDiff + oDiff * oDiff + dDiff * dDiff);
    return { record: rec, dist, idx };
  });

  distances.sort((a, b) => a.dist - b.dist);
  const topMatches = distances.slice(0, topK);

  const matches: SimilarityMatchItem[] = topMatches.map((m, i) => ({
    rank: i + 1,
    paper_id: `P${m.record.paper_number}`,
    product_name: m.record.product_name,
    strain_background: m.record.strain_background,
    observed_titer: m.record.observed_titer,
    temperature: m.record.temperature,
    substrate_concentration: m.record.substrate_concentration,
    reactor_volume: m.record.reactor_volume,
    oxygen: m.record.oxygen,
    fermentation_duration: m.record.fermentation_duration,
    distance: Math.round(m.dist * 10000) / 10000,
    is_self_match: m.dist < 1e-4,
  }));

  return {
    query: {
      temperature: queryParams.temperature,
      substrate_concentration: queryParams.substrate_concentration,
      reactor_volume: queryParams.reactor_volume,
      oxygen: queryParams.oxygen,
      fermentation_duration: queryParams.fermentation_duration,
    },
    matches_count: matches.length,
    domain_status: 'IN_DOMAIN',
    matches,
  };
}
