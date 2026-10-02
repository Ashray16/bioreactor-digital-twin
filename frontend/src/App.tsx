import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import Sidebar from './components/layout/Sidebar';
import HeaderBar from './components/layout/HeaderBar';
import KpiCards from './components/dashboard/KpiCards';
import ProcessCharts from './components/dashboard/ProcessCharts';
import BioreactorDiagram from './components/dashboard/BioreactorDiagram';
import ControllerPanel from './components/dashboard/ControllerPanel';
import EventLog from './components/dashboard/EventLog';
import ConfigModal from './components/dashboard/ConfigModal';
import { useToast } from './context/ToastContext';

const ScenarioComparisonView = lazy(() => import('./components/dashboard/ScenarioComparisonView'));
const FaultInjectionPanel = lazy(() => import('./components/dashboard/FaultInjectionPanel'));
const AnalyticsPage = lazy(() => import('./components/dashboard/AnalyticsPage'));
const AIProcessIntelligence = lazy(() => import('./components/dashboard/AIProcessIntelligence'));

import { Loader2 } from 'lucide-react';
import {
  BioreactorConfig,
  BioreactorState,
  SimulationHistoryItem,
  FaultConfig,
} from './types/simulation';
import {
  fetchDefaultConfig,
  startSimulation,
  getSimulationState,
  stepSimulation,
  runFullSimulation,
  runDemoScenario,
} from './services/api';

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-slate-500">
    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
    <p className="text-xs font-medium font-mono">Loading workspace view...</p>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'diagram' | 'scenarios' | 'controller' | 'faults' | 'analytics' | 'ai-analytics'>('dashboard');
  const [config, setConfig] = useState<BioreactorConfig | null>(null);
  const [state, setState] = useState<BioreactorState | null>(null);
  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);
  const [activeFault, setActiveFault] = useState<FaultConfig | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const { showSuccess, showError, showInfo } = useToast();
  const timerRef = useRef<any>(null);

  // Dynamic Document Title per Active Tab (Section 4)
  useEffect(() => {
    const titles: Record<string, string> = {
      'dashboard': 'Bioprocess Digital Twin | Overview',
      'diagram': 'Bioprocess Digital Twin | Live Reactor & Process Flow',
      'scenarios': 'Bioprocess Digital Twin | Scenario Comparison',
      'controller': 'Bioprocess Digital Twin | Control Center',
      'faults': 'Bioprocess Digital Twin | Fault Analysis',
      'analytics': 'Bioprocess Digital Twin | Process Analytics',
      'ai-analytics': 'Bioprocess Digital Twin | AI Process Intelligence',
    };
    document.title = titles[activeTab] || 'Bioprocess Digital Twin | CHO Perfusion';
  }, [activeTab]);

  // Initialize simulation engine baseline and auto-load nominal demonstration run
  const initEngine = async (customConfig?: BioreactorConfig, startFresh = false) => {
    setInitError(null);
    try {
      const defaultConfig = customConfig || (await fetchDefaultConfig());
      setConfig(defaultConfig);

      if (startFresh) {
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
            product_concentration: initialState.product_concentration,
            perfusion_rate: initialState.perfusion_rate,
            fouling_index: initialState.fouling_index,
            controller_enabled: initialState.controller_enabled,
            active_fault: initialState.active_fault,
          },
        ]);
        if (customConfig) {
          showSuccess('Digital Twin parameters updated and re-initialized.');
        }
      } else {
        // Auto-load finished 240-hour demo run so first-time visitors immediately see rich trajectories
        const fullRun = await runFullSimulation(defaultConfig);
        setState(fullRun.current_state);
        setHistory(fullRun.history);
      }
    } catch (err: any) {
      console.error('Failed to initialize simulation engine:', err);
      const msg = err.message || 'Digital Twin backend is unavailable. Start the API service and retry.';
      setInitError(msg);
      showError(msg);
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
          product_concentration: round(newState.product_concentration, 3),
          perfusion_rate: round(newState.perfusion_rate, 2),
          fouling_index: round(newState.fouling_index, 1),
          controller_enabled: newState.controller_enabled,
          active_fault: newState.active_fault,
        },
      ]);

      if (config && newState.simulation_time >= config.simulation_duration) {
        setIsRunning(false);
        showSuccess('Simulation reached final duration (120 h).');
      }
    } catch (err: any) {
      console.error('Failed to step simulation:', err);
      showError('Failed to advance simulation timestep.');
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
    setActiveFault(null);
    if (config) {
      await initEngine(config, true);
      showInfo('Digital Twin reset to inoculation state (t = 0.0 h).');
    }
  };

  const handleLoadExampleRun = async () => {
    setIsRunning(false);
    try {
      const fullRun = await runFullSimulation(config || undefined);
      setState(fullRun.current_state);
      setHistory(fullRun.history);
      showSuccess('Loaded 240-hour nominal digital twin demo trajectory.');
    } catch (err: any) {
      console.error('Failed to load example run:', err);
      showError('Failed to load demo trajectory.');
    }
  };

  const handleRunFull = async () => {
    setIsRunning(false);
    if (!config) return;
    try {
      const response = await runFullSimulation(config);
      setState(response.current_state);
      setHistory(response.history);
      showSuccess('240 h simulation completed successfully.');
    } catch (err: any) {
      console.error('Failed to run full simulation:', err);
      showError('Failed to complete full simulation run.');
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
        showSuccess('Demo scenario loaded: closed-loop control recovery demonstrated.');
      }
    } catch (err: any) {
      console.error('Failed to execute demo scenario:', err);
      showError('Failed to execute demo scenario.');
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

  const handleFaultInjected = (fault: FaultConfig) => {
    setActiveFault(fault);
    setActiveTab('scenarios');
    showSuccess(`Injected ${fault.fault_type.replace(/_/g, ' ')} (t=${fault.start_time.toFixed(0)}h–${(fault.start_time + fault.duration).toFixed(0)}h). Comparing scenarios with disturbance active.`);
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
              <div className="text-rose-600 font-bold text-sm">Connection Error</div>
              <p className="text-xs text-slate-600 font-mono leading-relaxed">{initError}</p>
              <button
                onClick={() => initEngine()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-xs"
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
    <div className="flex h-screen bg-[#F7F8FA] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-hidden">
      {/* Persistent Left Navigation Sidebar + Mobile Drawer */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenConfig={() => setIsConfigOpen(true)}
        isOpenMobile={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        state={state}
        isRunning={isRunning}
        activeFault={activeFault}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
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
          onToggleMobileNav={() => setIsMobileNavOpen((prev) => !prev)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-[1600px] w-full mx-auto">
          {/* 1. Overview Dashboard */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4">
              <h2 className="sr-only">Process Simulation Dashboard Overview</h2>
              <KpiCards state={state} history={history} />
              <ProcessCharts
                history={history}
                targetCellDensity={state?.target_cell_density ?? 1e8}
                disturbanceWindow={activeFault ? {
                  start: activeFault.start_time,
                  end: activeFault.start_time + activeFault.duration,
                  label: `Injected Disturbance: ${activeFault.fault_type.replace(/_/g, ' ')}`,
                } : null}
                onLoadExampleRun={handleLoadExampleRun}
              />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  {state && (
                    <ControllerPanel
                      state={state}
                      config={config}
                      history={history}
                      onRefreshState={handleRefreshState}
                    />
                  )}
                </div>
                <div>
                  <EventLog history={history} latestAction={state?.latest_controller_action ?? null} activeFault={state?.active_fault ?? null} targetCellDensity={state?.target_cell_density ?? 1e8} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'diagram' && (
            <div className="space-y-6">
              <h2 className="sr-only">Bioreactor Flow Diagram</h2>
              <BioreactorDiagram state={state} focus="flow" config={config} isRunning={isRunning} />
            </div>
          )}

          {/* 3. Scenario Comparison View */}
          {activeTab === 'scenarios' && (
            <Suspense fallback={<PageLoader />}>
              <ScenarioComparisonView
                activeFault={activeFault}
                onClearFault={() => {
                  setActiveFault(null);
                  showInfo('Injected disturbance cleared. Baseline challenge restored.');
                }}
                onNavigateToFaults={() => setActiveTab('faults')}
              />
            </Suspense>
          )}

          {/* 4. Automated Controller Panel */}
          {activeTab === 'controller' && (
            <ControllerPanel
              state={state}
              config={config}
              history={history}
              onRefreshState={handleRefreshState}
            />
          )}


          {/* 5. Process Disturbance & Fault Analysis */}
          {activeTab === 'faults' && (
            <Suspense fallback={<PageLoader />}>
              <FaultInjectionPanel
                onRefreshState={handleRefreshState}
                onInjectSuccess={handleFaultInjected}
                onNavigateToTab={(tab) => setActiveTab(tab)}
              />
            </Suspense>
          )}

          {/* 6. Advanced Process Analytics & Monte Carlo */}
          {activeTab === 'analytics' && (
            <Suspense fallback={<PageLoader />}>
              <AnalyticsPage state={state} />
            </Suspense>
          )}

          {/* 7. AI Process Intelligence & Benchmark */}
          {activeTab === 'ai-analytics' && (
            <Suspense fallback={<PageLoader />}>
              <AIProcessIntelligence
                state={state}
                config={config}
                onCompareWithTwin={() => setActiveTab('dashboard')}
              />
            </Suspense>
          )}
        </main>

        {/* 12. Standard Footer */}
        <footer className="mt-auto py-4 px-6 border-t border-slate-200 bg-white text-xs text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>© 2026 Bioprocess Digital Twin. CHO Perfusion Bioreactor Platform.</div>
          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500">
            <span>Solver: RK4 ODE</span>
            <span>•</span>
            <span>Dual Mechanistic &amp; AI Intelligence</span>
          </div>
        </footer>
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
