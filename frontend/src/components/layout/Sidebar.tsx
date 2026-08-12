import {
  Cpu,
  Activity,
  Layers,
  Sliders,
  Zap,
  BarChart3,
  BookOpen,
  Filter,
  RefreshCw,
  LineChart,
} from 'lucide-react';

interface SidebarProps {
  activeTab: 'dashboard' | 'diagram' | 'scenarios' | 'controller' | 'faults' | 'analytics';
  setActiveTab: (tab: 'dashboard' | 'diagram' | 'scenarios' | 'controller' | 'faults' | 'analytics') => void;
  onOpenConfig: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, onOpenConfig }: SidebarProps) {
  const navSections = [
    {
      title: 'DIGITAL TWIN',
      items: [
        { id: 'dashboard', label: 'Overview', icon: Cpu },
      ],
    },
    {
      title: 'PROCESS',
      items: [
        { id: 'diagram', label: 'Bioreactor Flow', icon: Activity },
        { id: 'diagram', label: 'Mass Balance', icon: RefreshCw },
        { id: 'diagram', label: 'Filtration Unit', icon: Filter },
      ],
    },
    {
      title: 'SIMULATION',
      items: [
        { id: 'dashboard', label: 'Live Simulation', icon: LineChart },
        { id: 'scenarios', label: 'Scenario Comparison', icon: Layers },
      ],
    },
    {
      title: 'CONTROL',
      items: [
        { id: 'controller', label: 'Automated Controller', icon: Sliders },
        { id: 'faults', label: 'Fault Injection', icon: Zap },
      ],
    },
    {
      title: 'ANALYSIS',
      items: [
        { id: 'analytics', label: 'Process Analytics', icon: BarChart3 },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 min-h-screen text-slate-700 select-none">
      <div>
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
            DT
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">
              Bioreactor Twin
            </h1>
            <p className="text-[11px] font-mono text-slate-500">BB 04 Perfusion</p>
          </div>
        </div>

        {/* Navigation Section Tree */}
        <div className="p-3 space-y-5 overflow-y-auto">
          {navSections.map((sec, idx) => (
            <div key={idx} className="space-y-1">
              <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {sec.title}
              </div>
              <div className="space-y-0.5">
                {sec.items.map((item, itemIdx) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={itemIdx}
                      onClick={() => setActiveTab(item.id as any)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                        active
                          ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200/60'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Model Section */}
          <div className="space-y-1">
            <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              MODEL
            </div>
            <button
              onClick={onOpenConfig}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent transition"
            >
              <BookOpen className="w-4 h-4 text-slate-400" />
              <span>Parameters &amp; Specs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer System Status */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] font-mono text-slate-500 space-y-1">
        <div className="flex justify-between items-center">
          <span>Engine Status:</span>
          <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Ready
          </span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span>Solver: RK4 ODE</span>
          <span>v1.0</span>
        </div>
      </div>
    </aside>
  );
}
