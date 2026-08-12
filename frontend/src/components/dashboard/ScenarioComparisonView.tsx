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
        initial_nutrient: 2.0,
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

  const mergedHistory = data
    ? data.uncontrolled_scenario.history.map((h, i) => {
        const ctrl = data.controlled_scenario.history[i] || h;
        return {
          time: h.time,
          uncontrolledDensity: Number((h.viable_cell_density / 1e6).toFixed(1)),
          controlledDensity: Number((ctrl.viable_cell_density / 1e6).toFixed(1)),
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
      <div className="glass-panel p-6 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            Controlled vs Uncontrolled Scenario Comparison
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Comparative digital twin trajectory analysis: <strong>Scenario A (Uncontrolled Fixed Perfusion 0.8 VVD)</strong> vs <strong>Scenario B (Adaptive Perfusion Control)</strong>
          </p>
        </div>

        <button
          onClick={handleRunComparison}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm disabled:opacity-50"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{loading ? 'Executing Scenarios...' : 'Execute Comparison'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {data && (
        <>
          {/* Overall Outcome Banner */}
          <div className="glass-panel p-5 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Overall Controlled Strategy Evaluation
              </div>
              <p className="text-xs text-slate-700 font-medium">
                {data.outcome_summary}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border ${
                  data.overall_outcome === 'IMPROVED'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : data.overall_outcome === 'DEGRADED'
                    ? 'bg-red-50 text-red-800 border-red-300'
                    : 'bg-slate-100 text-slate-800 border-slate-300'
                }`}
              >
                {data.overall_outcome === 'IMPROVED'
                  ? '✓ Strategy Improved Outcome'
                  : data.overall_outcome === 'DEGRADED'
                  ? '⚠️ Strategy Degraded Outcome'
                  : '— No Significant Change'}
              </span>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="glass-panel p-6 rounded-xl border border-slate-200 bg-white space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Performance Metrics Analytical Trade-off Table
            </h3>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold">
                    <th className="py-2.5 px-3">Metric</th>
                    <th className="py-2.5 px-3 text-amber-700">Scenario A (Uncontrolled)</th>
                    <th className="py-2.5 px-3 text-blue-700">Scenario B (Controlled)</th>
                    <th className="py-2.5 px-3">Difference (Δ)</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {data.comparison_table.map((row, idx) => {
                    const isMediaMetric = row.metric_name === 'Total Media Consumed';
                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-3 font-sans font-semibold text-slate-800">{row.metric_name}</td>
                        <td className="py-3 px-3 text-slate-700">
                          {row.uncontrolled_val} {row.unit}
                        </td>
                        <td className="py-3 px-3 font-bold text-blue-700">
                          {row.controlled_val} {row.unit}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {row.difference > 0 ? `+${row.difference}` : row.difference} {row.unit}
                        </td>
                        <td className="py-3 px-3 font-sans">
                          {isMediaMetric ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              TRADE-OFF (+ Media)
                            </span>
                          ) : row.improved ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" /> IMPROVED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              NEUTRAL
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Side-by-Side Trajectory Graphs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cell Density Trajectory Comparison */}
            <div className="glass-panel p-5 rounded-xl border border-slate-200 bg-white space-y-3">
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                Viable Cell Density Trajectory (Uncontrolled vs Controlled)
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mergedHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="time" stroke="#94A3B8" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#94A3B8" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', borderRadius: '8px', fontSize: '11px' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="uncontrolledDensity" name="Uncontrolled Density (M/mL)" stroke="#D97706" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="controlledDensity" name="Controlled Density (M/mL)" stroke="#2563EB" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Fouling Risk Trajectory Comparison */}
            <div className="glass-panel p-5 rounded-xl border border-slate-200 bg-white space-y-3">
              <h3 className="text-xs font-bold text-red-700 uppercase tracking-wider">
                Filter Fouling Risk Trajectory (Uncontrolled vs Controlled)
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mergedHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="time" stroke="#94A3B8" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#94A3B8" tick={{ fontSize: 10 }} domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', borderRadius: '8px', fontSize: '11px' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="uncontrolledFouling" name="Uncontrolled Fouling Risk" stroke="#DC2626" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="controlledFouling" name="Controlled Fouling Risk" stroke="#059669" strokeWidth={2.5} dot={false} />
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
