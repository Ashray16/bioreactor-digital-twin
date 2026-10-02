import { useState, useMemo, useEffect } from 'react';
import { AlertCircle, Loader2, Maximize2 } from 'lucide-react';
import { TimeSeriesDataPoint, CompositeEventMarker, OperatingEnvelope, SeriesConfig } from './chartTypes';
import TimeSeriesChart from './TimeSeriesChart';
import ChartToolbar from './ChartToolbar';
import { MetaTag } from '../common/Badges';
import { GLUCOSE_THRESHOLD_LOW, LACTATE_THRESHOLD_HIGH } from '../../config/constants';

interface AnalyticalChartProps {
  title: string;
  subtitle?: string;
  source: 'MECHANISTIC' | 'AI' | 'HISTORICAL';
  data: TimeSeriesDataPoint[];
  series: SeriesConfig[];
  events?: CompositeEventMarker[];
  targets?: Array<{ y: number; label: string; stroke: string }>;
  envelopes?: OperatingEnvelope[];
  yDomain?: [number | string, number | string];
  syncId?: string;
  loading?: boolean;
  error?: string | null;
  height?: number;
  disturbanceWindow?: { start: number; end: number; label?: string } | null;
  hideToolbar?: boolean;
  showEventsProp?: boolean;
  visibleDomainProp?: [number, number] | null;
}

export default function AnalyticalChart({
  title,
  subtitle,
  source,
  data = [],
  series = [],
  events = [],
  targets = [],
  envelopes = [],
  yDomain,
  syncId,
  loading = false,
  error = null,
  height = 200,
  disturbanceWindow = null,
  hideToolbar = false,
  showEventsProp,
  visibleDomainProp,
}: AnalyticalChartProps) {
  const [visibleDomain, setVisibleDomain] = useState<[number, number] | null>(null);
  const [timeRange, setTimeRange] = useState<string>('ALL');
  const [showEvents, setShowEvents] = useState<boolean>(true);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [visibleKeys, setVisibleKeys] = useState<string[]>(series.map((s) => s.key));

  useEffect(() => {
    if (!isMaximized) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMaximized(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized]);

  // Handle range calculations
  const maxTime = useMemo(() => {
    if (!data.length) return 0;
    return Math.max(...data.map((d) => d.time));
  }, [data]);

  const handleChangeTimeRange = (range: string) => {
    setTimeRange(range);
    if (range === 'ALL' || !data.length) {
      setVisibleDomain(null);
    } else {
      const hours = parseInt(range);
      if (!isNaN(hours)) {
        setVisibleDomain([Math.max(0, maxTime - hours), maxTime]);
      }
    }
  };

  const handleZoom = (left: number, right: number) => {
    setVisibleDomain([left, right]);
    setTimeRange('CUSTOM');
  };

  const handleResetZoom = () => {
    setVisibleDomain(null);
    setTimeRange('ALL');
  };

  const effectiveDomain = visibleDomainProp !== undefined ? visibleDomainProp : visibleDomain;
  const effectiveShowEvents = showEventsProp !== undefined ? showEventsProp : showEvents;

  // Visible Data calculations
  const visibleData = useMemo(() => {
    if (!effectiveDomain) return data;
    const [min, max] = effectiveDomain;
    return data.filter((d) => d.time >= min && d.time <= max);
  }, [data, effectiveDomain]);

  // Statistics calculation for all active keys in visible data
  const stats = useMemo(() => {
    const results: Record<string, { current: number; min: number; max: number; avg: number; trend: number; trendPct: number }> = {};
    
    if (!visibleData.length) return results;

    series.forEach((s) => {
      const vals = visibleData.map((d) => d[s.key]).filter((v) => typeof v === 'number');
      if (!vals.length) return;

      const current = vals[vals.length - 1];
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      
      const first = vals[0];
      const trend = current - first;
      const trendPct = first !== 0 ? (trend / first) * 100 : 0;

      results[s.key] = { current, min, max, avg, trend, trendPct };
    });

    return results;
  }, [visibleData, series]);

  // CSV Export utility
  const handleExportCSV = () => {
    if (!visibleData.length) return;

    const headers = ['Time (hours)', ...series.map((s) => s.name)];
    const rows = visibleData.map((d) => [
      d.time,
      ...series.map((s) => (d[s.key] !== undefined ? d[s.key] : '')),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((val) => (typeof val === 'number' ? val.toFixed(4) : val)).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${title.toLowerCase().replace(/\s+/g, '_')}_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleToggleSeries = (key: string) => {
    setVisibleKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Filter series configs based on visibility toggle
  const filteredSeriesConfigs = useMemo(() => {
    return series.filter((s) => visibleKeys.includes(s.key));
  }, [series, visibleKeys]);

  // Downsample helper for rendering performance
  const downsampleData = (rawData: TimeSeriesDataPoint[], maxPoints = 500): TimeSeriesDataPoint[] => {
    if (rawData.length <= maxPoints) return rawData;
    const factor = Math.ceil(rawData.length / maxPoints);
    const result: TimeSeriesDataPoint[] = [];
    for (let i = 0; i < rawData.length; i += factor) {
      result.push(rawData[i]);
    }
    if (rawData.length > 0 && result[result.length - 1].time !== rawData[rawData.length - 1].time) {
      result.push(rawData[rawData.length - 1]);
    }
    return result;
  };

  // Render content of the chart viewport
  const renderChartContent = (isModal: boolean) => {
    if (loading) {
      return (
        <div className="h-56 flex flex-col items-center justify-center text-slate-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs font-mono">Loading telemetry...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="h-56 flex flex-col items-center justify-center text-red-600 gap-2 p-4 text-center">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <span className="text-xs font-bold font-mono">Error: {error}</span>
        </div>
      );
    }

    if (!data || !data.length) {
      return (
        <div className="h-56 flex flex-col items-center justify-center text-slate-400 gap-2 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <span className="text-xs font-mono">No simulation telemetry available</span>
        </div>
      );
    }

    const activeDataset = (isModal ? visibleDomain : effectiveDomain) ? visibleData : data;
    const chartData = activeDataset.length > 500 ? downsampleData(activeDataset, 500) : activeDataset;

    return (
      <TimeSeriesChart
        data={chartData}
        series={filteredSeriesConfigs}
        syncId={syncId}
        visibleDomain={isModal ? visibleDomain : effectiveDomain}
        onZoom={handleZoom}
        showEvents={isModal ? showEvents : effectiveShowEvents}
        events={events}
        targets={targets}
        envelopes={envelopes}
        yDomain={yDomain}
        height={isModal ? 480 : height}
        disturbanceWindow={disturbanceWindow}
      />
    );
  };

  return (
    <>
      {/* 1. Main View Card */}
      <div 
        role="region" 
        aria-label={title}
        className="border border-slate-200 rounded-md bg-white p-4 space-y-3 shadow-none font-sans"
      >
        {/* Header Block */}
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-xs font-semibold text-slate-900">
              {title}
            </h3>
            {subtitle && <p className="text-[10px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Interactive Legend for Toggling Series */}
            {series.length > 1 && (
              <div className="flex flex-wrap gap-1 text-[10px] font-medium">
                {series.map((s) => {
                  const active = visibleKeys.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      onClick={() => handleToggleSeries(s.key)}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition ${
                        active
                          ? 'bg-slate-50 border-slate-200 text-slate-700'
                          : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: active ? s.stroke : '#CBD5E1' }}
                      />
                      <span>{s.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Header Maximize Button */}
            <button
              type="button"
              onClick={() => setIsMaximized(true)}
              title={`Maximize ${title}`}
              aria-label={`Maximize ${title}`}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Visibility stats row if loaded */}
        {data.length > 0 && !loading && !error && (
          <div className="space-y-1.5">
            {series.filter((s) => visibleKeys.includes(s.key)).length === 1 ? (
              // Clean horizontal summary for single-series charts
              (() => {
                const s = series.find((item) => visibleKeys.includes(item.key));
                if (!s) return null;
                const valStats = stats[s.key];
                if (!valStats) return null;

                const isFlat = Math.abs(valStats.trend) < 0.0001;

                let currentFormatted = valStats.current.toFixed(2);
                let changeFormatted = '';
                let alertElement: React.ReactNode = null;

                if (s.key === 'viableDensity') {
                  currentFormatted = `${valStats.current.toFixed(2)} × 10⁶ cells/mL`;
                  changeFormatted = `Δ ${valStats.trend >= 0 ? '+' : '−'}${Math.abs(valStats.trend).toFixed(2)}`;
                } else if (s.key === 'cellViability') {
                  currentFormatted = `${valStats.current.toFixed(1)}%`;
                  changeFormatted = `Δ ${valStats.trend >= 0 ? '+' : '−'}${Math.abs(valStats.trend).toFixed(1)}%`;
                  if (valStats.current < 90) {
                    alertElement = (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 font-sans">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Low (&lt;90%)
                      </span>
                    );
                  }
                } else if (s.key === 'glucose') {
                  currentFormatted = `${valStats.current.toFixed(2)} g/L`;
                  changeFormatted = `Δ ${valStats.trend >= 0 ? '+' : '−'}${Math.abs(valStats.trend).toFixed(2)}`;
                  if (valStats.current < GLUCOSE_THRESHOLD_LOW) {
                    alertElement = (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 font-sans">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Low (&lt;{GLUCOSE_THRESHOLD_LOW.toFixed(1)} g/L)
                      </span>
                    );
                  }
                } else if (s.key === 'lactate') {
                  currentFormatted = `${valStats.current.toFixed(2)} g/L`;
                  changeFormatted = `Δ ${valStats.trend >= 0 ? '+' : '−'}${Math.abs(valStats.trend).toFixed(2)}`;
                  if (valStats.current > LACTATE_THRESHOLD_HIGH) {
                    alertElement = (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 font-sans">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        High (&gt;{LACTATE_THRESHOLD_HIGH.toFixed(1)} g/L)
                      </span>
                    );
                  }
                } else if (s.key === 'perfusionRate') {
                  currentFormatted = `${valStats.current.toFixed(2)} VVD`;
                  changeFormatted = isFlat ? 'Constant' : `Δ ${valStats.trend >= 0 ? '+' : '−'}${Math.abs(valStats.trend).toFixed(2)}`;
                } else if (s.key === 'foulingIndex') {
                  currentFormatted = `${valStats.current.toFixed(1)} / 100`;
                  changeFormatted = `Δ ${valStats.trend >= 0 ? '+' : '−'}${Math.abs(valStats.trend).toFixed(1)}`;
                  if (valStats.current >= 70) {
                    alertElement = (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 font-sans">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Fouling Alarm (≥70)
                      </span>
                    );
                  }
                } else {
                  changeFormatted = `Δ ${valStats.trend >= 0 ? '+' : '−'}${Math.abs(valStats.trend).toFixed(2)}`;
                }

                return (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 py-0.5 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-slate-500">Current:</span>
                      <span className="text-sm font-bold text-slate-900 font-mono tabular-nums whitespace-nowrap">
                        {currentFormatted}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                        ({changeFormatted})
                      </span>
                      {alertElement && (
                        <div className="ml-1">{alertElement}</div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
                      <span>min <strong className="text-slate-600 font-semibold">{valStats.min.toFixed(1)}</strong></span>
                      <span>·</span>
                      <span>max <strong className="text-slate-600 font-semibold">{valStats.max.toFixed(1)}</strong></span>
                      <span>·</span>
                      <span>avg <strong className="text-slate-600 font-semibold">{valStats.avg.toFixed(1)}</strong></span>
                    </div>
                  </div>
                );
              })()
            ) : (
              // Multi-series clean readouts
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 px-1 py-0.5">
                {series.map((s) => {
                  if (!visibleKeys.includes(s.key)) return null;
                  const valStats = stats[s.key];
                  if (!valStats) return null;

                  return (
                    <div key={s.key} className="flex items-center justify-between gap-2 border border-slate-100 rounded px-2.5 py-1 bg-slate-50/50">
                      <span className="text-[11px] text-slate-500 truncate">{s.name}</span>
                      <span className="text-xs font-bold text-slate-900 font-mono tabular-nums">
                        {valStats.current.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Toolbar Controls */}
        {!hideToolbar && data.length > 0 && !loading && !error && (
          <ChartToolbar
            isMaximized={false}
            onToggleMaximize={() => setIsMaximized(true)}
            isZoomed={visibleDomain !== null}
            onResetZoom={handleResetZoom}
            showEvents={showEvents}
            onToggleEvents={() => setShowEvents((prev) => !prev)}
            onExportCSV={handleExportCSV}
            timeRange={timeRange}
            onChangeTimeRange={handleChangeTimeRange}
          />
        )}

        {/* Telemetry Chart Container */}
        <div className="pt-2">{renderChartContent(false)}</div>
      </div>

      {/* 2. Fullscreen Maximize Overlay Modal */}
      {isMaximized && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div 
            role="dialog"
            aria-modal="true"
            aria-label={`Expanded view: ${title}`}
            className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  {source !== 'MECHANISTIC' && (
                    <MetaTag label={source} />
                  )}
                  <h2 className="text-base font-extrabold text-slate-950 uppercase tracking-wider">
                    {title} (Expanded Analysis)
                  </h2>
                </div>
                {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
              </div>

              {/* Interactive Legend for Toggling Series (Modal) */}
              {series.length > 1 && (
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  {series.map((s) => {
                    const active = visibleKeys.includes(s.key);
                    return (
                      <button
                        key={s.key}
                        onClick={() => handleToggleSeries(s.key)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border transition ${
                          active
                            ? 'bg-slate-50 border-slate-200 text-slate-700'
                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: active ? s.stroke : '#CBD5E1' }}
                        />
                        <span>{s.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Viewport stats row inside Modal */}
            {data.length > 0 && !loading && !error && (
              <div className="space-y-2">
                {series.filter((s) => visibleKeys.includes(s.key)).length === 1 ? (
                  (() => {
                    const s = series.find((item) => visibleKeys.includes(item.key));
                    if (!s) return null;
                    const valStats = stats[s.key];
                    if (!valStats) return null;

                    const isFlat = Math.abs(valStats.trend) < 0.0001;

                    let currentFormatted = valStats.current.toFixed(2);
                    let changeFormatted = '';
                    let statusBadge = '';
                    let statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';

                    if (s.key === 'viableDensity') {
                      currentFormatted = `${valStats.current.toFixed(2)} × 10⁶ cells/mL`;
                      changeFormatted = `Growth: +${valStats.trend.toFixed(2)} × 10⁶ cells/mL`;
                      const pctTarget = Math.round((valStats.current / 100.0) * 100);
                      statusBadge = `${pctTarget}% of 100M Target`;
                      statusColor = 'text-blue-700 bg-blue-50 border-blue-200';
                    } else if (s.key === 'cellViability') {
                      currentFormatted = `${valStats.current.toFixed(1)}%`;
                      changeFormatted = `${valStats.trend >= 0 ? '+' : '−'}${Math.abs(valStats.trend).toFixed(1)} percentage points`;
                      statusBadge = valStats.current >= 90 ? 'Healthy (≥90%)' : 'Stressed (<90%)';
                      statusColor = valStats.current >= 90 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200';
                    } else if (s.key === 'glucose') {
                      currentFormatted = `${valStats.current.toFixed(2)} g/L`;
                      changeFormatted = `Δ ${valStats.trend >= 0 ? '+' : '−'}${Math.abs(valStats.trend).toFixed(2)} g/L`;
                      statusBadge = valStats.current >= 1.5 ? 'SAFE / ABOVE LOW-GLUCOSE LIMIT' : 'ALERT / LOW GLUCOSE';
                      statusColor = valStats.current >= 1.5 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200';
                    } else if (s.key === 'lactate') {
                      currentFormatted = `${valStats.current.toFixed(2)} g/L`;
                      changeFormatted = `Δ ${valStats.trend >= 0 ? '+' : '−'}${Math.abs(valStats.trend).toFixed(2)} g/L`;
                      statusBadge = valStats.current <= 3.5 ? 'SAFE / BELOW LACTATE LIMIT' : 'ALERT / ELEVATED LACTATE';
                      statusColor = valStats.current <= 3.5 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200';
                    } else if (s.key === 'perfusionRate') {
                      currentFormatted = `${valStats.current.toFixed(2)} VVD`;
                      changeFormatted = isFlat ? 'Fixed during run' : `Δ ${valStats.trend >= 0 ? '+' : '−'}${Math.abs(valStats.trend).toFixed(2)} VVD`;
                      statusBadge = isFlat ? 'Fixed (0 Interventions)' : 'Adaptive Active';
                      statusColor = isFlat ? 'text-slate-650 bg-slate-100 border-slate-200' : 'text-blue-700 bg-blue-50 border-blue-200';
                    } else if (s.key === 'foulingIndex') {
                      currentFormatted = `${valStats.current.toFixed(1)} / 100`;
                      changeFormatted = `Δ ${valStats.trend >= 0 ? '+' : '−'}${Math.abs(valStats.trend).toFixed(1)} pts`;
                      statusBadge = valStats.current <= 70 ? 'SAFE / BELOW FOULING LIMIT' : 'ALERT / HIGH FOULING RISK';
                      statusColor = valStats.current <= 70 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200';
                    } else {
                      changeFormatted = `Δ ${valStats.trend >= 0 ? '+' : '−'}${Math.abs(valStats.trend).toFixed(2)}`;
                    }

                    return (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">Current:</span>
                            <span className="text-xl font-extrabold text-slate-900 font-mono whitespace-nowrap">
                              {currentFormatted}
                            </span>
                          </div>
                          <span className="text-xs font-mono text-slate-600 font-medium px-2.5 py-0.5 rounded-md bg-white border border-slate-200 shadow-2xs whitespace-nowrap">
                            {changeFormatted}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {statusBadge && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border font-mono whitespace-nowrap ${statusColor}`}>
                              {statusBadge}
                            </span>
                          )}

                          <div className="flex items-center gap-3 font-mono text-xs text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-2xs">
                            <span>Min: <strong className="text-slate-700 font-bold">{valStats.min.toFixed(2)}</strong></span>
                            <span className="text-slate-300">|</span>
                            <span>Max: <strong className="text-slate-700 font-bold">{valStats.max.toFixed(2)}</strong></span>
                            <span className="text-slate-300">|</span>
                            <span>Avg: <strong className="text-slate-700 font-bold">{valStats.avg.toFixed(2)}</strong></span>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {series.map((s) => {
                      if (!visibleKeys.includes(s.key)) return null;
                      const valStats = stats[s.key];
                      if (!valStats) return null;

                      const isFlat = Math.abs(valStats.trend) < 0.0001;

                      let currentFormatted = valStats.current.toFixed(2);
                      let changeFormatted = '';
                      let statusBadge = '';
                      let statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';

                      if (s.key === 'viableDensity') {
                        currentFormatted = `${valStats.current.toFixed(2)} × 10⁶ cells/mL`;
                        changeFormatted = `Growth: +${valStats.trend.toFixed(2)} × 10⁶ cells/mL`;
                        const pctTarget = Math.round((valStats.current / 100.0) * 100);
                        statusBadge = `${pctTarget}% of 100M Target`;
                        statusColor = 'text-blue-700 bg-blue-50 border-blue-200';
                      } else if (s.key === 'cellViability') {
                        currentFormatted = `${valStats.current.toFixed(1)}%`;
                        changeFormatted = `${valStats.trend >= 0 ? '+' : '−'}${Math.abs(valStats.trend).toFixed(1)} percentage points`;
                        statusBadge = valStats.current >= 90 ? 'Healthy (≥90%)' : 'Stressed (<90%)';
                        statusColor = valStats.current >= 90 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200';
                      } else if (s.key === 'glucose') {
                        currentFormatted = `${valStats.current.toFixed(2)} g/L`;
                        changeFormatted = `Δ ${valStats.trend >= 0 ? '+' : '−'}${Math.abs(valStats.trend).toFixed(2)} g/L`;
                        statusBadge = valStats.current >= 1.5 ? 'SAFE / ABOVE LOW-GLUCOSE LIMIT' : 'ALERT / LOW GLUCOSE';
                        statusColor = valStats.current >= 1.5 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200';
                      } else if (s.key === 'lactate') {
                        currentFormatted = `${valStats.current.toFixed(2)} g/L`;
                        changeFormatted = `Δ ${valStats.trend >= 0 ? '+' : '−'}${Math.abs(valStats.trend).toFixed(2)} g/L`;
                        statusBadge = valStats.current <= 3.5 ? 'SAFE / BELOW LACTATE LIMIT' : 'ALERT / ELEVATED LACTATE';
                        statusColor = valStats.current <= 3.5 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200';
                      } else if (s.key === 'perfusionRate') {
                        currentFormatted = `${valStats.current.toFixed(2)} VVD`;
                        changeFormatted = isFlat ? 'Fixed during run' : `Δ ${valStats.trend >= 0 ? '+' : '−'}${Math.abs(valStats.trend).toFixed(2)} VVD`;
                        statusBadge = isFlat ? 'Fixed (0 Interventions)' : 'Adaptive Active';
                        statusColor = isFlat ? 'text-slate-650 bg-slate-100 border-slate-200' : 'text-blue-700 bg-blue-50 border-blue-200';
                      } else if (s.key === 'foulingIndex') {
                        currentFormatted = `${valStats.current.toFixed(1)} / 100`;
                        changeFormatted = `Δ ${valStats.trend >= 0 ? '+' : '−'}${Math.abs(valStats.trend).toFixed(1)} pts`;
                        statusBadge = valStats.current <= 70 ? 'SAFE / BELOW FOULING LIMIT' : 'ALERT / HIGH FOULING RISK';
                        statusColor = valStats.current <= 70 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200';
                      } else {
                        changeFormatted = `Δ ${valStats.trend >= 0 ? '+' : '−'}${Math.abs(valStats.trend).toFixed(2)}`;
                      }

                      return (
                        <div key={s.key} className="space-y-1 text-xs">
                          <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold uppercase">
                            <span>{s.name}</span>
                            <span className="font-mono">Current</span>
                          </div>
                          <div className="flex items-baseline justify-between">
                            <span className="text-lg font-extrabold text-slate-900 font-mono">
                              {currentFormatted}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-600">
                            {changeFormatted}
                          </div>
                          {statusBadge && (
                            <div className="pt-1">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border font-mono truncate max-w-full ${statusColor}`}>
                                {statusBadge}
                              </span>
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-2 font-mono text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                            <div>
                              <span>Min:</span> <strong className="text-slate-700">{valStats.min.toFixed(2)}</strong>
                            </div>
                            <div>
                              <span>Max:</span> <strong className="text-slate-700">{valStats.max.toFixed(2)}</strong>
                            </div>
                            <div>
                              <span>Avg:</span> <strong className="text-slate-700">{valStats.avg.toFixed(2)}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Modal Controls */}
            {data.length > 0 && !loading && !error && (
              <ChartToolbar
                isMaximized={true}
                onToggleMaximize={() => setIsMaximized(false)}
                isZoomed={visibleDomain !== null}
                onResetZoom={handleResetZoom}
                showEvents={showEvents}
                onToggleEvents={() => setShowEvents((prev) => !prev)}
                onExportCSV={handleExportCSV}
                timeRange={timeRange}
                onChangeTimeRange={handleChangeTimeRange}
              />
            )}

            {/* Maximized Chart Viewport */}
            <div className="flex-1 w-full bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-center justify-center min-h-[350px]">
              {renderChartContent(true)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
