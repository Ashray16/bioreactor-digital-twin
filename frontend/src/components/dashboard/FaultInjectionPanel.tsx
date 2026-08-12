import { useState } from 'react';
import { Zap, CheckCircle2 } from 'lucide-react';
import { injectProcessFault } from '../../services/api';

interface FaultInjectionPanelProps {
  onRefreshState: () => void;
}

export default function FaultInjectionPanel({ onRefreshState }: FaultInjectionPanelProps) {
  const [selectedFault, setSelectedFault] = useState<
    'nutrient_reduction' | 'cell_death_surge' | 'fouling_surge' | 'perfusion_disruption'
  >('nutrient_reduction');
  const [severity, setSeverity] = useState(0.75);
  const [startTime, setStartTime] = useState(10.0);
  const [duration, setDuration] = useState(24.0);
  const [injecting, setInjecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleInject = async () => {
    setInjecting(true);
    setMessage(null);
    try {
      const res = await injectProcessFault({
        fault_type: selectedFault,
        severity,
        start_time: startTime,
        duration,
      });
      setMessage(res.message);
      onRefreshState();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setInjecting(false);
    }
  };

  const getFaultCausalChain = (fault: string) => {
    switch (fault) {
      case 'nutrient_reduction':
        return [
          { step: '1. Fault Injected', text: 'Nutrient feed reduced by 75%', color: 'text-red-700 bg-red-50 border-red-200' },
          { step: '2. Primary Impact', text: 'Substrate S drops below 1.5 g/L', color: 'text-amber-700 bg-amber-50 border-amber-200' },
          { step: '3. Digital Twin Prediction', text: 'Cell growth rate halts (μ → 0)', color: 'text-blue-700 bg-blue-50 border-blue-200' },
          { step: '4. Controller Action', text: 'Perfusion rate D adaptively boosted', color: 'text-slate-800 bg-slate-100 border-slate-200' },
          { step: '5. Process Recovery', text: 'Substrate & cell density stabilized', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
        ];
      case 'cell_death_surge':
        return [
          { step: '1. Fault Injected', text: 'Elevated mortality rate (+0.03 h⁻¹)', color: 'text-red-700 bg-red-50 border-red-200' },
          { step: '2. Primary Impact', text: 'Cell viability drops below 85%', color: 'text-amber-700 bg-amber-50 border-amber-200' },
          { step: '3. Digital Twin Prediction', text: 'Elevated debris accelerates filter loading', color: 'text-blue-700 bg-blue-50 border-blue-200' },
          { step: '4. Controller Action', text: 'Perfusion adjusted for debris clearance', color: 'text-slate-800 bg-slate-100 border-slate-200' },
          { step: '5. Process Recovery', text: 'Viability trend stabilizes', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
        ];
      case 'fouling_surge':
        return [
          { step: '1. Fault Injected', text: '3× Membrane Fouling Multiplier', color: 'text-red-700 bg-red-50 border-red-200' },
          { step: '2. Primary Impact', text: 'Fouling index F crosses 70 threshold', color: 'text-amber-700 bg-amber-50 border-amber-200' },
          { step: '3. Digital Twin Prediction', text: 'Imminent filter occlusion warning', color: 'text-blue-700 bg-blue-50 border-blue-200' },
          { step: '4. Controller Action', text: 'Perfusion rate throttled to safe flux', color: 'text-slate-800 bg-slate-100 border-slate-200' },
          { step: '5. Process Recovery', text: 'Membrane risk contained in Moderate zone', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
        ];
      default:
        return [
          { step: '1. Fault Injected', text: 'Perfusion pump line disruption', color: 'text-red-700 bg-red-50 border-red-200' },
          { step: '2. Primary Impact', text: 'Perfusion flow drops by severity %', color: 'text-amber-700 bg-amber-50 border-amber-200' },
          { step: '3. Digital Twin Prediction', text: 'Lactate accumulation hazard', color: 'text-blue-700 bg-blue-50 border-blue-200' },
          { step: '4. Controller Action', text: 'Feedback controller signals pump alarm', color: 'text-slate-800 bg-slate-100 border-slate-200' },
          { step: '5. Process Recovery', text: 'Emergency flow compensation', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
        ];
    }
  };

  const chain = getFaultCausalChain(selectedFault);

  return (
    <div className="glass-panel p-6 rounded-xl border border-slate-200 space-y-6 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Process Disturbance Analysis &amp; Fault Injection Tool
            </h2>
            <p className="text-xs text-slate-500">
              Simulate operational faults in the digital twin to observe adaptive controller response and recovery
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Fault Selector Buttons */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
            Select Disturbance Scenario
          </label>

          {[
            {
              id: 'nutrient_reduction',
              title: 'Nutrient Feed Reduction',
              desc: 'Simulates fresh media glucose supply drop (75% feed concentration reduction).',
            },
            {
              id: 'cell_death_surge',
              title: 'Cell Mortality Surge',
              desc: 'Simulates acute cytotoxic stress resulting in elevated baseline cell mortality.',
            },
            {
              id: 'fouling_surge',
              title: 'Filter Fouling Surge',
              desc: 'Simulates rapid membrane bio-layer buildup and 3× fouling sensitivity multiplier.',
            },
            {
              id: 'perfusion_disruption',
              title: 'Perfusion Pump Disruption',
              desc: 'Simulates mechanical pump degradation or partial line blockage.',
            },
          ].map((f) => (
            <div
              key={f.id}
              onClick={() => setSelectedFault(f.id as any)}
              className={`p-3.5 rounded-xl border cursor-pointer transition ${
                selectedFault === f.id
                  ? 'bg-blue-50/70 border-blue-300 text-blue-900 shadow-xs font-semibold'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="text-xs font-bold text-slate-900 mb-0.5">{f.title}</div>
              <div className="text-[11px] text-slate-500 font-sans">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Fault Parameters Controls */}
        <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 flex justify-between mb-1">
                <span>Disturbance Severity</span>
                <span className="font-mono text-red-700 font-bold">{(severity * 100).toFixed(0)}%</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={severity}
                onChange={(e) => setSeverity(parseFloat(e.target.value))}
                className="w-full accent-blue-600 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 flex justify-between mb-1">
                <span>Start Time (Simulation Hours)</span>
                <span className="font-mono text-blue-700 font-bold">{startTime.toFixed(1)} h</span>
              </label>
              <input
                type="range"
                min="0"
                max="72"
                step="1"
                value={startTime}
                onChange={(e) => setStartTime(parseFloat(e.target.value))}
                className="w-full accent-blue-600 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 flex justify-between mb-1">
                <span>Disturbance Duration (Hours)</span>
                <span className="font-mono text-blue-700 font-bold">{duration.toFixed(1)} h</span>
              </label>
              <input
                type="range"
                min="6"
                max="72"
                step="6"
                value={duration}
                onChange={(e) => setDuration(parseFloat(e.target.value))}
                className="w-full accent-blue-600 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          <div>
            {message && (
              <div className="mb-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-mono text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <button
              onClick={handleInject}
              disabled={injecting}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-red-600 hover:bg-red-700 text-white transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Inject Fault Disturbance</span>
            </button>
          </div>
        </div>
      </div>

      {/* Causal Response Chain Section */}
      <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Predicted Process Response &amp; Digital Twin Recovery Flow
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {chain.map((c, i) => (
            <div key={i} className={`p-3 border rounded-lg space-y-1 ${c.color}`}>
              <div className="text-[10px] font-mono font-bold uppercase">{c.step}</div>
              <div className="text-xs font-sans font-medium">{c.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
