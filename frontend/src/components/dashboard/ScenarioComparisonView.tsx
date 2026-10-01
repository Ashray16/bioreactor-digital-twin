import { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Play,
  Sliders,
  Download,
  Bell,
  BellOff,
  AlertCircle,
  Loader2,
  Activity,
  Table as TableIcon,
  LineChart as ChartIcon
} from 'lucide-react';

import { ScenarioComparisonResponse, BioreactorConfig, FaultConfig } from '../../types/simulation';
import { runScenarioComparison } from '../../services/api';
import ComparisonChart from '../analytics/ComparisonChart';
import { TimeSeriesDataPoint, EventMarker } from '../analytics/chartTypes';
import ConfigModal from './ConfigModal';

interface ScenarioComparisonViewProps {
  activeFault?: FaultConfig | null;
  onClearFault?: () => void;
  onNavigateToFaults?: () => void;
}

export default function ScenarioComparisonView({
  activeFault = null,
  onClearFault,
  onNavigateToFaults,
}: ScenarioComparisonViewProps) {
  const [data, setData] = useState<ScenarioComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active view tab: Charts (3x2) | Table | Events
  const [activeTab, setActiveTab] = useState<'charts' | 'table' | 'events'>('charts');

  // Scenario Challenge preset
  const [preset, setPreset] = useState<'nutrient_stress' | 'fouling_surge' | 'nominal'>('nutrient_stress');

  // Config modal state
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [customConfig, setCustomConfig] = useState<BioreactorConfig | null>(null);

  // Global Page-Level Chart Controls
  const [timeRange, setTimeRange] = useState<string>('ALL');
  const [showControlled, setShowControlled] = useState<boolean>(true);
  const [showUncontrolled, setShowUncontrolled] = useState<boolean>(true);
  const [showTarget, setShowTarget] = useState<boolean>(true);
  const [showEvents, setShowEvents] = useState<boolean>(true);

  // Disturbance Window for Shading across all plots
  const disturbanceWindow = useMemo(() => {
    if (activeFault) {
      return {
        start: activeFault.start_time,
        end: activeFault.start_time + activeFault.duration,
        label: `Disturbance Window (${activeFault.start_time.toFixed(0)}h–${(activeFault.start_time + activeFault.duration).toFixed(0)}h)`,
      };
    }
    if (preset === 'nutrient_stress') {
      return { start: 60.0, end: 96.0, label: 'Nutrient Stress Window (60h–96h)' };
    }
    if (preset === 'fouling_surge') {
      return { start: 72.0, end: 112.0, label: 'Fouling Surge Window (72h–112h)' };
    }
    return null;
  }, [activeFault, preset]);

  const handleRunComparison = async (overridePreset?: string, overrideConfig?: BioreactorConfig, overrideFault?: FaultConfig | null) => {
    setLoading(true);
    setError(null);
    try {
      const activePreset = overridePreset || preset;
      const activeCfg = overrideConfig || customConfig;
      const currentFault = overrideFault !== undefined ? overrideFault : activeFault;

      const res = await runScenarioComparison({
        preset: currentFault ? undefined : activePreset,
        fault: currentFault || undefined,
        config: activeCfg || {
          simulation_duration: 240.0,
          timestep: 0.5,
          perfusion_rate: 0.4,
          feed_nutrient_concentration: 7.0,
          initial_nutrient: 3.0,
        }
      });
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to execute scenario comparison');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRunComparison(undefined, undefined, activeFault);
  }, [activeFault]);

  const handlePresetChange = (newPreset: 'nutrient_stress' | 'fouling_surge' | 'nominal') => {
    setPreset(newPreset);
    handleRunComparison(newPreset);
  };

  const handleSaveConfig = (newConfig: BioreactorConfig) => {
    setCustomConfig(newConfig);
    handleRunComparison(undefined, newConfig);
  };

  const uncontrolledHistory = data?.uncontrolled_scenario.history || [];
  const controlledHistory = data?.controlled_scenario.history || [];

  // Mapped trajectory points combining uncontrolled and controlled histories
  const formattedData: TimeSeriesDataPoint[] = useMemo(() => {
    if (!data) return [];
    return data.uncontrolled_scenario.history.map((h, i) => {
      const ctrl = data.controlled_scenario.history[i] || h;
      return {
        time: h.time,
        vcc_controlled: Number((ctrl.viable_cell_density / 1e6).toFixed(2)),
        vcc_uncontrolled: Number((h.viable_cell_density / 1e6).toFixed(2)),
        viability_controlled: ctrl.cell_viability,
        viability_uncontrolled: h.cell_viability,
        glucose_controlled: ctrl.nutrient_concentration,
        glucose_uncontrolled: h.nutrient_concentration,
        lactate_controlled: ctrl.metabolite_concentration,
        lactate_uncontrolled: h.metabolite_concentration,
        fouling_controlled: ctrl.fouling_index,
        fouling_uncontrolled: h.fouling_index,
        perfusion_controlled: ctrl.perfusion_rate,
        perfusion_uncontrolled: h.perfusion_rate,
      };
    });
  }, [data]);

  // Global Visible Time Domain based on timeRange
  const visibleDomain = useMemo<[number, number] | null>(() => {
    if (!formattedData.length || timeRange === 'ALL') return null;
    const maxTime = Math.max(...formattedData.map((d) => d.time));
    const hours = parseInt(timeRange);
    if (isNaN(hours)) return null;
    return [Math.max(0, maxTime - hours), maxTime];
  }, [formattedData, timeRange]);

  // Process and Control Events Timeline
  const events = useMemo<EventMarker[]>(() => {
    if (!data) return [];
    const eventList: EventMarker[] = [];
    const targetCellDensity = data.config.target_cell_density;

    // 1. Process target achievement
    const targetAchievedItem = data.controlled_scenario.history.find(h => h.viable_cell_density >= targetCellDensity);
    if (targetAchievedItem) {
      eventList.push({
        time: targetAchievedItem.time,
        type: 'PROCESS',
        label: 'TARGET ACHIEVED',
        description: `Controlled biomass VCC reached target of ${(targetCellDensity / 1e6).toFixed(0)}M cells/mL.`
      });
    }

    // 2. Control loops and faults
    data.controlled_scenario.history.forEach((item, index) => {
      const prevItem = index > 0 ? data.controlled_scenario.history[index - 1] : null;

      if (prevItem && Math.abs(prevItem.perfusion_rate - item.perfusion_rate) > 0.01) {
        const delta = item.perfusion_rate - prevItem.perfusion_rate;
        eventList.push({
          time: item.time,
          type: 'CONTROL',
          label: delta > 0 ? `Ramp Perfusion (${item.perfusion_rate.toFixed(1)} VVD)` : `Throttle Perfusion (${item.perfusion_rate.toFixed(1)} VVD)`,
          description: `Adaptive controller adjusted perfusion rate from ${prevItem.perfusion_rate.toFixed(2)} to ${item.perfusion_rate.toFixed(2)} VVD.`
        });
      }

      if (item.active_fault && (!prevItem || prevItem.active_fault !== item.active_fault)) {
        eventList.push({
          time: item.time,
          type: 'FAULT',
          label: `${item.active_fault}`,
          description: `Injected disturbance active: ${item.active_fault}`
        });
      }
    });

    return eventList;
  }, [data]);

  const controlTimelineEvents = useMemo(() => {
    return events.filter(e => e.type === 'CONTROL' || e.type === 'FAULT');
  }, [events]);

  // Utility extractors
  const getFinalVal = (history: any[], key: string) => (!history.length ? 0 : history[history.length - 1][key]);
  const getMaxVal = (history: any[], key: string) => (!history.length ? 0 : Math.max(...history.map(h => h[key])));
  const getMinVal = (history: any[], key: string) => (!history.length ? 0 : Math.min(...history.map(h => h[key])));

  // Global Consolidated Export CSV
  const handleExportConsolidatedCSV = () => {
    if (!formattedData.length) return;
    const headers = [
      'Time_h',
      'VCC_Controlled_M', 'VCC_Uncontrolled_M',
      'Viability_Controlled_pct', 'Viability_Uncontrolled_pct',
      'Glucose_Controlled_gL', 'Glucose_Uncontrolled_gL',
      'Lactate_Controlled_gL', 'Lactate_Uncontrolled_gL',
      'Fouling_Controlled', 'Fouling_Uncontrolled',
      'Perfusion_Controlled_VVD', 'Perfusion_Uncontrolled_VVD'
    ];
    const rows = formattedData.map(d => [
      d.time,
      d.vcc_controlled, d.vcc_uncontrolled,
      d.viability_controlled, d.viability_uncontrolled,
      d.glucose_controlled, d.glucose_uncontrolled,
      d.lactate_controlled, d.lactate_uncontrolled,
      d.fouling_controlled, d.fouling_uncontrolled,
      d.perfusion_controlled, d.perfusion_uncontrolled
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scenario_comparison_${preset}_telemetry.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return (
      <div className="h-[65vh] flex flex-col items-center justify-center text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-xs font-mono font-bold">Integrating 240-hour twin bioprocess trajectories...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg space-y-4 text-center max-w-md mx-auto my-12">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-red-950">Scenario comparison unavailable</h3>
          <p className="text-xs text-red-700">{error}</p>
        </div>
        <button
          onClick={() => handleRunComparison()}
          className="px-3.5 py-1.5 bg-red-650 hover:bg-red-700 text-white rounded-md text-xs font-bold transition"
        >
          Retry Simulation
        </button>
      </div>
    );
  }

  if (!data) return null;

  const targetM = data.config.target_cell_density / 1e6;
  const ctrlVCC = getFinalVal(controlledHistory, 'viable_cell_density') / 1e6;
  const unctrlVCC = getFinalVal(uncontrolledHistory, 'viable_cell_density') / 1e6;
  const vccDelta = ctrlVCC - unctrlVCC;

  const ctrlViab = getFinalVal(controlledHistory, 'cell_viability');
  const unctrlViab = getFinalVal(uncontrolledHistory, 'cell_viability');
  const viabDelta = ctrlViab - unctrlViab;

  const ctrlMinGluc = getMinVal(controlledHistory, 'nutrient_concentration');
  const unctrlMinGluc = getMinVal(uncontrolledHistory, 'nutrient_concentration');
  const glucDelta = ctrlMinGluc - unctrlMinGluc;

  const ctrlMaxLac = getMaxVal(controlledHistory, 'metabolite_concentration');
  const unctrlMaxLac = getMaxVal(uncontrolledHistory, 'metabolite_concentration');
  const lacDelta = ctrlMaxLac - unctrlMaxLac;

  const ctrlMaxFoul = getMaxVal(controlledHistory, 'fouling_index');
  const unctrlMaxFoul = getMaxVal(uncontrolledHistory, 'fouling_index');
  const foulDelta = ctrlMaxFoul - unctrlMaxFoul;

  const mediaCtrl = data.total_media_consumed_controlled_L;
  const mediaUnctrl = data.total_media_consumed_uncontrolled_L;
  const mediaDelta = mediaCtrl - mediaUnctrl;

  return (
    <div className="space-y-3 pb-8">
      {/* 1. Header & One-Line Explanation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h1 className="text-sm font-bold text-slate-900 tracking-tight uppercase">
              Scenario Comparison
            </h1>
            <span className="text-[11px] font-sans text-slate-500 font-medium">
              — Same culture, two strategies: fixed perfusion vs. feedback-controlled perfusion.
            </span>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md self-start sm:self-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('charts')}
            className={`flex items-center gap-1 px-3 py-1 rounded transition ${
              activeTab === 'charts' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ChartIcon className="w-3.5 h-3.5" />
            <span>Charts (3×2)</span>
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={`flex items-center gap-1 px-3 py-1 rounded transition ${
              activeTab === 'table' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Trade-Off Table</span>
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`flex items-center gap-1 px-3 py-1 rounded transition ${
              activeTab === 'events' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Event Stream</span>
          </button>
        </div>
      </div>

      {/* 2. Page-Level Controls & Shared Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
        {/* Scenario Challenge Selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Scenario:</span>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md">
            <button
              onClick={() => handlePresetChange('nutrient_stress')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                preset === 'nutrient_stress' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Feed restriction partway through (60h); controller intervenes with perfusion boost"
            >
              Feed Interruption (60h)
            </button>
            <button
              onClick={() => handlePresetChange('fouling_surge')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                preset === 'fouling_surge' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Filter membrane clogging challenge (72h); controller throttles perfusion to protect filter"
            >
              Fouling Surge (72h)
            </button>
            <button
              onClick={() => handlePresetChange('nominal')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                preset === 'nominal' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Standard continuous perfusion (240h); fixed 0.4 VVD starves naturally under high density"
            >
              Nominal (240h)
            </button>
          </div>
        </div>

        {/* Global Time Range Selector */}
        <div className="flex items-center gap-1.5">
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
                {r === '168H' ? '7D' : r === 'ALL' ? 'ALL (10D)' : r}
              </button>
            ))}
          </div>
        </div>

        {/* Shared Legend Series Toggles */}
        <div className="flex items-center gap-2">
          {/* Uncontrolled: dashed slate */}
          <button
            onClick={() => setShowUncontrolled(prev => !prev)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-medium transition ${
              showUncontrolled ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-white border-slate-100 text-slate-350 opacity-60'
            }`}
            title="Toggle Uncontrolled Scenario (Fixed 0.4 VVD)"
          >
            <svg width="18" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="18" y2="3" stroke={showUncontrolled ? '#64748B' : '#CBD5E1'} strokeWidth="2" strokeDasharray="3 3" />
            </svg>
            <span>Uncontrolled (Fixed)</span>
          </button>

          {/* Controlled: solid blue */}
          <button
            onClick={() => setShowControlled(prev => !prev)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-medium transition ${
              showControlled ? 'bg-blue-50/60 border-blue-200 text-blue-700' : 'bg-white border-slate-100 text-slate-350 opacity-60'
            }`}
            title="Toggle Controlled Scenario (Adaptive Feedback)"
          >
            <svg width="18" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="18" y2="3" stroke={showControlled ? '#2563EB' : '#CBD5E1'} strokeWidth="2.5" />
            </svg>
            <span>Controlled (Adaptive)</span>
          </button>

          {/* Target: dotted emerald */}
          <button
            onClick={() => setShowTarget(prev => !prev)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-medium transition ${
              showTarget ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-white border-slate-100 text-slate-350 opacity-60'
            }`}
            title="Toggle Target Setpoint Line"
          >
            <svg width="18" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="18" y2="3" stroke={showTarget ? '#059669' : '#CBD5E1'} strokeWidth="1.5" strokeDasharray="2 2" />
            </svg>
            <span>Target</span>
          </button>
        </div>

        {/* Global Toolbar Actions */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Events Toggle */}
          <button
            onClick={() => setShowEvents(prev => !prev)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] font-semibold transition ${
              showEvents ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Toggle process event markers across all 6 panels"
          >
            {showEvents ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3 text-slate-400" />}
            <span>Events</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportConsolidatedCSV}
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition"
            title="Export consolidated telemetry data across all 6 variables"
          >
            <Download className="w-3 h-3" />
            <span>Export CSV</span>
          </button>

          {/* Parameters Modal */}
          <button
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition"
            title="Configure digital twin parameters, seed density, and controller thresholds"
          >
            <Sliders className="w-3 h-3 text-slate-500" />
            <span>Parameters</span>
          </button>

          {/* Re-Run */}
          <button
            onClick={() => handleRunComparison()}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition shadow-xs disabled:opacity-50"
            title="Re-execute digital twin simulation"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
            <span>Re-Simulate</span>
          </button>
        </div>
      </div>

      {/* 3. KPI Strip: 6 numbers in one row */}
      <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-xs">
          {/* KPI 1: Final Biomass (VCC) */}
          <div className="px-3 py-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Final Biomass (VCC)</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-mono tabular-nums text-sm font-extrabold text-blue-700">{ctrlVCC.toFixed(1)}</span>
              <span className="text-[11px] font-mono text-slate-400">vs {unctrlVCC.toFixed(1)}</span>
            </div>
            <div className="text-[10px] font-mono font-bold text-emerald-700 mt-0.5">
              Δ {vccDelta >= 0 ? '+' : ''}{vccDelta.toFixed(1)} M cells/mL
            </div>
          </div>

          {/* KPI 2: Final Viability */}
          <div className="px-3 py-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Cell Viability</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-mono tabular-nums text-sm font-extrabold text-blue-700">{ctrlViab.toFixed(1)}%</span>
              <span className="text-[11px] font-mono text-slate-400">vs {unctrlViab.toFixed(1)}%</span>
            </div>
            <div className={`text-[10px] font-mono font-bold mt-0.5 ${viabDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              Δ {viabDelta >= 0 ? '+' : '−'}{Math.abs(viabDelta).toFixed(1)} pp
            </div>
          </div>

          {/* KPI 3: Min Glucose */}
          <div className="px-3 py-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Minimum Glucose</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={`font-mono tabular-nums text-sm font-extrabold ${ctrlMinGluc < 1.5 ? 'text-rose-700' : 'text-slate-800'}`}>
                {ctrlMinGluc.toFixed(2)}
              </span>
              <span className="text-[11px] font-mono text-slate-400">vs {unctrlMinGluc.toFixed(2)}</span>
            </div>
            <div className={`text-[10px] font-mono font-bold mt-0.5 ${glucDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              Δ {glucDelta >= 0 ? '+' : ''}{glucDelta.toFixed(2)} g/L
            </div>
          </div>

          {/* KPI 4: Max Lactate */}
          <div className="px-3 py-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Maximum Lactate</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-mono tabular-nums text-sm font-extrabold text-slate-800">{ctrlMaxLac.toFixed(2)}</span>
              <span className="text-[11px] font-mono text-slate-400">vs {unctrlMaxLac.toFixed(2)}</span>
            </div>
            <div className={`text-[10px] font-mono font-bold mt-0.5 ${lacDelta <= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              Δ {lacDelta >= 0 ? '+' : ''}{lacDelta.toFixed(2)} g/L
            </div>
          </div>

          {/* KPI 5: Peak Fouling */}
          <div className="px-3 py-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Peak Fouling Load</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={`font-mono tabular-nums text-sm font-extrabold ${ctrlMaxFoul >= 70 ? 'text-amber-700' : 'text-slate-800'}`}>
                {ctrlMaxFoul.toFixed(1)}
              </span>
              <span className="text-[11px] font-mono text-slate-400">vs {unctrlMaxFoul.toFixed(1)}</span>
            </div>
            <div className={`text-[10px] font-mono font-bold mt-0.5 ${foulDelta <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
              Δ {foulDelta >= 0 ? '+' : ''}{foulDelta.toFixed(1)} pts
            </div>
          </div>

          {/* KPI 6: Media Consumed */}
          <div className="px-3 py-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Total Media Consumed</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-mono tabular-nums text-sm font-extrabold text-slate-800">{mediaCtrl.toFixed(2)} L</span>
              <span className="text-[11px] font-mono text-slate-400">vs {mediaUnctrl.toFixed(2)} L</span>
            </div>
            <div className="text-[10px] font-mono font-bold text-slate-600 mt-0.5">
              Δ {mediaDelta >= 0 ? '+' : ''}{mediaDelta.toFixed(2)} L
            </div>
          </div>
        </div>
      </div>

      {/* Outcome Banner (Compact single-line) */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 border ${
            data.overall_outcome === 'TRADE-OFF'
              ? 'bg-amber-50 text-amber-800 border-amber-300'
              : data.overall_outcome === 'IMPROVED'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-slate-100 text-slate-700 border-slate-300'
          }`}>
            {data.overall_outcome === 'TRADE-OFF' ? 'Multi-Objective Trade-Off' : data.overall_outcome === 'IMPROVED' ? 'Controlled Improved' : 'Nominal Match'}
          </span>
          <p className="text-[11px] text-slate-650 truncate">
            {data.outcome_summary}
          </p>
        </div>
        {data.divergence_cause && (
          <span className="text-[10px] font-mono text-blue-700 bg-blue-50/70 border border-blue-200 px-2 py-0.5 rounded shrink-0 hidden md:inline">
            Trigger: {data.divergence_cause.split('.')[0]}
          </span>
        )}
      </div>

      {/* Active Disturbance Shading Indicator Banner */}
      {activeFault && (
        <div className="bg-rose-50/70 border border-rose-200 rounded-lg px-3.5 py-2 flex items-center justify-between gap-3 text-xs shadow-xs animate-fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0 animate-pulse" />
            <span className="font-bold text-rose-950 truncate">Injected Disturbance Active:</span>
            <span className="font-mono text-rose-900 truncate">
              {activeFault.fault_type.replace(/_/g, ' ')} (t = {activeFault.start_time.toFixed(0)}h → {(activeFault.start_time + activeFault.duration).toFixed(0)}h, Severity {(activeFault.severity * 100).toFixed(0)}%)
            </span>
            <span className="text-rose-400 hidden sm:inline">·</span>
            <span className="text-slate-600 hidden sm:inline">Disturbance window shaded on all 6 comparison plots</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onNavigateToFaults && (
              <button
                onClick={onNavigateToFaults}
                className="px-2.5 py-1 rounded text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition"
              >
                Modify Disturbance
              </button>
            )}
            {onClearFault && (
              <button
                onClick={onClearFault}
                className="px-2.5 py-1 rounded text-[11px] font-medium text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 transition"
              >
                Clear Disturbance
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. Tab View 1: Small Multiples 3x2 Grid */}
      {activeTab === 'charts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in">
          {/* Chart 1: Viable Cell Density */}
          <ComparisonChart
            title="Viable Cell Density"
            data={formattedData}
            controlledKey="vcc_controlled"
            uncontrolledKey="vcc_uncontrolled"
            controlledLabel="Controlled VCC"
            uncontrolledLabel="Uncontrolled VCC"
            unit="×10⁶/mL"
            metricDirection="higher"
            target={targetM}
            targetLabel={`Target: ${targetM}M`}
            events={events}
            disturbanceWindow={disturbanceWindow}
            syncId="scenario-comparison"
            showControlled={showControlled}
            showUncontrolled={showUncontrolled}
            showTarget={showTarget}
            showEvents={showEvents}
            visibleDomain={visibleDomain}
            yDomain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.15))]}
          />

          {/* Chart 2: Cell Viability */}
          <ComparisonChart
            title="Cell Viability"
            data={formattedData}
            controlledKey="viability_controlled"
            uncontrolledKey="viability_uncontrolled"
            controlledLabel="Controlled Viab"
            uncontrolledLabel="Uncontrolled Viab"
            unit="%"
            metricDirection="higher"
            envelopes={[{ yMin: 90, yMax: 100, color: 'rgba(16, 185, 129, 0.05)', label: 'Normal Range' }]}
            events={events}
            disturbanceWindow={disturbanceWindow}
            syncId="scenario-comparison"
            showControlled={showControlled}
            showUncontrolled={showUncontrolled}
            showTarget={showTarget}
            showEvents={showEvents}
            visibleDomain={visibleDomain}
            yDomain={[(dataMin: number) => Math.max(0, Math.floor(dataMin - 3)), 100]}
          />

          {/* Chart 3: Glucose Concentration */}
          <ComparisonChart
            title="Glucose Substrate"
            data={formattedData}
            controlledKey="glucose_controlled"
            uncontrolledKey="glucose_uncontrolled"
            controlledLabel="Controlled Glucose"
            uncontrolledLabel="Uncontrolled Glucose"
            unit="g/L"
            metricDirection="higher"
            target={data.config.nutrient_threshold_low || 2.0}
            targetLabel={`Threshold: ${(data.config.nutrient_threshold_low || 2.0).toFixed(1)} g/L`}
            events={events}
            disturbanceWindow={disturbanceWindow}
            syncId="scenario-comparison"
            showControlled={showControlled}
            showUncontrolled={showUncontrolled}
            showTarget={showTarget}
            showEvents={showEvents}
            visibleDomain={visibleDomain}
            yDomain={[0, (dataMax: number) => Math.max(4, Math.ceil(dataMax + 0.5))]}
          />

          {/* Chart 4: Lactate Byproduct */}
          <ComparisonChart
            title="Lactate Metabolite"
            data={formattedData}
            controlledKey="lactate_controlled"
            uncontrolledKey="lactate_uncontrolled"
            controlledLabel="Controlled Lactate"
            uncontrolledLabel="Uncontrolled Lactate"
            unit="g/L"
            metricDirection="lower"
            target={data.config.metabolite_threshold_high || 3.5}
            targetLabel={`Inhibition: ${(data.config.metabolite_threshold_high || 3.5).toFixed(1)} g/L`}
            events={events}
            disturbanceWindow={disturbanceWindow}
            syncId="scenario-comparison"
            showControlled={showControlled}
            showUncontrolled={showUncontrolled}
            showTarget={showTarget}
            showEvents={showEvents}
            visibleDomain={visibleDomain}
            yDomain={[0, (dataMax: number) => Math.max(2, Math.ceil(dataMax + 0.5))]}
          />

          {/* Chart 5: Membrane Fouling Risk */}
          <ComparisonChart
            title="Membrane Fouling Risk"
            data={formattedData}
            controlledKey="fouling_controlled"
            uncontrolledKey="fouling_uncontrolled"
            controlledLabel="Controlled Fouling"
            uncontrolledLabel="Uncontrolled Fouling"
            unit="/100"
            metricDirection="lower"
            target={data.config.fouling_threshold_high || 70.0}
            targetLabel="Limit: 70"
            events={events}
            disturbanceWindow={disturbanceWindow}
            syncId="scenario-comparison"
            showControlled={showControlled}
            showUncontrolled={showUncontrolled}
            showTarget={showTarget}
            showEvents={showEvents}
            visibleDomain={visibleDomain}
            yDomain={[0, (dataMax: number) => Math.max(60, Math.ceil(dataMax * 1.1))]}
          />

          {/* Chart 6: Adaptive Perfusion */}
          <ComparisonChart
            title="Perfusion Rate"
            data={formattedData}
            controlledKey="perfusion_controlled"
            uncontrolledKey="perfusion_uncontrolled"
            controlledLabel="Controlled Perfusion"
            uncontrolledLabel="Uncontrolled Perfusion"
            unit="VVD"
            metricDirection="higher"
            envelopes={[{ yMin: 0.2, yMax: 4.0, color: 'rgba(37, 99, 235, 0.04)', label: 'Operating Bounds' }]}
            events={events}
            disturbanceWindow={disturbanceWindow}
            syncId="scenario-comparison"
            showControlled={showControlled}
            showUncontrolled={showUncontrolled}
            showTarget={showTarget}
            showEvents={showEvents}
            visibleDomain={visibleDomain}
            yDomain={[0, (dataMax: number) => Math.max(1.5, Math.ceil(dataMax + 0.5))]}
          />
        </div>
      )}

      {/* 5. Tab View 2: Analytical Trade-Off Table */}
      {activeTab === 'table' && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-xs animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Analytical Performance Trade-Off Matrix
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Side-by-side terminal metrics comparing Scenario A (Fixed {data.config.perfusion_rate.toFixed(1)} VVD) against Scenario B (Adaptive Perfusion Control)
              </p>
            </div>
            <button
              onClick={handleExportConsolidatedCSV}
              className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Table Data</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-md">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-650 text-[11px] font-bold">
                  <th className="py-2 px-3">Metric</th>
                  <th className="py-2 px-3 text-slate-600 bg-slate-100/50">Scenario A (Uncontrolled)</th>
                  <th className="py-2 px-3 text-blue-800 bg-blue-50/30">Scenario B (Controlled)</th>
                  <th className="py-2 px-3">Difference (Δ)</th>
                  <th className="py-2 px-3">Evaluation Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {/* Final VCC */}
                <tr className="hover:bg-slate-50 transition">
                  <td className="py-2 px-3 font-sans font-semibold text-slate-800">Final VCC</td>
                  <td className="py-2 px-3 text-slate-600 bg-slate-100/20">{unctrlVCC.toFixed(2)} ×10⁶ cells/mL</td>
                  <td className="py-2 px-3 font-bold text-blue-700 bg-blue-50/10">{ctrlVCC.toFixed(2)} ×10⁶ cells/mL</td>
                  <td className="py-2 px-3 font-bold text-slate-700">
                    {vccDelta >= 0 ? '+' : ''}{vccDelta.toFixed(2)} ×10⁶ cells/mL
                  </td>
                  <td className="py-2 px-3 font-sans">
                    {Math.abs(vccDelta) < 0.05 ? (
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">IDENTICAL</span>
                    ) : vccDelta > 0 ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">IMPROVED</span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">DEGRADED</span>
                    )}
                  </td>
                </tr>

                {/* Final Viability */}
                <tr className="hover:bg-slate-50 transition">
                  <td className="py-2 px-3 font-sans font-semibold text-slate-800">Final Viability</td>
                  <td className="py-2 px-3 text-slate-600 bg-slate-100/20">{unctrlViab.toFixed(1)}%</td>
                  <td className="py-2 px-3 font-bold text-blue-700 bg-blue-50/10">{ctrlViab.toFixed(1)}%</td>
                  <td className="py-2 px-3 text-slate-700">
                    {viabDelta >= 0 ? '+' : '−'}{Math.abs(viabDelta).toFixed(1)} pp
                  </td>
                  <td className="py-2 px-3 font-sans">
                    {Math.abs(viabDelta) < 0.1 ? (
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">IDENTICAL</span>
                    ) : viabDelta > 0 ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">IMPROVED</span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">DEGRADED</span>
                    )}
                  </td>
                </tr>

                {/* Minimum Glucose */}
                <tr className="hover:bg-slate-50 transition">
                  <td className="py-2 px-3 font-sans font-semibold text-slate-800">Minimum Glucose</td>
                  <td className="py-2 px-3 text-slate-600 bg-slate-100/20">{unctrlMinGluc.toFixed(2)} g/L</td>
                  <td className="py-2 px-3 font-bold text-blue-700 bg-blue-50/10">{ctrlMinGluc.toFixed(2)} g/L</td>
                  <td className="py-2 px-3 text-slate-700">
                    {glucDelta >= 0 ? '+' : ''}{glucDelta.toFixed(2)} g/L
                  </td>
                  <td className="py-2 px-3 font-sans">
                    {Math.abs(glucDelta) < 0.05 ? (
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">IDENTICAL</span>
                    ) : glucDelta > 0 ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">PROTECTED</span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">DEPLETED</span>
                    )}
                  </td>
                </tr>

                {/* Maximum Lactate */}
                <tr className="hover:bg-slate-50 transition">
                  <td className="py-2 px-3 font-sans font-semibold text-slate-800">Maximum Lactate</td>
                  <td className="py-2 px-3 text-slate-600 bg-slate-100/20">{unctrlMaxLac.toFixed(2)} g/L</td>
                  <td className="py-2 px-3 font-bold text-blue-700 bg-blue-50/10">{ctrlMaxLac.toFixed(2)} g/L</td>
                  <td className="py-2 px-3 text-slate-700">
                    {lacDelta >= 0 ? '+' : ''}{lacDelta.toFixed(2)} g/L
                  </td>
                  <td className="py-2 px-3 font-sans">
                    {Math.abs(lacDelta) < 0.05 ? (
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">IDENTICAL</span>
                    ) : lacDelta < 0 ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">WASHED OUT</span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">ACCUMULATED</span>
                    )}
                  </td>
                </tr>

                {/* Peak Fouling Risk */}
                <tr className="hover:bg-slate-50 transition">
                  <td className="py-2 px-3 font-sans font-semibold text-slate-800">Peak Fouling Load</td>
                  <td className="py-2 px-3 text-slate-600 bg-slate-100/20">{unctrlMaxFoul.toFixed(1)} /100</td>
                  <td className="py-2 px-3 font-bold text-blue-700 bg-blue-50/10">{ctrlMaxFoul.toFixed(1)} /100</td>
                  <td className="py-2 px-3 text-slate-700">
                    {foulDelta >= 0 ? '+' : ''}{foulDelta.toFixed(1)} pts
                  </td>
                  <td className="py-2 px-3 font-sans">
                    {Math.abs(foulDelta) < 0.5 ? (
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">IDENTICAL</span>
                    ) : foulDelta < 0 ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">PROTECTED</span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">HIGHER LOAD</span>
                    )}
                  </td>
                </tr>

                {/* Total Media Consumed */}
                <tr className="hover:bg-slate-50 transition">
                  <td className="py-2 px-3 font-sans font-semibold text-slate-800">Total Media Consumed</td>
                  <td className="py-2 px-3 text-slate-600 bg-slate-100/20">{mediaUnctrl.toFixed(2)} L</td>
                  <td className="py-2 px-3 font-bold text-blue-700 bg-blue-50/10">{mediaCtrl.toFixed(2)} L</td>
                  <td className="py-2 px-3 text-slate-700 font-bold">
                    {mediaDelta >= 0 ? '+' : ''}{mediaDelta.toFixed(2)} L
                  </td>
                  <td className="py-2 px-3 font-sans">
                    {/* Fixed Table Status: Only mark as Trade-Off if media difference > 0.05 L */}
                    {Math.abs(mediaDelta) <= 0.05 ? (
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">IDENTICAL</span>
                    ) : mediaDelta > 0.05 ? (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                        TRADE-OFF (+ Media)
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        IMPROVED (− Media)
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Tab View 3: Event Stream & Timeline */}
      {activeTab === 'events' && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4 shadow-xs animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Digital Twin Control Action &amp; Event Sequence Stream
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Timestamped feedback loop interventions, disturbance injections, and recovery steps
              </p>
            </div>
            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {controlTimelineEvents.length} Process Events Recorded
            </span>
          </div>

          {controlTimelineEvents.length === 0 ? (
            <div className="text-xs text-slate-500 italic py-6 text-center">
              No feedback controller interventions occurred during this run. Operating state remained within normal tolerance bounds.
            </div>
          ) : (
            <div className="relative pl-5 border-l-2 border-slate-200 py-1 space-y-3 font-mono text-xs">
              {controlTimelineEvents.map((ev, idx) => (
                <div key={idx} className="relative">
                  <div className={`absolute -left-[27px] top-1 w-2.5 h-2.5 rounded-full border-2 bg-white ${
                    ev.type === 'FAULT' ? 'border-red-600' : 'border-blue-600'
                  }`} />
                  <div className="flex items-center gap-2">
                    <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                      ev.type === 'FAULT' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                      t = {ev.time.toFixed(1)} h
                    </span>
                    <span className="font-sans font-bold text-slate-800 text-[11px]">{ev.label}</span>
                  </div>
                  {ev.description && (
                    <p className="font-sans text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      {ev.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Configuration Modal */}
      <ConfigModal
        config={customConfig || (data.config as BioreactorConfig)}
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onSave={handleSaveConfig}
      />
    </div>
  );
}
