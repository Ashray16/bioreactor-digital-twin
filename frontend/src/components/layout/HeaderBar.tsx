import { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Sliders,
  Layers,
  Zap,
  Menu,
  ChevronDown
} from 'lucide-react';

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
  onToggleMobileNav?: () => void;
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
  onToggleMobileNav,
}: HeaderBarProps) {
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  // Close options menu on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target as Node)) {
        setIsOptionsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOptionsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 py-2.5 font-sans">
      <div className="max-w-[1600px] w-full mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        {/* Left Section: Branding, Live State & Telemetry */}
        <div className="flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-3">
            {/* Mobile Nav Button */}
            <button
              onClick={onToggleMobileNav}
              className="md:hidden p-1.5 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
                  Digital Twin Bioreactor
                </h1>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 text-slate-600 shrink-0">
                  BB 04
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                CHO Perfusion &amp; Adaptive Control
              </p>
            </div>
          </div>

          {/* Telemetry Status Cluster: labels in font-sans, numbers in font-mono */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200">
              <span className="text-slate-500 hidden sm:inline">Status:</span>
              <span className={`font-semibold flex items-center gap-1.5 text-xs ${isRunning ? 'text-emerald-700' : 'text-amber-700'}`}>
                <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                {isRunning ? 'Running' : 'Paused'}
              </span>
            </div>

            <div className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs">
              <span className="text-slate-500">t = </span>
              <span className="font-bold text-blue-700 font-mono">{simulationTime.toFixed(1)} h</span>
            </div>
          </div>
        </div>

        {/* Right Section: Consolidated 3-Cluster Controls */}
        <div className="flex items-center gap-2.5">
          {/* Cluster 1: Media Player Control Group (Play/Pause, Step, Reset) */}
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5 shadow-2xs">
            <button
              onClick={onTogglePlay}
              aria-label={isRunning ? 'Pause simulation' : 'Start simulation'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                isRunning
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
              }`}
            >
              {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isRunning ? 'Pause' : 'Start Simulation'}</span>
            </button>

            <button
              onClick={onStep}
              disabled={isRunning}
              aria-label="Advance single timestep (+0.5h)"
              className="p-1.5 rounded-md text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-40 transition"
              title="Advance single step (+0.5h)"
            >
              <FastForward className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onReset}
              aria-label="Reset simulation engine"
              className="p-1.5 rounded-md text-slate-600 hover:bg-white hover:text-slate-900 transition"
              title="Reset simulation engine"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Cluster 2: Compact Simulation Speed Dropdown */}
          <div className="flex items-center bg-slate-100/80 border border-slate-200 rounded-lg px-2 py-1 text-xs gap-1.5 shadow-2xs">
            <span className="text-slate-500 text-[11px] hidden sm:inline">Speed:</span>
            <select
              value={simulationSpeed}
              onChange={(e) => setSimulationSpeed(Number(e.target.value))}
              aria-label="Simulation speed multiplier"
              className="bg-transparent font-mono font-bold text-slate-800 text-xs focus:outline-none cursor-pointer"
            >
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={5}>5×</option>
              <option value={10}>10×</option>
            </select>
          </div>

          {/* Cluster 3: Folded Configuration & Scenario Options Menu */}
          <div className="relative" ref={optionsMenuRef}>
            <button
              onClick={() => setIsOptionsOpen((prev) => !prev)}
              aria-expanded={isOptionsOpen}
              aria-label="Open simulation options and configuration menu"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition shadow-2xs ${
                isOptionsOpen
                  ? 'bg-slate-100 border-slate-300 text-slate-900'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title="Parameters, Full Run, and Demo Scenarios"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Options</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOptionsOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOptionsOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-fade-in font-sans">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Execution Scenarios
                </div>

                <button
                  onClick={() => {
                    onRunFull();
                    setIsOptionsOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-slate-700 hover:bg-slate-50 transition"
                >
                  <Zap className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">Run Full Trajectory</div>
                    <div className="text-[11px] text-slate-500">Simulate 120-hour batch in 1-click</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onRunDemo();
                    setIsOptionsOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-slate-700 hover:bg-slate-50 transition"
                >
                  <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">Execute Demo Scenario</div>
                    <div className="text-[11px] text-slate-500">Fault injection &amp; closed-loop recovery</div>
                  </div>
                </button>

                <div className="my-1.5 border-t border-slate-100" />

                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Reactor Configuration
                </div>

                <button
                  onClick={() => {
                    onOpenConfig();
                    setIsOptionsOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-slate-700 hover:bg-slate-50 transition"
                >
                  <Sliders className="w-4 h-4 text-purple-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">Parameters &amp; Specs</div>
                    <div className="text-[11px] text-slate-500">Edit kinetics, volumes &amp; limits</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
