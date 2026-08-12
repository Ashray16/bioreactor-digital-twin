import { BioreactorState } from '../../types/simulation';
import { ArrowRight, Activity, Cpu, CheckCircle2, Filter } from 'lucide-react';

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

  return (
    <div className="glass-panel p-6 rounded-xl border border-slate-200 space-y-6 bg-white">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-600" />
            Bioreactor Process Flow Schematic
          </h2>
          <p className="text-xs text-slate-500">
            Real-time digital twin process visualization of media exchange, cell retention, and filtration load
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded">
            Reactor Volume: <strong className="text-slate-900">{state.reactor_volume} L</strong>
          </span>
          <span className="text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded">
            Volumetric Flow: <strong className="text-blue-600">{flowRateLh} L/h</strong>
          </span>
        </div>
      </div>

      {/* Industrial Process Flow Diagram */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 min-h-[360px]">
        {/* 1. Fresh Media Feed Tank */}
        <div className="flex flex-col items-center gap-2 p-4 bg-white border border-slate-200 rounded-xl max-w-[200px] w-full text-center shadow-xs">
          <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-xs">
            FEED
          </div>
          <h4 className="text-xs font-bold text-slate-900">Fresh Media Feed Tank</h4>
          <div className="text-[11px] text-slate-600 font-mono">
            Glucose Feed: <span className="text-emerald-700 font-bold">10.0 g/L</span>
          </div>
          <div className="text-[11px] text-slate-600 font-mono">
            Perfusion Rate: <span className="text-blue-600 font-bold">{state.perfusion_rate.toFixed(2)} VVD</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-blue-600 font-semibold mt-1">
            <span>Inflow Rate: {flowRateLh} L/h</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Flow Connector Arrow */}
        <div className="hidden md:flex flex-col items-center gap-1 text-slate-400">
          <span className="text-[10px] font-mono text-slate-500">{state.perfusion_rate.toFixed(1)} VVD</span>
          <ArrowRight className="w-6 h-6 text-blue-600" />
        </div>

        {/* 2. Main Bioreactor Vessel */}
        <div className="relative flex flex-col items-center justify-between p-5 bg-white border-2 border-blue-200 rounded-xl w-full max-w-[280px] min-h-[260px] shadow-xs">
          <div className="absolute top-2 left-3 text-[10px] font-mono font-bold text-slate-400 uppercase">BIOREACTOR VESSEL</div>

          {/* Agitator Motor */}
          <div className="w-10 h-3 bg-slate-200 border border-slate-300 rounded-t flex justify-center items-center">
            <div className="w-1 h-5 bg-slate-400"></div>
          </div>

          {/* Cell Culture Liquid */}
          <div className="w-full flex-1 my-3 bg-blue-50/60 border border-blue-100 rounded-lg p-3 flex flex-col justify-end relative overflow-hidden">
            <div className="space-y-1.5 bg-white/90 p-3 rounded border border-slate-200 text-xs shadow-xs">
              <div className="flex justify-between font-mono">
                <span className="text-slate-600">VCC Density:</span>
                <span className="text-blue-700 font-bold">{cellDensityFormatted} ×{cellDensityExponent}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-600">Cell Viability:</span>
                <span className="text-emerald-700 font-bold">{state.cell_viability.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-600">Glucose (S):</span>
                <span className="text-slate-800 font-bold">{state.nutrient_concentration.toFixed(2)} g/L</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-600">Lactate (P):</span>
                <span className="text-amber-700 font-bold">{state.metabolite_concentration.toFixed(2)} g/L</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] font-medium text-slate-600 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            <span>Stirred Suspension (37°C, pH 7.2)</span>
          </div>
        </div>

        {/* Flow Connector Arrow */}
        <div className="hidden md:flex flex-col items-center gap-1 text-slate-400">
          <span className="text-[10px] font-mono text-slate-500">Cell Retention</span>
          <ArrowRight className="w-6 h-6 text-blue-600" />
        </div>

        {/* 3. Cell Retention Filter Unit */}
        <div className="relative flex flex-col items-center gap-2 p-4 bg-white border border-slate-200 rounded-xl max-w-[210px] w-full text-center shadow-xs">
          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold">
            <Filter className="w-5 h-5 text-blue-600" />
          </div>
          <h4 className="text-xs font-bold text-slate-900">Membrane Filter Unit</h4>

          {/* Membrane Fouling Meter */}
          <div className="w-full bg-slate-50 p-2.5 rounded-lg border border-slate-200 my-1 space-y-2 text-left">
            <div className="flex justify-between text-[10px] font-mono text-slate-600">
              <span>Fouling Risk:</span>
              <span className={`font-bold ${state.fouling_index >= 70 ? 'text-red-600' : 'text-emerald-700'}`}>
                {state.fouling_index.toFixed(1)}/100
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  state.fouling_index >= 70
                    ? 'bg-red-500'
                    : state.fouling_index >= 30
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, state.fouling_index)}%` }}
              ></div>
            </div>

            <div className="flex justify-between text-[10px] font-mono text-slate-600 pt-1 border-t border-slate-200">
              <span>Permeability:</span>
              <span className="text-blue-700 font-bold">{permeabilityPercent}%</span>
            </div>
          </div>

          <div className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>100% Cell Retention</span>
          </div>
        </div>

        {/* Flow Connector Arrow */}
        <div className="hidden md:flex flex-col items-center gap-1 text-slate-400">
          <span className="text-[10px] font-mono text-slate-500">Permeate</span>
          <ArrowRight className="w-6 h-6 text-slate-500" />
        </div>

        {/* 4. Waste Permeate Tank */}
        <div className="flex flex-col items-center gap-2 p-4 bg-white border border-slate-200 rounded-xl max-w-[180px] w-full text-center shadow-xs">
          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
            OUT
          </div>
          <h4 className="text-xs font-bold text-slate-900">Waste Permeate Tank</h4>
          <div className="text-[11px] text-slate-600 font-mono">
            Lactate Washout: <span className="text-amber-700 font-bold">{state.metabolite_concentration.toFixed(2)} g/L</span>
          </div>
          <div className="text-[11px] text-slate-600 font-mono">
            Outflow Rate: <span className="text-blue-600 font-bold">{flowRateLh} L/h</span>
          </div>
        </div>
      </div>
    </div>
  );
}
