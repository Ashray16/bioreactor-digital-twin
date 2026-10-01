import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { FanPoint } from '../../types/simulation';

interface FanChartProps {
  data: FanPoint[];
  height?: number;
  loading?: boolean;
}

export default function FanChart({ data, height = 280, loading = false }: FanChartProps) {
  const [showControlled, setShowControlled] = useState(true);
  const [showUncontrolled, setShowUncontrolled] = useState(true);

  // Transform data for stacked area rendering in Recharts
  // Range is p95 - p5, base is p5
  const chartData = useMemo(() => {
    return data.map((pt) => ({
      time: pt.time,
      // Controlled ribbon
      ctrl_base: pt.controlled.p5,
      ctrl_range: Math.max(0, pt.controlled.p95 - pt.controlled.p5),
      ctrl_median: pt.controlled.median,
      ctrl_p5: pt.controlled.p5,
      ctrl_p95: pt.controlled.p95,
      // Uncontrolled ribbon
      un_base: pt.uncontrolled.p5,
      un_range: Math.max(0, pt.uncontrolled.p95 - pt.uncontrolled.p5),
      un_median: pt.uncontrolled.median,
      un_p5: pt.uncontrolled.p5,
      un_p95: pt.uncontrolled.p95,
    }));
  }, [data]);

  return (
    <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-3.5 shadow-sm">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            Viable Cell Density Fan Chart
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Median trajectory line with shaded 5th–95th percentile confidence ribbon (N = 200 runs)
          </p>
        </div>

        {/* Legend Series Toggles */}
        <div className="flex items-center gap-2 text-xs font-medium">
          <button
            type="button"
            onClick={() => setShowControlled(!showControlled)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition cursor-pointer text-xs ${
              showControlled
                ? 'bg-blue-50 border-blue-200 text-blue-800 font-semibold'
                : 'bg-slate-50 border-slate-200 text-slate-400'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: showControlled ? '#2563eb' : '#cbd5e1' }}
            />
            <span>Controlled</span>
          </button>

          <button
            type="button"
            onClick={() => setShowUncontrolled(!showUncontrolled)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition cursor-pointer text-xs ${
              showUncontrolled
                ? 'bg-amber-50 border-amber-200 text-amber-900 font-semibold'
                : 'bg-slate-50 border-slate-200 text-slate-400'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: showUncontrolled ? '#d97706' : '#cbd5e1' }}
            />
            <span>Uncontrolled</span>
          </button>
        </div>
      </div>

      {/* Chart Viewport */}
      <div className="w-full relative" style={{ height }}>
        {loading ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs font-mono">
            Evaluating 200 ODE ensemble runs...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs font-mono">
            No ensemble trajectories available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: -5, bottom: 5 }}>
              <defs>
                <linearGradient id="ctrlBandGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.08} />
                </linearGradient>
                <linearGradient id="unBandGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.06} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
                unit=" h"
              />

              <YAxis
                domain={[0, 'auto']}
                allowDataOverflow={false}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
                tickFormatter={(v) => `${v.toFixed(0)}`}
                label={{
                  value: '×10⁶ cells/mL',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 15,
                  style: { fontSize: 11, fill: '#64748b', textAnchor: 'middle' },
                }}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0].payload;
                  return (
                    <div className="bg-white/95 backdrop-blur-sm p-3 rounded-lg border border-slate-200 shadow-md text-xs space-y-2 font-sans">
                      <div className="font-mono text-slate-500 font-bold border-b border-slate-100 pb-1">
                        Time: {item.time} h
                      </div>
                      {showControlled && (
                        <div className="space-y-0.5 text-blue-700">
                          <div className="font-bold flex justify-between gap-4">
                            <span>Controlled Median:</span>
                            <span className="font-mono">{item.ctrl_median.toFixed(2)} ×10⁶</span>
                          </div>
                          <div className="text-[10px] text-slate-500 flex justify-between gap-4">
                            <span>90% CI (5th–95th):</span>
                            <span className="font-mono">[{item.ctrl_p5.toFixed(2)} – {item.ctrl_p95.toFixed(2)}]</span>
                          </div>
                        </div>
                      )}
                      {showUncontrolled && (
                        <div className="space-y-0.5 text-amber-800">
                          <div className="font-bold flex justify-between gap-4">
                            <span>Uncontrolled Median:</span>
                            <span className="font-mono">{item.un_median.toFixed(2)} ×10⁶</span>
                          </div>
                          <div className="text-[10px] text-slate-500 flex justify-between gap-4">
                            <span>90% CI (5th–95th):</span>
                            <span className="font-mono">[{item.un_p5.toFixed(2)} – {item.un_p95.toFixed(2)}]</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }}
              />

              {/* Shaded Confidence Ribbons */}
              {showControlled && (
                <>
                  <Area
                    type="monotone"
                    dataKey="ctrl_p95"
                    stroke="none"
                    fill="url(#ctrlBandGradient)"
                    fillOpacity={1}
                  />
                  <Area
                    type="monotone"
                    dataKey="ctrl_p5"
                    stroke="none"
                    fill="#ffffff"
                    fillOpacity={1}
                  />
                </>
              )}

              {showUncontrolled && (
                <>
                  <Area
                    type="monotone"
                    dataKey="un_p95"
                    stroke="none"
                    fill="url(#unBandGradient)"
                    fillOpacity={0.7}
                  />
                  <Area
                    type="monotone"
                    dataKey="un_p5"
                    stroke="none"
                    fill="#ffffff"
                    fillOpacity={1}
                  />
                </>
              )}

              {/* Median Lines */}
              {showUncontrolled && (
                <Line
                  type="monotone"
                  dataKey="un_median"
                  stroke="#d97706"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  dot={false}
                  isAnimationActive={false}
                />
              )}

              {showControlled && (
                <Line
                  type="monotone"
                  dataKey="ctrl_median"
                  stroke="#2563eb"
                  strokeWidth={2.2}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 font-sans border-t border-slate-100">
        <span>X-axis clamped at physical lower bound: VCC ≥ 0.0</span>
        <span className="font-mono text-slate-400">Sample size: N = 200 runs</span>
      </div>
    </div>
  );
}
