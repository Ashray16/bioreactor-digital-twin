import { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Cpu, Database, CheckCircle2, AlertCircle } from 'lucide-react';

interface SystemHealth {
  status: string;
  engine: string;
  target_cell_density_goal: string;
  models?: Record<string, string>;
}

export default function App() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    const startTime = performance.now();
    try {
      const res = await fetch('http://127.0.0.1:8000/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const endTime = performance.now();
      setLatencyMs(Math.round(endTime - startTime));
      setHealth(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
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
          {health ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              API CONNECTED ({latencyMs}ms)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-950/60 border border-amber-500/30 text-amber-400">
              <AlertCircle className="w-3.5 h-3.5" />
              BACKEND DISCONNECTED
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 space-y-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-cyan-400 text-sm font-semibold mb-2">
                <Cpu className="w-4 h-4" />
                <span>Simulation Target Goal</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">
                &gt; 1.00 × 10⁸ <span className="text-sm font-normal text-slate-400">cells/mL</span>
              </h3>
              <p className="text-xs text-slate-400">High-density mammalian cell perfusion objective</p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500 flex justify-between">
              <span>Model Engine</span>
              <span className="text-slate-300 font-mono">Monod / Contois ODE</span>
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
                {loading
                  ? 'Connecting to http://127.0.0.1:8000...'
                  : health
                  ? `Status: ${health.status.toUpperCase()} (${health.engine})`
                  : `Offline (${error || 'Run backend API server'})`}
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500 flex justify-between">
              <span>REST API Route</span>
              <span className="text-slate-300 font-mono">/api/v1/health</span>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Security &amp; Integrity</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">
                Validated Architecture
              </h3>
              <p className="text-xs text-slate-400">
                Strict Pydantic model validation, bounded ODE integrations, and zero dynamic string execution.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500 flex justify-between">
              <span>Fouling Index</span>
              <span className="text-emerald-400 font-mono">0 – 100 Normalized</span>
            </div>
          </div>
        </div>

        {health?.models && (
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
              Registered Digital Twin Simulation Models
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(health.models).map(([key, value]) => (
                <div key={key} className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                  <div className="text-xs font-mono text-cyan-400 uppercase mb-1">
                    {key.replace('_', ' ')}
                  </div>
                  <div className="text-xs text-slate-300">
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
