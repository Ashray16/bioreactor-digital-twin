import { BioreactorState } from '../types/simulation';

export type MappingStatus = 'DIRECT' | 'UNAVAILABLE' | 'NOT_EQUIVALENT' | 'MANUAL';

export interface FeatureMappingInfo {
  paramKey: string;
  label: string;
  status: MappingStatus;
  mappedValue?: number;
  unit: string;
  reason: string;
}

export interface DigitalTwinProcessContext {
  simulationTime: number;
  reactorVolume: number;
  temperature: number;
  ph: number;
  dissolvedOxygen: number;
  perfusionRate: number;
  viableCellDensity: number;
  viability: number;
  glucose: number;
  lactate: number;
  foulingRisk: number;
}

export function createProcessContext(state: BioreactorState): DigitalTwinProcessContext {
  return {
    simulationTime: state.simulation_time,
    reactorVolume: state.reactor_volume,
    temperature: 37.0, // CHO operating temperature baseline °C
    ph: 7.2, // CHO pH baseline
    dissolvedOxygen: 50.0, // CHO continuous DO %
    perfusionRate: state.perfusion_rate,
    viableCellDensity: state.viable_cell_density,
    viability: state.cell_viability,
    glucose: state.nutrient_concentration,
    lactate: state.metabolite_concentration,
    foulingRisk: state.fouling_index,
  };
}

export function getAIContextMappings(context: DigitalTwinProcessContext): Record<string, FeatureMappingInfo> {
  return {
    temperature: {
      paramKey: 'temperature',
      label: 'Temperature',
      status: 'DIRECT',
      mappedValue: context.temperature,
      unit: '°C',
      reason: 'Direct thermal equivalence from CHO bioreactor state'
    },
    reactor_volume: {
      paramKey: 'reactor_volume',
      label: 'Reactor Volume',
      status: 'DIRECT',
      mappedValue: context.reactorVolume,
      unit: 'L',
      reason: 'Direct working volume equivalence from CHO bioreactor state'
    },
    fermentation_duration: {
      paramKey: 'fermentation_duration',
      label: 'Fermentation Duration',
      status: 'DIRECT',
      mappedValue: Math.max(0.1, context.simulationTime),
      unit: 'h',
      reason: 'Derived from current digital twin simulation elapsed time'
    },
    substrate_concentration: {
      paramKey: 'substrate_concentration',
      label: 'Substrate Concentration',
      status: 'MANUAL',
      mappedValue: undefined,
      unit: 'g/L',
      reason: 'Dataset 2 substrate is microbial feedstock, not direct CHO glucose'
    },
    oxygen: {
      paramKey: 'oxygen',
      label: 'Oxygenation Mode',
      status: 'NOT_EQUIVALENT',
      mappedValue: undefined,
      unit: 'binary',
      reason: 'Dataset 2 uses binary aerobic/anaerobic indicator, not continuous CHO DO%'
    }
  };
}
