import { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine
} from 'recharts';
import { AlertCircle, Loader2, Maximize2, Minimize2, Download } from 'lucide-react';
import { DistributionSeries, DistributionType } from './chartTypes';
import { MetaTag } from '../common/Badges';

interface DistributionChartProps {
  type: DistributionType;
  title: string;
  subtitle?: string;
  series: DistributionSeries[];
  source: 'MECHANISTIC' | 'AI' | 'HISTORICAL';
  bins?: number;
  showMean?: boolean;
  showMedian?: boolean;
  showOutliers?: boolean;
  height?: number;
  loading?: boolean;
  error?: string | null;
}

interface BoxPlotStats {
  key: string;
  label: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  iqr: number;
  mean: number;
  stdDev: number;
  outliers: number[];
  whiskerMin: number;
  whiskerMax: number;
  count: number;
}

export default function DistributionChart({
  type,
  title,
  subtitle,
  series = [],
  source,
  bins = 10,
  showMean = true,
  showMedian = true,
  showOutliers = true,
  height = 240,
  loading = false,
  error = null,
}: DistributionChartProps) {
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

  // Tooltip state for custom box plot
  const [hoveredBox, setHoveredBox] = useState<{
    stats: BoxPlotStats;
    x: number;
    y: number;
  } | null>(null);

  // Sync keys if series changes
  useMemo(() => {
    setVisibleKeys((prev) => {
      const keys = series.map((s) => s.key);
      return prev.filter((k) => keys.includes(k));
    });
  }, [series]);

  // Filters active series based on visibility checklist
  const activeSeries = useMemo(() => {
    return series.filter((s) => visibleKeys.includes(s.key) || visibleKeys.length === 0);
  }, [series, visibleKeys]);

  // Helper: clean actual number array
  const getCleanValues = (arr: number[]) => {
    return arr.filter((v) => typeof v === 'number' && !isNaN(v) && isFinite(v));
  };

  // 1. Calculate Quartiles and Box Plot stats
  const boxPlotStats = useMemo<BoxPlotStats[]>(() => {
    return activeSeries.map((s) => {
      const vals = getCleanValues(s.values).sort((a, b) => a - b);
      const count = vals.length;

      if (count === 0) {
        return {
          key: s.key,
          label: s.label,
          min: 0,
          q1: 0,
          median: 0,
          q3: 0,
          max: 0,
          iqr: 0,
          mean: 0,
          stdDev: 0,
          outliers: [],
          whiskerMin: 0,
          whiskerMax: 0,
          count: 0
        };
      }

      const mean = vals.reduce((a, b) => a + b, 0) / count;
      const getMedian = (arr: number[]) => {
        const mid = Math.floor(arr.length / 2);
        return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
      };
      
      const median = getMedian(vals);
      
      const mid = Math.floor(vals.length / 2);
      const lowerHalf = vals.slice(0, mid);
      const upperHalf = vals.slice(vals.length % 2 === 0 ? mid : mid + 1);
      
      const q1 = getMedian(lowerHalf.length ? lowerHalf : [vals[0]]);
      const q3 = getMedian(upperHalf.length ? upperHalf : [vals[vals.length - 1]]);
      const iqr = q3 - q1;

      // Outlier filters
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;

      const outliers = showOutliers ? vals.filter((v) => v < lowerBound || v > upperBound) : [];
      const nonOutliers = vals.filter((v) => v >= lowerBound && v <= upperBound);

      const whiskerMin = nonOutliers.length ? nonOutliers[0] : q1;
      const whiskerMax = nonOutliers.length ? nonOutliers[nonOutliers.length - 1] : q3;

      const min = vals[0];
      const max = vals[vals.length - 1];

      // Standard deviation
      const variance = count > 1 ? vals.map((v) => Math.pow(v - mean, 2)).reduce((a, b) => a + b, 0) / (count - 1) : 0;
      const stdDev = Math.sqrt(variance);

      return {
        key: s.key,
        label: s.label,
        min,
        q1,
        median,
        q3,
        max,
        iqr,
        mean,
        stdDev,
        outliers,
        whiskerMin,
        whiskerMax,
        count
      };
    });
  }, [activeSeries, showOutliers]);

  // 2. Generate Aligned Histogram Bins
  const histogramData = useMemo(() => {
    if (!activeSeries.length) return [];

    // Find global range
    let globalValues: number[] = [];
    activeSeries.forEach((s) => {
      globalValues = globalValues.concat(getCleanValues(s.values));
    });

    if (!globalValues.length) return [];

    const minVal = Math.min(...globalValues);
    const maxVal = Math.max(...globalValues);

    // Single observation or all values identical
    if (minVal === maxVal) {
      const label = `${minVal.toFixed(2)}`;
      const dataRow: any = { binLabel: label, rangeStart: minVal, rangeEnd: minVal };
      activeSeries.forEach((s) => {
        const cleanVals = getCleanValues(s.values);
        dataRow[s.key] = cleanVals.length;
      });
      return [dataRow];
    }

    const numBins = bins || 10;
    const binWidth = (maxVal - minVal) / numBins;
    const computedBins = [];

    for (let i = 0; i < numBins; i++) {
      const rangeStart = minVal + i * binWidth;
      const rangeEnd = minVal + (i + 1) * binWidth;
      const label = `${rangeStart.toFixed(1)}–${rangeEnd.toFixed(1)}`;
      
      const dataRow: any = {
        binLabel: label,
        rangeStart,
        rangeEnd
      };

      activeSeries.forEach((s) => {
        const cleanVals = getCleanValues(s.values);
        const count = cleanVals.filter((v) => 
          i === numBins - 1
            ? v >= rangeStart && v <= rangeEnd
            : v >= rangeStart && v < rangeEnd
        ).length;

        dataRow[s.key] = count;
      });

      computedBins.push(dataRow);
    }

    return computedBins;
  }, [activeSeries, bins]);

  // CSV Export utility
  const handleExportCSV = () => {
    if (!activeSeries.length) return;

    const headers = ['SeriesKey', 'SeriesLabel', 'Value'];
    const rows: any[][] = [];

    activeSeries.forEach((s) => {
      const cleanVals = getCleanValues(s.values);
      cleanVals.forEach((val) => {
        rows.push([s.key, s.label, val]);
      });
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((v) => (typeof v === 'number' ? v.toFixed(4) : v)).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${title.toLowerCase().replace(/\s+/g, '_')}_distribution.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleToggleSeries = (key: string) => {
    setVisibleKeys((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key]
    );
  };

  // Custom colors for series rendering
  const getSeriesColor = (index: number) => {
    const colors = ['#2563EB', '#64748B', '#059669', '#D97706', '#8B5CF6'];
    return colors[index % colors.length];
  };

  // Core Renderers
  const renderHistogram = () => {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={histogramData} margin={{ top: 10, right: 15, left: -25, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="binLabel" stroke="#94A3B8" tick={{ fontSize: 11, fill: '#64748B' }} />
          <YAxis stroke="#94A3B8" tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'monospace' }} allowDecimals={false} />
          
          <RechartsTooltip
            contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', borderRadius: '8px', fontSize: '11px' }}
            formatter={(value: any, name: any) => {
              const seriesObj = series.find((s) => s.key === name);
              return [`${value} observations`, seriesObj?.label || name];
            }}
          />

          {/* Render markers for overall Mean/Median if toggled */}
          {showMean && activeSeries.length === 1 && boxPlotStats[0] && (
            <ReferenceLine
              x={histogramData.find((bin) => 
                boxPlotStats[0].mean >= bin.rangeStart && boxPlotStats[0].mean <= bin.rangeEnd
              )?.binLabel}
              stroke="#D97706"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              label={{ value: 'Mean', fill: '#D97706', fontSize: 9, position: 'insideTopLeft' }}
            />
          )}

          {showMedian && activeSeries.length === 1 && boxPlotStats[0] && (
            <ReferenceLine
              x={histogramData.find((bin) => 
                boxPlotStats[0].median >= bin.rangeStart && boxPlotStats[0].median <= bin.rangeEnd
              )?.binLabel}
              stroke="#2563EB"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              label={{ value: 'Median', fill: '#2563EB', fontSize: 9, position: 'insideTopRight' }}
            />
          )}

          {activeSeries.map((s, idx) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.key}
              fill={getSeriesColor(idx)}
              radius={[3, 3, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderBoxPlot = () => {
    // Custom SVG renderer for box plot
    const svgWidth = 600;
    const svgHeight = 240;
    const margin = { top: 20, right: 30, bottom: 30, left: 50 };

    if (!boxPlotStats.length || boxPlotStats.every((s) => s.count === 0)) {
      return (
        <div className="h-56 flex items-center justify-center text-slate-400 font-mono text-xs">
          No observations loaded to calculate quartiles
        </div>
      );
    }

    // Determine global Y scale bounds
    const allWhiskersAndOutliers = boxPlotStats.flatMap((s) => [
      s.whiskerMin,
      s.whiskerMax,
      ...s.outliers
    ]);

    const yMin = Math.min(...allWhiskersAndOutliers);
    const yMax = Math.max(...allWhiskersAndOutliers);
    const yRange = yMax - yMin;
    
    // Add 10% padding but clamp at physical lower bound >= 0
    const padding = yRange === 0 ? 1 : yRange * 0.1;
    const chartYMin = Math.max(0, yMin - padding);
    const chartYMax = yMax + padding;

    // Helper: Map data value to SVG coordinate
    const getYSVG = (val: number) => {
      const scaleRange = chartYMax - chartYMin;
      const pct = (val - chartYMin) / (scaleRange === 0 ? 1 : scaleRange);
      return margin.top + (1 - pct) * (svgHeight - margin.top - margin.bottom);
    };

    const numBoxes = boxPlotStats.length;
    const availableWidth = svgWidth - margin.left - margin.right;
    const boxSpacing = availableWidth / (numBoxes + 1);

    return (
      <div className="w-full relative">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto max-h-56">
          {/* Subtle Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
            const val = chartYMin + p * (chartYMax - chartYMin);
            const y = getYSVG(val);
            return (
              <g key={idx}>
                <line
                  x1={margin.left}
                  y1={y}
                  x2={svgWidth - margin.right}
                  y2={y}
                  stroke="#F1F5F9"
                  strokeWidth={1}
                />
                <text
                  x={margin.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#64748B"
                  className="font-mono text-[11px]"
                >
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Render Box Plots */}
          {boxPlotStats.map((s, idx) => {
            if (s.count === 0) return null;

            const x = margin.left + (idx + 1) * boxSpacing;
            const boxWidth = Math.min(40, boxSpacing * 0.5);
            const strokeColor = getSeriesColor(idx);

            const yMinWhisker = getYSVG(s.whiskerMin);
            const yMaxWhisker = getYSVG(s.whiskerMax);
            const yQ1 = getYSVG(s.q1);
            const yQ3 = getYSVG(s.q3);
            const yMedian = getYSVG(s.median);
            const yMean = getYSVG(s.mean);

            return (
              <g
                key={s.key}
                onMouseEnter={(e) => {
                  setHoveredBox({
                    stats: s,
                    x: e.currentTarget.getBoundingClientRect().left - e.currentTarget.parentElement!.getBoundingClientRect().left,
                    y: yMedian - 40
                  });
                }}
                onMouseLeave={() => setHoveredBox(null)}
                className="cursor-pointer group"
              >
                {/* 1. Whiskers */}
                {/* Lower Whisker Line */}
                <line
                  x1={x}
                  y1={yMinWhisker}
                  x2={x}
                  y2={yQ1}
                  stroke={strokeColor}
                  strokeWidth={2}
                  strokeDasharray="2 2"
                />
                {/* Upper Whisker Line */}
                <line
                  x1={x}
                  y1={yQ3}
                  x2={x}
                  y2={yMaxWhisker}
                  stroke={strokeColor}
                  strokeWidth={2}
                  strokeDasharray="2 2"
                />
                {/* Whisker Caps */}
                <line
                  x1={x - boxWidth / 4}
                  y1={yMinWhisker}
                  x2={x + boxWidth / 4}
                  y2={yMinWhisker}
                  stroke={strokeColor}
                  strokeWidth={2}
                />
                <line
                  x1={x - boxWidth / 4}
                  y1={yMaxWhisker}
                  x2={x + boxWidth / 4}
                  y2={yMaxWhisker}
                  stroke={strokeColor}
                  strokeWidth={2}
                />

                {/* 2. Main Box Rectangle */}
                <rect
                  x={x - boxWidth / 2}
                  y={yQ3}
                  width={boxWidth}
                  height={Math.max(2, yQ1 - yQ3)}
                  fill="rgba(255,255,255,0.9)"
                  stroke={strokeColor}
                  strokeWidth={2}
                  className="group-hover:fill-slate-50 transition-colors"
                />

                {/* 3. Median Marker */}
                <line
                  x1={x - boxWidth / 2}
                  y1={yMedian}
                  x2={x + boxWidth / 2}
                  y2={yMedian}
                  stroke={strokeColor}
                  strokeWidth={3}
                />

                {/* 4. Optional Mean Marker (cross indicator or circle outline) */}
                {showMean && (
                  <circle
                    cx={x}
                    cy={yMean}
                    r={3}
                    fill="none"
                    stroke="#D97706"
                    strokeWidth={1.5}
                  />
                )}

                {/* 5. Outliers (Red filled dots) */}
                {s.outliers.map((val, oIdx) => (
                  <circle
                    key={oIdx}
                    cx={x}
                    cy={getYSVG(val)}
                    r={3.5}
                    fill="#EF4444"
                    stroke="none"
                  />
                ))}

                {/* Series Label at the X axis */}
                <text
                  x={x}
                  y={svgHeight - margin.bottom + 16}
                  textAnchor="middle"
                  fill="#64748B"
                  className="font-bold text-[10px]"
                >
                  {s.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Dynamic Box Plot Tooltip Popover */}
        {hoveredBox && (
          <div
            className="absolute z-20 bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-xl text-xs font-sans space-y-1 max-w-[200px]"
            style={{
              left: `${Math.min(svgWidth - 180, Math.max(margin.left, hoveredBox.x - 70))}px`,
              top: `${Math.max(5, hoveredBox.y)}px`
            }}
          >
            <div className="font-bold text-slate-800 border-b border-slate-100 pb-1 flex justify-between gap-2">
              <span className="truncate">{hoveredBox.stats.label}</span>
              <span className="text-[10px] text-slate-400 font-mono">N={hoveredBox.stats.count}</span>
            </div>
            <div className="space-y-0.5 font-mono text-[10px] text-slate-600">
              <div className="flex justify-between">
                <span>Max:</span> <strong className="text-slate-900">{hoveredBox.stats.max.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Whisker Max:</span> <strong className="text-slate-900">{hoveredBox.stats.whiskerMax.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Q3 (75%):</span> <strong className="text-slate-900">{hoveredBox.stats.q3.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between text-blue-700 font-bold border-y border-slate-100 py-0.5 my-0.5 font-sans">
                <span>Median (50%):</span> <span className="font-mono">{hoveredBox.stats.median.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Q1 (25%):</span> <strong className="text-slate-900">{hoveredBox.stats.q1.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Whisker Min:</span> <strong className="text-slate-900">{hoveredBox.stats.whiskerMin.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Min:</span> <strong className="text-slate-900">{hoveredBox.stats.min.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-0.5 mt-0.5">
                <span>IQR:</span> <strong className="text-slate-900">{hoveredBox.stats.iqr.toFixed(2)}</strong>
              </div>
              {showMean && (
                <div className="flex justify-between text-amber-700">
                  <span>Mean (○):</span> <strong className="font-mono">{hoveredBox.stats.mean.toFixed(2)}</strong>
                </div>
              )}
              {hoveredBox.stats.outliers.length > 0 && (
                <div className="flex justify-between text-red-650 font-bold">
                  <span>Outliers:</span> <span>{hoveredBox.stats.outliers.length}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderContent = (isModal: boolean) => {
    if (loading) {
      return (
        <div className="h-56 flex flex-col items-center justify-center text-slate-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs font-mono">Aggregating observations...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="h-56 flex flex-col items-center justify-center text-slate-500 gap-2 p-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <AlertCircle className="w-5 h-5 text-slate-400" />
          <span className="text-xs font-sans text-slate-600 max-w-sm">{error}</span>
        </div>
      );
    }

    if (!series || !series.length) {
      return (
        <div className="h-56 flex flex-col items-center justify-center text-slate-400 gap-2 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <span className="text-xs font-mono">No distribution observations loaded</span>
        </div>
      );
    }

    if (activeSeries.length === 0) {
      return (
        <div className="h-56 flex flex-col items-center justify-center text-slate-500 gap-1 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-4 text-center">
          <span className="text-xs font-bold font-sans">Select at least one series to display distribution.</span>
        </div>
      );
    }

    return (
      <div className="w-full relative" style={{ height: isModal ? 480 : height }}>
        {type === 'histogram' ? renderHistogram() : renderBoxPlot()}
      </div>
    );
  };

  return (
    <>
      <div 
        role="region"
        aria-label={title}
        className="glass-panel p-5 rounded-xl border border-slate-200 bg-white space-y-4 shadow-sm"
      >
        {/* Card Header Panel */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              {source !== 'MECHANISTIC' && (
                <MetaTag label={source} />
              )}
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                {title}
              </h3>
            </div>
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>

          {/* Legend Checklist Toggles */}
          {series.length > 1 && (
            <div className="flex flex-wrap gap-2 text-[10px] font-bold">
              {series.map((s, idx) => {
                const active = visibleKeys.includes(s.key);
                return (
                  <button
                    key={s.key}
                    onClick={() => handleToggleSeries(s.key)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded border transition ${
                      active
                        ? 'bg-slate-50 border-slate-200 text-slate-700'
                        : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: active ? getSeriesColor(idx) : '#CBD5E1' }}
                    />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Real-time calculated statistics summary */}
        {activeSeries.length > 0 && !loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
            {boxPlotStats.map((s) => {
              if (s.count === 0) return null;
              return (
                <div key={s.key} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase truncate">
                    <span>{s.label}</span>
                    <span className="font-mono">N = {s.count}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-extrabold text-slate-800 font-mono">
                      Median: {s.median.toFixed(2)}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">
                      Mean: {s.mean.toFixed(2)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 font-mono text-[8px] text-slate-400 pt-0.5 border-t border-slate-200/50">
                    <div>
                      <span>Min:</span> <strong className="text-slate-600">{s.min.toFixed(1)}</strong>
                    </div>
                    <div>
                      <span>Max:</span> <strong className="text-slate-600">{s.max.toFixed(1)}</strong>
                    </div>
                    <div>
                      <span>σ (SD):</span> <strong className="text-slate-600">{s.stdDev.toFixed(1)}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Toolbar Panel */}
        {series.length > 0 && !loading && !error && (
          <div className="flex items-center justify-end gap-2 bg-slate-50/80 p-2 rounded-lg border border-slate-100 text-xs">
            {/* CSV Export */}
            <button
              onClick={handleExportCSV}
              title="Export CSV"
              className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            {/* Maximize */}
            <button
              onClick={() => setIsMaximized(true)}
              title="Maximize"
              className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold transition"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Maximize</span>
            </button>
          </div>
        )}

        {/* Chart Viewport */}
        <div className="pt-2">{renderContent(false)}</div>
      </div>

      {/* Expanded Modal view */}
      {isMaximized && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div 
            role="dialog"
            aria-modal="true"
            aria-label={`Expanded view: ${title}`}
            className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            {/* Modal Header Panel */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  {source !== 'MECHANISTIC' && (
                    <MetaTag label={source} />
                  )}
                  <h2 className="text-base font-extrabold text-slate-955 uppercase tracking-wider">
                    {title} (Expanded Distribution Analysis)
                  </h2>
                </div>
                {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
              </div>

              {/* Toggles in Modal */}
              {series.length > 1 && (
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  {series.map((s, idx) => {
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
                          style={{ backgroundColor: active ? getSeriesColor(idx) : '#CBD5E1' }}
                        />
                        <span>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Stats Row */}
            {activeSeries.length > 0 && !loading && !error && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                {boxPlotStats.map((s) => {
                  if (s.count === 0) return null;
                  return (
                    <div key={s.key} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase truncate">
                        <span>{s.label}</span>
                        <span className="font-mono">N = {s.count}</span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-extrabold text-slate-805 font-mono">
                          Median: {s.median.toFixed(2)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          Mean: {s.mean.toFixed(2)} | SD: {s.stdDev.toFixed(2)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 font-mono text-[9px] text-slate-450 pt-1 border-t border-slate-200">
                        <div>
                          <span>Min:</span> <strong className="text-slate-700">{s.min.toFixed(2)}</strong>
                        </div>
                        <div>
                          <span>Max:</span> <strong className="text-slate-700">{s.max.toFixed(2)}</strong>
                        </div>
                        <div>
                          <span>IQR:</span> <strong className="text-slate-700">{s.iqr.toFixed(2)}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Modal Toolbar */}
            {series.length > 0 && !loading && !error && (
              <div className="flex items-center justify-end gap-2 bg-slate-50/80 p-2 rounded-lg border border-slate-100 text-xs">
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1 px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>

                <button
                  onClick={() => setIsMaximized(false)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold transition"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </button>
              </div>
            )}

            {/* Maximized Chart Viewport */}
            <div className="flex-1 w-full bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-center justify-center min-h-[400px]">
              {renderContent(true)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
