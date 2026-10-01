import React, { useState, useEffect, useMemo } from 'react';
import { BioreactorState, BioreactorConfig, SimulationHistoryItem, ControllerActionInfo } from '../../types/simulation';
import {
  Sliders,
  CheckCircle2,
  Clock,
  RotateCcw,
  Save,
  Info,
} from 'lucide-react';
import { updateControlSettings } from '../../services/api';

interface ControllerPanelProps {
  state: BioreactorState;
  config?: BioreactorConfig | null;
  history?: SimulationHistoryItem[];
  onRefreshState: () => void;
}

export default function ControllerPanel({
  state,
  config,
  history = [],
  onRefreshState,
}: ControllerPanelProps) {
  // Mode state: synchronized with active digital twin controller status
  const [enabled, setEnabled] = useState(state.controller_enabled);

  // Read limits directly from config (Single Source of Truth)
  const minVvd = config?.min_perfusion_rate ?? 0.5;
  const maxVvd = config?.max_perfusion_rate ?? 4.0;

  // Threshold setpoints (editable inputs)
  const [glucoseLimit, setGlucoseLimit] = useState<number>(config?.nutrient_threshold_low ?? 1.5);
  const [foulingLimit, setFoulingLimit] = useState<number>(config?.fouling_threshold_high ?? 70.0);
  const [lactateLimit, setLactateLimit] = useState<number>(config?.metabolite_threshold_high ?? 3.5);
  const [stepIncrement, setStepIncrement] = useState<number>(config?.step_increment_vvd ?? 0.3);
  const [deadbandHours, setDeadbandHours] = useState<number>(1.0);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<SimulationHistoryItem | null>(null);

  // Sync mode when state changes externally
  useEffect(() => {
    setEnabled(state.controller_enabled);
  }, [state.controller_enabled]);

  // Sync threshold defaults if config changes
  useEffect(() => {
    if (config) {
      if (config.nutrient_threshold_low !== undefined) setGlucoseLimit(config.nutrient_threshold_low);
      if (config.fouling_threshold_high !== undefined) setFoulingLimit(config.fouling_threshold_high);
      if (config.metabolite_threshold_high !== undefined) setLactateLimit(config.metabolite_threshold_high);
      if (config.step_increment_vvd !== undefined) setStepIncrement(config.step_increment_vvd);
    }
  }, [config]);

  // Toggle mode (Manual Fixed vs Adaptive Feedback)
  const handleModeChange = async (newEnabled: boolean) => {
    if (newEnabled === enabled) return;
    setSaving(true);
    try {
      await updateControlSettings({
        enabled: newEnabled,
        min_perfusion_rate: minVvd,
        max_perfusion_rate: maxVvd,
        nutrient_threshold_low: glucoseLimit,
        metabolite_threshold_high: lactateLimit,
        fouling_threshold_high: foulingLimit,
        step_increment_vvd: stepIncrement,
        deadband_hours: deadbandHours,
      });
      setEnabled(newEnabled);
      onRefreshState();
    } catch (err) {
      console.error('Failed to change control mode:', err);
    } finally {
      setSaving(false);
    }
  };

  // Save updated threshold settings to backend controller
  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateControlSettings({
        enabled,
        min_perfusion_rate: minVvd,
        max_perfusion_rate: maxVvd,
        nutrient_threshold_low: glucoseLimit,
        metabolite_threshold_high: lactateLimit,
        fouling_threshold_high: foulingLimit,
        step_increment_vvd: stepIncrement,
        deadband_hours: deadbandHours,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      onRefreshState();
    } catch (err) {
      console.error('Failed to save thresholds:', err);
    } finally {
      setSaving(false);
    }
  };

  // Reset thresholds to recommended baseline engineering defaults
  const handleResetDefaults = () => {
    setGlucoseLimit(1.5);
    setFoulingLimit(70.0);
    setLactateLimit(3.5);
    setStepIncrement(0.3);
    setDeadbandHours(1.0);
  };

  // Extract authentic controller actions from current simulation run
  const recordedActions: ControllerActionInfo[] = useMemo(() => {
    if (state.controller_actions && state.controller_actions.length > 0) {
      return [...state.controller_actions].reverse();
    }
    if (state.latest_controller_action) {
      return [state.latest_controller_action];
    }
    // Also inspect history for discrete perfusion changes if controller was enabled
    const detected: ControllerActionInfo[] = [];
    if (history.length > 1) {
      for (let i = 1; i < history.length; i++) {
        const prev = history[i - 1];
        const curr = history[i];
        if (curr.controller_enabled && Math.abs(curr.perfusion_rate - prev.perfusion_rate) > 0.04) {
          const isIncrease = curr.perfusion_rate > prev.perfusion_rate;
          let reason = isIncrease
            ? (curr.nutrient_concentration < glucoseLimit ? `Glucose low (${curr.nutrient_concentration.toFixed(2)} < ${glucoseLimit.toFixed(2)} g/L)` : `Metabolite elevation (${curr.metabolite_concentration.toFixed(2)} > ${lactateLimit.toFixed(2)} g/L)`)
            : `Fouling protection (${curr.fouling_index.toFixed(1)}% >= ${foulingLimit.toFixed(1)}%)`;
          detected.push({
            timestamp: curr.time,
            action_type: isIncrease ? 'Increase Perfusion' : 'Throttle Perfusion',
            reason,
            previous_perfusion: prev.perfusion_rate,
            current_perfusion: curr.perfusion_rate,
          });
        }
      }
    }
    return detected.reverse();
  }, [state.controller_actions, state.latest_controller_action, history, glucoseLimit, lactateLimit, foulingLimit]);

  const latestAction = recordedActions.length > 0 ? recordedActions[0] : null;

  // Single Consolidated Status Indicator
  const renderStatusBadge = () => {
    if (!enabled) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Manual Fixed Mode · Feedback inactive (D = {state.perfusion_rate.toFixed(2)} VVD)
        </span>
      );
    }
    if (state.active_fault) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          Disturbance Active · Counteracting {state.active_fault.replace(/_/g, ' ')}
        </span>
      );
    }
    if (latestAction && Math.abs(state.simulation_time - latestAction.timestamp) < 6.0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
          Intervention Active · {latestAction.action_type} ({latestAction.previous_perfusion.toFixed(2)} → {latestAction.current_perfusion.toFixed(2)} VVD)
        </span>
      );
    }
    if (latestAction) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Within limits · Last action at {latestAction.timestamp.toFixed(1)} h
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Within limits · No interventions needed at t = {state.simulation_time.toFixed(1)} h
      </span>
    );
  };

  // Process history coordinates for SVG performance chart
  const chartData = useMemo(() => {
    if (!history || history.length === 0) {
      return [
        {
          time: 0,
          perfusion_rate: state.perfusion_rate,
          nutrient_concentration: state.nutrient_concentration,
          metabolite_concentration: state.metabolite_concentration,
          fouling_index: state.fouling_index,
          controller_enabled: enabled,
          viable_cell_density: state.viable_cell_density,
          nonviable_cell_density: state.nonviable_cell_density,
          cell_viability: state.cell_viability,
          product_concentration: state.product_concentration,
        },
      ];
    }
    return history;
  }, [history, state, enabled]);


  // Dimensions for responsive SVGs
  const svgWidth = 800;
  const topPlotHeight = 120;
  const bottomPlotHeight = 150;
  const maxTime = Math.max(120, state.simulation_time, ...chartData.map((d) => d.time));

  // Compute SVG polyline paths
  const scaleX = (t: number) => 50 + (t / maxTime) * (svgWidth - 70);
  const scaleYPerfusion = (d: number) => topPlotHeight - 20 - ((d - 0) / (maxVvd * 1.15)) * (topPlotHeight - 35);
  const scaleYConcentration = (c: number) => bottomPlotHeight - 25 - ((c - 0) / 10.0) * (bottomPlotHeight - 40); // 0 to 10 g/L
  const scaleYFouling = (f: number) => bottomPlotHeight - 25 - ((f - 0) / 100.0) * (bottomPlotHeight - 40); // 0 to 100%

  const perfusionPath = chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(d.time).toFixed(1)} ${scaleYPerfusion(d.perfusion_rate).toFixed(1)}`).join(' ');
  const glucosePath = chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(d.time).toFixed(1)} ${scaleYConcentration(d.nutrient_concentration).toFixed(1)}`).join(' ');
  const lactatePath = chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(d.time).toFixed(1)} ${scaleYConcentration(d.metabolite_concentration).toFixed(1)}`).join(' ');
  const foulingPath = chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(d.time).toFixed(1)} ${scaleYFouling(d.fouling_index).toFixed(1)}`).join(' ');

  return (
    <div className="border border-slate-200 rounded-lg p-5 space-y-5 bg-white shadow-none font-sans text-slate-800">
      {/* 1. Header with Mode Switcher & Direct Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-50 border border-slate-200/90 rounded-md text-blue-600 shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1f2937] leading-tight">
              Rule-Based Feedback Controller
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Closed-loop feedback regulation maintaining substrate feed and protecting filtration membrane
            </p>
          </div>
        </div>

        {/* Mode Toggle Button Group */}
        <div className="flex items-center gap-2">
          <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => handleModeChange(false)}
              disabled={saving}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
                !enabled
                  ? 'bg-white text-slate-800 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Manual Fixed
            </button>
            <button
              type="button"
              onClick={() => handleModeChange(true)}
              disabled={saving}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                enabled
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              Adaptive Feedback
            </button>
          </div>
        </div>
      </div>

      {/* 2. Single Consolidated Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 p-3 rounded-md bg-slate-50 border border-slate-200/80 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {renderStatusBadge()}
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-500 flex-wrap">
          <div>
            Operating limits: <span className="font-mono font-bold text-slate-700">{minVvd.toFixed(1)} – {maxVvd.toFixed(1)} VVD</span>
          </div>
          <div>
            Max step: <span className="font-mono font-bold text-slate-700">≤ {stepIncrement.toFixed(2)} VVD</span>
          </div>
          <div>
            Deadband: <span className="font-mono font-bold text-slate-700">{deadbandHours.toFixed(1)} h</span>
          </div>
        </div>
      </div>

      {/* 3. Single Row Layout: Policy Table on Left, Live Operating Status on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Column: Compact Policy & Editable Setpoint Table (7 Cols) */}
        <div className="lg:col-span-8 border border-slate-200/90 rounded-md p-4 bg-slate-50/50 flex flex-col justify-between">
          <form onSubmit={handleSaveThresholds} className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Operational Control Policy &amp; Thresholds
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Controller acts when monitored state variables cross specified boundaries
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer transition"
                title="Reset to recommended engineering defaults"
              >
                <RotateCcw className="w-3 h-3" />
                Defaults
              </button>
            </div>

            {/* Threshold Rules Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-md bg-white">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 text-[11px] font-semibold">
                    <th className="py-2 px-3">Variable</th>
                    <th className="py-2 px-3">Trigger Condition</th>
                    <th className="py-2 px-3">Action</th>
                    <th className="py-2 px-3">Current</th>
                    <th className="py-2 px-3">Threshold Setpoint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Glucose */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 font-medium text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      Glucose
                    </td>
                    <td className="py-2 px-3 text-slate-600 text-[11px]">Substrate limitation</td>
                    <td className="py-2 px-3 text-slate-700 text-[11px] font-medium">+ΔD (Ramp Feed)</td>
                    <td className="py-2 px-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                      {state.nutrient_concentration.toFixed(2)} g/L
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 font-mono text-xs">&lt;</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0.5"
                          max="10.0"
                          value={glucoseLimit}
                          onChange={(e) => setGlucoseLimit(parseFloat(e.target.value) || 0)}
                          className="w-16 px-1.5 py-0.5 border border-slate-300 rounded font-mono text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                        />
                        <span className="text-[11px] text-slate-500">g/L</span>
                      </div>
                    </td>
                  </tr>

                  {/* Membrane Fouling */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 font-medium text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                      <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                      Fouling Risk
                    </td>
                    <td className="py-2 px-3 text-slate-600 text-[11px]">Membrane load warning</td>
                    <td className="py-2 px-3 text-slate-700 text-[11px] font-medium">−ΔD (Throttle)</td>
                    <td className="py-2 px-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                      {state.fouling_index.toFixed(1)}%
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 font-mono text-xs">&ge;</span>
                        <input
                          type="number"
                          step="5"
                          min="20"
                          max="95"
                          value={foulingLimit}
                          onChange={(e) => setFoulingLimit(parseFloat(e.target.value) || 0)}
                          className="w-16 px-1.5 py-0.5 border border-slate-300 rounded font-mono text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                        />
                        <span className="text-[11px] text-slate-500">%</span>
                      </div>
                    </td>
                  </tr>

                  {/* Lactate */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 font-medium text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                      Lactate
                    </td>
                    <td className="py-2 px-3 text-slate-600 text-[11px]">Metabolite toxicity</td>
                    <td className="py-2 px-3 text-slate-700 text-[11px] font-medium">+ΔD (Washout)</td>
                    <td className="py-2 px-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                      {state.metabolite_concentration.toFixed(2)} g/L
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 font-mono text-xs">&gt;</span>
                        <input
                          type="number"
                          step="0.5"
                          min="1.0"
                          max="15.0"
                          value={lactateLimit}
                          onChange={(e) => setLactateLimit(parseFloat(e.target.value) || 0)}
                          className="w-16 px-1.5 py-0.5 border border-slate-300 rounded font-mono text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                        />
                        <span className="text-[11px] text-slate-500">g/L</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Dynamics & Rate-of-Change Constraints */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 text-[11px]">Rate step size (ΔD):</span>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="1.5"
                    value={stepIncrement}
                    onChange={(e) => setStepIncrement(parseFloat(e.target.value) || 0)}
                    className="w-14 px-1.5 py-0.5 border border-slate-300 rounded font-mono text-xs text-slate-800"
                  />
                  <span className="text-[10px] text-slate-400">VVD</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 text-[11px]">Deadband window:</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="6.0"
                    value={deadbandHours}
                    onChange={(e) => setDeadbandHours(parseFloat(e.target.value) || 0)}
                    className="w-14 px-1.5 py-0.5 border border-slate-300 rounded font-mono text-xs text-slate-800"
                  />
                  <span className="text-[10px] text-slate-400">h</span>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {saveSuccess && (
                  <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Updated
                  </span>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3 h-3" />
                  {saving ? 'Saving...' : 'Apply Thresholds'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: Live Operating Bounds & Active Execution Card (4 Cols) */}
        <div className="lg:col-span-4 border border-slate-200/90 rounded-md p-4 bg-slate-50/50 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Current Operating Status
            </h3>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-white border border-slate-200 rounded-md space-y-1.5">
                <div className="flex items-center justify-between text-slate-500 text-[11px]">
                  <span>Current Perfusion Rate</span>
                  <span className="font-mono text-slate-400">D</span>
                </div>
                <div className="text-lg font-bold font-mono text-blue-700 flex items-baseline gap-1">
                  {state.perfusion_rate.toFixed(2)}
                  <span className="text-xs font-normal text-slate-500 font-sans">VVD</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, ((state.perfusion_rate - minVvd) / (maxVvd - minVvd)) * 100)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>Min {minVvd.toFixed(1)}</span>
                  <span>Max {maxVvd.toFixed(1)} VVD</span>
                </div>
              </div>

              {/* Latest Intervention Summary */}
              <div className="p-2.5 bg-white border border-slate-200 rounded-md text-xs space-y-1">
                <div className="text-[11px] font-semibold text-slate-600">Last Recorded Action</div>
                {latestAction ? (
                  <>
                    <div className="flex items-center justify-between font-mono text-[11px] text-slate-800">
                      <span className="text-blue-700 font-bold">{latestAction.action_type}</span>
                      <span>t = {latestAction.timestamp.toFixed(1)} h</span>
                    </div>
                    <div className="text-[11px] text-slate-600 leading-tight">
                      {latestAction.reason}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono pt-0.5">
                      Shift: {latestAction.previous_perfusion.toFixed(2)} → {latestAction.current_perfusion.toFixed(2)} VVD
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-500 italic py-1">
                    No controller adjustments recorded yet in this run.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 border-t border-slate-200/70 pt-2 flex items-center justify-between">
            <span>Intervention count:</span>
            <span className="font-mono font-bold text-slate-700">{recordedActions.length}</span>
          </div>
        </div>
      </div>

      {/* 4. Live Controller Performance Chart (Perfusion vs Triggers over Time) */}
      <div className="border border-slate-200 rounded-md p-4 bg-white space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Controller Response &amp; Process Traces
            </h3>
            <p className="text-[11px] text-slate-500">
              Live trajectory showing perfusion rate step adjustments and process variables relative to threshold lines
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[11px] font-sans flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-blue-600 inline-block" />
              Perfusion D(t)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              Glucose
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" />
              Fouling
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              Lactate
            </span>
          </div>
        </div>

        {/* Live / Hover Telemetry Readout Strip */}
        <div className="flex items-center justify-between text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded font-mono text-[11px]">
          {hoveredPoint ? (
            <div className="flex items-center gap-4 flex-wrap text-slate-700">
              <span className="font-bold text-slate-900">Inspect t = {hoveredPoint.time.toFixed(1)} h:</span>
              <span className="text-blue-700 font-semibold">D = {hoveredPoint.perfusion_rate.toFixed(2)} VVD</span>
              <span className="text-amber-700 font-semibold">Glucose = {hoveredPoint.nutrient_concentration.toFixed(2)} g/L</span>
              <span className="text-violet-700 font-semibold">Fouling = {hoveredPoint.fouling_index.toFixed(1)}%</span>
              <span className="text-rose-700 font-semibold">Lactate = {hoveredPoint.metabolite_concentration.toFixed(2)} g/L</span>
            </div>
          ) : (
            <div className="flex items-center gap-4 flex-wrap text-slate-600">
              <span className="font-bold text-slate-800">Current (t = {state.simulation_time.toFixed(1)} h):</span>
              <span className="text-blue-700 font-semibold">D = {state.perfusion_rate.toFixed(2)} VVD</span>
              <span className="text-amber-700 font-semibold">Glucose = {state.nutrient_concentration.toFixed(2)} g/L</span>
              <span className="text-violet-700 font-semibold">Fouling = {state.fouling_index.toFixed(1)}%</span>
              <span className="text-rose-700 font-semibold">Lactate = {state.metabolite_concentration.toFixed(2)} g/L</span>
            </div>
          )}
          <span className="text-slate-400 text-[10px] hidden sm:inline">Hover chart to inspect trajectory</span>
        </div>

        {/* SVG Chart */}
        <div className="relative border border-slate-100 rounded-md p-2 bg-[#FAFBFD] overflow-hidden">
          <svg
            viewBox={`0 0 ${svgWidth} ${topPlotHeight + bottomPlotHeight}`}
            className="w-full h-auto select-none cursor-crosshair"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const mouseX = e.clientX - rect.left;
              const normalizedX = (mouseX / rect.width) * svgWidth;
              const targetTime = ((normalizedX - 50) / (svgWidth - 70)) * maxTime;
              if (targetTime >= 0 && targetTime <= maxTime && chartData.length > 0) {
                let closest = chartData[0];
                let minDiff = Math.abs(chartData[0].time - targetTime);
                for (let i = 1; i < chartData.length; i++) {
                  const diff = Math.abs(chartData[i].time - targetTime);
                  if (diff < minDiff) {
                    minDiff = diff;
                    closest = chartData[i];
                  }
                }
                setHoveredPoint(closest);
              }
            }}
            onMouseLeave={() => setHoveredPoint(null)}
          >
            {/* Top Lane: Perfusion Rate (VVD) */}
            <g>
              {/* Lane Header */}
              <text x="50" y="16" fill="#475569" fontSize="10" fontWeight="600">
                Perfusion Rate D(t) [VVD]
              </text>

              {/* Horizontal gridlines for top lane */}
              <line x1="50" y1={scaleYPerfusion(0)} x2={svgWidth - 20} y2={scaleYPerfusion(0)} stroke="#E2E8F0" strokeWidth="1" />
              <line x1="50" y1={scaleYPerfusion(1.0)} x2={svgWidth - 20} y2={scaleYPerfusion(1.0)} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="50" y1={scaleYPerfusion(2.0)} x2={svgWidth - 20} y2={scaleYPerfusion(2.0)} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="50" y1={scaleYPerfusion(maxVvd)} x2={svgWidth - 20} y2={scaleYPerfusion(maxVvd)} stroke="#CBD5E1" strokeWidth="1" strokeDasharray="2 2" />

              <text x="45" y={scaleYPerfusion(0) + 3} fill="#94A3B8" fontSize="9" textAnchor="end" fontFamily="monospace">0.0</text>
              <text x="45" y={scaleYPerfusion(1.0) + 3} fill="#94A3B8" fontSize="9" textAnchor="end" fontFamily="monospace">1.0</text>
              <text x="45" y={scaleYPerfusion(2.0) + 3} fill="#94A3B8" fontSize="9" textAnchor="end" fontFamily="monospace">2.0</text>
              <text x="45" y={scaleYPerfusion(maxVvd) + 3} fill="#94A3B8" fontSize="9" textAnchor="end" fontFamily="monospace">{maxVvd.toFixed(1)}</text>

              {/* Perfusion stepped trace */}
              <path
                d={perfusionPath}
                fill="none"
                stroke="#2563EB"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Action markers on top lane */}
              {recordedActions.map((action, idx) => {
                const cx = scaleX(action.timestamp);
                const cy = scaleYPerfusion(action.current_perfusion);
                return (
                  <g key={idx} className="cursor-pointer">
                    <circle cx={cx} cy={cy} r="4.5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="1.5" />
                    <line x1={cx} y1={cy + 5} x2={cx} y2={topPlotHeight - 5} stroke="#2563EB" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
                  </g>
                );
              })}

              {/* Hover vertical hairline and point marker on top lane */}
              {hoveredPoint && (
                <g>
                  <line
                    x1={scaleX(hoveredPoint.time)}
                    y1={15}
                    x2={scaleX(hoveredPoint.time)}
                    y2={topPlotHeight - 5}
                    stroke="#94A3B8"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <circle
                    cx={scaleX(hoveredPoint.time)}
                    cy={scaleYPerfusion(hoveredPoint.perfusion_rate)}
                    r="4"
                    fill="#2563EB"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                </g>
              )}
            </g>

            {/* Divider between lanes */}
            <line x1="20" y1={topPlotHeight} x2={svgWidth - 10} y2={topPlotHeight} stroke="#E2E8F0" strokeWidth="1" />

            {/* Bottom Lane: Process Variables & Threshold Guides */}
            <g transform={`translate(0, ${topPlotHeight})`}>
              <text x="50" y="16" fill="#475569" fontSize="10" fontWeight="600">
                Process Variables (Glucose &amp; Lactate [g/L], Fouling [%])
              </text>

              {/* Y Axis Guides */}
              <line x1="50" y1={scaleYConcentration(0)} x2={svgWidth - 20} y2={scaleYConcentration(0)} stroke="#E2E8F0" strokeWidth="1" />
              <line x1="50" y1={scaleYConcentration(5.0)} x2={svgWidth - 20} y2={scaleYConcentration(5.0)} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="50" y1={scaleYConcentration(10.0)} x2={svgWidth - 20} y2={scaleYConcentration(10.0)} stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3 3" />

              <text x="45" y={scaleYConcentration(0) + 3} fill="#94A3B8" fontSize="9" textAnchor="end" fontFamily="monospace">0</text>
              <text x="45" y={scaleYConcentration(5.0) + 3} fill="#94A3B8" fontSize="9" textAnchor="end" fontFamily="monospace">5 g/L</text>
              <text x="45" y={scaleYConcentration(10.0) + 3} fill="#94A3B8" fontSize="9" textAnchor="end" fontFamily="monospace">10</text>

              {/* Threshold Guide Lines */}
              {/* 1. Glucose Low Threshold */}
              <line
                x1="50"
                y1={scaleYConcentration(glucoseLimit)}
                x2={svgWidth - 20}
                y2={scaleYConcentration(glucoseLimit)}
                stroke="#F59E0B"
                strokeWidth="1.2"
                strokeDasharray="4 4"
              />
              <text
                x={svgWidth - 25}
                y={scaleYConcentration(glucoseLimit) - 3}
                fill="#D97706"
                fontSize="9"
                textAnchor="end"
                fontFamily="sans-serif"
                fontWeight="500"
              >
                Glucose limit ({glucoseLimit.toFixed(1)} g/L)
              </text>

              {/* 2. Fouling Threshold (70%) */}
              <line
                x1="50"
                y1={scaleYFouling(foulingLimit)}
                x2={svgWidth - 20}
                y2={scaleYFouling(foulingLimit)}
                stroke="#8B5CF6"
                strokeWidth="1.2"
                strokeDasharray="4 4"
              />
              <text
                x={svgWidth - 25}
                y={scaleYFouling(foulingLimit) - 3}
                fill="#7C3AED"
                fontSize="9"
                textAnchor="end"
                fontFamily="sans-serif"
                fontWeight="500"
              >
                Fouling limit ({foulingLimit.toFixed(0)}%)
              </text>

              {/* 3. Lactate Threshold */}
              <line
                x1="50"
                y1={scaleYConcentration(lactateLimit)}
                x2={svgWidth - 20}
                y2={scaleYConcentration(lactateLimit)}
                stroke="#F43F5E"
                strokeWidth="1.2"
                strokeDasharray="4 4"
              />
              <text
                x={svgWidth - 25}
                y={scaleYConcentration(lactateLimit) - 3}
                fill="#E11D48"
                fontSize="9"
                textAnchor="end"
                fontFamily="sans-serif"
                fontWeight="500"
              >
                Lactate limit ({lactateLimit.toFixed(1)} g/L)
              </text>

              {/* Traces */}
              <path d={glucosePath} fill="none" stroke="#D97706" strokeWidth="1.75" />
              <path d={foulingPath} fill="none" stroke="#8B5CF6" strokeWidth="1.75" />
              <path d={lactatePath} fill="none" stroke="#E11D48" strokeWidth="1.75" />

              {/* Hover vertical hairline and markers on bottom lane */}
              {hoveredPoint && (
                <g>
                  <line
                    x1={scaleX(hoveredPoint.time)}
                    y1={15}
                    x2={scaleX(hoveredPoint.time)}
                    y2={bottomPlotHeight - 20}
                    stroke="#94A3B8"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <circle cx={scaleX(hoveredPoint.time)} cy={scaleYConcentration(hoveredPoint.nutrient_concentration)} r="3.5" fill="#D97706" stroke="#FFFFFF" strokeWidth="1.5" />
                  <circle cx={scaleX(hoveredPoint.time)} cy={scaleYFouling(hoveredPoint.fouling_index)} r="3.5" fill="#8B5CF6" stroke="#FFFFFF" strokeWidth="1.5" />
                  <circle cx={scaleX(hoveredPoint.time)} cy={scaleYConcentration(hoveredPoint.metabolite_concentration)} r="3.5" fill="#E11D48" stroke="#FFFFFF" strokeWidth="1.5" />
                </g>
              )}

              {/* Time Axis Markers */}
              <text x="50" y={bottomPlotHeight - 5} fill="#94A3B8" fontSize="9" textAnchor="middle" fontFamily="monospace">0h</text>
              <text x={scaleX(maxTime * 0.25)} y={bottomPlotHeight - 5} fill="#94A3B8" fontSize="9" textAnchor="middle" fontFamily="monospace">{(maxTime * 0.25).toFixed(0)}h</text>
              <text x={scaleX(maxTime * 0.5)} y={bottomPlotHeight - 5} fill="#94A3B8" fontSize="9" textAnchor="middle" fontFamily="monospace">{(maxTime * 0.5).toFixed(0)}h</text>
              <text x={scaleX(maxTime * 0.75)} y={bottomPlotHeight - 5} fill="#94A3B8" fontSize="9" textAnchor="middle" fontFamily="monospace">{(maxTime * 0.75).toFixed(0)}h</text>
              <text x={scaleX(maxTime)} y={bottomPlotHeight - 5} fill="#94A3B8" fontSize="9" textAnchor="middle" fontFamily="monospace">{maxTime.toFixed(0)}h</text>
            </g>
          </svg>
        </div>
      </div>


      {/* 5. Controller Intervention History & Audit Trail */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Intervention Audit Trail ({recordedActions.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-sans">
            Newest actions listed first
          </span>
        </div>

        {recordedActions.length === 0 ? (
          /* Honest Empty State when no interventions have occurred */
          <div className="p-8 text-center bg-slate-50/60 border border-slate-200/90 rounded-md space-y-2">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
              <Info className="w-4 h-4" />
            </div>
            <div className="text-xs font-semibold text-slate-800">
              No interventions recorded in this run
            </div>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto leading-relaxed">
              {enabled
                ? `Process variables remain within standard bounds (Glucose ≥ ${glucoseLimit.toFixed(1)} g/L, Lactate ≤ ${lactateLimit.toFixed(1)} g/L, Fouling < ${foulingLimit.toFixed(0)}%). If a disturbance occurs or nutrients deplete, the feedback controller will record its adjustments here.`
                : 'The controller is set to Manual Fixed mode (feedback adjustments are disabled). Perfusion remains at setpoint.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-md bg-white">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 text-[11px] font-semibold">
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Variable</th>
                  <th className="py-2.5 px-3">Trigger Condition</th>
                  <th className="py-2.5 px-3">Action Type</th>
                  <th className="py-2.5 px-3">Adjustment</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recordedActions.map((log, idx) => {
                  const delta = log.current_perfusion - log.previous_perfusion;
                  const deltaSign = delta > 0 ? '+' : '';
                  const isGlucose = log.reason.toLowerCase().includes('glucose') || log.reason.toLowerCase().includes('substrate');
                  const isFouling = log.reason.toLowerCase().includes('fouling') || log.reason.toLowerCase().includes('membrane');

                  return (
                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                        {log.timestamp.toFixed(1)} h
                      </td>
                      <td className="py-2.5 px-3 font-medium whitespace-nowrap">
                        <span className="flex items-center gap-1.5 text-slate-800">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isGlucose ? 'bg-amber-500' : isFouling ? 'bg-violet-500' : 'bg-rose-500'
                            }`}
                          />
                          {isGlucose ? 'Glucose' : isFouling ? 'Fouling Risk' : 'Lactate'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px] max-w-xs truncate" title={log.reason}>
                        {log.reason}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 font-medium whitespace-nowrap">
                        {log.action_type}
                      </td>
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                        <span className="text-slate-600">{log.previous_perfusion.toFixed(2)}</span>
                        <span className="text-slate-400 mx-1">→</span>
                        <span className="text-blue-700 font-bold">{log.current_perfusion.toFixed(2)} VVD</span>
                        <span className={`text-[10px] ml-1.5 font-medium ${delta > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                          ({deltaSign}{delta.toFixed(2)})
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Executed
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
