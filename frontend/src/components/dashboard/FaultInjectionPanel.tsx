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
          { step: '1. Fault Injected', text: 'Nutrient feed reduced by 75%', color: 'text-rose-400 border-rose-500/30' },
          { step: '2. Primary Impact', text: 'Substrate S drops below 1.5 g/L', color: 'text-amber-400 border-amber-500/30' },
          { step: '3. Digital Twin Prediction', text: 'Cell growth rate halts (μ → 0)', color: 'text-cyan-400 border-cyan-500/30' },
          { step: '4. Controller Action', text: 'Perfusion rate D adaptively boosted', color: 'text-indigo-400 border-indigo-500/30' },
          { step: '5. Process Recovery', text: 'Substrate & cell density stabilized', color: 'text-emerald-400 border-emerald-500/30' },
        ];
      case 'cell_death_surge':
        return [
          { step: '1. Fault Injected', text: 'Elevated mortality rate (+0.03 h⁻¹)', color: 'text-rose-400 border-rose-500/30' },
          { step: '2. Primary Impact', text: 'Cell viability drops below 85%', color: 'text-amber-400 border-amber-500/30' },
          { step: '3. Digital Twin Prediction', text: 'Elevated debris accelerates filter loading', color: 'text-cyan-400 border-cyan-500/30' },
          { step: '4. Controller Action', text: 'Perfusion adjusted for debris clearance', color: 'text-indigo-400 border-indigo-500/30' },
          { step: '5. Process Recovery', text: 'Viability trend stabilizes', color: 'text-emerald-400 border-emerald-500/30' },
        ];
      case 'fouling_surge':
        return [
          { step: '1. Fault Injected', text: '3× Membrane Fouling Multiplier', color: 'text-rose-400 border-rose-500/30' },
          { step: '2. Primary Impact', text: 'Fouling index F crosses 70 threshold', color: 'text-amber-400 border-amber-500/30' },
          { step: '3. Digital Twin Prediction', text: 'Imminent filter occlusion warning', color: 'text-cyan-400 border-cyan-500/30' },
          { step: '4. Controller Action', text: 'Perfusion rate throttled to safe flux', color: 'text-indigo-400 border-indigo-500/30' },
          { step: '5. Process Recovery', text: 'Membrane risk contained in Moderate zone', color: 'text-emerald-400 border-emerald-500/30' },
        ];
      default:
        return [
          { step: '1. Fault Injected', text: 'Perfusion pump line disruption', color: 'text-rose-400 border-rose-500/30' },
          { step: '2. Primary Impact', text: 'Perfusion flow drops by severity %', color: 'text-amber-400 border-amber-500/30' },
          { step: '3. Digital Twin Prediction', text: 'Lactate accumulation hazard', color: 'text-cyan-400 border-cyan-500/30' },
          { step: '4. Controller Action', text: 'Feedback controller signals pump alarm', color: 'text-indigo-400 border-indigo-500/30' },
          { step: '5. Process Recovery', text: 'Emergency flow compensation', color: 'text-emerald-400 border-emerald-500/30' },
        ];
    }
  };

  const chain = getFaultCausalChain(selectedFault);

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-950/60 border border-rose-500/30 rounded-xl text-rose-400">
            <Zap className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Simulated Process Disturbance &amp; Fault Injection Panel
            </h2>
            <p className="text-xs text-slate-400">
              Inject operational faults into the digital twin to observe adaptive controller detection and recovery
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Fault Selector Buttons */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
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
                  ? 'bg-rose-950/50 border-rose-500/50 text-rose-200 shadow-md shadow-rose-950/50'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="text-xs font-bold text-white mb-0.5">{f.title}</div>
              <div className="text-[11px] text-slate-400 font-sans">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Fault Parameters Controls */}
        <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 flex justify-between mb-1">
                <span>Disturbance Severity</span>
                <span className="font-mono text-rose-400">{(severity * 100).toFixed(0)}%</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={severity}
                onChange={(e) => setSeverity(parseFloat(e.target.value))}
                className="w-full accent-rose-500 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 flex justify-between mb-1">
                <span>Start Time (Simulation Hours)</span>
                <span className="font-mono text-cyan-400">{startTime.toFixed(1)} h</span>
              </label>
              <input
                type="range"
                min="0"
                max="72"
                step="1"
                value={startTime}
                onChange={(e) => setStartTime(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 flex justify-between mb-1">
                <span>Disturbance Duration (Hours)</span>
                <span className="font-mono text-cyan-400">{duration.toFixed(1)} h</span>
              </label>
              <input
                type="range"
                min="6"
                max="72"
                step="6"
                value={duration}
                onChange={(e) => setDuration(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          <div>
            {message && (
              <div className="mb-3 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <button
              onClick={handleInject}
              disabled={injecting}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white transition flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30 disabled:opacity-50"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>INJECT FAULT DISTURBANCE</span>
            </button>
          </div>
        </div>
      </div>

      {/* Causal Response Chain Section */}
      <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Expected Digital Twin &amp; Controller Causal Response Chain
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {chain.map((c, i) => (
            <div key={i} className={`p-3 bg-slate-950/80 border rounded-xl space-y-1 ${c.color}`}>
              <div className="text-[10px] font-mono font-bold uppercase">{c.step}</div>
              <div className="text-xs font-sans text-slate-200">{c.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
