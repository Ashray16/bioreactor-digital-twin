import { useState } from 'react';
import { Zap, CheckCircle2, ChevronRight, ArrowRight } from 'lucide-react';
import { injectProcessFault } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { FaultConfig } from '../../types/simulation';

interface FaultInjectionPanelProps {
  onRefreshState: () => void;
  onInjectSuccess?: (fault: FaultConfig) => void;
  onNavigateToTab?: (tab: 'scenarios' | 'dashboard') => void;
}

interface CausalStep {
  stage: string;
  title: string;
  detail: string;
}

export default function FaultInjectionPanel({
  onRefreshState,
  onInjectSuccess,
  onNavigateToTab,
}: FaultInjectionPanelProps) {
  // Recommended parameter defaults for realistic bioprocess demonstration:
  // Initial perfusion ~0.4 VVD, start time 60h (cells dense & hungry), severity 85%, duration 40h
  const [selectedFault, setSelectedFault] = useState<
    'nutrient_reduction' | 'cell_death_surge' | 'fouling_surge' | 'perfusion_disruption'
  >('nutrient_reduction');
  const [severity, setSeverity] = useState(0.85);
  const [startTime, setStartTime] = useState(60.0);
  const [duration, setDuration] = useState(40.0);
  const [injecting, setInjecting] = useState(false);
  const [injectedFault, setInjectedFault] = useState<FaultConfig | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();

  const handleInject = async () => {
    setInjecting(true);
    setMessage(null);
    const faultPayload: FaultConfig = {
      fault_type: selectedFault,
      severity,
      start_time: startTime,
      duration,
    };

    try {
      const res = await injectProcessFault(faultPayload);
      setMessage(res.message);
      setInjectedFault(faultPayload);
      showSuccess(`Disturbance scheduled: ${res.message}`);
      onRefreshState();

      // Immediately pass injected fault to parent and navigate to charts with disturbance shading
      if (onInjectSuccess) {
        onInjectSuccess(faultPayload);
      }
    } catch (err: any) {
      const errMsg = `Error: ${err.message}`;
      setMessage(errMsg);
      showError(errMsg);
    } finally {
      setInjecting(false);
    }
  };

  const scenarios = [
    {
      id: 'nutrient_reduction' as const,
      title: 'Nutrient Feed Reduction',
      shortDesc: 'Media glucose supply depletion simulating feed pump failure or media lot exhaustion.',
      getMapping: (sev: number) =>
        `Severity ${(sev * 100).toFixed(0)}% = ${(sev * 95).toFixed(0)}% feed glucose drop (delivers ${(7.0 * Math.max(0.05, 1 - 0.95 * sev)).toFixed(2)} g/L vs 7.0 g/L nominal)`,
    },
    {
      id: 'perfusion_disruption' as const,
      title: 'Perfusion Pump Disruption',
      shortDesc: 'Mechanical pump head wear, tubing pinch, or line flow resistance restriction.',
      getMapping: (sev: number) =>
        `Severity ${(sev * 100).toFixed(0)}% = pump delivers ${Math.max(5, Math.round((1 - sev) * 100))}% of setpoint (${(0.4 * Math.max(0.05, 1 - sev)).toFixed(2)} VVD vs 0.40 VVD baseline)`,
    },
    {
      id: 'cell_death_surge' as const,
      title: 'Cell Mortality Surge',
      shortDesc: 'Acute cytotoxic shock, viral contamination, or hydrodynamic shear stress.',
      getMapping: (sev: number) =>
        `Severity ${(sev * 100).toFixed(0)}% = +${(0.03 * sev).toFixed(3)} h⁻¹ added to baseline mortality rate (+${(sev * 300).toFixed(0)}% increase)`,
    },
    {
      id: 'fouling_surge' as const,
      title: 'Filter Fouling Surge',
      shortDesc: 'Accelerated bio-cake layer deposition on hollow-fiber ATF/TFF membrane.',
      getMapping: (sev: number) =>
        `Severity ${(sev * 100).toFixed(0)}% = ${(1.0 + 3.0 * sev).toFixed(1)}× membrane fouling sensitivity multiplier`,
    },
  ];

  const getDynamicCausalChain = (
    fault: 'nutrient_reduction' | 'cell_death_surge' | 'fouling_surge' | 'perfusion_disruption',
    sev: number,
    t0: number,
    dt: number
  ): CausalStep[] => {
    const tEnd = (t0 + dt).toFixed(0);
    const baselineFeed = 7.0; // g/L
    const baselinePerfusion = 0.4; // VVD

    switch (fault) {
      case 'nutrient_reduction': {
        const feedDropPct = Math.round(sev * 95);
        const reducedFeed = (baselineFeed * Math.max(0.05, 1.0 - 0.95 * sev)).toFixed(2);
        const vesselMinGlucose = Math.max(0.35, 4.8 * (1.0 - sev * 0.85)).toFixed(2);
        const muDropPct = Math.round(sev * 75);

        return [
          {
            stage: 'Injection',
            title: 'Feed Substrate Starvation',
            detail: `Fresh media glucose cut by ${feedDropPct}% (to ${reducedFeed} g/L) at t=${t0.toFixed(0)}h for ${dt.toFixed(0)}h.`,
          },
          {
            stage: 'Vessel Impact',
            title: 'Glucose Concentration Drifts Down',
            detail: `Dense cells (~6.5M/mL) rapidly consume vessel glucose, dropping below 1.5 g/L toward ${vesselMinGlucose} g/L.`,
          },
          {
            stage: 'Twin Model',
            title: 'Growth Halts (μ → 0)',
            detail: `Monod substrate limitation drops specific growth rate μ by ~${muDropPct}%; cell viability starts declining.`,
          },
          {
            stage: 'Controller Action',
            title: 'Adaptive Perfusion Ramp',
            detail: `Glucose < 1.5 g/L threshold trips closed-loop controller: ramps perfusion D from ${baselinePerfusion.toFixed(1)} up toward 4.0 VVD.`,
          },
          {
            stage: 'Bioprocess Outcome',
            title: 'Homeostasis vs Crash',
            detail: `Controlled run delivers 5.4 g/L/day glucose and recovers viability; uncontrolled 0.4 VVD crashes to starvation.`,
          },
        ];
      }

      case 'perfusion_disruption': {
        const deliveryPct = Math.max(5, Math.round((1.0 - sev) * 100));
        const throttledFlow = (baselinePerfusion * Math.max(0.05, 1.0 - sev)).toFixed(2);
        const lactateAccum = (sev * 2.8).toFixed(1);

        return [
          {
            stage: 'Injection',
            title: 'Perfusion Pump Restriction',
            detail: `Pump mechanically restricted to deliver only ${deliveryPct}% of setpoint (${throttledFlow} VVD) from t=${t0.toFixed(0)}h to ${tEnd}h.`,
          },
          {
            stage: 'Vessel Impact',
            title: 'Toxic Metabolite Accumulation',
            detail: `Reduced washout leads to severe lactate accumulation (+${lactateAccum} g/L), acidifying culture media.`,
          },
          {
            stage: 'Twin Model',
            title: 'Metabolite Inhibition Triggered',
            detail: `Lactate crosses high threshold (3.5 g/L), triggering secondary growth inhibition and slowing viable density.`,
          },
          {
            stage: 'Controller Action',
            title: 'Emergency Flow Compensation',
            detail: `Controller detects byproduct buildup, raises valve setpoints and triggers flow deviation alarms.`,
          },
          {
            stage: 'Bioprocess Outcome',
            title: 'Recovery on Disturbance Clearance',
            detail: `Homeostasis restored once pump restriction clears at t=${tEnd}h; uncontrolled culture retains elevated lactate.`,
          },
        ];
      }

      case 'cell_death_surge': {
        const addedDeathRate = (0.03 * sev).toFixed(3);
        const viabilityDrop = Math.round(sev * 28);
        const stabilizedViability = Math.max(60, Math.round(100 - sev * 18));

        return [
          {
            stage: 'Injection',
            title: 'Acute Cytotoxic Stress',
            detail: `Cytotoxic stress adds +${addedDeathRate} h⁻¹ to baseline mortality rate from t=${t0.toFixed(0)}h.`,
          },
          {
            stage: 'Vessel Impact',
            title: 'Viability Decline & Lysis',
            detail: `Cell viability drops by ~${viabilityDrop} percentage points as nonviable cell fraction X_d accumulates.`,
          },
          {
            stage: 'Twin Model',
            title: 'Debris & Filter Loading',
            detail: `Intracellular debris release increases bioreactor turbidity and accelerates membrane filter loading.`,
          },
          {
            stage: 'Controller Action',
            title: 'Bleed & Perfusion Adjustment',
            detail: `Controller increases bleed perfusion exchange to purge dead cell debris and maintain viable cell fraction.`,
          },
          {
            stage: 'Bioprocess Outcome',
            title: 'Viability Preserved Above Critical Limit',
            detail: `Viability stabilizes above ${stabilizedViability}% in controlled run; uncontrolled culture suffers irreversible lysis.`,
          },
        ];
      }

      case 'fouling_surge': {
        const foulingMult = (1.0 + 3.0 * sev).toFixed(1);
        const projectedFouling = Math.min(98, Math.round(28 + sev * 62));

        return [
          {
            stage: 'Injection',
            title: 'Accelerated Bio-Cake Deposition',
            detail: `Bio-cake deposition sensitivity boosted to ${foulingMult}× nominal rate starting at t=${t0.toFixed(0)}h.`,
          },
          {
            stage: 'Vessel Impact',
            title: 'Fouling Index Rapid Rise',
            detail: `Membrane fouling index F rapidly climbs toward ${projectedFouling} / 100 within the ${dt.toFixed(0)}h window.`,
          },
          {
            stage: 'Twin Model',
            title: 'Transmembrane Pressure Alarm',
            detail: `Fouling exceeds warning setpoint (70/100); digital twin signals impending filter occlusion risk.`,
          },
          {
            stage: 'Controller Action',
            title: 'Protective Perfusion Throttling',
            detail: `Controller throttles perfusion to a safe hydrodynamic flux to prevent irreversible hollow-fiber clogging.`,
          },
          {
            stage: 'Bioprocess Outcome',
            title: 'Membrane Preserved Without Shutdown',
            detail: `Filter fouling index safely contained below 80; uncontrolled filter suffers total occlusion (F = 100).`,
          },
        ];
      }
    }
  };

  const chain = getDynamicCausalChain(selectedFault, severity, startTime, duration);

  return (
    <div className="bg-white border border-slate-200 rounded-md p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 border border-slate-200 rounded-md text-slate-700">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Process Disturbance &amp; Fault Injection Tool
            </h2>
            <p className="text-xs text-slate-500">
              Inject physical disturbances into the continuous culture to evaluate closed-loop controller resilience
            </p>
          </div>
        </div>

        {injectedFault && (
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => onNavigateToTab?.('scenarios')}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition flex items-center gap-1.5"
            >
              <span>View Scenario Comparison</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigateToTab?.('dashboard')}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition"
            >
              Overview Charts
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Radio Scenario Selector (5 cols) */}
        <div className="lg:col-span-6 space-y-3">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
            Select Disturbance Scenario
          </label>

          <div className="space-y-2">
            {scenarios.map((f) => {
              const isSelected = selectedFault === f.id;
              return (
                <div
                  key={f.id}
                  onClick={() => setSelectedFault(f.id)}
                  className={`p-3.5 rounded-md border cursor-pointer transition text-left ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/30'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {isSelected ? (
                        <div className="w-4 h-4 rounded-full border-2 border-blue-600 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-blue-600" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300" />
                      )}
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900">{f.title}</div>
                      <div className="text-[11px] text-slate-600 leading-normal">{f.shortDesc}</div>
                      <div className="text-[11px] font-mono text-slate-500 pt-0.5 border-t border-slate-100">
                        {f.getMapping(severity)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Parameters & Interactive Timeline Preview (6 cols) */}
        <div className="lg:col-span-6 space-y-4 flex flex-col justify-between">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-4">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Disturbance Dynamics &amp; Operational Window
            </div>

            {/* Slider 1: Severity */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Severity Factor</span>
                <span className="font-mono text-slate-800 font-semibold">
                  {(severity * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.10"
                max="1.00"
                step="0.05"
                value={severity}
                onChange={(e) => setSeverity(parseFloat(e.target.value))}
                className="w-full accent-blue-600 bg-slate-200 rounded cursor-pointer h-1.5"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>10% (Minor)</span>
                <span>85% (Recommended)</span>
                <span>100% (Total)</span>
              </div>
            </div>

            {/* Slider 2: Start Time (0 - 180 h) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Start Time (Culture Age)</span>
                <span className="font-mono text-slate-800 font-semibold">
                  {startTime.toFixed(1)} h
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="180"
                step="1"
                value={startTime}
                onChange={(e) => setStartTime(parseFloat(e.target.value))}
                className="w-full accent-blue-600 bg-slate-200 rounded cursor-pointer h-1.5"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>0 h (Inoculation)</span>
                <span>60 h (Dense &amp; hungry cells)</span>
                <span>180 h (Late stage)</span>
              </div>
            </div>

            {/* Slider 3: Duration (6 - 96 h) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Disturbance Duration</span>
                <span className="font-mono text-slate-800 font-semibold">
                  {duration.toFixed(1)} h
                </span>
              </div>
              <input
                type="range"
                min="6"
                max="96"
                step="2"
                value={duration}
                onChange={(e) => setDuration(parseFloat(e.target.value))}
                className="w-full accent-blue-600 bg-slate-200 rounded cursor-pointer h-1.5"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>6 h (Transient pulse)</span>
                <span>40 h (Recommended challenge)</span>
                <span>96 h (Extended fault)</span>
              </div>
            </div>
          </div>

          {/* Timeline Preview Chart (Placed in previously empty space) */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-md space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-700">Disturbance Timeline Preview</span>
              <span className="font-mono text-slate-600">
                Window: <strong className="text-slate-900">{startTime.toFixed(0)} h</strong> → <strong className="text-slate-900">{(startTime + duration).toFixed(0)} h</strong> (Δ {duration.toFixed(0)} h)
              </span>
            </div>

            {/* Visual Timeline Bar */}
            <div className="relative w-full h-8 bg-slate-100 rounded border border-slate-200 overflow-hidden">
              {/* Shaded Disturbance Window */}
              <div
                className="absolute top-0 bottom-0 bg-rose-500/20 border-x-2 border-rose-600 flex items-center justify-center transition-all duration-150"
                style={{
                  left: `${(startTime / 240) * 100}%`,
                  width: `${Math.min(100 - (startTime / 240) * 100, (duration / 240) * 100)}%`,
                }}
              >
                <span className="text-[10px] font-mono font-bold text-rose-900 truncate px-1 select-none">
                  {duration >= 20 ? `Active Fault (${duration.toFixed(0)}h)` : 'Fault'}
                </span>
              </div>

              {/* Major timeline division markers */}
              <div className="absolute top-0 bottom-0 w-px bg-slate-300 pointer-events-none" style={{ left: '25%' }} />
              <div className="absolute top-0 bottom-0 w-px bg-slate-300 pointer-events-none" style={{ left: '50%' }} />
              <div className="absolute top-0 bottom-0 w-px bg-slate-300 pointer-events-none" style={{ left: '75%' }} />
            </div>

            {/* Axis Tick Labels */}
            <div className="relative w-full flex justify-between text-[10px] font-mono text-slate-400 select-none">
              <span>0 h</span>
              <span>60 h</span>
              <span>120 h</span>
              <span>180 h</span>
              <span>240 h</span>
            </div>
          </div>

          {/* Action Trigger Area */}
          <div className="space-y-2">
            {message && (
              <div className="p-2.5 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-mono text-[11px]">{message}</span>
                </div>
                <button
                  onClick={() => onNavigateToTab?.('scenarios')}
                  className="text-[11px] font-semibold text-emerald-900 underline hover:no-underline ml-2"
                >
                  View Charts →
                </button>
              </div>
            )}

            {/* ONLY red element: single muted red inject button */}
            <button
              onClick={handleInject}
              disabled={injecting}
              className="w-full py-2.5 px-4 rounded-md font-medium text-xs bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>{injecting ? 'Injecting Disturbance...' : 'Inject Fault Disturbance & Jump to Charts'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Causal Chain Section (Neutral single style, connecting sequence arrows) */}
      <div className="pt-4 border-t border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Predicted Process Response &amp; Digital Twin Recovery Flow
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            Dynamically computed for {selectedFault.replace('_', ' ')} (t={startTime.toFixed(0)}h–{(startTime + duration).toFixed(0)}h)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 relative">
          {chain.map((c, i) => (
            <div
              key={i}
              className="p-3 bg-white border border-slate-200 rounded-md flex flex-col justify-between min-h-[110px] shadow-none hover:border-slate-300 transition"
            >
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase tracking-wider font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    <span>Step {i + 1} · {c.stage}</span>
                  </div>
                  {i < chain.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:block shrink-0" />
                  )}
                </div>
                <div className="text-xs font-semibold text-slate-900 mt-1">{c.title}</div>
                <div className="text-[11px] text-slate-600 font-sans leading-relaxed mt-1">{c.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
