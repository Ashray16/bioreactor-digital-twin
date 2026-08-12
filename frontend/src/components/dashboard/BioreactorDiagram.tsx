import { BioreactorState } from '../../types/simulation';
import { ArrowRight, Activity, Cpu, CheckCircle2 } from 'lucide-react';

interface BioreactorDiagramProps {
  state: BioreactorState;
}

export default function BioreactorDiagram({ state }: BioreactorDiagramProps) {
  const isHighDensity = state.viable_cell_density >= 1e7;
  const cellDensityFormatted = isHighDensity
    ? (state.viable_cell_density / 1e7).toFixed(2)
    : (state.viable_cell_density / 1e6).toFixed(2);
  const cellDensityExponent = isHighDensity ? '10⁷' : '10⁶';

  const flowRateLh = ((state.perfusion_rate / 24.0) * state.reactor_volume).toFixed(3);
  const permeabilityPercent = Math.max(0, 100 - state.fouling_index).toFixed(1);

  // Dynamic animation speed based on active perfusion rate VVD
  const animDuration = `${Math.max(0.4, (2.5 / Math.max(0.5, state.perfusion_rate))).toFixed(2)}s`;

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            Bioreactor Engineering &amp; Dynamic Filtration Process Diagram
          </h2>
          <p className="text-xs text-slate-400">
            Real-time digital twin visualization of media exchange, cell retention, and membrane fouling load
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">
            Working Volume: <strong className="text-white">{state.reactor_volume} L</strong>
          </span>
          <span className="text-xs font-mono text-slate-400">
            Flow Rate: <strong className="text-cyan-400">{flowRateLh} L/h</strong>
          </span>
        </div>
      </div>

      {/* Visual Flow Schematic */}
      <div className="relative bg-slate-950/70 border border-slate-800 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-8 min-h-[380px]">
        {/* 1. Fresh Media Feed Inflow */}
        <div className="flex flex-col items-center gap-2 p-4 bg-slate-900/80 border border-slate-800 rounded-xl max-w-[180px] w-full text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold">
            IN
          </div>
          <h4 className="text-xs font-bold text-white">Fresh Media Feed</h4>
          <div className="text-[11px] text-slate-400 font-mono">
            Glucose: <span className="text-emerald-400 font-semibold">10.0 g/L</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Rate: <span className="text-cyan-400">{state.perfusion_rate.toFixed(2)} VVD</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-emerald-400 animate-pulse mt-1">
            <span>Feeding</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Animated Connector Arrow - Speed scaled to Perfusion Rate */}
        <div className="hidden md:flex flex-col items-center gap-1 text-cyan-400/80">
          <span className="text-[10px] font-mono text-cyan-400">{flowRateLh} L/h</span>
          <ArrowRight className="w-8 h-8 animate-pulse" style={{ animationDuration: animDuration }} />
        </div>

        {/* 2. Bioreactor Main Vessel */}
        <div className="relative flex flex-col items-center justify-between p-6 bg-slate-900/90 border-2 border-cyan-500/30 rounded-2xl w-full max-w-[280px] min-h-[260px] shadow-2xl shadow-cyan-950/50">
          <div className="absolute top-2 left-3 text-[10px] font-mono text-slate-500">BIOREACTOR VESSEL</div>

          {/* Agitator Impeller Motor */}
          <div className="w-12 h-4 bg-slate-800 border border-slate-700 rounded-t flex justify-center items-center">
            <div className="w-1.5 h-6 bg-slate-500 rounded-b"></div>
          </div>

          {/* Cell Culture Liquid Representation */}
          <div className="w-full flex-1 my-3 bg-gradient-to-b from-cyan-950/40 to-cyan-900/60 border border-cyan-500/20 rounded-xl p-3 flex flex-col justify-end relative overflow-hidden">
            {/* Cell Particles */}
            <div className="absolute inset-0 flex flex-wrap gap-2 p-3 opacity-40">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"
                  style={{ animationDuration: `${1.0 + (i % 3) * 0.5}s` }}
                ></div>
              ))}
            </div>

            <div className="relative z-10 space-y-1 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 text-xs">
              <div className="flex justify-between font-mono">
                <span className="text-slate-400">Viable Density:</span>
                <span className="text-cyan-300 font-bold">{cellDensityFormatted} ×{cellDensityExponent}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-400">Glucose:</span>
                <span className="text-emerald-400 font-bold">{state.nutrient_concentration.toFixed(2)} g/L</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-400">Lactate:</span>
                <span className="text-amber-400 font-bold">{state.metabolite_concentration.toFixed(2)} g/L</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            <span>Stirred Suspension (37°C, pH 7.2)</span>
          </div>
        </div>

        {/* Animated Connector Arrow */}
        <div className="hidden md:flex flex-col items-center gap-1 text-cyan-400/80">
          <span className="text-[10px] font-mono text-cyan-400">Cell Retention</span>
          <ArrowRight className="w-8 h-8 animate-pulse" style={{ animationDuration: animDuration }} />
        </div>

        {/* 3. Cell Retention Filter Unit */}
        <div className="relative flex flex-col items-center gap-2 p-5 bg-slate-900/90 border border-slate-800 rounded-2xl max-w-[210px] w-full text-center">
          <div className="w-10 h-10 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-400 flex items-center justify-center font-bold">
            FILTER
          </div>
          <h4 className="text-xs font-bold text-white">Membrane Filter Unit</h4>

          {/* Membrane Fouling Meter */}
          <div className="w-full bg-slate-950 p-2.5 rounded-lg border border-slate-800 my-1 space-y-2 text-left">
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>Fouling Risk:</span>
              <span className={`font-bold ${state.fouling_index >= 70 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {state.fouling_index.toFixed(1)}/100
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  state.fouling_index >= 70
                    ? 'bg-rose-500'
                    : state.fouling_index >= 30
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, state.fouling_index)}%` }}
              ></div>
            </div>

            <div className="flex justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
              <span>Permeability:</span>
              <span className="text-cyan-300 font-bold">{permeabilityPercent}%</span>
            </div>
          </div>

          <div className="text-[10px] text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>100% Cell Retention</span>
          </div>
        </div>

        {/* Animated Connector Arrow */}
        <div className="hidden md:flex flex-col items-center gap-1 text-amber-400/80">
          <span className="text-[10px] font-mono text-amber-400">Permeate</span>
          <ArrowRight className="w-8 h-8 animate-pulse" style={{ animationDuration: animDuration }} />
        </div>

        {/* 4. Waste Permeate Outflow */}
        <div className="flex flex-col items-center gap-2 p-4 bg-slate-900/80 border border-slate-800 rounded-xl max-w-[180px] w-full text-center">
          <div className="w-10 h-10 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold">
            OUT
          </div>
          <h4 className="text-xs font-bold text-white">Waste Permeate</h4>
          <div className="text-[11px] text-slate-400 font-mono">
            Lactate Washout: <span className="text-amber-400 font-semibold">{state.metabolite_concentration.toFixed(2)} g/L</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Outflow: <span className="text-cyan-400">{flowRateLh} L/h</span>
          </div>
        </div>
      </div>
    </div>
  );
}
