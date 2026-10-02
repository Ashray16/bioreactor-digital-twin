import {
  BioreactorConfig,
  BioreactorState,
  SimulationResponse,
  ScenarioComparisonResponse,
  FaultConfig,
  MonteCarloResponse,
  SensitivityResponse,
} from '../types/simulation';

import {
  clientFetchDefaultConfig,
  clientStartSimulation,
  clientGetSimulationState,
  clientStepSimulation,
  clientRunFullSimulation,
  clientGetControlSettings,
  clientUpdateControlSettings,
  clientRunScenarioComparison,
  clientInjectProcessFault,
  clientFetchDefaultMonteCarlo,
  clientFetchMonteCarloBatch,
  clientFetchSensitivityAnalysis,
} from './clientSimulationEngine';

const BACKEND_BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '')).replace(/\/$/, '');
const API_BASE = `${BACKEND_BASE}/api/v1/simulation`;
const ANALYTICS_API_BASE = `${BACKEND_BASE}/api/v1/analytics`;

let useClientEngine = !BACKEND_BASE && !import.meta.env.DEV;

export function isUsingClientFallback(): boolean {
  return useClientEngine;
}

export function setUsingClientFallback(val: boolean): void {
  useClientEngine = val;
}

export async function fetchDefaultConfig(): Promise<BioreactorConfig> {
  if (useClientEngine) {
    return clientFetchDefaultConfig();
  }
  try {
    const res = await fetch(`${API_BASE}/config/default`);
    if (!res.ok) {
      console.warn(`[Digital Twin] Backend returned HTTP ${res.status}. Falling back to in-browser simulation engine.`);
      useClientEngine = true;
      return clientFetchDefaultConfig();
    }
    return await res.json();
  } catch (err) {
    console.warn('[Digital Twin] Backend unreachable. Falling back to in-browser simulation engine:', err);
    useClientEngine = true;
    return clientFetchDefaultConfig();
  }
}

export async function startSimulation(config?: Partial<BioreactorConfig>): Promise<BioreactorState> {
  if (useClientEngine) {
    return clientStartSimulation(config);
  }
  try {
    const res = await fetch(`${API_BASE}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config || {}),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    useClientEngine = true;
    return clientStartSimulation(config);
  }
}

export async function getSimulationState(): Promise<BioreactorState> {
  if (useClientEngine) {
    return clientGetSimulationState();
  }
  try {
    const res = await fetch(`${API_BASE}/state`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    useClientEngine = true;
    return clientGetSimulationState();
  }
}

export async function stepSimulation(dt?: number, perfusionRateOverride?: number): Promise<BioreactorState> {
  if (useClientEngine) {
    return clientStepSimulation(dt, perfusionRateOverride);
  }
  try {
    const payload: Record<string, any> = {};
    if (dt !== undefined) payload.dt = dt;
    if (perfusionRateOverride !== undefined) payload.perfusion_rate_override = perfusionRateOverride;

    const res = await fetch(`${API_BASE}/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    useClientEngine = true;
    return clientStepSimulation(dt, perfusionRateOverride);
  }
}

export async function runFullSimulation(config?: Partial<BioreactorConfig>): Promise<SimulationResponse> {
  if (useClientEngine) {
    return clientRunFullSimulation(config);
  }
  try {
    const res = await fetch(`${API_BASE}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config || {}),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    useClientEngine = true;
    return clientRunFullSimulation(config);
  }
}

export async function getControlSettings(): Promise<any> {
  if (useClientEngine) {
    return clientGetControlSettings();
  }
  try {
    const res = await fetch(`${API_BASE}/control`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    useClientEngine = true;
    return clientGetControlSettings();
  }
}

export async function updateControlSettings(payload: {
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
  if (useClientEngine) {
    return clientUpdateControlSettings(payload);
  }
  try {
    const res = await fetch(`${API_BASE}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    useClientEngine = true;
    return clientUpdateControlSettings(payload);
  }
}

export async function runScenarioComparison(
  payload?: { preset?: string; config?: Partial<BioreactorConfig>; fault?: FaultConfig } | Partial<BioreactorConfig>
): Promise<ScenarioComparisonResponse> {
  if (useClientEngine) {
    return clientRunScenarioComparison(payload);
  }
  try {
    const body = payload && ('preset' in payload || 'fault' in payload || 'config' in payload) ? payload : { config: payload };
    const res = await fetch(`${API_BASE}/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    useClientEngine = true;
    return clientRunScenarioComparison(payload);
  }
}

export async function runDemoScenario(): Promise<any> {
  if (useClientEngine) {
    return clientRunScenarioComparison();
  }
  try {
    const res = await fetch(`${API_BASE}/demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    useClientEngine = true;
    return clientRunScenarioComparison();
  }
}

export async function injectProcessFault(fault: FaultConfig): Promise<any> {
  if (useClientEngine) {
    return clientInjectProcessFault(fault);
  }
  try {
    const res = await fetch(`${API_BASE}/fault`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fault),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    useClientEngine = true;
    return clientInjectProcessFault(fault);
  }
}

export async function fetchDefaultMonteCarlo(): Promise<MonteCarloResponse> {
  if (useClientEngine) {
    return clientFetchDefaultMonteCarlo();
  }
  try {
    const res = await fetch(`${ANALYTICS_API_BASE}/monte-carlo/default`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    useClientEngine = true;
    return clientFetchDefaultMonteCarlo();
  }
}

export async function fetchMonteCarloBatch(
  config?: Partial<BioreactorConfig>,
  numRuns: number = 200
): Promise<MonteCarloResponse> {
  if (useClientEngine) {
    return clientFetchMonteCarloBatch(config, numRuns);
  }
  try {
    const res = await fetch(`${ANALYTICS_API_BASE}/monte-carlo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, num_runs: numRuns }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    useClientEngine = true;
    return clientFetchMonteCarloBatch(config, numRuns);
  }
}

export async function fetchSensitivityAnalysis(perturbationPct: number = 20.0): Promise<SensitivityResponse> {
  if (useClientEngine) {
    return clientFetchSensitivityAnalysis(perturbationPct);
  }
  try {
    const res = await fetch(`${ANALYTICS_API_BASE}/sensitivity?perturbation_pct=${perturbationPct}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    useClientEngine = true;
    return clientFetchSensitivityAnalysis(perturbationPct);
  }
}
