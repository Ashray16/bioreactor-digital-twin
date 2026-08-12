import { BioreactorState } from '../../types/simulation';
import { Target, Heart, Droplet, Flame, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface KpiCardsProps {
  state: BioreactorState;
}

export default function KpiCards({ state }: KpiCardsProps) {
  // Clean standard scientific notation formatting
  const isHighDensity = state.viable_cell_density >= 1e7;
  const cellDensityFormatted = isHighDensity
    ? (state.viable_cell_density / 1e7).toFixed(2)
    : (state.viable_cell_density / 1e6).toFixed(2);
  const cellDensityExponent = isHighDensity ? '10⁷' : '10⁶';

  const targetPercent = Math.min(100, Math.round((state.viable_cell_density / state.target_cell_density) * 100));

  const getFoulingBadgeClass = (status: string) => {
    switch (status) {
      case 'LOW':
        return 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40';
      case 'MODERATE':
        return 'bg-amber-950/80 text-amber-400 border-amber-500/40';
      case 'HIGH':
        return 'bg-orange-950/80 text-orange-400 border-orange-500/40';
      case 'CRITICAL':
        return 'bg-rose-950/80 text-rose-400 border-rose-500/40 animate-pulse';
      default:
        return 'bg-slate-900 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-3">
      {/* Digital Twin Status Bar */}
      <div className="glass-panel px-4 py-2 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs text-slate-400 bg-slate-950/50">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-bold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            DIGITAL TWIN: SYNCHRONIZED
          </span>
          <span className="text-slate-600">|</span>
          <span>Model Status: <strong className="text-slate-200">Valid Monod-Contois ODEs</strong></span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span>Controller: <strong className={state.controller_enabled ? "text-emerald-400" : "text-amber-400"}>{state.controller_enabled ? "ACTIVE (Feedback Loop)" : "INACTIVE (Fixed Perfusion)"}</strong></span>
          <span className="text-slate-600">|</span>
          <span>Perfusion: <strong className="text-cyan-400">{state.perfusion_rate.toFixed(2)} VVD</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* 1. Viable Cell Density */}
        <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between border-cyan-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              Viable Cell Density
            </span>
            {state.target_achieved ? (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                <CheckCircle2 className="w-3 h-3" /> GOAL
              </span>
            ) : (
              <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded">{targetPercent}% Target</span>
            )}
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {cellDensityFormatted} <span className="text-xs font-semibold text-cyan-400">×{cellDensityExponent}</span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">cells/mL</p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Target: 1.00 × 10⁸</span>
            {state.time_to_target && (
              <span className="text-emerald-400 font-mono">t={state.time_to_target.toFixed(1)}h</span>
            )}
          </div>
        </div>

        {/* 2. Cell Viability */}
        <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5" />
              Cell Viability
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              state.cell_viability >= 90 ? 'text-emerald-400 bg-emerald-950/60' : 'text-amber-400 bg-amber-950/60'
            }`}>
              {state.cell_viability >= 90 ? 'Healthy' : 'Stressed'}
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {state.cell_viability.toFixed(1)} <span className="text-sm font-normal text-slate-400">%</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Viable fraction</p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Dead cells:</span>
            <span className="font-mono text-slate-300">{(state.nonviable_cell_density / 1e6).toFixed(2)}M</span>
          </div>
        </div>

        {/* 3. Nutrient (Glucose) */}
        <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between" title="Mass Balance: dS/dt = D*(S_feed - S) - q_s*X_v">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <Droplet className="w-3.5 h-3.5" />
              Glucose (Nutrient)
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              state.nutrient_concentration >= 1.5 ? 'text-emerald-400 bg-emerald-950/60' : 'text-rose-400 bg-rose-950/60'
            }`}>
              {state.nutrient_concentration >= 1.5 ? 'Sufficient' : 'Low'}
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {state.nutrient_concentration.toFixed(2)} <span className="text-sm font-normal text-slate-400">g/L</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Mass Balance In - Out</p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Min Limit:</span>
            <span className="font-mono text-slate-300">1.50 g/L</span>
          </div>
        </div>

        {/* 4. Metabolite (Lactate) */}
        <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" />
              Lactate (Metabolite)
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              state.metabolite_concentration <= 3.5 ? 'text-emerald-400 bg-emerald-950/60' : 'text-amber-400 bg-amber-950/60'
            }`}>
              {state.metabolite_concentration <= 3.5 ? 'Normal' : 'High'}
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {state.metabolite_concentration.toFixed(2)} <span className="text-sm font-normal text-slate-400">g/L</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Inhibitory byproduct</p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Toxicity Limit:</span>
            <span className="font-mono text-slate-300">3.50 g/L</span>
          </div>
        </div>

        {/* 5. Perfusion Rate */}
        <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              Perfusion Rate
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              state.controller_enabled ? 'text-cyan-400 bg-cyan-950/60' : 'text-slate-400 bg-slate-800'
            }`}>
              {state.controller_enabled ? 'AUTO' : 'MANUAL'}
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {state.perfusion_rate.toFixed(2)} <span className="text-sm font-normal text-slate-400">VVD</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Media exchange rate</p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Flow Rate:</span>
            <span className="font-mono text-slate-300">
              {((state.perfusion_rate / 24.0) * state.reactor_volume).toFixed(3)} L/h
            </span>
          </div>
        </div>

        {/* 6. Filter Fouling Risk Index */}
        <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Fouling Risk Index
            </span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getFoulingBadgeClass(state.fouling_state)}`}>
              {state.fouling_state}
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {state.fouling_index.toFixed(1)} <span className="text-sm font-normal text-slate-400">/ 100</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Membrane load proxy</p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Warning Threshold:</span>
            <span className="font-mono text-slate-300">70 / 100</span>
          </div>
        </div>
      </div>
    </div>
  );
}
