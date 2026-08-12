import {
  BioreactorConfig,
  BioreactorState,
  SimulationResponse,
  ScenarioComparisonResponse,
  FaultConfig,
} from '../types/simulation';

const API_BASE = 'http://127.0.0.1:8000/api/v1/simulation';

export async function fetchDefaultConfig(): Promise<BioreactorConfig> {
  const res = await fetch(`${API_BASE}/config/default`);
  if (!res.ok) throw new Error(`Failed to fetch default config: HTTP ${res.status}`);
  return res.json();
}

export async function startSimulation(config?: Partial<BioreactorConfig>): Promise<BioreactorState> {
  const res = await fetch(`${API_BASE}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config || {}),
  });
  if (!res.ok) throw new Error(`Failed to start simulation: HTTP ${res.status}`);
  return res.json();
}

export async function getSimulationState(): Promise<BioreactorState> {
  const res = await fetch(`${API_BASE}/state`);
  if (!res.ok) throw new Error(`Failed to fetch state: HTTP ${res.status}`);
  return res.json();
}

export async function stepSimulation(dt?: number, perfusionRateOverride?: number): Promise<BioreactorState> {
  const payload: Record<string, any> = {};
  if (dt !== undefined) payload.dt = dt;
  if (perfusionRateOverride !== undefined) payload.perfusion_rate_override = perfusionRateOverride;

  const res = await fetch(`${API_BASE}/step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to step simulation: HTTP ${res.status}`);
  return res.json();
}

export async function runFullSimulation(config?: Partial<BioreactorConfig>): Promise<SimulationResponse> {
  const res = await fetch(`${API_BASE}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config || {}),
  });
  if (!res.ok) throw new Error(`Failed to run simulation: HTTP ${res.status}`);
  return res.json();
}

export async function updateControlSettings(payload: {
  enabled: boolean;
  min_perfusion_rate?: number;
  max_perfusion_rate?: number;
  nutrient_threshold_low?: number;
  metabolite_threshold_high?: number;
  fouling_threshold_high?: number;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update control: HTTP ${res.status}`);
  return res.json();
}

export async function runScenarioComparison(config?: Partial<BioreactorConfig>): Promise<ScenarioComparisonResponse> {
  const res = await fetch(`${API_BASE}/scenario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config || {}),
  });
  if (!res.ok) throw new Error(`Failed to run scenario comparison: HTTP ${res.status}`);
  return res.json();
}

export async function runDemoScenario(): Promise<any> {
  const res = await fetch(`${API_BASE}/demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Failed to run demo scenario: HTTP ${res.status}`);
  return res.json();
}

export async function injectProcessFault(fault: FaultConfig): Promise<any> {
  const res = await fetch(`${API_BASE}/fault`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fault),
  });
  if (!res.ok) throw new Error(`Failed to inject fault: HTTP ${res.status}`);
  return res.json();
}
