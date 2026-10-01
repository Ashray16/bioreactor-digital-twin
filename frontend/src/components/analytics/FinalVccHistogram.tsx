import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { HistogramBin, DistributionStats } from '../../types/simulation';

interface FinalVccHistogramProps {
  bins: HistogramBin[];
  controlledStats?: DistributionStats;
  uncontrolledStats?: DistributionStats;
  height?: number;
  loading?: boolean;
}

export default function FinalVccHistogram({
  bins,
  controlledStats,
  uncontrolledStats,
  height = 280,
  loading = false,
}: FinalVccHistogramProps) {
  return (
    <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-3.5 shadow-sm">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            Final Cell Density Distribution
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Binned histogram of final VCC at t = 120 h across 200 perturbed parameter runs
          </p>
        </div>

        {/* Statistical Summary Pills */}
        <div className="flex items-center gap-3 text-xs">
          {controlledStats && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-blue-900">
              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
              <span>Controlled:</span>
              <strong className="font-mono">{controlledStats.median.toFixed(1)}</strong>
              <span className="text-[10px] text-blue-700 font-mono">(±{controlledStats.std_dev.toFixed(1)})</span>
            </div>
          )}
          {uncontrolledStats && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-900">
              <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0" />
              <span>Uncontrolled:</span>
              <strong className="font-mono">{uncontrolledStats.median.toFixed(1)}</strong>
              <span className="text-[10px] text-amber-700 font-mono">(±{uncontrolledStats.std_dev.toFixed(1)})</span>
            </div>
          )}
        </div>
      </div>

      {/* Chart Viewport */}
      <div className="w-full relative" style={{ height }}>
        {loading ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs font-mono">
            Compiling histogram bins...
          </div>
        ) : bins.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs font-mono">
            No histogram observations available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bins} margin={{ top: 10, right: 15, left: -10, bottom: 5 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

              <XAxis
                dataKey="bin_center"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
                tickFormatter={(v) => `${v.toFixed(1)}`}
                label={{
                  value: 'Final VCC (×10⁶ cells/mL)',
                  position: 'insideBottom',
                  offset: -4,
                  style: { fontSize: 11, fill: '#64748b', textAnchor: 'middle' },
                }}
              />

              <YAxis
                domain={[0, 'auto']}
                allowDataOverflow={false}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
                label={{
                  value: 'Runs Count',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 15,
                  style: { fontSize: 11, fill: '#64748b', textAnchor: 'middle' },
                }}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0].payload as HistogramBin;
                  return (
                    <div className="bg-white/95 backdrop-blur-sm p-3 rounded-lg border border-slate-200 shadow-md text-xs space-y-1.5 font-sans">
                      <div className="font-mono text-slate-700 font-bold border-b border-slate-100 pb-1">
                        Range: {item.bin_min.toFixed(2)} – {item.bin_max.toFixed(2)} ×10⁶ cells/mL
                      </div>
                      <div className="flex justify-between gap-4 text-blue-700 font-medium">
                        <span>Controlled:</span>
                        <span className="font-mono font-bold">
                          {item.controlled_count} runs ({item.controlled_pct}%)
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 text-amber-800 font-medium">
                        <span>Uncontrolled:</span>
                        <span className="font-mono font-bold">
                          {item.uncontrolled_count} runs ({item.uncontrolled_pct}%)
                        </span>
                      </div>
                    </div>
                  );
                }}
              />

              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '11px', paddingBottom: '4px' }}
                formatter={(value) => (
                  <span className="text-slate-600 font-medium capitalize">{value}</span>
                )}
              />

              <Bar
                name="Controlled"
                dataKey="controlled_count"
                fill="#2563eb"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                name="Uncontrolled"
                dataKey="uncontrolled_count"
                fill="#d97706"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 font-sans border-t border-slate-100">
        <span>Bins: 14 equal intervals over [{bins[0]?.bin_min.toFixed(1) || '0'} – {bins[bins.length - 1]?.bin_max.toFixed(1) || '0'} ×10⁶]</span>
        <span className="font-mono text-slate-400">Total runs: N = 200 per condition</span>
      </div>
    </div>
  );
}
