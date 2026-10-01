import { useMemo } from 'react';
import { BioreactorState, SimulationHistoryItem } from '../../types/simulation';

interface KpiCardsProps {
  state: BioreactorState | null;
  history?: SimulationHistoryItem[];
}

function Sparkline({ data, stroke = '#64748B' }: { data: number[]; stroke?: string }) {
  if (!data || data.length < 2) {
    return <div className="h-4 w-12 bg-slate-50 rounded" />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 52;
  const height = 16;
  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible shrink-0 opacity-75">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function KpiCards({ state, history = [] }: KpiCardsProps) {
  // Sparkline data extraction from history (last 30 samples)
  const sparklines = useMemo(() => {
    const samples = history.slice(-30);
    return {
      vcd: samples.map((h) => h.viable_cell_density / 1e6),
      viability: samples.map((h) => h.cell_viability),
      glucose: samples.map((h) => h.nutrient_concentration),
      lactate: samples.map((h) => h.metabolite_concentration),
      titer: samples.map((h) => h.product_concentration),
      perfusion: samples.map((h) => h.perfusion_rate),
      fouling: samples.map((h) => h.fouling_index),
    };
  }, [history]);

  if (!state) return null;

  const isHighDensity = state.viable_cell_density >= 1e7;
  const cellDensityFormatted = isHighDensity
    ? (state.viable_cell_density / 1e7).toFixed(2)
    : (state.viable_cell_density / 1e6).toFixed(2);
  const cellDensityExponent = isHighDensity ? '10⁷' : '10⁶';

  const flowRateLh = ((state.perfusion_rate / 24.0) * state.reactor_volume).toFixed(3);

  // Trajectory-aware status logic: culture in growth phase (t < 80h) is on normal trajectory
  const isVcdAlarm = state.simulation_time >= 90 && state.viable_cell_density < 5e7;
  const isViabilityAlarm = state.cell_viability < 90;
  const isGlucoseAlarm = state.nutrient_concentration < 1.5;
  const isLactateAlarm = state.metabolite_concentration > 3.5;
  const isFoulingAlarm = state.fouling_index >= 70;

  return (
    <div className="border border-slate-200 rounded-md bg-white overflow-hidden shadow-none font-sans">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        
        {/* 1. Viable Cell Density */}
        <div className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              Cell Density
            </span>
            {isVcdAlarm ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                Slow
              </span>
            ) : state.target_achieved ? (
              <span className="text-[11px] font-medium text-emerald-700">Met</span>
            ) : null}
          </div>

          <div className="my-1">
            <div className="flex items-baseline gap-1 font-mono tabular-nums">
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {cellDensityFormatted}
              </span>
              <span className="text-xs font-semibold text-slate-600 font-mono">
                ×{cellDensityExponent}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">cells/mL</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
            <span className="text-[11px] text-slate-500 truncate">
              {state.target_achieved
                ? `Met at t=${state.time_to_target?.toFixed(1) || '0'}h`
                : 'Target: 100M'}
            </span>
            <Sparkline data={sparklines.vcd} stroke="#2563EB" />
          </div>
        </div>

        {/* 2. Cell Viability */}
        <div className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              Viability
            </span>
            {isViabilityAlarm && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                Low
              </span>
            )}
          </div>

          <div className="my-1">
            <div className="flex items-baseline gap-1 font-mono tabular-nums">
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {state.cell_viability.toFixed(1)}
              </span>
              <span className="text-xs font-semibold text-slate-600 font-mono">%</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">live ratio</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
            <span className="text-[11px] text-slate-500 truncate">Threshold ≥ 90%</span>
            <Sparkline data={sparklines.viability} stroke={isViabilityAlarm ? '#D97706' : '#64748B'} />
          </div>
        </div>

        {/* 3. Glucose Concentration */}
        <div className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              Glucose
            </span>
            {isGlucoseAlarm && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                Depleted
              </span>
            )}
          </div>

          <div className="my-1">
            <div className="flex items-baseline gap-1 font-mono tabular-nums">
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {state.nutrient_concentration.toFixed(2)}
              </span>
              <span className="text-xs font-semibold text-slate-600 font-mono">g/L</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">substrate</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
            <span className="text-[11px] text-slate-500 truncate">Setpoint ≥ 1.50</span>
            <Sparkline data={sparklines.glucose} stroke={isGlucoseAlarm ? '#EF4444' : '#64748B'} />
          </div>
        </div>

        {/* 4. Lactate Concentration */}
        <div className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              Lactate
            </span>
            {isLactateAlarm && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                High
              </span>
            )}
          </div>

          <div className="my-1">
            <div className="flex items-baseline gap-1 font-mono tabular-nums">
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {state.metabolite_concentration.toFixed(2)}
              </span>
              <span className="text-xs font-semibold text-slate-600 font-mono">g/L</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">byproduct</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
            <span className="text-[11px] text-slate-500 truncate">Limit ≤ 3.50</span>
            <Sparkline data={sparklines.lactate} stroke={isLactateAlarm ? '#EF4444' : '#64748B'} />
          </div>
        </div>

        {/* 5. Product Titer */}
        <div className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              Product Titer
            </span>
          </div>

          <div className="my-1">
            <div className="flex items-baseline gap-1 font-mono tabular-nums">
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {state.product_concentration.toFixed(2)}
              </span>
              <span className="text-xs font-semibold text-slate-600 font-mono">g/L</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">mAb protein</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
            <span className="text-[11px] text-slate-500 truncate">Yield metric</span>
            <Sparkline data={sparklines.titer} stroke="#0F172A" />
          </div>
        </div>

        {/* 6. Perfusion Rate */}
        <div className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              Perfusion
            </span>
            <span className="text-[10px] text-slate-400">
              {state.controller_enabled ? 'Adaptive' : 'Manual'}
            </span>
          </div>

          <div className="my-1">
            <div className="flex items-baseline gap-1 font-mono tabular-nums">
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {state.perfusion_rate.toFixed(2)}
              </span>
              <span className="text-xs font-semibold text-slate-600 font-mono">VVD</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">{flowRateLh} L/h</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
            <span className="text-[11px] text-slate-500 truncate">0.2 – 4.0 range</span>
            <Sparkline data={sparklines.perfusion} stroke="#2563EB" />
          </div>
        </div>

        {/* 7. Filter Fouling */}
        <div className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              Filter Fouling
            </span>
            {isFoulingAlarm && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                Clogged
              </span>
            )}
          </div>

          <div className="my-1">
            <div className="flex items-baseline gap-1 font-mono tabular-nums">
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {state.fouling_index.toFixed(1)}
              </span>
              <span className="text-xs font-semibold text-slate-400 font-mono">/ 100</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">resistance</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
            <span className="text-[11px] text-slate-500 truncate">Warning limit 70</span>
            <Sparkline data={sparklines.fouling} stroke={isFoulingAlarm ? '#EF4444' : '#64748B'} />
          </div>
        </div>

      </div>
    </div>
  );
}
