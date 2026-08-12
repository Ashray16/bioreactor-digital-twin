import { useState, useEffect } from 'react';
import { Layers, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ScenarioComparisonResponse } from '../../types/simulation';
import { runScenarioComparison } from '../../services/api';

export default function ScenarioComparisonView() {
  const [data, setData] = useState<ScenarioComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunComparison = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runScenarioComparison({
        simulation_duration: 120.0,
        timestep: 0.5,
        initial_nutrient: 2.0, // Low initial nutrient to demonstrate controller power
      });
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to execute scenario comparison');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRunComparison();
  }, []);

  // Merge history for Recharts side-by-side comparison
  const mergedHistory = data
    ? data.uncontrolled_scenario.history.map((h, i) => {
        const ctrl = data.controlled_scenario.history[i] || h;
        return {
          time: h.time,
          uncontrolledDensity: Number((h.viable_cell_density / 1e8).toFixed(3)),
          controlledDensity: Number((ctrl.viable_cell_density / 1e8).toFixed(3)),
          uncontrolledGlucose: h.nutrient_concentration,
          controlledGlucose: ctrl.nutrient_concentration,
          uncontrolledLactate: h.metabolite_concentration,
          controlledLactate: ctrl.metabolite_concentration,
          uncontrolledFouling: h.fouling_index,
          controlledFouling: ctrl.fouling_index,
        };
      })
    : [];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            Controlled vs Uncontrolled Bioprocess Scenario Comparison
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Evaluate twin trajectories: <strong>Scenario A (Uncontrolled Fixed Perfusion)</strong> vs <strong>Scenario B (Adaptive Perfusion Control)</strong>
          </p>
        </div>

        <button
          onClick={handleRunComparison}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black transition shadow-lg shadow-cyan-500/20 disabled:opacity-50"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{loading ? 'RUNNING SCENARIOS...' : 'EXECUTE COMPARISON'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {data && (
        <>
          {/* Overall Outcome Banner */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Overall Controlled Strategy Evaluation
              </div>
              <p className="text-xs text-slate-300 font-medium">
                {data.outcome_summary}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border ${
                  data.overall_outcome === 'IMPROVED'
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                    : data.overall_outcome === 'DEGRADED'
                    ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {data.overall_outcome === 'IMPROVED'
                  ? '✓ STRATEGY IMPROVED OUTCOME'
                  : data.overall_outcome === 'DEGRADED'
                  ? '⚠️ STRATEGY DEGRADED OUTCOME'
                  : '— NO SIGNIFICANT CHANGE'}
              </span>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4">
              Performance Metrics Comparison Summary
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                    <th className="py-2.5 px-3">Metric</th>
                    <th className="py-2.5 px-3 text-amber-400">Scenario A (Uncontrolled)</th>
                    <th className="py-2.5 px-3 text-cyan-400">Scenario B (Controlled)</th>
                    <th className="py-2.5 px-3">Difference</th>
                    <th className="py-2.5 px-3">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.comparison_table.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition">
                      <td className="py-3 px-3 font-semibold text-slate-200">{row.metric_name}</td>
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {row.uncontrolled_val} {row.unit}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-cyan-300">
                        {row.controlled_val} {row.unit}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {row.difference > 0 ? `+${row.difference}` : row.difference} {row.unit}
                      </td>
                      <td className="py-3 px-3">
                        {row.improved ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> IMPROVED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                            NEUTRAL
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Side-by-Side Trajectory Graphs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cell Density Trajectory Comparison */}
            <div className="glass-panel p-5 rounded-2xl">
              <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">
                Viable Cell Density Trajectory (Uncontrolled vs Controlled)
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mergedHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="time" stroke="#64748B" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748B" tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="uncontrolledDensity" name="Uncontrolled Density" stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="controlledDensity" name="Controlled Density" stroke="#00F0FF" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Fouling Risk Trajectory Comparison */}
            <div className="glass-panel p-5 rounded-2xl">
              <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-3">
                Filter Fouling Risk Trajectory (Uncontrolled vs Controlled)
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mergedHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="time" stroke="#64748B" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748B" tick={{ fontSize: 10 }} domain={[0, 100]} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="uncontrolledFouling" name="Uncontrolled Fouling" stroke="#EF4444" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="controlledFouling" name="Controlled Fouling" stroke="#10B981" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
