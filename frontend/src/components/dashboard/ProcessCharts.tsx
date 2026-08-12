import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';
import { SimulationHistoryItem } from '../../types/simulation';

interface ProcessChartsProps {
  history: SimulationHistoryItem[];
  targetCellDensity: number;
}

export default function ProcessCharts({ history, targetCellDensity }: ProcessChartsProps) {
  // Format history data for clean chart visualization
  const formattedData = history.map((item) => ({
    time: item.time,
    viableDensity: Number((item.viable_cell_density / 1e6).toFixed(1)), // In Millions cells/mL
    cellViability: item.cell_viability,
    glucose: item.nutrient_concentration,
    lactate: item.metabolite_concentration,
    perfusionRate: item.perfusion_rate,
    foulingIndex: item.fouling_index,
  }));

  const targetM = targetCellDensity / 1e6; // 100M cells/mL target

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* 1. Viable Cell Density Trajectory Chart */}
      <div className="glass-panel p-5 rounded-xl border border-slate-200 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Viable Cell Density Trajectory
            </h3>
            <p className="text-[11px] text-slate-500">Biomass growth vs target threshold</p>
          </div>
          <span className="text-[10px] font-mono text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-bold">
            ×10⁶ cells/mL
          </span>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="time" stroke="#94A3B8" tick={{ fontSize: 10 }} />
              <YAxis stroke="#94A3B8" tick={{ fontSize: 10 }} domain={[0, 'dataMax + 20']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', borderRadius: '8px', fontSize: '11px' }}
              />
              <ReferenceLine y={targetM} stroke="#059669" strokeDasharray="4 4" label={{ value: `Target: ${targetM}M`, fill: '#059669', fontSize: 10, position: 'insideTopRight' }} />
              <Line type="monotone" dataKey="viableDensity" name="Viable Density (M/mL)" stroke="#2563EB" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Substrate & Metabolite Mass Balance Chart */}
      <div className="glass-panel p-5 rounded-xl border border-slate-200 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Substrate &amp; Metabolite Kinetics
            </h3>
            <p className="text-[11px] text-slate-500">Glucose (Nutrient) vs Lactate (Byproduct)</p>
          </div>
          <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-bold">
            g/L
          </span>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="time" stroke="#94A3B8" tick={{ fontSize: 10 }} />
              <YAxis stroke="#94A3B8" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', borderRadius: '8px', fontSize: '11px' }}
              />
              <ReferenceLine y={1.5} stroke="#DC2626" strokeDasharray="3 3" label={{ value: 'Min Glucose (1.5g/L)', fill: '#DC2626', fontSize: 9 }} />
              <ReferenceLine y={3.5} stroke="#D97706" strokeDasharray="3 3" label={{ value: 'Max Lactate (3.5g/L)', fill: '#D97706', fontSize: 9 }} />
              <Line type="monotone" dataKey="glucose" name="Glucose (g/L)" stroke="#059669" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="lactate" name="Lactate (g/L)" stroke="#D97706" strokeWidth={2} dot={false} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Cell Viability % Chart */}
      <div className="glass-panel p-5 rounded-xl border border-slate-200 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Cell Culture Viability
            </h3>
            <p className="text-[11px] text-slate-500">Percentage of living cell population</p>
          </div>
          <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
            %
          </span>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="time" stroke="#94A3B8" tick={{ fontSize: 10 }} />
              <YAxis stroke="#94A3B8" tick={{ fontSize: 10 }} domain={[50, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', borderRadius: '8px', fontSize: '11px' }}
              />
              <ReferenceLine y={90} stroke="#D97706" strokeDasharray="3 3" label={{ value: 'Viability Threshold (90%)', fill: '#D97706', fontSize: 9 }} />
              <Line type="monotone" dataKey="cellViability" name="Viability %" stroke="#16A34A" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Adaptive Perfusion Rate Chart */}
      <div className="glass-panel p-5 rounded-xl border border-slate-200 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Adaptive Perfusion Rate
            </h3>
            <p className="text-[11px] text-slate-500">Feedback controller exchange action</p>
          </div>
          <span className="text-[10px] font-mono text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-bold">
            VVD
          </span>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="time" stroke="#94A3B8" tick={{ fontSize: 10 }} />
              <YAxis stroke="#94A3B8" tick={{ fontSize: 10 }} domain={[0, 4]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', borderRadius: '8px', fontSize: '11px' }}
              />
              <Line type="stepAfter" dataKey="perfusionRate" name="Perfusion Rate (VVD)" stroke="#2563EB" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. Membrane Fouling Load Index Chart */}
      <div className="glass-panel p-5 rounded-xl border border-slate-200 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Filter Fouling Risk Trajectory
            </h3>
            <p className="text-[11px] text-slate-500">Normalized 0–100 membrane load proxy</p>
          </div>
          <span className="text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-bold">
            0–100
          </span>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="time" stroke="#94A3B8" tick={{ fontSize: 10 }} />
              <YAxis stroke="#94A3B8" tick={{ fontSize: 10 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', borderRadius: '8px', fontSize: '11px' }}
              />
              <ReferenceLine y={70} stroke="#DC2626" strokeDasharray="3 3" label={{ value: 'Fouling Alert (70)', fill: '#DC2626', fontSize: 9 }} />
              <Line type="monotone" dataKey="foulingIndex" name="Fouling Risk Index" stroke="#D97706" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
