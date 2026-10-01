import { Layers, Info } from 'lucide-react';
import { SensitivityResponse } from '../../types/simulation';

interface TornadoChartProps {
  data: SensitivityResponse | null;
  loading?: boolean;
}

export default function TornadoChart({ data, loading = false }: TornadoChartProps) {
  if (loading || !data) {
    return (
      <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4 shadow-sm animate-pulse">
        <div className="h-5 bg-slate-100 rounded w-1/3"></div>
        <div className="space-y-3 pt-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-10 bg-slate-50 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  // Find max absolute delta for symmetric horizontal bar scaling
  const maxDelta = Math.max(
    ...data.parameters.map((p) => Math.max(Math.abs(p.delta_low), Math.abs(p.delta_high))),
    1.0
  );

  return (
    <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4 shadow-sm">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            Parameter Sensitivity Analysis (Tornado Chart)
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            One-at-a-time (OAT) local sensitivity: effect of ±{data.perturbation_pct}% variation on final VCC at 120 h
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1 rounded-md">
          <span>Baseline VCC:</span>
          <strong className="text-slate-900 font-bold">{data.baseline_vcc.toFixed(2)} ×10⁶ cells/mL</strong>
        </div>
      </div>

      {/* Tornado Divergence Grid */}
      <div className="space-y-3.5 pt-1 text-xs">
        {/* Scale Header */}
        <div className="flex items-center text-[10px] text-slate-600 font-mono border-b border-slate-100 pb-1">
          <div className="w-1/3 font-semibold uppercase tracking-wider">Parameter (Symbol / Nominal)</div>
          <div className="w-5/12 flex justify-between px-2 font-bold">
            <span className="text-rose-600">−20% Swing (ΔVCC)</span>
            <span className="text-slate-400">Baseline (0)</span>
            <span className="text-blue-600">+20% Swing (ΔVCC)</span>
          </div>
          <div className="w-1/4 text-right font-semibold uppercase tracking-wider">Total Swing &amp; Share</div>
        </div>

        {data.parameters.map((p, idx) => {
          // Negative bar width percentage (0 to 50%)
          const negWidthPct = (Math.abs(Math.min(0, p.delta_low, p.delta_high)) / maxDelta) * 50;
          // Positive bar width percentage (0 to 50%)
          const posWidthPct = (Math.max(0, p.delta_low, p.delta_high) / maxDelta) * 50;

          return (
            <div key={p.param_key} className="space-y-1 group">
              <div className="flex items-center">
                {/* 1. Parameter Label */}
                <div className="w-1/3 pr-2 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 font-medium text-slate-800">
                    <span className="font-mono text-[10px] text-slate-400">{idx + 1}.</span>
                    <span className="font-bold">{p.name}</span>
                    <span className="font-mono text-blue-700 font-bold text-[11px]">({p.symbol})</span>
                  </div>
                  <div className="text-[10px] text-slate-600 font-mono">
                    Nominal: {p.nominal_value >= 0.01 ? p.nominal_value.toFixed(3) : p.nominal_value.toExponential(1)} {p.unit}
                  </div>
                </div>

                {/* 2. Diverging Bars Area (50% left for negative, 50% right for positive) */}
                <div className="w-5/12 h-6 flex items-center bg-slate-50 border border-slate-100 rounded relative px-1">
                  {/* Center Baseline Divider */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300 z-10" />

                  {/* Left Half: Negative Deviation */}
                  <div className="w-1/2 h-full flex justify-end items-center pr-px">
                    <div
                      className="bg-rose-500/80 hover:bg-rose-600 transition-all rounded-l h-4 flex items-center justify-start pl-1 text-[9px] font-mono text-white font-bold"
                      style={{ width: `${negWidthPct}%` }}
                      title={`${p.name} low: ${p.delta_low < 0 ? p.delta_low.toFixed(2) : p.delta_high.toFixed(2)} ×10⁶ cells/mL`}
                    >
                      {negWidthPct > 18 && (
                        <span>{p.delta_low < 0 ? p.delta_low.toFixed(2) : p.delta_high.toFixed(2)}</span>
                      )}
                    </div>
                  </div>

                  {/* Right Half: Positive Deviation */}
                  <div className="w-1/2 h-full flex justify-start items-center pl-px">
                    <div
                      className="bg-blue-600/85 hover:bg-blue-700 transition-all rounded-r h-4 flex items-center justify-end pr-1 text-[9px] font-mono text-white font-bold"
                      style={{ width: `${posWidthPct}%` }}
                      title={`${p.name} high: ${p.delta_high > 0 ? p.delta_high.toFixed(2) : p.delta_low.toFixed(2)} ×10⁶ cells/mL`}
                    >
                      {posWidthPct > 18 && (
                        <span>{p.delta_high > 0 ? `+${p.delta_high.toFixed(2)}` : `+${p.delta_low.toFixed(2)}`}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Swing and Share Stats */}
                <div className="w-1/4 pl-3 flex items-center justify-between text-right">
                  <div className="text-left font-mono">
                    <div className="font-bold text-slate-800">{p.swing.toFixed(2)} M</div>
                    <div className="text-[10px] text-slate-600">cells/mL swing</div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {p.impact_share_pct.toFixed(1)}%
                    </span>
                    <span className="text-[9px] text-slate-600">share</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dynamic Honest Insight Box */}
      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-sans leading-relaxed space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs uppercase tracking-wider">
          <Info className="w-3.5 h-3.5 text-blue-600" />
          <span>Biophysical Model Insight</span>
        </div>
        <p className="text-[11px] text-slate-650">
          {data.insight_summary}
        </p>
        <p className="text-[10px] text-slate-600 font-mono pt-1">
          * Fractional impact shares sum strictly to 100.0% ({data.parameters.map((p) => p.impact_share_pct).join('% + ')}% = 100.0%).
        </p>
      </div>
    </div>
  );
}
