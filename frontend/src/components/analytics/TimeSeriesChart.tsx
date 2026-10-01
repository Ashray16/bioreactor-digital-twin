import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { TimeSeriesDataPoint, CompositeEventMarker, OperatingEnvelope, SeriesConfig } from './chartTypes';
import { ArrowUpRight } from 'lucide-react';

interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[];
  series: SeriesConfig[];
  syncId?: string;
  visibleDomain: [number, number] | null;
  onZoom: (left: number, right: number) => void;
  showEvents: boolean;
  events?: CompositeEventMarker[];
  targets?: Array<{ y: number; label: string; stroke: string }>;
  envelopes?: OperatingEnvelope[];
  yDomain?: [number | string, number | string];
  height?: number;
  disturbanceWindow?: { start: number; end: number; label?: string } | null;
}

const TYPE_COLOR: Record<string, string> = {
  FAULT:   '#EF4444',
  CONTROL: '#3B82F6',
  PROCESS: '#10B981',
  AI:      '#8B5CF6',
};
const COMPOSITE_COLOR = '#64748B';

function compositeStroke(marker: CompositeEventMarker): string {
  if (marker.types.length === 1) {
    return TYPE_COLOR[marker.types[0]] ?? COMPOSITE_COLOR;
  }
  return COMPOSITE_COLOR;
}

const CustomTooltip = ({
  active,
  payload,
  label,
  events,
}: {
  active?: boolean;
  payload?: any[];
  label?: any;
  events?: CompositeEventMarker[];
}) => {
  if (!active || !payload || !payload.length) return null;
  const timeVal = Number(label);
  const nearbyComposites = (events ?? []).filter(
    (c) => Math.abs(c.time - timeVal) < 0.25
  );

  return (
    <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-xl max-w-sm space-y-2 text-xs font-sans">
      <div className="flex items-center justify-between border-b border-slate-100 pb-1 font-bold text-slate-800">
        <span>Timestamp: <span className="font-mono text-blue-700">t = {timeVal.toFixed(1)} h</span></span>
      </div>

      <div className="space-y-2">
        {payload.map((p: any, idx: number) => {
          const val = typeof p.value === 'number' ? p.value : 0;
          const key = p.dataKey;

          return (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.stroke }} />
                  {p.name}
                </span>
                <span className="font-mono font-bold text-slate-950">
                  {key === 'viableDensity' ? `${val.toFixed(2)} × 10⁶ cells/mL` :
                   key === 'cellViability' ? `${val.toFixed(1)}%` :
                   key === 'glucose' ? `${val.toFixed(2)} g/L` :
                   key === 'lactate' ? `${val.toFixed(2)} g/L` :
                   key === 'perfusionRate' ? `${val.toFixed(2)} VVD` :
                   key === 'foulingIndex' ? `${val.toFixed(1)} / 100` :
                   `${val.toFixed(2)} ${p.unit || ''}`}
                </span>
              </div>

              {/* Physical Context / Target Margins */}
              {key === 'viableDensity' && (
                <div className="pl-3.5 text-[10px] text-slate-500 font-mono flex flex-col gap-0.5">
                  <div className="flex justify-between">
                    <span>Target Setpoint:</span>
                    <strong className="text-slate-700">100 × 10⁶ cells/mL</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Distance to Target:</span>
                    <strong className="text-blue-700">{(100 - val).toFixed(1)} × 10⁶ remaining ({((val / 100) * 100).toFixed(0)}% reached)</strong>
                  </div>
                </div>
              )}

              {key === 'cellViability' && (
                <div className="pl-3.5 text-[10px] text-slate-500 font-mono flex flex-col gap-0.5">
                  <div className="flex justify-between">
                    <span>Optimal Bound:</span>
                    <strong className="text-slate-700">≥ 90.0%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <strong className={val >= 90 ? 'text-emerald-700' : 'text-amber-700'}>
                      {val >= 90 ? 'Normal viable range' : `${(90 - val).toFixed(1)} percentage points below optimal`}
                    </strong>
                  </div>
                </div>
              )}

              {key === 'glucose' && (
                <div className="pl-3.5 text-[10px] text-slate-500 font-mono flex flex-col gap-0.5">
                  <div className="flex justify-between">
                    <span>Low-Feed Threshold:</span>
                    <strong className="text-slate-700">1.50 g/L</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Safety Margin:</span>
                    <strong className={val >= 1.5 ? 'text-emerald-700' : 'text-rose-700'}>
                      {val >= 1.5 ? `+${(val - 1.5).toFixed(2)} g/L above limit (SAFE)` : `${(val - 1.5).toFixed(2)} g/L (LOW GLUCOSE)`}
                    </strong>
                  </div>
                </div>
              )}

              {key === 'lactate' && (
                <div className="pl-3.5 text-[10px] text-slate-500 font-mono flex flex-col gap-0.5">
                  <div className="flex justify-between">
                    <span>Toxicity Threshold:</span>
                    <strong className="text-slate-700">3.50 g/L</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Toxicity Margin:</span>
                    <strong className={val <= 3.5 ? 'text-emerald-700' : 'text-amber-700'}>
                      {val <= 3.5 ? `${(3.5 - val).toFixed(2)} g/L below limit (SAFE)` : `+${(val - 3.5).toFixed(2)} g/L (ELEVATED)`}
                    </strong>
                  </div>
                </div>
              )}

              {key === 'perfusionRate' && (
                <div className="pl-3.5 text-[10px] text-slate-500 font-mono flex flex-col gap-0.5">
                  <div className="flex justify-between">
                    <span>Operating Bounds:</span>
                    <strong className="text-slate-700">0.20 – 4.00 VVD</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Volumetric Flow:</span>
                    <strong className="text-blue-700">{((val / 24.0) * 2.0).toFixed(3)} L/h (2L vessel)</strong>
                  </div>
                </div>
              )}

              {key === 'foulingIndex' && (
                <div className="pl-3.5 text-[10px] text-slate-500 font-mono flex flex-col gap-0.5">
                  <div className="flex justify-between">
                    <span>Warning Threshold:</span>
                    <strong className="text-slate-700">70.0 / 100</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Safety Margin:</span>
                    <strong className={val <= 70 ? 'text-emerald-700' : 'text-rose-700'}>
                      {val <= 70 ? `${(70 - val).toFixed(1)} pts below warning (SAFE)` : `+${(val - 70).toFixed(1)} pts (FOULING WARNING)`}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {nearbyComposites.length > 0 && (
        <div className="border-t border-slate-100 pt-1.5 mt-1.5 space-y-2 max-h-48 overflow-y-auto">
          <div className="text-[9px] uppercase font-bold text-slate-400">Process Events</div>
          {nearbyComposites.map((composite, ci) => (
            <div key={ci} className="space-y-1">
              {composite.isComposite && (
                <div className="flex items-center gap-1 pb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: compositeStroke(composite) }} />
                  <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
                    {composite.events.length} events near t={composite.time.toFixed(1)} h
                  </span>
                </div>
              )}
              {composite.events.map((ev, ei) => {
                const badgeColors: Record<string, string> = {
                  FAULT:   'bg-red-50 text-red-800 border-red-200',
                  CONTROL: 'bg-blue-50 text-blue-800 border-blue-200',
                  PROCESS: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                  AI:      'bg-purple-50 text-purple-800 border-purple-200',
                };
                const badge = badgeColors[ev.type] ?? 'bg-slate-50 text-slate-800 border-slate-200';
                return (
                  <div key={ei} className="flex flex-col gap-0.5 p-1 rounded border bg-slate-50/50">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1 rounded text-[8px] font-extrabold tracking-wider border uppercase ${badge}`}>{ev.type}</span>
                      <span className="font-bold text-slate-800 text-[10px] truncate max-w-[140px]">{ev.label}</span>
                    </div>
                    {ev.description && (
                      <p className="text-[9px] text-slate-500 font-mono leading-tight">{ev.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function TimeSeriesChart({
  data,
  series,
  syncId = 'bioprocess',
  visibleDomain,
  onZoom,
  showEvents,
  events = [],
  targets = [],
  envelopes = [],
  yDomain = ['auto', 'auto'],
  height = 224,
  disturbanceWindow = null,
}: TimeSeriesChartProps) {
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null);

  const handleMouseDown = (e: any) => {
    if (e && e.activeLabel !== undefined) setRefAreaLeft(Number(e.activeLabel));
  };
  const handleMouseMove = (e: any) => {
    if (refAreaLeft !== null && e && e.activeLabel !== undefined) setRefAreaRight(Number(e.activeLabel));
  };
  const handleMouseUp = () => {
    if (refAreaLeft !== null && refAreaRight !== null) {
      let [left, right] = [refAreaLeft, refAreaRight];
      if (left > right) { const temp = left; left = right; right = temp; }
      if (right - left > 0.1) onZoom(left, right);
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const formattedXDomain = visibleDomain || ['dataMin', 'dataMax'];

  // Check which targets are off-scale (outside current visible viewport)
  const { visibleTargets, offScaleTargets } = useMemo(() => {
    if (!targets.length || !data.length) {
      return { visibleTargets: targets, offScaleTargets: [] };
    }

    // Get max and min value among active data series
    let dataMax = -Infinity;
    let dataMin = Infinity;
    data.forEach((d) => {
      series.forEach((s) => {
        const val = d[s.key];
        if (typeof val === 'number') {
          if (val > dataMax) dataMax = val;
          if (val < dataMin) dataMin = val;
        }
      });
    });

    if (dataMax === -Infinity) dataMax = 100;
    if (dataMin === Infinity) dataMin = 0;

    // Approximate rendered Y axis maximum based on yDomain rules
    let effectiveYMax = dataMax;
    let effectiveYMin = dataMin;

    if (Array.isArray(yDomain)) {
      const [y0, y1] = yDomain;
      if (typeof y1 === 'number') {
        effectiveYMax = y1;
      } else if (typeof y1 === 'string' && y1.includes('dataMax')) {
        const offset = parseFloat(y1.replace('dataMax', '').replace('+', '').trim()) || 0;
        effectiveYMax = dataMax + offset;
      }

      if (typeof y0 === 'number') {
        effectiveYMin = y0;
      }
    }

    const inTargets: typeof targets = [];
    const offTargets: Array<{ target: (typeof targets)[0]; reason: string }> = [];

    targets.forEach((tgt) => {
      if (tgt.y > effectiveYMax * 1.05) {
        offTargets.push({
          target: tgt,
          reason: 'above current viewport'
        });
      } else if (tgt.y < effectiveYMin * 0.95 && effectiveYMin > 0) {
        offTargets.push({
          target: tgt,
          reason: 'below current viewport'
        });
      } else {
        inTargets.push(tgt);
      }
    });

    return { visibleTargets: inTargets, offScaleTargets: offTargets };
  }, [targets, data, series, yDomain]);

  return (
    <div className="w-full relative select-none" style={{ height }}>
      {/* Off-scale target / threshold indicators overlay */}
      {offScaleTargets.length > 0 && (
        <div className="absolute top-1 right-2 z-10 flex flex-col gap-1 pointer-events-none">
          {offScaleTargets.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-sm border border-slate-200 text-[10px] font-mono shadow-xs"
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.target.stroke }} />
              <span className="font-bold text-slate-700">{item.target.label}</span>
              <span className="text-slate-500 font-sans italic">({item.reason})</span>
              <ArrowUpRight className="w-3 h-3 text-slate-400 shrink-0" />
            </div>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          syncId={syncId}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          margin={{ top: 12, right: 15, left: -25, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis
            dataKey="time"
            type="number"
            domain={formattedXDomain}
            allowDataOverflow={true}
            stroke="#94A3B8"
            tick={{ fontSize: 10, fontFamily: 'monospace' }}
            tickFormatter={(val) => `${val.toFixed(0)}h`}
          />
          <YAxis
            stroke="#94A3B8"
            tick={{ fontSize: 10, fontFamily: 'monospace' }}
            domain={yDomain}
            allowDataOverflow={true}
            allowDecimals={true}
          />
          <RechartsTooltip content={<CustomTooltip events={events} />} isAnimationActive={false} />

          {/* Shaded Disturbance Window */}
          {disturbanceWindow && (
            <ReferenceArea
              x1={disturbanceWindow.start}
              x2={disturbanceWindow.end}
              fill="rgba(244, 63, 94, 0.08)"
              stroke="rgba(244, 63, 94, 0.35)"
              strokeDasharray="3 3"
              label={{
                value: disturbanceWindow.label || 'Disturbance Window',
                fill: '#BE123C',
                fontSize: 9,
                position: 'insideTopLeft',
                fontFamily: 'sans-serif',
                fontWeight: 'bold',
              }}
            />
          )}

          {envelopes.map((envelope, idx) => (
            <ReferenceArea
              key={`env-${idx}`}
              y1={envelope.yMin}
              y2={envelope.yMax}
              fill={envelope.color || 'rgba(148, 163, 184, 0.05)'}
              fillOpacity={1}
              stroke="none"
            />
          ))}

          {visibleTargets.map((target, idx) => (
            <ReferenceLine
              key={`tgt-${idx}`}
              y={target.y}
              stroke={target.stroke}
              strokeDasharray="4 4"
              label={{ value: target.label, fill: target.stroke, fontSize: 9, position: 'insideTopRight', fontFamily: 'sans-serif', fontWeight: 'bold' }}
            />
          ))}

          {/* ONE ReferenceLine per CompositeEventMarker — no overlapping lines */}
          {showEvents &&
            events.map((composite, idx) => {
              const stroke = compositeStroke(composite);
              const isMulti = composite.isComposite;
              return (
                <ReferenceLine
                  key={`evt-${idx}`}
                  x={composite.time}
                  stroke={stroke}
                  strokeWidth={isMulti ? 2 : 1.5}
                  strokeDasharray={isMulti ? '4 2' : '3 3'}
                  strokeOpacity={isMulti ? 0.85 : 0.75}
                />
              );
            })}

          {series.map((s) => (
            <Line
              key={s.key}
              type={s.type || 'monotone'}
              dataKey={s.key}
              name={s.name}
              stroke={s.stroke}
              strokeDasharray={s.strokeDasharray}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls
              unit={s.unit}
            />
          ))}

          {refAreaLeft !== null && refAreaRight !== null && (
            <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="#3B82F6" fillOpacity={0.15} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
