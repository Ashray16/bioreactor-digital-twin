import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { SimulationHistoryItem } from '../../types/simulation';

interface ProcessChartsProps {
  history: SimulationHistoryItem[];
  targetCellDensity: number;
}

const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0B0F17]/95 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs font-sans">
        <div className="font-mono text-cyan-400 font-bold mb-1">Time: {label} h</div>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center gap-2 text-slate-200">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
            <span className="text-slate-400">{entry.name}:</span>
            <span className="font-mono font-semibold">{entry.value} {unit}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function ProcessCharts({ history, targetCellDensity }: ProcessChartsProps) {
  const chartData = history.map((h) => ({
    time: h.time,
    viableDensity: Number((h.viable_cell_density / 1e8).toFixed(3)),
    nonviableDensity: Number((h.nonviable_cell_density / 1e8).toFixed(3)),
    viability: h.cell_viability,
    nutrient: h.nutrient_concentration,
    metabolite: h.metabolite_concentration,
    perfusion: h.perfusion_rate,
    fouling: h.fouling_index,
  }));

  const targetScaled = Number((targetCellDensity / 1e8).toFixed(2));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* 1. Cell Density vs Time */}
      <div className="glass-panel p-4 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
            Viable Cell Density vs Time
          </h3>
          <span className="text-[11px] font-mono text-slate-400">×10⁸ cells/mL</span>
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="time" stroke="#64748B" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748B" tick={{ fontSize: 10 }} domain={[0, 'auto']} />
              <Tooltip content={<CustomTooltip unit="×10⁸ cells/mL" />} />
              <ReferenceLine y={targetScaled} stroke="#00F0FF" strokeDasharray="5 5" label={{ value: 'Target Goal', fill: '#00F0FF', fontSize: 10 }} />
              <Line type="monotone" dataKey="viableDensity" name="Viable Density" stroke="#00F0FF" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="nonviableDensity" name="Dead Density" stroke="#EF4444" strokeWidth={1.5} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Viability vs Time */}
      <div className="glass-panel p-4 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
            Cell Viability vs Time
          </h3>
          <span className="text-[11px] font-mono text-slate-400">% Viable</span>
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="time" stroke="#64748B" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748B" tick={{ fontSize: 10 }} domain={[60, 100]} />
              <Tooltip content={<CustomTooltip unit="%" />} />
              <ReferenceLine y={90} stroke="#10B981" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="viability" name="Viability" stroke="#6366F1" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Glucose vs Time */}
      <div className="glass-panel p-4 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
            Nutrient (Glucose) vs Time
          </h3>
          <span className="text-[11px] font-mono text-slate-400">g/L</span>
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="time" stroke="#64748B" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748B" tick={{ fontSize: 10 }} domain={[0, 'auto']} />
              <Tooltip content={<CustomTooltip unit="g/L" />} />
              <ReferenceLine y={1.5} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: 'Min Limit', fill: '#F59E0B', fontSize: 10 }} />
              <Line type="monotone" dataKey="nutrient" name="Glucose" stroke="#10B981" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Lactate vs Time */}
      <div className="glass-panel p-4 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
            Metabolite (Lactate) vs Time
          </h3>
          <span className="text-[11px] font-mono text-slate-400">g/L</span>
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="time" stroke="#64748B" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748B" tick={{ fontSize: 10 }} domain={[0, 'auto']} />
              <Tooltip content={<CustomTooltip unit="g/L" />} />
              <ReferenceLine y={3.5} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'Toxicity', fill: '#EF4444', fontSize: 10 }} />
              <Line type="monotone" dataKey="metabolite" name="Lactate" stroke="#F59E0B" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. Perfusion Rate vs Time */}
      <div className="glass-panel p-4 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
            Perfusion Rate vs Time
          </h3>
          <span className="text-[11px] font-mono text-slate-400">VVD</span>
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="time" stroke="#64748B" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748B" tick={{ fontSize: 10 }} domain={[0, 4.5]} />
              <Tooltip content={<CustomTooltip unit="VVD" />} />
              <Line type="stepAfter" dataKey="perfusion" name="Perfusion Rate" stroke="#3B82F6" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 6. Fouling Risk Index vs Time */}
      <div className="glass-panel p-4 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider">
            Fouling Risk Index vs Time
          </h3>
          <span className="text-[11px] font-mono text-slate-400">0–100 Index</span>
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="time" stroke="#64748B" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748B" tick={{ fontSize: 10 }} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip unit="/ 100" />} />
              <ReferenceLine y={70} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'Warning (70)', fill: '#EF4444', fontSize: 10 }} />
              <Line type="monotone" dataKey="fouling" name="Fouling Risk" stroke="#F43F5E" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
