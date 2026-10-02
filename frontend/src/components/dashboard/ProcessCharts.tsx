import { useState, useMemo } from 'react';
import { SimulationHistoryItem } from '../../types/simulation';
import AnalyticalChart from '../analytics/AnalyticalChart';
import { TimeSeriesDataPoint, EventMarker, CompositeEventMarker } from '../analytics/chartTypes';
import { useAI } from '../../context/AIContext';
import { Activity, Download, Bell, BellOff, Sparkles } from 'lucide-react';
import {
  GLUCOSE_THRESHOLD_LOW,
  LACTATE_THRESHOLD_HIGH,
  FOULING_THRESHOLD_HIGH,
} from '../../config/constants';

interface ProcessChartsProps {
  history: SimulationHistoryItem[];
  targetCellDensity: number;
  disturbanceWindow?: { start: number; end: number; label?: string } | null;
  onLoadExampleRun?: () => void;
}

/**
 * Groups a flat list of EventMarkers into CompositeEventMarkers so that
 * events within CLUSTER_WINDOW hours of each other share a single vertical
 * line. Events are sorted by time, then greedily clustered: once the gap
 * between the current event and the cluster anchor exceeds CLUSTER_WINDOW,
 * the cluster is closed and a new one starts.
 */
function groupNearbyEvents(
  events: EventMarker[],
  clusterWindow = 0.25
): CompositeEventMarker[] {
  if (events.length === 0) return [];

  // Sort by ascending time first
  const sorted = [...events].sort((a, b) => a.time - b.time);

  const groups: CompositeEventMarker[] = [];
  let currentGroup: EventMarker[] = [sorted[0]];
  let anchorTime = sorted[0].time;

  for (let i = 1; i < sorted.length; i++) {
    const ev = sorted[i];
    if (ev.time - anchorTime <= clusterWindow) {
      currentGroup.push(ev);
    } else {
      groups.push(buildComposite(currentGroup));
      currentGroup = [ev];
      anchorTime = ev.time;
    }
  }
  groups.push(buildComposite(currentGroup));

  return groups;
}

const TYPE_PRIORITY: Record<string, number> = { FAULT: 0, PROCESS: 1, CONTROL: 2, AI: 3 };

function buildComposite(events: EventMarker[]): CompositeEventMarker {
  const uniqueTypes = [
    ...new Set(events.map((e) => e.type))
  ].sort(
    (a, b) => (TYPE_PRIORITY[a] ?? 99) - (TYPE_PRIORITY[b] ?? 99)
  ) as Array<'PROCESS' | 'CONTROL' | 'FAULT' | 'AI'>;

  const isComposite = events.length > 1;

  let label: string;
  if (!isComposite) {
    label = events[0].label;
  } else if (uniqueTypes.length === 1) {
    label = `${events.length}× ${uniqueTypes[0]}`;
  } else {
    label = uniqueTypes.join(' + ');
  }

  return {
    time: events[0].time,
    types: uniqueTypes,
    label,
    isComposite,
    events,
  };
}

export default function ProcessCharts({
  history,
  targetCellDensity,
  disturbanceWindow,
  onLoadExampleRun,
}: ProcessChartsProps) {
  const [timeRange, setTimeRange] = useState<string>('ALL');
  const [showEvents, setShowEvents] = useState<boolean>(true);

  // Graceful empty state when no simulation history exists
  if (!history || history.length === 0) {
    return (
      <div className="border border-slate-200 rounded-md p-8 bg-white flex flex-col items-center justify-center text-center space-y-3 min-h-[260px] shadow-none">
        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200 text-slate-400">
          <Activity className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-800">No process trajectory available</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            Start the Digital Twin simulation or load an example run to inspect process telemetry.
          </p>
        </div>
        {onLoadExampleRun && (
          <button
            type="button"
            onClick={onLoadExampleRun}
            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Example Run (240h)</span>
          </button>
        )}
      </div>
    );
  }

  // Format historical trajectory data
  const formattedData: TimeSeriesDataPoint[] = history.map((item) => ({
    time: item.time,
    viableDensity: Number((item.viable_cell_density / 1e6).toFixed(4)),
    cellViability: item.cell_viability,
    glucose: item.nutrient_concentration,
    lactate: item.metabolite_concentration,
    productTiter: item.product_concentration,
    perfusionRate: item.perfusion_rate,
    foulingIndex: item.fouling_index,
  }));

  const maxTime = useMemo(() => {
    if (!formattedData.length) return 240;
    return Math.max(...formattedData.map((d) => d.time));
  }, [formattedData]);

  const globalVisibleDomain = useMemo<[number, number] | null>(() => {
    if (timeRange === 'ALL' || !formattedData.length) return null;
    const hours = parseInt(timeRange);
    if (!isNaN(hours)) {
      return [Math.max(0, maxTime - hours), maxTime];
    }
    return null;
  }, [timeRange, maxTime, formattedData.length]);

  // Consolidated CSV Export
  const handleExportConsolidatedCSV = () => {
    if (!formattedData.length) return;
    const headers = [
      'Time_h',
      'Viable_Cell_Density_M_cells_mL',
      'Viability_pct',
      'Glucose_gL',
      'Lactate_gL',
      'Product_Titer_gL',
      'Perfusion_Rate_VVD',
      'Fouling_Index',
    ];
    const rows = formattedData.map((d) => [
      d.time,
      d.viableDensity,
      d.cellViability,
      d.glucose,
      d.lactate,
      d.productTiter,
      d.perfusionRate,
      d.foulingIndex,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `digital_twin_telemetry_${maxTime.toFixed(0)}h.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Build event markers
  const rawEvents: EventMarker[] = [];

  const targetAchievedItem = history.find((h) => h.viable_cell_density >= targetCellDensity);
  if (targetAchievedItem) {
    rawEvents.push({
      time: targetAchievedItem.time,
      type: 'PROCESS',
      label: 'TARGET ACHIEVED',
      description: `Target cell density of ${(targetCellDensity / 1e6).toFixed(0)} ×10⁶ cells/mL achieved.`,
    });
  }

  history.forEach((item, index) => {
    const prevItem = index > 0 ? history[index - 1] : null;

    if (prevItem && prevItem.perfusion_rate !== item.perfusion_rate) {
      const delta = item.perfusion_rate - prevItem.perfusion_rate;
      rawEvents.push({
        time: item.time,
        type: 'CONTROL',
        label: delta > 0 ? 'Increase Perfusion' : 'Reduce Perfusion',
        description: `Feedback controller adjusted perfusion rate from ${prevItem.perfusion_rate.toFixed(2)} to ${item.perfusion_rate.toFixed(2)} VVD.`,
      });
    }

    if (item.active_fault && (!prevItem || prevItem.active_fault !== item.active_fault)) {
      rawEvents.push({
        time: item.time,
        type: 'FAULT',
        label: `${item.active_fault} Fault`,
        description: `Process disturbance active: ${item.active_fault}`,
      });
    }
  });

  const { analysisHistory } = useAI();
  analysisHistory.forEach((item) => {
    rawEvents.push({
      time: item.simulationTime,
      type: 'AI',
      label: 'AI Prediction Run',
      description: `Auxiliary AI prediction: Titer estimated at ${item.prediction.prediction.toFixed(2)} g/L.`,
    });
  });

  const compositeEvents: CompositeEventMarker[] = groupNearbyEvents(rawEvents);
  const targetM = targetCellDensity / 1e6;

  const controllerInterventions = useMemo(() => {
    let count = 0;
    for (let i = 1; i < history.length; i++) {
      if (history[i].perfusion_rate !== history[i - 1].perfusion_rate) {
        count++;
      }
    }
    return count;
  }, [history]);

  const latestState = history[history.length - 1];

  return (
    <div className="space-y-3 font-sans">
      {/* Consolidated Global Toolbar Bar (Replaces 7 bulky toolbars) */}
      <div className="bg-white border border-slate-200 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
        {/* Left: Process Context */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Target VCC:</span>
          <span className="font-mono font-bold text-slate-900">&gt; 100 × 10⁶ cells/mL</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-600">
            {targetAchievedItem ? (
              <span className="text-emerald-700 font-semibold">Met at t={targetAchievedItem.time.toFixed(1)}h</span>
            ) : (
              <span>Progress: <strong className="font-mono text-slate-800">{((latestState.viable_cell_density / targetCellDensity) * 100).toFixed(0)}%</strong></span>
            )}
          </span>
          <span className="text-slate-300">·</span>
          <span>Interventions: <strong className="font-mono text-slate-800">{controllerInterventions}</strong></span>
        </div>

        {/* Right: Controls & Range Selector */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Time Range Selector */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Range:</span>
            <div className="flex bg-slate-100 p-0.5 rounded-md">
              {['24H', '72H', '168H', 'ALL'].map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition ${
                    timeRange === r ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {r === '168H' ? '7D' : r === 'ALL' ? 'ALL' : r}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle Events */}
          <button
            type="button"
            onClick={() => setShowEvents((prev) => !prev)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] font-semibold transition ${
              showEvents
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {showEvents ? <Bell className="w-3 h-3 text-blue-600" /> : <BellOff className="w-3 h-3 text-slate-400" />}
            <span>Events</span>
          </button>

          {/* Export Consolidated CSV */}
          <button
            type="button"
            onClick={handleExportConsolidatedCSV}
            title="Export all process trajectories to CSV"
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition"
          >
            <Download className="w-3 h-3 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {/* Optional Load Example Run Button */}
          {onLoadExampleRun && (
            <button
              type="button"
              onClick={onLoadExampleRun}
              title="Auto-load completed 240-hour nominal digital twin run"
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[11px] font-bold transition shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>Load Example Run</span>
            </button>
          )}
        </div>
      </div>

      {/* Clean 3-Column Small Multiples Grid (Matching Comparison Page) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* 1. Viable Cell Density (VCC) */}
        <AnalyticalChart
          title="Viable Cell Density"
          subtitle="Biomass growth vs target benchmark"
          source="MECHANISTIC"
          data={formattedData}
          series={[{ key: 'viableDensity', name: 'VCC', stroke: '#2563EB' }]}
          targets={[{ y: targetM, label: `Target: ${targetM.toFixed(0)} × 10⁶ cells/mL`, stroke: '#059669' }]}
          events={compositeEvents}
          disturbanceWindow={disturbanceWindow}
          syncId="bioprocess"
          yDomain={[0, Math.max(120, targetM + 20)]}
          hideToolbar={true}
          showEventsProp={showEvents}
          visibleDomainProp={globalVisibleDomain}
        />

        {/* 2. Cell Viability */}
        <AnalyticalChart
          title="Cell Viability"
          subtitle="Percentage of living cell population"
          source="MECHANISTIC"
          data={formattedData}
          series={[{ key: 'cellViability', name: 'Viability', stroke: '#10B981' }]}
          envelopes={[{ yMin: 90, yMax: 100, color: 'rgba(16, 185, 129, 0.05)', label: 'Normal Bounds' }]}
          events={compositeEvents}
          disturbanceWindow={disturbanceWindow}
          syncId="bioprocess"
          yDomain={[50, 100]}
          hideToolbar={true}
          showEventsProp={showEvents}
          visibleDomainProp={globalVisibleDomain}
        />

        {/* 3. Glucose Concentration */}
        <AnalyticalChart
          title="Glucose Concentration"
          subtitle="Substrate availability in bioreactor vessel"
          source="MECHANISTIC"
          data={formattedData}
          series={[{ key: 'glucose', name: 'Glucose', stroke: '#059669' }]}
          targets={[{ y: GLUCOSE_THRESHOLD_LOW, label: `Control Threshold: ${GLUCOSE_THRESHOLD_LOW.toFixed(2)} g/L`, stroke: '#DC2626' }]}
          events={compositeEvents}
          disturbanceWindow={disturbanceWindow}
          syncId="bioprocess"
          yDomain={[0, 'dataMax + 2']}
          hideToolbar={true}
          showEventsProp={showEvents}
          visibleDomainProp={globalVisibleDomain}
        />

        {/* 4. Lactate Concentration */}
        <AnalyticalChart
          title="Lactate Concentration"
          subtitle="Accumulation of metabolic byproduct"
          source="MECHANISTIC"
          data={formattedData}
          series={[{ key: 'lactate', name: 'Lactate', stroke: '#D97706' }]}
          targets={[{ y: LACTATE_THRESHOLD_HIGH, label: `Control Threshold: ${LACTATE_THRESHOLD_HIGH.toFixed(2)} g/L`, stroke: '#DC2626' }]}
          events={compositeEvents}
          disturbanceWindow={disturbanceWindow}
          syncId="bioprocess"
          yDomain={[0, 'dataMax + 1']}
          hideToolbar={true}
          showEventsProp={showEvents}
          visibleDomainProp={globalVisibleDomain}
        />

        {/* 5. Product Titer (mAb) */}
        <AnalyticalChart
          title="Product Titer (mAb)"
          subtitle="Mechanistic product accumulation trajectory"
          source="MECHANISTIC"
          data={formattedData}
          series={[{ key: 'productTiter', name: 'Product Titer', stroke: '#0F172A', unit: 'g/L' }]}
          events={compositeEvents}
          disturbanceWindow={disturbanceWindow}
          syncId="bioprocess"
          yDomain={[0, 'dataMax + 0.5']}
          hideToolbar={true}
          showEventsProp={showEvents}
          visibleDomainProp={globalVisibleDomain}
        />

        {/* 6. Adaptive Perfusion */}
        <AnalyticalChart
          title="Adaptive Perfusion"
          subtitle="Feedback controller exchange action"
          source="MECHANISTIC"
          data={formattedData}
          series={[{ key: 'perfusionRate', name: 'Perfusion', stroke: '#2563EB', type: 'stepAfter' }]}
          envelopes={[{ yMin: 0.2, yMax: 4.0, color: 'rgba(37, 99, 235, 0.05)', label: 'Controller Bounds' }]}
          events={compositeEvents}
          disturbanceWindow={disturbanceWindow}
          syncId="bioprocess"
          yDomain={[0, 4.5]}
          hideToolbar={true}
          showEventsProp={showEvents}
          visibleDomainProp={globalVisibleDomain}
        />

        {/* 7. Membrane Fouling Risk */}
        <AnalyticalChart
          title="Membrane Fouling Risk"
          subtitle="Normalized membrane clogging load risk"
          source="MECHANISTIC"
          data={formattedData}
          series={[{ key: 'foulingIndex', name: 'Fouling Risk', stroke: '#7C3AED' }]}
          targets={[{ y: FOULING_THRESHOLD_HIGH, label: `Warning Limit: ${FOULING_THRESHOLD_HIGH.toFixed(0)} / 100`, stroke: '#DC2626' }]}
          events={compositeEvents}
          disturbanceWindow={disturbanceWindow}
          syncId="bioprocess"
          yDomain={[0, 100]}
          hideToolbar={true}
          showEventsProp={showEvents}
          visibleDomainProp={globalVisibleDomain}
        />
      </div>
    </div>
  );
}
