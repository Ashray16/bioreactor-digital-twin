import { useState, useEffect } from 'react';
import {
  Cpu,
  Activity,
  Workflow,
  Sliders,
  Zap,
  BarChart3,
  BookOpen,
  LineChart,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { BioreactorState, FaultConfig } from '../../types/simulation';

interface SidebarProps {
  activeTab: 'dashboard' | 'diagram' | 'scenarios' | 'controller' | 'faults' | 'analytics' | 'ai-analytics';
  setActiveTab: (tab: 'dashboard' | 'diagram' | 'scenarios' | 'controller' | 'faults' | 'analytics' | 'ai-analytics') => void;
  onOpenConfig: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  state?: BioreactorState | null;
  isRunning?: boolean;
  activeFault?: FaultConfig | null;
}

// Simple line icon of a vessel (1.5px stroke, liquid surface and impeller shaft)
function VesselLineIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="7" y="3" width="10" height="18" rx="3" />
      <path d="M7 10c1.7-1 3.3 1 5 0s3.3-1 5 0" />
      <path d="M12 3v12M9.5 15h5" />
    </svg>
  );
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  onOpenConfig,
  isOpenMobile = false,
  onCloseMobile = () => {},
  state,
  isRunning = false,
  activeFault,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Global Keyboard Shortcuts (1-7 for tabs, 8 for specs, [ for collapse toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently focused on an input element
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === '1') setActiveTab('dashboard');
      else if (e.key === '2') setActiveTab('diagram');
      else if (e.key === '3') setActiveTab('controller');
      else if (e.key === '4') setActiveTab('faults');
      else if (e.key === '5') setActiveTab('scenarios');
      else if (e.key === '6') setActiveTab('analytics');
      else if (e.key === '7') setActiveTab('ai-analytics');
      else if (e.key === '8') onOpenConfig();
      else if (e.key === '[' || (e.ctrlKey && e.key.toLowerCase() === 'b')) {
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab, onOpenConfig]);

  // Mobile Body scroll locking & Escape key listener
  useEffect(() => {
    if (!isOpenMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseMobile();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpenMobile, onCloseMobile]);

  // Two streamlined navigation groups as recommended
  const navGroups = [
    {
      title: 'RUN',
      items: [
        { id: 'dashboard', label: 'Overview', icon: Activity, shortcut: '1' },
        { id: 'diagram', label: 'Reactor & Flow', icon: Workflow, shortcut: '2' },
        { id: 'controller', label: 'Controller', icon: Sliders, shortcut: '3' },
        { id: 'faults', label: 'Fault Analysis', icon: Zap, shortcut: '4' },
      ],
    },
    {
      title: 'ANALYZE',
      items: [
        { id: 'scenarios', label: 'Scenario Comparison', icon: LineChart, shortcut: '5' },
        { id: 'analytics', label: 'Process Analytics', icon: BarChart3, shortcut: '6' },
        { id: 'ai-analytics', label: 'AI Intelligence', icon: Cpu, shortcut: '7' },
      ],
    },
  ];

  const handleNavClick = (id: any) => {
    setActiveTab(id);
    onCloseMobile();
  };

  const handleConfigClick = () => {
    onOpenConfig();
    onCloseMobile();
  };

  const isDisturbanceActive = Boolean(
    activeFault || (state && state.active_fault)
  );

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full text-slate-700 select-none bg-[#FAFAFB]">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Header: Quiet 28px Vessel Mark + Reactor Selector Dropdown + Collapse Toggle */}
        <div
          className={`p-4 border-b border-slate-100 flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-between'
          } gap-2 bg-white`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {/* Quiet 28px square with 1px border and blue vessel line icon */}
            <div
              className="w-7 h-7 rounded-md border border-slate-200/80 bg-white flex items-center justify-center text-blue-600 shrink-0"
              title="Bioreactor Vessel"
            >
              <VesselLineIcon className="w-4 h-4 text-blue-600" />
            </div>

            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <h1 className="text-[15px] font-semibold text-[#1f2937] leading-tight truncate">
                  Bioreactor Twin
                </h1>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 truncate">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500/80'
                    }`}
                  />
                  <span className="truncate">
                    {isRunning ? 'BB 04 · Running' : 'CHO perfusion, 2 L'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Collapse / Expand Toggle Button */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
            title={isCollapsed ? 'Expand sidebar ([)' : 'Collapse sidebar ([)'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>

          {/* Close button for mobile drawer */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Section Tree */}
        <nav
          aria-label="Main Navigation"
          className="p-2 space-y-4 overflow-y-auto flex-1"
        >
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {!isCollapsed ? (
                <div className="px-2.5 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  {group.title}
                </div>
              ) : (
                <div className="h-2" />
              )}

              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      title={`${item.label} (Press ${item.shortcut})`}
                      className={`w-full flex items-center ${
                        isCollapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-2.5 py-1.5'
                      } rounded-md text-xs transition-colors relative group cursor-pointer ${
                        active
                          ? 'bg-slate-100/90 text-slate-900 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 font-medium'
                      }`}
                    >
                      {/* Quieter 2.5px Left Accent Bar on Active */}
                      {active && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] bg-blue-600 rounded-r" />
                      )}

                      <Icon
                        className={`w-4 h-4 shrink-0 stroke-[1.75] ${
                          active
                            ? 'text-blue-600'
                            : 'text-slate-400 group-hover:text-slate-600'
                        }`}
                      />

                      {!isCollapsed && (
                        <span className="truncate flex-1 text-left">{item.label}</span>
                      )}

                      {/* Live Pulsing Dot on Overview while simulation runs */}
                      {item.id === 'dashboard' && isRunning && (
                        <span
                          className={`w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0 ${
                            isCollapsed ? 'absolute top-1 right-1' : ''
                          }`}
                          title="Simulation actively advancing"
                        />
                      )}

                      {/* Live Disturbance Alert Badge on Fault Analysis */}
                      {item.id === 'faults' && isDisturbanceActive && (
                        <span
                          className={`shrink-0 ${
                            isCollapsed
                              ? 'absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500'
                              : 'px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                          title="Process disturbance currently active"
                        >
                          {!isCollapsed && 'Active'}
                        </span>
                      )}

                      {/* Keyboard shortcut hint */}
                      {!isCollapsed && (
                        <span className="hidden group-hover:inline text-[9px] font-mono text-slate-400 ml-auto">
                          {item.shortcut}
                        </span>
                      )}

                      {/* Tooltip bubble when collapsed */}
                      {isCollapsed && (
                        <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-medium rounded-md shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 flex items-center gap-1.5">
                          <span>{item.label}</span>
                          <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-1 py-0.5 rounded">
                            {item.shortcut}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Model Parameters Pinned Settings Entry */}
          <div className="space-y-1 pt-2 border-t border-slate-200/60">
            <button
              type="button"
              onClick={handleConfigClick}
              title="Parameters & Specs (Press 8)"
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-2.5 py-1.5'
              } rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 transition-colors group cursor-pointer relative`}
            >
              <BookOpen className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0 stroke-[1.75]" />
              {!isCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">Parameters &amp; Specs</span>
                  <span className="hidden group-hover:inline text-[9px] font-mono text-slate-400 ml-auto">
                    8
                  </span>
                </>
              )}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-medium rounded-md shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 flex items-center gap-1.5">
                  <span>Parameters &amp; Specs</span>
                  <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-1 py-0.5 rounded">
                    8
                  </span>
                </div>
              )}
            </button>
          </div>
        </nav>
      </div>

      {/* Live Digital Twin Status Footer */}
      <div className="p-3 border-t border-slate-200/80 bg-white text-xs text-slate-600 space-y-1.5">
        {!isCollapsed ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500">Culture State:</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                  }`}
                />
                <span className={isRunning ? 'text-emerald-700' : 'text-slate-600'}>
                  {isRunning ? 'Running' : 'Ready'}
                </span>
                <span className="font-mono text-slate-800 font-bold">
                  t = {(state?.simulation_time || 0).toFixed(1)} h
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-100">
              <span>Solver: RK4 (dt = 0.5h)</span>
              <span className="text-emerald-700 font-medium">Engine: Online</span>
            </div>
          </>
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-1 py-1"
            title={`State: ${isRunning ? 'Running' : 'Ready'} | t = ${(state?.simulation_time || 0).toFixed(1)} h | Solver: RK4`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span className="text-[9px] font-mono font-bold text-slate-700">
              {(state?.simulation_time || 0).toFixed(0)}h
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (>= md) */}
      <aside
        className={`hidden md:flex ${
          isCollapsed ? 'w-[64px]' : 'w-[236px]'
        } bg-[#FAFAFB] border-r border-slate-200/80 flex-col shrink-0 min-h-screen transition-[width] duration-200 ease-in-out`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Out Drawer (< md) */}
      {isOpenMobile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation drawer"
          className="fixed inset-0 z-50 md:hidden flex"
        >
          {/* Backdrop */}
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
          />

          {/* Drawer container */}
          <div className="relative w-64 max-w-[85vw] bg-[#FAFAFB] h-full shadow-2xl z-10 flex flex-col animate-fade-in">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
