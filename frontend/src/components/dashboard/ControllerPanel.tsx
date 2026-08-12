import { useState } from 'react';
import { BioreactorState } from '../../types/simulation';
import { Sliders, ShieldCheck, ArrowRight, HelpCircle, CheckCircle2, History } from 'lucide-react';
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

  // Mock historical log for industrial audit table
  const auditLogs = [
    { time: '118.7 h', variable: 'Glucose', trigger: 'Substrate Depletion (S < 1.5g/L)', action: 'Increase Perfusion', detail: '1.20 → 1.80 VVD', result: 'Glucose Restored' },
    { time: '105.2 h', variable: 'Fouling Risk', trigger: 'Membrane Load Warning (F ≥ 70)', action: 'Adjust Operating Strategy', detail: '1.80 → 1.50 VVD', result: 'Risk Stabilized' },
    { time: '92.4 h', variable: 'Lactate', trigger: 'Metabolite Elevation (P > 3.5g/L)', action: 'Increase Perfusion', detail: '1.00 → 1.40 VVD', result: 'Lactate Cleared' },
  ];

  return (
    <div className="glass-panel p-6 rounded-xl border border-slate-200 space-y-6 bg-white">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-700">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Automated Process Control &amp; Decision Engine
            </h2>
            <p className="text-xs text-slate-500">
              Adaptive feedback controller for substrate replenishment and membrane fouling mitigation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleController}
            disabled={updating}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition border ${
              enabled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-600 border-slate-300 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Status: {enabled ? 'Active (Feedback Loop)' : 'Inactive (Manual Baseline)'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Operating Strategy Card */}
        <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Control Strategy
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-2">
              Adaptive Rule-Based Perfusion Engine
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Continuously balances substrate limitation (Glucose &lt; 1.5 g/L), metabolite toxicity (Lactate &gt; 3.5 g/L), and filter fouling risk (F &ge; 70).
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 space-y-1.5 text-[11px] text-slate-600">
            <div className="flex justify-between">
              <span>Operating Limits:</span>
              <span className="font-mono text-blue-700 font-bold">{minVvd.toFixed(1)} – {maxVvd.toFixed(1)} VVD</span>
            </div>
            <div className="flex justify-between">
              <span>Hysteresis Buffer:</span>
              <span className="font-mono text-slate-700">1.0 Hour Deadband</span>
            </div>
          </div>
        </div>

        {/* Explainable Controller Action Card */}
        <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between md:col-span-2">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                Current Controller Action &amp; Explainable Rationale
              </span>
              {action ? (
                <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-bold">
                  Intervention at t = {action.timestamp.toFixed(1)} h
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 font-mono">No active intervention</span>
              )}
            </div>

            {action ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white border border-slate-200 rounded-lg shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {action.action_type}
                    </span>
                    <span className="text-xs text-slate-800 font-medium">{action.reason}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-700 bg-slate-50 px-3 py-1 rounded border border-slate-200">
                    <span>{action.previous_perfusion.toFixed(2)} VVD</span>
                    <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-blue-700 font-bold">{action.current_perfusion.toFixed(2)} VVD</span>
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-1">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Expected Process Response:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono pt-1">
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 font-semibold">
                      1. Substrate Replenishment ↑
                    </div>
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded text-blue-800 font-semibold">
                      2. Lactate Clearance ↑
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 font-semibold">
                      3. Biomass Growth Stabilized
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 text-center space-y-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto" />
                <p className="font-bold text-slate-900">Process Operating Within Standard Parameters</p>
                <p className="text-[11px] text-slate-500">Glucose &ge; 1.5 g/L, Lactate &le; 3.5 g/L, and Fouling Index &lt; 70.</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <span>Rate-of-Change Constraint:</span>
            <span className="font-mono text-slate-700 font-bold">&le; 0.5 VVD per Step</span>
          </div>
        </div>
      </div>

      {/* Controller Intervention History Table */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-4 h-4 text-slate-500" />
            Controller Intervention History &amp; Audit Trail
          </h3>
          <span className="text-[11px] font-mono text-slate-500">Last 3 Events</span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold">
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Variable</th>
                <th className="py-2.5 px-3">Trigger Condition</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Adjustment</th>
                <th className="py-2.5 px-3">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {auditLogs.map((log, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition">
                  <td className="py-2.5 px-3 font-semibold text-slate-800">{log.time}</td>
                  <td className="py-2.5 px-3 text-blue-700 font-bold">{log.variable}</td>
                  <td className="py-2.5 px-3 font-sans text-slate-600">{log.trigger}</td>
                  <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">{log.action}</td>
                  <td className="py-2.5 px-3 text-slate-700">{log.detail}</td>
                  <td className="py-2.5 px-3 font-sans text-emerald-700 font-bold">{log.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
