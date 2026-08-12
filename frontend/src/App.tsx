import { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Cpu, Database } from 'lucide-react';

export default function App() {
  const [health, setHealth] = useState<{ status: string; engine: string; target_cell_density_goal: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/health')
      .then((res) => res.json())
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Backend server not connected yet:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 p-6 flex flex-col font-sans">
      <header className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-950/60 border border-cyan-500/30 rounded-xl text-cyan-400">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              BB 04 — Digital Twin Bioreactor Platform
            </h1>
            <p className="text-xs text-slate-400">
              Mammalian Cell Perfusion &amp; Adaptive Filtration Control Platform
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            FOUNDATION READY
          </span>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto w-full">
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-sm font-semibold mb-2">
              <Cpu className="w-4 h-4" />
              <span>Simulation Target</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">
              &gt; 1.00 × 10⁸ <span className="text-sm font-normal text-slate-400">cells/mL</span>
            </h3>
            <p className="text-xs text-slate-400">High-density mammalian cell perfusion objective</p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500 flex justify-between">
            <span>Model Engine</span>
            <span className="text-slate-300 font-mono">Mechanistic RK4</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-sm font-semibold mb-2">
              <Database className="w-4 h-4" />
              <span>Backend Service</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">
              FastAPI Engine
            </h3>
            <p className="text-xs text-slate-400">
              {loading ? 'Connecting to backend...' : health ? `Status: ${health.status.toUpperCase()}` : 'Backend server offline (run backend/app/main.py)'}
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500 flex justify-between">
            <span>REST API</span>
            <span className="text-slate-300 font-mono">http://127.0.0.1:8000</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Security &amp; Scientific Integrity</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">
              Validated Bounds
            </h3>
            <p className="text-xs text-slate-400">
              Strict input sanitization, bounded numerical integration, and model assumption labeling.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500 flex justify-between">
            <span>Fouling Index</span>
            <span className="text-emerald-400 font-mono">0 – 100 Normalized</span>
          </div>
        </div>
      </main>
    </div>
  );
}
