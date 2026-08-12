import { useState } from 'react';
import { BioreactorState } from '../../types/simulation';
import { Sliders, ShieldCheck, ArrowRight, HelpCircle, CheckCircle2 } from 'lucide-react';
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
              Automated Process Controller &amp; Explainable Decision Engine
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
        <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
              Operating Strategy
            </div>
            <h3 className="text-base font-bold text-white mb-2">
              Adaptive Perfusion Rule Engine
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Continuously balances cell growth kinetics against substrate starvation (Glucose &lt; 1.5 g/L), lactate accumulation (Lactate &gt; 3.5 g/L), and filter clogging (Fouling Risk &ge; 70).
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-[11px] text-slate-400">
            <div className="flex justify-between">
              <span>Perfusion Rate Limits:</span>
              <span className="font-mono text-cyan-400 font-bold">{minVvd.toFixed(1)} – {maxVvd.toFixed(1)} VVD</span>
            </div>
            <div className="flex justify-between">
              <span>Hysteresis Deadband:</span>
              <span className="font-mono text-slate-300">1.0 Hour Buffer</span>
            </div>
          </div>
        </div>

        {/* Explainable Decision Audit Card */}
        <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col justify-between md:col-span-2">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4" />
                Why Did The Controller Act? (Explainable Decision Audit)
              </span>
              {action ? (
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                  Intervention at t = {action.timestamp.toFixed(1)} h
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 font-mono">No intervention active</span>
              )}
            </div>

            {action ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-950/90 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded text-xs font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                      {action.action_type}
                    </span>
                    <span className="text-xs text-slate-300 font-medium">{action.reason}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                    <span>{action.previous_perfusion.toFixed(2)} VVD</span>
                    <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-cyan-400 font-bold">{action.current_perfusion.toFixed(2)} VVD</span>
                  </div>
                </div>

                {/* Causal Chain Visualization */}
                <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs space-y-2">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Causal Response Chain:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                    <div className="p-2 bg-slate-900 rounded border border-slate-800 text-amber-300">
                      1. Trigger: Threshold Crossed
                    </div>
                    <div className="p-2 bg-slate-900 rounded border border-slate-800 text-cyan-300">
                      2. Action: Perfusion Step-Up
                    </div>
                    <div className="p-2 bg-slate-900 rounded border border-slate-800 text-emerald-300">
                      3. Effect: Metabolite Washout
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-slate-950/50 border border-slate-800/80 rounded-xl text-xs text-slate-400 text-center space-y-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                <p className="font-semibold text-slate-300">System Operating Within Safe Parameters</p>
                <p className="text-[11px]">Substrate concentration &ge; 1.5 g/L, lactate &le; 3.5 g/L, and fouling risk &lt; 70.</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Rate-of-Change Limit:</span>
            <span className="font-mono text-slate-300">&le; 0.5 VVD per Step</span>
          </div>
        </div>
      </div>
    </div>
  );
}
