import { useMemo } from 'react';
import { SimulationHistoryItem } from '../../types/simulation';
import AnalyticalChart from '../analytics/AnalyticalChart';
import { TimeSeriesDataPoint, EventMarker, CompositeEventMarker } from '../analytics/chartTypes';
import { useAI } from '../../context/AIContext';
import { Activity } from 'lucide-react';

interface ProcessChartsProps {
  history: SimulationHistoryItem[];
  targetCellDensity: number;
  disturbanceWindow?: { start: number; end: number; label?: string } | null;
}

/**
 * Groups a flat list of EventMarkers into CompositeEventMarkers so that
 * events within CLUSTER_WINDOW hours of each other share a single vertical
 * line. Events are sorted by time, then greedily clustered: once the gap
 * between the current event and the cluster anchor exceeds CLUSTER_WINDOW,
 * the cluster is closed and a new one starts.
 *
 * The representative time is the *earliest* event in each cluster so the
 * marker appears at the first moment something actually happened.
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
      // Close enough — merge into current cluster
      currentGroup.push(ev);
    } else {
      // Flush current cluster
      groups.push(buildComposite(currentGroup));
      currentGroup = [ev];
      anchorTime = ev.time;
    }
  }
  // Flush the final cluster
  groups.push(buildComposite(currentGroup));

  return groups;
}

const TYPE_PRIORITY: Record<string, number> = { FAULT: 0, PROCESS: 1, CONTROL: 2, AI: 3 };

function buildComposite(events: EventMarker[]): CompositeEventMarker {
  // Unique types sorted by visual priority (FAULT > PROCESS > CONTROL > AI)
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
    time: events[0].time,   // earliest timestamp = anchor
    types: uniqueTypes,
    label,
    isComposite,
    events,                 // full detail preserved
  };
}

export default function ProcessCharts({ history, targetCellDensity, disturbanceWindow }: ProcessChartsProps) {
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
            Start the Digital Twin simulation to populate process analytics.
          </p>
        </div>
      </div>
    );
  }

  // Format historical trajectory data into the schema expected by the charting workspace
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

  // ── Build raw flat event list (unchanged semantics) ─────────────────────
  const rawEvents: EventMarker[] = [];

  // 1. Process Event: Target cell density achievement
  const targetAchievedItem = history.find((h) => h.viable_cell_density >= targetCellDensity);
  if (targetAchievedItem) {
    rawEvents.push({
      time: targetAchievedItem.time,
      type: 'PROCESS',
      label: 'TARGET ACHIEVED',
      description: `Target cell density of ${(targetCellDensity / 1e6).toFixed(0)} ×10⁶ cells/mL achieved.`
    });
  }

  // 2. Scan timeseries for control loop actions and process faults
  history.forEach((item, index) => {
    const prevItem = index > 0 ? history[index - 1] : null;

    // Control event: perfusion rate changes
    if (prevItem && prevItem.perfusion_rate !== item.perfusion_rate) {
      const delta = item.perfusion_rate - prevItem.perfusion_rate;
      rawEvents.push({
        time: item.time,
        type: 'CONTROL',
        label: delta > 0 ? 'Increase Perfusion' : 'Reduce Perfusion',
        description: `Feedback controller adjusted perfusion rate from ${prevItem.perfusion_rate.toFixed(2)} to ${item.perfusion_rate.toFixed(2)} VVD.`
      });
    }

    // Fault event: active fault starts
    if (item.active_fault && (!prevItem || prevItem.active_fault !== item.active_fault)) {
      rawEvents.push({
        time: item.time,
        type: 'FAULT',
        label: `${item.active_fault} Fault`,
        description: `Process disturbance active: ${item.active_fault}`
      });
    }
  });

  // 3. User-triggered AI Analysis prediction markers
  const { analysisHistory } = useAI();
  analysisHistory.forEach((item) => {
    rawEvents.push({
      time: item.simulationTime,
      type: 'AI',
      label: 'AI Prediction Run',
      description: `Auxiliary AI prediction: Titer estimated at ${item.prediction.prediction.toFixed(2)} g/L.`
    });
  });

  // ── Collapse nearby raw events into one line per cluster ────────────────
  // rawEvents is NOT modified — all detail is preserved inside each composite
  const compositeEvents: CompositeEventMarker[] = groupNearbyEvents(rawEvents);

  const targetM = targetCellDensity / 1e6;

  // Count actual controller interventions
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
    <div className="space-y-4 font-sans">
      {/* Process Header Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2 border border-slate-200 rounded-md bg-white text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-500">VCC Target:</span>
          <span className="font-mono font-semibold text-slate-900">&gt; 100 × 10⁶ cells/mL</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-600">
            {targetAchievedItem ? (
              <span className="text-emerald-700 font-medium">Met at t={targetAchievedItem.time.toFixed(1)}h</span>
            ) : (
              <span>Progress: <strong className="font-mono text-slate-800">{((latestState.viable_cell_density / targetCellDensity) * 100).toFixed(0)}%</strong></span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-3 text-slate-600">
          <span>Controller: <strong className="font-medium text-slate-800">{controllerInterventions > 0 ? 'Adaptive' : 'Fixed'}</strong></span>
          <span className="text-slate-300">·</span>
          <span>Interventions: <strong className="font-mono text-slate-800">{controllerInterventions}</strong></span>
        </div>
      </div>

      {/* Grid containing the six synchronized analytical charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
          yDomain={[0, 'dataMax + 20']}
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
        />

        {/* 3. Glucose Concentration */}
        <AnalyticalChart
          title="Glucose Concentration"
          subtitle="Substrate availability in bioreactor vessel"
          source="MECHANISTIC"
          data={formattedData}
          series={[{ key: 'glucose', name: 'Glucose', stroke: '#059669' }]}
          targets={[{ y: 1.5, label: 'Control Threshold: 1.50 g/L', stroke: '#DC2626' }]}
          events={compositeEvents}
          disturbanceWindow={disturbanceWindow}
          syncId="bioprocess"
          yDomain={[0, 'dataMax + 2']}
        />

        {/* 4. Lactate Concentration */}
        <AnalyticalChart
          title="Lactate Concentration"
          subtitle="Accumulation of metabolic byproduct"
          source="MECHANISTIC"
          data={formattedData}
          series={[{ key: 'lactate', name: 'Lactate', stroke: '#D97706' }]}
          targets={[{ y: 3.5, label: 'Control Threshold: 3.50 g/L', stroke: '#DC2626' }]}
          events={compositeEvents}
          disturbanceWindow={disturbanceWindow}
          syncId="bioprocess"
          yDomain={[0, 'dataMax + 1']}
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
        />

        {/* 7. Membrane Fouling Risk */}
        <AnalyticalChart
          title="Membrane Fouling Risk"
          subtitle="Normalized membrane clogging load risk"
          source="MECHANISTIC"
          data={formattedData}
          series={[{ key: 'foulingIndex', name: 'Fouling Risk', stroke: '#D97706' }]}
          targets={[{ y: 70, label: 'Warning Limit: 70 / 100', stroke: '#DC2626' }]}
          events={compositeEvents}
          disturbanceWindow={disturbanceWindow}
          syncId="bioprocess"
          yDomain={[0, 100]}
        />
      </div>
    </div>
  );
}
