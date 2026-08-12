import { Play, Pause, RotateCcw, FastForward, Sliders, Layers, Cpu, Zap, Activity } from 'lucide-react';

interface HeaderProps {
  activeTab: 'dashboard' | 'diagram' | 'scenarios' | 'controller' | 'faults';
  setActiveTab: (tab: 'dashboard' | 'diagram' | 'scenarios' | 'controller' | 'faults') => void;
  isRunning: boolean;
  onTogglePlay: () => void;
  onStep: () => void;
  onReset: () => void;
  onRunFull: () => void;
  onOpenConfig: () => void;
  simulationSpeed: number;
  setSimulationSpeed: (speed: number) => void;
  simulationTime: number;
}

export default function Header({
  activeTab,
  setActiveTab,
  isRunning,
  onTogglePlay,
  onStep,
  onReset,
  onRunFull,
  onOpenConfig,
  simulationSpeed,
  setSimulationSpeed,
  simulationTime,
}: HeaderProps) {
  return (
    <header className="border-b border-slate-800 bg-[#0B0F17]/90 backdrop-blur-md sticky top-0 z-30 pb-4 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-950/60 border border-cyan-500/30 rounded-xl text-cyan-400">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">
                BB 04 — Digital Twin Bioreactor
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-cyan-950 border border-cyan-500/30 text-cyan-400">
                Perfusion Platform
              </span>
            </div>
            <p className="text-xs text-slate-400">
              High-Density Mammalian Cell Perfusion &amp; Adaptive Filtration Control
            </p>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
            <button
              onClick={onTogglePlay}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                isRunning
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
              }`}
            >
              {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isRunning ? 'PAUSE' : 'START'}</span>
            </button>

            <button
              onClick={onStep}
              disabled={isRunning}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition"
              title="Advance Single Timestep (+0.5h)"
            >
              <FastForward className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onReset}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title="Reset Simulation Engine"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onRunFull}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/80 transition"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>RUN TRAJECTORY</span>
          </button>

          {/* Speed Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-2 py-1 gap-1 text-xs">
            <span className="text-slate-400 font-mono text-[11px]">Speed:</span>
            {[0.5, 1, 2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => setSimulationSpeed(s)}
                className={`px-1.5 py-0.5 rounded font-mono text-[11px] transition ${
                  simulationSpeed === s ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>

          <button
            onClick={onOpenConfig}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Configure Parameters"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Navigation & Time Badge */}
      <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 mt-3">
        <nav className="flex items-center gap-1">
          {[
            { id: 'dashboard', label: 'Overview Dashboard', icon: Cpu },
            { id: 'diagram', label: 'Bioreactor Diagram', icon: Activity },
            { id: 'scenarios', label: 'Scenario Comparison', icon: Layers },
            { id: 'controller', label: 'Automated Controller', icon: Sliders },
            { id: 'faults', label: 'Fault Injection', icon: Zap },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  active
                    ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 shadow-sm shadow-cyan-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">Simulation Time:</span>
          <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-cyan-400 font-mono font-bold text-sm">
            {simulationTime.toFixed(1)} h
          </span>
        </div>
      </div>
    </header>
  );
}
