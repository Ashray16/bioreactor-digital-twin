import { BioreactorState } from '../../types/simulation';
import { Target, Heart, Droplet, Flame, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface KpiCardsProps {
  state: BioreactorState;
}

export default function KpiCards({ state }: KpiCardsProps) {
  const isHighDensity = state.viable_cell_density >= 1e7;
  const cellDensityFormatted = isHighDensity
    ? (state.viable_cell_density / 1e7).toFixed(2)
    : (state.viable_cell_density / 1e6).toFixed(2);
  const cellDensityExponent = isHighDensity ? '10⁷' : '10⁶';

  const targetPercent = Math.min(100, Math.round((state.viable_cell_density / state.target_cell_density) * 100));

  const getFoulingBadgeClass = (status: string) => {
    switch (status) {
      case 'LOW':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'MODERATE':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'HIGH':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'CRITICAL':
        return 'bg-red-50 text-red-700 border-red-200 animate-pulse';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Digital Twin Status Bar */}
      <div className="glass-panel px-4 py-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-white">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-bold text-emerald-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Digital Twin Synchronized
          </span>
          <span className="text-slate-300">|</span>
          <span>Model Status: <strong className="text-slate-800 font-semibold">Valid Monod-Contois ODEs</strong></span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span>Controller: <strong className={state.controller_enabled ? "text-blue-700 font-bold" : "text-amber-700 font-bold"}>{state.controller_enabled ? "Active (Feedback Loop)" : "Inactive (Fixed Perfusion)"}</strong></span>
          <span className="text-slate-300">|</span>
          <span>Perfusion: <strong className="text-blue-600 font-bold">{state.perfusion_rate.toFixed(2)} VVD</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* 1. Viable Cell Density */}
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-between border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-blue-600" />
              Viable Cell Density
            </span>
            {state.target_achieved ? (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" /> Target Met
              </span>
            ) : (
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{targetPercent}% Target</span>
            )}
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {cellDensityFormatted} <span className="text-xs font-semibold text-blue-600">×{cellDensityExponent}</span>
            </div>
            <p className="text-[11px] font-mono text-slate-500 mt-0.5">cells/mL</p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Target: 1.00 × 10⁸</span>
            {state.time_to_target && (
              <span className="text-emerald-600 font-mono font-bold">t={state.time_to_target.toFixed(1)}h</span>
            )}
          </div>
        </div>

        {/* 2. Cell Viability */}
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-between border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-emerald-600" />
              Cell Viability
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
              state.cell_viability >= 90 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200'
            }`}>
              {state.cell_viability >= 90 ? 'Healthy' : 'Stressed'}
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {state.cell_viability.toFixed(1)} <span className="text-sm font-normal text-slate-500">%</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Viable fraction</p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Dead cells:</span>
            <span className="font-mono text-slate-700">{(state.nonviable_cell_density / 1e6).toFixed(2)}M</span>
          </div>
        </div>

        {/* 3. Glucose (Nutrient) */}
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-between border-slate-200" title="Mass Balance: dS/dt = D*(S_feed - S) - q_s*X_v">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Droplet className="w-3.5 h-3.5 text-blue-600" />
              Glucose (Nutrient)
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
              state.nutrient_concentration >= 1.5 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'
            }`}>
              {state.nutrient_concentration >= 1.5 ? 'Normal Range' : 'Low Level'}
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {state.nutrient_concentration.toFixed(2)} <span className="text-sm font-normal text-slate-500">g/L</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">dS/dt Mass Balance</p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Min Limit:</span>
            <span className="font-mono text-slate-700">1.50 g/L</span>
          </div>
        </div>

        {/* 4. Lactate (Metabolite) */}
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-between border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-600" />
              Lactate (Metabolite)
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
              state.metabolite_concentration <= 3.5 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200'
            }`}>
              {state.metabolite_concentration <= 3.5 ? 'Below Limit' : 'Elevated'}
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {state.metabolite_concentration.toFixed(2)} <span className="text-sm font-normal text-slate-500">g/L</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Byproduct Concentration</p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Toxicity Limit:</span>
            <span className="font-mono text-slate-700">3.50 g/L</span>
          </div>
        </div>

        {/* 5. Perfusion Rate */}
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-between border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
              Perfusion Rate
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
              state.controller_enabled ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-slate-600 bg-slate-100 border-slate-200'
            }`}>
              {state.controller_enabled ? 'Adaptive' : 'Manual'}
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {state.perfusion_rate.toFixed(2)} <span className="text-sm font-normal text-slate-500">VVD</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Volumetric Exchange</p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Flow Rate:</span>
            <span className="font-mono text-slate-700">
              {((state.perfusion_rate / 24.0) * state.reactor_volume).toFixed(3)} L/h
            </span>
          </div>
        </div>

        {/* 6. Filter Fouling Risk Index */}
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-between border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Fouling Risk Index
            </span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getFoulingBadgeClass(state.fouling_state)}`}>
              {state.fouling_state}
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {state.fouling_index.toFixed(1)} <span className="text-sm font-normal text-slate-500">/ 100</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Membrane Loading Proxy</p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Warning Limit:</span>
            <span className="font-mono text-slate-700">70 / 100</span>
          </div>
        </div>
      </div>
    </div>
  );
}
