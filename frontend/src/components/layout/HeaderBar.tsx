import { Play, Pause, RotateCcw, FastForward, Sliders, Layers, Zap } from 'lucide-react';

interface HeaderBarProps {
  isRunning: boolean;
  onTogglePlay: () => void;
  onStep: () => void;
  onReset: () => void;
  onRunFull: () => void;
  onRunDemo: () => void;
  onOpenConfig: () => void;
  simulationSpeed: number;
  setSimulationSpeed: (speed: number) => void;
  simulationTime: number;
}

export default function HeaderBar({
  isRunning,
  onTogglePlay,
  onStep,
  onReset,
  onRunFull,
  onRunDemo,
  onOpenConfig,
  simulationSpeed,
  setSimulationSpeed,
  simulationTime,
}: HeaderBarProps) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-3 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Title & Status */}
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                Digital Twin Bioreactor
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 text-slate-600">
                BB 04
              </span>
            </div>
            <p className="text-xs text-slate-500">
              High-Density Mammalian Perfusion &amp; Adaptive Process Control
            </p>
          </div>

          <div className="hidden lg:flex items-center gap-3 pl-4 border-l border-slate-200 text-xs font-mono">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200">
              <span className="text-slate-500">Status:</span>
              <span className={`font-bold flex items-center gap-1 ${isRunning ? 'text-emerald-600' : 'text-amber-600'}`}>
                <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`}></span>
                {isRunning ? 'Running' : 'Paused'}
              </span>
            </div>

            <div className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200">
              <span className="text-slate-500">Model: </span>
              <span className="font-bold text-slate-700">Perfusion v1.0</span>
            </div>

            <div className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200">
              <span className="text-slate-500">Time: </span>
              <span className="font-bold text-blue-600">{simulationTime.toFixed(1)} h</span>
            </div>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={onTogglePlay}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                isRunning
                  ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
              }`}
            >
              {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isRunning ? 'Pause' : 'Start Simulation'}</span>
            </button>

            <button
              onClick={onStep}
              disabled={isRunning}
              className="px-2 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-40 transition"
              title="Advance Single Timestep (+0.5h)"
            >
              <FastForward className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onReset}
              className="px-2 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-white transition"
              title="Reset Simulation Engine"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onRunFull}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <Zap className="w-3.5 h-3.5 text-blue-600" />
            <span>Run Full Trajectory</span>
          </button>

          <button
            onClick={onRunDemo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm"
            title="Execute 1-Click Reproducible Hackathon Demo Story"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Demo Mode</span>
          </button>

          {/* Speed Selector */}
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 gap-1 text-xs">
            <span className="text-slate-500 font-mono text-[11px]">Speed:</span>
            {[0.5, 1, 2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => setSimulationSpeed(s)}
                className={`px-1.5 py-0.5 rounded font-mono text-[11px] transition ${
                  simulationSpeed === s ? 'bg-white text-blue-700 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>

          <button
            onClick={onOpenConfig}
            className="p-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition shadow-xs"
            title="Parameters & Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
