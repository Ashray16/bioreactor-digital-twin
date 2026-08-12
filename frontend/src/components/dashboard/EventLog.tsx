import { SimulationHistoryItem, ControllerActionInfo } from '../../types/simulation';
import { List, CheckCircle2, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';

interface EventLogProps {
  history: SimulationHistoryItem[];
  latestAction: ControllerActionInfo | null;
  activeFault: string | null;
}

export default function EventLog({ history, latestAction, activeFault }: EventLogProps) {
  const events: Array<{ time: number; type: 'info' | 'warning' | 'control' | 'fault'; title: string; desc: string }> = [];

  if (history.length > 0) {
    events.push({
      time: 0.0,
      type: 'info',
      title: 'Simulation Initialized',
      desc: 'Digital twin state created with baseline cell density.',
    });
  }

  history.forEach((h) => {
    if (h.viable_cell_density >= 1.0e8 && !events.some((e) => e.title === 'Target Cell Density Reached')) {
      events.push({
        time: h.time,
        type: 'info',
        title: 'Target Cell Density Reached',
        desc: `Cell density crossed >1.00 × 10⁸ cells/mL goal benchmark.`,
      });
    }

    if (h.fouling_index >= 70.0 && !events.some((e) => e.time === h.time && e.type === 'warning')) {
      events.push({
        time: h.time,
        type: 'warning',
        title: 'Filter Fouling Risk Warning',
        desc: `Fouling risk index elevated to ${h.fouling_index.toFixed(1)} / 100 (HIGH).`,
      });
    }

    if (h.nutrient_concentration < 1.5 && !events.some((e) => e.time === h.time && e.title.includes('Low Glucose'))) {
      events.push({
        time: h.time,
        type: 'warning',
        title: 'Low Glucose Alert',
        desc: `Substrate concentration dropped to ${h.nutrient_concentration.toFixed(2)} g/L.`,
      });
    }
  });

  if (latestAction) {
    if (!events.some((e) => e.time === latestAction.timestamp && e.type === 'control')) {
      events.push({
        time: latestAction.timestamp,
        type: 'control',
        title: `Controller Action: ${latestAction.action_type}`,
        desc: latestAction.reason,
      });
    }
  }

  if (activeFault) {
    events.push({
      time: history.length > 0 ? history[history.length - 1].time : 0.0,
      type: 'fault',
      title: 'Process Disturbance Active',
      desc: activeFault,
    });
  }

  events.sort((a, b) => b.time - a.time);

  return (
    <div className="glass-panel p-6 rounded-xl border border-slate-200 space-y-4 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wider">
          <List className="w-4 h-4 text-blue-600" />
          Real-Time Process Event Stream
        </h3>
        <span className="text-[11px] font-mono text-slate-500">{events.length} Events</span>
      </div>

      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
        {events.map((ev, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-lg border text-xs flex items-start gap-3 transition ${
              ev.type === 'control'
                ? 'bg-blue-50 border-blue-200 text-blue-900'
                : ev.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : ev.type === 'fault'
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <div className="mt-0.5">
              {ev.type === 'control' && <ShieldCheck className="w-4 h-4 text-blue-600" />}
              {ev.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
              {ev.type === 'fault' && <Zap className="w-4 h-4 text-red-600" />}
              {ev.type === 'info' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            </div>
            <div className="flex-1 space-y-0.5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900">{ev.title}</span>
                <span className="font-mono text-[10px] text-slate-500 font-semibold">t={ev.time.toFixed(1)}h</span>
              </div>
              <p className="text-[11px] text-slate-600 font-sans">{ev.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
