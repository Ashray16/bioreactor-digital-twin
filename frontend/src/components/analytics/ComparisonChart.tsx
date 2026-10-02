import { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { AlertCircle, Loader2, Maximize2, X, Download } from 'lucide-react';
import { EventMarker, OperatingEnvelope } from './chartTypes';

export interface ComparisonChartProps {
  title: string;
  source?: 'MECHANISTIC' | 'AI' | 'HISTORICAL';
  data: any[];
  controlledKey: string;
  uncontrolledKey: string;
  controlledLabel?: string;
  uncontrolledLabel?: string;
  xKey?: string;
  target?: number;
  targetLabel?: string;
  events?: EventMarker[];
  envelopes?: OperatingEnvelope[];
  yDomain?: [any, any];
  syncId?: string;
  loading?: boolean;
  error?: string | null;
  unit?: string;
  metricDirection?: 'higher' | 'lower';
  showControlled?: boolean;
  showUncontrolled?: boolean;
  showTarget?: boolean;
  showEvents?: boolean;
  visibleDomain?: [number, number] | null;
  disturbanceWindow?: { start: number; end: number; label?: string } | null;
}

const ComparisonTooltip = ({
  active,
  payload,
  label,
  events,
  showEvents = true,
  controlledKey,
  uncontrolledKey,
  controlledLabel = 'Controlled',
  uncontrolledLabel = 'Uncontrolled',
  stats,
  unit = ''
}: any) => {
  if (!active || !payload || !payload.length) return null;

  const timeVal = Number(label);
  const ctrlItem = payload.find((p: any) => p.dataKey === controlledKey);
  const unctrlItem = payload.find((p: any) => p.dataKey === uncontrolledKey);

  const ctrlVal = ctrlItem && typeof ctrlItem.value === 'number' ? ctrlItem.value : null;
  const unctrlVal = unctrlItem && typeof unctrlItem.value === 'number' ? unctrlItem.value : null;

  let diff: number | null = null;
  if (ctrlVal !== null && unctrlVal !== null) {
    diff = ctrlVal - unctrlVal;
  }


  const activeEvents = showEvents && events?.filter(
    (ev: any) => Math.abs(ev.time - timeVal) < 0.35
  ) || [];

  const isViability = unit === '%';
  let diffText = '';
  if (diff !== null) {
    if (isViability) {
      diffText = `${diff >= 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)} pp`;
    } else {
      diffText = `${diff >= 0 ? '+' : ''}${diff.toFixed(2)} ${unit}`;
    }
  }

  return (
    <div className="bg-white/95 backdrop-blur-md p-2.5 rounded-lg border border-slate-200 shadow-lg text-xs space-y-2 max-w-xs font-sans pointer-events-none">
      <div className="flex items-center justify-between border-b border-slate-100 pb-1 font-mono text-[11px]">
        <span className="font-bold text-slate-700">t = {timeVal.toFixed(1)} h</span>
        {diff !== null && (
          <span className={`font-bold ${diff > 0.001 ? 'text-blue-700' : diff < -0.001 ? 'text-rose-700' : 'text-slate-500'}`}>
            Δ {diffText}
          </span>
        )}
      </div>

      <div className="space-y-1 font-mono text-[11px]">
        {ctrlVal !== null && (
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 font-sans font-medium text-slate-700">
              <span className="w-2 h-0.5 bg-blue-600 rounded-full" />
              {controlledLabel}:
            </span>
            <span className="font-bold text-blue-700">
              {ctrlVal.toFixed(2)} {unit}
            </span>
          </div>
        )}

        {unctrlVal !== null && (
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 font-sans font-medium text-slate-500">
              <span className="w-2 h-0.5 border-t border-dashed border-slate-400" />
              {uncontrolledLabel}:
            </span>
            <span className="text-slate-700">
              {unctrlVal.toFixed(2)} {unit}
            </span>
          </div>
        )}
      </div>

      {/* Min / Max trajectory statistics stored in tooltip */}
      {stats && (
        <div className="border-t border-slate-100 pt-1 text-[10px] text-slate-400 font-mono flex items-center justify-between">
          <span>Ctrl Min/Max: {stats.controlled.min.toFixed(1)} / {stats.controlled.max.toFixed(1)}</span>
          <span>Unctrl: {stats.uncontrolled.min.toFixed(1)} / {stats.uncontrolled.max.toFixed(1)}</span>
        </div>
      )}

      {/* Process events near this timestamp */}
      {activeEvents.length > 0 && (
        <div className="border-t border-slate-100 pt-1 space-y-1">
          {activeEvents.map((ev: any, idx: number) => (
            <div key={idx} className="flex items-center gap-1.5 text-[10px]">
              <span className={`px-1 py-0.2 rounded font-extrabold text-[9px] uppercase ${
                ev.type === 'FAULT' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                {ev.type}
              </span>
              <span className="font-medium text-slate-700 truncate">{ev.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function ComparisonChart({
  title,
  data = [],
  controlledKey,
  uncontrolledKey,
  controlledLabel = 'Controlled',
  uncontrolledLabel = 'Uncontrolled',
  xKey = 'time',
  target,
  targetLabel,
  events = [],
  envelopes = [],
  yDomain = ['auto', 'auto'],
  syncId = 'scenario-comparison',
  loading = false,
  error = null,
  unit = '',
  metricDirection,
  showControlled = true,
  showUncontrolled = true,
  showTarget = true,
  showEvents = true,
  visibleDomain = null,
  disturbanceWindow = null,
}: ComparisonChartProps) {
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  useEffect(() => {
    if (!isMaximized) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMaximized(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized]);

  // Compute latest values and stats for single-line header
  const { currentCtrl, diff, diffColor, diffText, stats, isTargetOffScale } = useMemo(() => {
    if (!data.length) {
      return { currentCtrl: null, diff: null, diffColor: 'text-slate-400', diffText: '', stats: null, isTargetOffScale: false };
    }

    const last = data[data.length - 1];
    const cVal = last[controlledKey] ?? null;
    const uVal = last[uncontrolledKey] ?? null;

    let delta: number | null = null;
    let color = 'text-slate-500';
    let text = '0.00';

    if (typeof cVal === 'number' && typeof uVal === 'number') {
      delta = cVal - uVal;
      const isPositive = delta > 0.001;
      const isNegative = delta < -0.001;

      if (metricDirection === 'higher') {
        color = isPositive ? 'text-emerald-700 font-bold' : isNegative ? 'text-rose-700 font-bold' : 'text-slate-500';
      } else if (metricDirection === 'lower') {
        color = isNegative ? 'text-emerald-700 font-bold' : isPositive ? 'text-rose-700 font-bold' : 'text-slate-500';
      } else {
        color = isPositive ? 'text-blue-700 font-bold' : isNegative ? 'text-rose-700 font-bold' : 'text-slate-500';
      }

      if (unit === '%') {
        text = `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)} pp`;
      } else {
        text = `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`;
      }
    }

    // Min / Max computation
    const ctrlVals = data.map((d) => d[controlledKey]).filter((v) => typeof v === 'number');
    const unctrlVals = data.map((d) => d[uncontrolledKey]).filter((v) => typeof v === 'number');
    const cMin = ctrlVals.length ? Math.min(...ctrlVals) : 0;
    const cMax = ctrlVals.length ? Math.max(...ctrlVals) : 0;
    const uMin = unctrlVals.length ? Math.min(...unctrlVals) : 0;
    const uMax = unctrlVals.length ? Math.max(...unctrlVals) : 0;

    const dataMax = Math.max(cMax, uMax);
    const targetOff = target !== undefined && target > dataMax * 1.8;

    return {
      currentCtrl: cVal,
      diff: delta,
      diffColor: color,
      diffText: text,
      stats: {
        controlled: { min: cMin, max: cMax },
        uncontrolled: { min: uMin, max: uMax },
      },
      isTargetOffScale: targetOff
    };
  }, [data, controlledKey, uncontrolledKey, metricDirection, unit, target]);

  // Prepared data with deviation area
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      _deviationArea: [d[uncontrolledKey], d[controlledKey]]
    }));
  }, [data, uncontrolledKey, controlledKey]);

  // Export CSV
  const handleExportCSV = () => {
    if (!data.length) return;
    const headers = ['Time (h)', controlledLabel, uncontrolledLabel, 'Difference'];
    const rows = data.map((d) => {
      const c = d[controlledKey] ?? '';
      const u = d[uncontrolledKey] ?? '';
      const dVal = (typeof c === 'number' && typeof u === 'number') ? (c - u) : '';
      return [d[xKey], c, u, dVal];
    });
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/\s+/g, '_')}_comparison.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderPlot = () => {

    if (loading) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-1.5">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-[11px] font-mono">Simulating trajectory...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-rose-600 gap-1 p-2 text-center">
          <AlertCircle className="w-5 h-5 text-rose-500" />
          <span className="text-[11px] font-bold">Error: {error}</span>
        </div>
      );
    }

    if (!data.length) {
      return (
        <div className="h-full flex items-center justify-center text-slate-400 text-xs font-mono">
          No data
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          syncId={syncId}
          margin={{ top: 8, right: 12, left: 0, bottom: 2 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />

          <XAxis
            dataKey={xKey}
            type="number"
            domain={visibleDomain || ['dataMin', 'dataMax']}
            allowDataOverflow={true}
            stroke="#94A3B8"
            tick={{ fontSize: 9, fontFamily: 'monospace' }}
            tickFormatter={(val: number) => `${Number(val.toFixed(0))}h`}
          />

          <YAxis
            stroke="#94A3B8"
            width={38}
            domain={yDomain}
            allowDataOverflow={true}
            allowDecimals={true}
            tick={{ fontSize: 9, fontFamily: 'monospace' }}
            tickFormatter={(val: number) => {
              if (typeof val !== 'number' || isNaN(val)) return '';
              if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
              return Number(val.toFixed(1)).toString();
            }}
          />

          <RechartsTooltip
            content={
              <ComparisonTooltip
                controlledKey={controlledKey}
                uncontrolledKey={uncontrolledKey}
                controlledLabel={controlledLabel}
                uncontrolledLabel={uncontrolledLabel}
                events={events}
                showEvents={showEvents}
                stats={stats}
                metricDirection={metricDirection}
                unit={unit}
              />
            }
            isAnimationActive={false}
          />

          {/* Shaded Disturbance Window (Labeled once in shared legend) */}
          {disturbanceWindow && (
            <ReferenceArea
              x1={disturbanceWindow.start}
              x2={disturbanceWindow.end}
              fill="rgba(244, 63, 94, 0.08)"
              stroke="rgba(244, 63, 94, 0.35)"
              strokeDasharray="3 3"
            />
          )}

          {/* Operating Envelopes */}
          {envelopes.map((env, idx) => (
            <ReferenceArea
              key={`env-${idx}`}
              y1={env.yMin}
              y2={env.yMax}
              fill={env.color || 'rgba(148, 163, 184, 0.05)'}
              fillOpacity={1}
              stroke="none"
            />
          ))}

          {/* Target Reference Line (if in viewport) */}
          {showTarget && target !== undefined && !isTargetOffScale && (
            <ReferenceLine
              y={target}
              stroke="#059669"
              strokeDasharray="4 4"
              label={{
                value: targetLabel || `Target: ${target}`,
                fill: '#059669',
                fontSize: 9,
                position: 'insideTopRight',
                fontWeight: 'bold',
              }}
            />
          )}

          {/* Clustered Event Marker Lines */}
          {showEvents &&
            (() => {
              const sorted = [...events].sort((a, b) => a.time - b.time);
              const groups: { time: number; types: Set<string> }[] = [];
              let anchor = -Infinity;
              let cur: { time: number; types: Set<string> } | null = null;
              for (const ev of sorted) {
                if (ev.time - anchor <= 0.35 && cur) {
                  cur.types.add(ev.type);
                } else {
                  if (cur) groups.push(cur);
                  cur = { time: ev.time, types: new Set([ev.type]) };
                  anchor = ev.time;
                }
              }
              if (cur) groups.push(cur);

              return groups.map((g, idx) => {
                const typeList = [...g.types];
                const strokeColor =
                  typeList.length === 1
                    ? ({ FAULT: '#EF4444', CONTROL: '#3B82F6', PROCESS: '#10B981' }[typeList[0]] ?? '#94A3B8')
                    : '#64748B';
                return (
                  <ReferenceLine
                    key={`evt-${idx}`}
                    x={g.time}
                    stroke={strokeColor}
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    strokeOpacity={0.7}
                  />
                );
              });
            })()}

          {/* Deviation Shading Band */}
          {showControlled && showUncontrolled && (
            <Area
              type="monotone"
              dataKey="_deviationArea"
              stroke="none"
              fill="rgba(59, 130, 246, 0.08)"
              activeDot={false}
              connectNulls
            />
          )}

          {/* Uncontrolled Scenario Line (Dashed slate) */}
          {showUncontrolled && (
            <Line
              type="monotone"
              dataKey={uncontrolledKey}
              name={uncontrolledLabel}
              stroke="#64748B"
              strokeWidth={1.75}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 0 }}
              connectNulls
            />
          )}

          {/* Controlled Scenario Line (Solid blue) */}
          {showControlled && (
            <Line
              type="monotone"
              dataKey={controlledKey}
              name={controlledLabel}
              stroke="#2563EB"
              strokeWidth={2.25}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  return (
    <>
      {/* 
        Small Multiples Chart Cell:
        Fixed height: calc((100vh - 220px) / 2) with min-height 240px and max-height 310px.
        Fits cleanly in a 3-column x 2-row grid on ~1080p screens.
      */}
      <div 
        role="region"
        aria-label={title}
        className="chart-cell bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden shadow-xs hover:border-slate-300 transition"
        style={{ height: 'calc((100vh - 225px) / 2)', minHeight: '235px', maxHeight: '310px' }}
      >
        {/* Single-line Header: Title   Controlled Value   Δ Delta */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-slate-800 text-[11px] truncate tracking-tight">{title}</span>
            <span className="font-mono tabular-nums text-xs font-extrabold text-blue-700 whitespace-nowrap">
              {currentCtrl !== null ? `${currentCtrl.toFixed(unit === '%' ? 1 : 2)} ${unit}` : '—'}
            </span>
            {diff !== null && (
              <span className={`font-mono tabular-nums text-[11px] whitespace-nowrap ${diffColor}`}>
                Δ {diffText}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {isTargetOffScale && (
              <span 
                className="text-[9px] font-mono text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 whitespace-nowrap"
                title={`Target setpoint (${target}M) is above current y-axis viewport`}
              >
                Target {target}M (above range)
              </span>
            )}
            <button
              onClick={() => setIsMaximized(true)}
              title="Maximize chart"
              aria-label={`Maximize ${title}`}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded transition"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Plot Area */}
        <div className="flex-1 w-full min-h-[170px] p-1">
          {renderPlot()}
        </div>
      </div>

      {/* Expanded Modal View */}
      {isMaximized && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div 
            role="dialog"
            aria-modal="true"
            aria-label={`Expanded ${title}`}
            className="w-full max-w-5xl bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col p-5 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  {title} — Expanded View
                </h2>
                <span className="font-mono tabular-nums text-sm font-extrabold text-blue-700">
                  {currentCtrl !== null ? `${currentCtrl.toFixed(2)} ${unit}` : '—'}
                </span>
                {diff !== null && (
                  <span className={`font-mono tabular-nums text-xs ${diffColor}`}>
                    Δ {diffText}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => setIsMaximized(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Expanded Plot */}
            <div className="w-full h-[450px]">
              {renderPlot()}
            </div>


            {/* Trajectory Stats Summary */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Controlled Min / Max</span>
                  <span className="font-bold text-blue-700">{stats.controlled.min.toFixed(2)} / {stats.controlled.max.toFixed(2)} {unit}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Uncontrolled Min / Max</span>
                  <span className="font-bold text-slate-700">{stats.uncontrolled.min.toFixed(2)} / {stats.uncontrolled.max.toFixed(2)} {unit}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Net Trajectory Difference</span>
                  <span className={`font-bold ${diffColor}`}>Δ {diffText}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Target Setpoint</span>
                  <span className="font-bold text-emerald-700">{target ? `${target} ${unit}` : 'N/A'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
