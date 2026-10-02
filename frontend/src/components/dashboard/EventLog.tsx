import { SimulationHistoryItem, ControllerActionInfo } from '../../types/simulation';
import { useAI } from '../../context/AIContext';
import { CheckCircle2, ShieldCheck, Zap, Sparkles } from 'lucide-react';
import { GLUCOSE_THRESHOLD_LOW, FOULING_THRESHOLD_HIGH } from '../../config/constants';

interface EventLogProps {
  history: SimulationHistoryItem[];
  latestAction: ControllerActionInfo | null;
  activeFault: string | null;
  targetCellDensity: number;
}

export default function EventLog({ history, latestAction, activeFault, targetCellDensity }: EventLogProps) {
  const { analysisHistory } = useAI();

  const formatDensity = (density: number) => {
    if (density >= 1e8) {
      return `${(density / 1e8).toFixed(2)} × 10⁸`;
    } else if (density >= 1e7) {
      return `${(density / 1e7).toFixed(2)} × 10⁷`;
    } else {
      return `${(density / 1e6).toFixed(2)} × 10⁶`;
    }
  };

  const events: Array<{
    time: number;
    category: 'PROCESS' | 'CONTROL' | 'FAULT' | 'AI';
    title: string;
    desc: string;
  }> = [];

  if (history.length > 0) {
    events.push({
      time: 0.0,
      category: 'PROCESS',
      title: 'Simulation Initialized',
      desc: 'Digital twin state created with baseline cell density.',
    });
  }

  history.forEach((h) => {
    if (h.viable_cell_density >= targetCellDensity && !events.some((e) => e.title === 'Target Cell Density Reached')) {
      events.push({
        time: h.time,
        category: 'PROCESS',
        title: 'Target Cell Density Reached',
        desc: `Cell density crossed >${formatDensity(targetCellDensity)} cells/mL goal benchmark at t=${h.time.toFixed(1)}h.`,
      });
    }

    if (h.fouling_index >= FOULING_THRESHOLD_HIGH && !events.some((e) => e.time === h.time && e.category === 'PROCESS' && e.title.includes('Fouling'))) {
      events.push({
        time: h.time,
        category: 'PROCESS',
        title: 'Filter Fouling Warning',
        desc: `Fouling risk index elevated to ${h.fouling_index.toFixed(1)} / 100 (HIGH).`,
      });
    }

    if (h.nutrient_concentration < GLUCOSE_THRESHOLD_LOW && !events.some((e) => e.time === h.time && e.title.includes('Low Glucose'))) {
      events.push({
        time: h.time,
        category: 'PROCESS',
        title: 'Low Glucose Alert',
        desc: `Substrate concentration dropped to ${h.nutrient_concentration.toFixed(2)} g/L (<${GLUCOSE_THRESHOLD_LOW.toFixed(1)} g/L).`,
      });
    }
  });

  if (latestAction) {
    if (!events.some((e) => e.time === latestAction.timestamp && e.category === 'CONTROL')) {
      events.push({
        time: latestAction.timestamp,
        category: 'CONTROL',
        title: `Controller Action: ${latestAction.action_type}`,
        desc: `${latestAction.reason} (${latestAction.previous_perfusion.toFixed(2)} → ${latestAction.current_perfusion.toFixed(2)} VVD).`,
      });
    }
  }

  if (activeFault) {
    events.push({
      time: history.length > 0 ? history[history.length - 1].time : 0.0,
      category: 'FAULT',
      title: 'Process Disturbance Active',
      desc: activeFault,
    });
  }

  // Include user-executed AI process intelligence events
  analysisHistory.forEach((item) => {
    events.push({
      time: item.simulationTime,
      category: 'AI',
      title: `AI Process Analysis Executed`,
      desc: `HistGradientBoosting v1.0 prediction: ${item.prediction.prediction.toFixed(2)} g/L titer (Source: ${item.source}).`,
    });
  });

  events.sort((a, b) => b.time - a.time);

  return (
    <div className="border border-slate-200 rounded-md p-4 space-y-3 bg-white shadow-none font-sans">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
          Process Event Stream
        </h2>
        <span className="text-[11px] font-mono text-slate-400">{events.length} Events</span>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {events.map((ev, idx) => (
          <div
            key={idx}
            className={`p-2.5 rounded-md border text-xs flex items-start gap-2.5 transition ${
              ev.category === 'FAULT'
                ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                : 'bg-slate-50/70 border-slate-200/70 text-slate-700'
            }`}
          >
            <div className="mt-0.5">
              {ev.category === 'CONTROL' && <ShieldCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
              {ev.category === 'FAULT' && <Zap className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
              {ev.category === 'AI' && <Sparkles className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
              {ev.category === 'PROCESS' && <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
            </div>
            <div className="flex-1 space-y-0.5 min-w-0">
              <div className="flex justify-between items-center gap-1">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-semibold text-slate-900 truncate">{ev.title}</span>
                  <span
                    className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${
                      ev.category === 'FAULT'
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : 'bg-white text-slate-500 border-slate-200'
                    }`}
                  >
                    {ev.category}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-slate-400 shrink-0 font-medium">t={ev.time.toFixed(1)}h</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">{ev.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
