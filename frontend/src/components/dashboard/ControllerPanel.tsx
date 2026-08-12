import { useState } from 'react';
import { BioreactorState } from '../../types/simulation';
import { Sliders, ShieldCheck, ArrowRight } from 'lucide-react';
import { updateControlSettings } from '../../services/api';

interface ControllerPanelProps {
  state: BioreactorState;
  onRefreshState: () => void;
}

export default function ControllerPanel({ state, onRefreshState }: ControllerPanelProps) {
  const [enabled, setEnabled] = useState(state.controller_enabled);
  const [minVvd] = useState(0.5);
  const [maxVvd] = useState(3.5);
  const [updating, setUpdating] = useState(false);

  const handleToggleController = async () => {
    setUpdating(true);
    try {
      await updateControlSettings({
        enabled: !enabled,
        min_perfusion_rate: minVvd,
        max_perfusion_rate: maxVvd,
      });
      setEnabled(!enabled);
      onRefreshState();
    } catch (err) {
      console.error('Failed to toggle control:', err);
    } finally {
      setUpdating(false);
    }
  };

  const action = state.latest_controller_action;

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-950/60 border border-indigo-500/30 rounded-xl text-indigo-400">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Automated Process Controller &amp; Decision Audit Log
            </h2>
            <p className="text-xs text-slate-400">
              Rule-based adaptive feedback controller for substrate replenishment and membrane fouling mitigation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleController}
            disabled={updating}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition border ${
              enabled
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/80'
                : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>CONTROLLER {enabled ? 'ACTIVE (ENABLED)' : 'INACTIVE (DISABLED)'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Strategy Card */}
        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
              Current Strategy
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              Rule-Based Adaptive Perfusion
            </h3>
            <p className="text-xs text-slate-400">
              Continuously balances cell density growth against substrate starvation (Glucose &lt; 1.5 g/L), lactate accumulation (Lactate &gt; 3.5 g/L), and filter clogging (Fouling Risk &ge; 70).
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex justify-between">
            <span>Operating Limits:</span>
            <span className="font-mono text-cyan-400">{minVvd.toFixed(1)} – {maxVvd.toFixed(1)} VVD</span>
          </div>
        </div>

        {/* Latest Action Card */}
        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl flex flex-col justify-between md:col-span-2">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                Latest Controller Decision
              </span>
              {action ? (
                <span className="text-[10px] font-mono text-slate-400">t = {action.timestamp.toFixed(1)} h</span>
              ) : (
                <span className="text-[10px] text-slate-500 font-mono">No intervention yet</span>
              )}
            </div>

            {action ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded text-xs font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                    {action.action_type}
                  </span>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                    <span>Previous: {action.previous_perfusion.toFixed(2)} VVD</span>
                    <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-cyan-400 font-bold">New: {action.current_perfusion.toFixed(2)} VVD</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-300 font-mono">
                  <span className="text-slate-500 font-sans font-bold mr-2">Rationale:</span>
                  {action.reason}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-950/50 border border-slate-800/80 rounded-lg text-xs text-slate-400 text-center">
                System is operating within normal parameters or controller is awaiting next deadband step.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Deadband Buffer:</span>
            <span className="font-mono text-slate-300">1.0 Hour (Prevents Oscillation Jitter)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
