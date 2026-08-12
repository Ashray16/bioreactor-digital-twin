import { useState, useEffect, useRef } from 'react';
import Header from './components/dashboard/Header';
import KpiCards from './components/dashboard/KpiCards';
import ProcessCharts from './components/dashboard/ProcessCharts';
import BioreactorDiagram from './components/dashboard/BioreactorDiagram';
import ControllerPanel from './components/dashboard/ControllerPanel';
import EventLog from './components/dashboard/EventLog';
import ScenarioComparisonView from './components/dashboard/ScenarioComparisonView';
import FaultInjectionPanel from './components/dashboard/FaultInjectionPanel';
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'diagram' | 'scenarios' | 'controller' | 'faults'>('dashboard');
  const [config, setConfig] = useState<BioreactorConfig | null>(null);
  const [state, setState] = useState<BioreactorState | null>(null);
  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const timerRef = useRef<any>(null);

  // Initialize simulation engine baseline
  const initEngine = async (customConfig?: BioreactorConfig) => {
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
    } catch (err) {
      console.error('Failed to initialize simulation engine:', err);
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

      // Stop if simulation reaches duration limit
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
      <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400 font-mono">Initializing Digital Twin Simulation Engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 p-6 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
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

      <main className="flex-1 space-y-6 max-w-7xl mx-auto w-full">
        {/* Main Tab Content */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Primary KPI Cards */}
            <KpiCards state={state} />

            {/* Time-Series Charts */}
            <ProcessCharts history={history} targetCellDensity={state.target_cell_density} />

            {/* Controller Panel & Real-time Event Log */}
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

        {activeTab === 'diagram' && <BioreactorDiagram state={state} />}

        {activeTab === 'scenarios' && <ScenarioComparisonView />}

        {activeTab === 'controller' && (
          <ControllerPanel state={state} onRefreshState={handleRefreshState} />
        )}

        {activeTab === 'faults' && (
          <FaultInjectionPanel onRefreshState={handleRefreshState} />
        )}
      </main>

      {/* Configuration Drawer Modal */}
      <ConfigModal
        config={config}
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onSave={(newCfg) => initEngine(newCfg)}
      />
    </div>
  );
}
