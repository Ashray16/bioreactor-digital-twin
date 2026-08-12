import { useState, useEffect, useRef } from 'react';
import Sidebar from './components/layout/Sidebar';
import HeaderBar from './components/layout/HeaderBar';
import KpiCards from './components/dashboard/KpiCards';
import ProcessCharts from './components/dashboard/ProcessCharts';
import BioreactorDiagram from './components/dashboard/BioreactorDiagram';
import ControllerPanel from './components/dashboard/ControllerPanel';
import EventLog from './components/dashboard/EventLog';
import ScenarioComparisonView from './components/dashboard/ScenarioComparisonView';
import FaultInjectionPanel from './components/dashboard/FaultInjectionPanel';
import AnalyticsPage from './components/dashboard/AnalyticsPage';
import ConfigModal from './components/dashboard/ConfigModal';

import {
  BioreactorConfig,
  BioreactorState,
  SimulationHistoryItem,
} from './types/simulation';
import {
  fetchDefaultConfig,
  startSimulation,
  getSimulationState,
  stepSimulation,
  runFullSimulation,
  runDemoScenario,
} from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'diagram' | 'scenarios' | 'controller' | 'faults' | 'analytics'>('dashboard');
  const [config, setConfig] = useState<BioreactorConfig | null>(null);
  const [state, setState] = useState<BioreactorState | null>(null);
  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const timerRef = useRef<any>(null);

  // Initialize simulation engine baseline
  const initEngine = async (customConfig?: BioreactorConfig) => {
    setInitError(null);
    try {
      const defaultConfig = customConfig || (await fetchDefaultConfig());
      setConfig(defaultConfig);

      const initialState = await startSimulation(defaultConfig);
      setState(initialState);
      setHistory([
        {
          time: 0.0,
          viable_cell_density: initialState.viable_cell_density,
          nonviable_cell_density: initialState.nonviable_cell_density,
          cell_viability: initialState.cell_viability,
          nutrient_concentration: initialState.nutrient_concentration,
          metabolite_concentration: initialState.metabolite_concentration,
          perfusion_rate: initialState.perfusion_rate,
          fouling_index: initialState.fouling_index,
          controller_enabled: initialState.controller_enabled,
          active_fault: initialState.active_fault,
        },
      ]);
    } catch (err: any) {
      console.error('Failed to initialize simulation engine:', err);
      setInitError(err.message || 'Could not connect to Digital Twin backend service.');
    }
  };

  useEffect(() => {
    initEngine();
  }, []);

  // Timestep advancement handler
  const handleStep = async () => {
    try {
      const newState = await stepSimulation();
      setState(newState);
      setHistory((prev) => [
        ...prev,
        {
          time: round(newState.simulation_time, 2),
          viable_cell_density: round(newState.viable_cell_density, 2),
          nonviable_cell_density: round(newState.nonviable_cell_density, 2),
          cell_viability: round(newState.cell_viability, 2),
          nutrient_concentration: round(newState.nutrient_concentration, 3),
          metabolite_concentration: round(newState.metabolite_concentration, 3),
          perfusion_rate: round(newState.perfusion_rate, 2),
          fouling_index: round(newState.fouling_index, 1),
          controller_enabled: newState.controller_enabled,
          active_fault: newState.active_fault,
        },
      ]);

      if (config && newState.simulation_time >= config.simulation_duration) {
        setIsRunning(false);
      }
    } catch (err) {
      console.error('Failed to step simulation:', err);
      setIsRunning(false);
    }
  };

  // Playback timer loop
  useEffect(() => {
    if (isRunning) {
      const intervalMs = Math.max(100, 1000 / simulationSpeed);
      timerRef.current = setInterval(() => {
        handleStep();
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, simulationSpeed, config]);

  const handleTogglePlay = () => {
    setIsRunning((prev) => !prev);
  };

  const handleReset = async () => {
    setIsRunning(false);
    if (config) {
      await initEngine(config);
    }
  };

  const handleRunFull = async () => {
    setIsRunning(false);
    if (!config) return;
    try {
      const response = await runFullSimulation(config);
      setState(response.current_state);
      setHistory(response.history);
    } catch (err) {
      console.error('Failed to run full simulation:', err);
    }
  };

  const handleRunDemo = async () => {
    setIsRunning(false);
    setActiveTab('scenarios');
    try {
      const demoRes = await runDemoScenario();
      if (demoRes && demoRes.comparison_result) {
        setState(demoRes.comparison_result.controlled_scenario.current_state);
        setHistory(demoRes.comparison_result.controlled_scenario.history);
      }
    } catch (err) {
      console.error('Failed to execute demo scenario:', err);
    }
  };

  const handleRefreshState = async () => {
    try {
      const st = await getSimulationState();
      setState(st);
    } catch (err) {
      console.error('Failed to refresh state:', err);
    }
  };

  const round = (val: number, decimals: number) => {
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  };

  if (!state || !config) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] text-slate-800 flex items-center justify-center p-6 font-sans">
        <div className="text-center space-y-4 max-w-md">
          {initError ? (
            <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
              <div className="text-red-600 font-bold text-sm">Connection Error</div>
              <p className="text-xs text-slate-500 font-mono">{initError}</p>
              <button
                onClick={() => initEngine()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition"
              >
                Retry Connection
              </button>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-slate-600 font-mono">Initializing Digital Twin Simulation Engine...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F7F8FA] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Persistent Left Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenConfig={() => setIsConfigOpen(true)}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <HeaderBar
          isRunning={isRunning}
          onTogglePlay={handleTogglePlay}
          onStep={handleStep}
          onReset={handleReset}
          onRunFull={handleRunFull}
          onRunDemo={handleRunDemo}
          onOpenConfig={() => setIsConfigOpen(true)}
          simulationSpeed={simulationSpeed}
          setSimulationSpeed={setSimulationSpeed}
          simulationTime={state.simulation_time}
        />

        <main className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">
          {/* 1. Overview Dashboard */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <KpiCards state={state} />
              <ProcessCharts history={history} targetCellDensity={state.target_cell_density} />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <ControllerPanel state={state} onRefreshState={handleRefreshState} />
                </div>
                <div>
                  <EventLog history={history} latestAction={state.latest_controller_action} activeFault={state.active_fault} />
                </div>
              </div>
            </div>
          )}

          {/* 2. Process Flow View */}
          {activeTab === 'diagram' && <BioreactorDiagram state={state} />}

          {/* 3. Scenario Comparison View */}
          {activeTab === 'scenarios' && <ScenarioComparisonView />}

          {/* 4. Automated Controller Panel */}
          {activeTab === 'controller' && (
            <ControllerPanel state={state} onRefreshState={handleRefreshState} />
          )}

          {/* 5. Process Disturbance & Fault Analysis */}
          {activeTab === 'faults' && (
            <FaultInjectionPanel onRefreshState={handleRefreshState} />
          )}

          {/* 6. Advanced Process Analytics & Monte Carlo */}
          {activeTab === 'analytics' && <AnalyticsPage state={state} />}
        </main>
      </div>

      {/* Configuration Parameters Modal */}
      <ConfigModal
        config={config}
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onSave={(newCfg) => initEngine(newCfg)}
      />
    </div>
  );
}
