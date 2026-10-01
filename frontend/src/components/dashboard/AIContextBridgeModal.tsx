import React, { useState, useEffect } from 'react';
import { useAI } from '../../context/AIContext';
import { BioreactorState } from '../../types/simulation';
import { createProcessContext, getAIContextMappings } from '../../utils/aiMapping';
import { TiterInputParams } from '../../types/ai';
import { Cpu, X, Sparkles, Loader2, Info, CheckCircle2, AlertTriangle } from 'lucide-react';

interface AIContextBridgeModalProps {
  state: BioreactorState;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AIContextBridgeModal({ state, isOpen, onClose, onSuccess }: AIContextBridgeModalProps) {
  const { runTiterPrediction, runSimilaritySearch, addAnalysisHistoryItem, available } = useAI();

  const twinCtx = createProcessContext(state);
  const mappings = getAIContextMappings(twinCtx);

  // Form state prefilled from twin mappings + manual defaults
  const [manualSubstrate, setManualSubstrate] = useState<number>(20.0);
  const [manualOxygen, setManualOxygen] = useState<number>(1.0); // 1.0 = Aerobic, 0.0 = Anaerobic
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tempVal = mappings.temperature.mappedValue ?? 37.0;
  const volVal = mappings.reactor_volume.mappedValue ?? 1.0;
  const durVal = mappings.fermentation_duration.mappedValue ?? 24.0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!available || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const inputs: TiterInputParams = {
        temperature: tempVal,
        substrate_concentration: manualSubstrate,
        reactor_volume: volVal,
        oxygen: manualOxygen,
        fermentation_duration: durVal,
      };

      const pred = await runTiterPrediction(inputs);
      let similarityRes = null;
      if (pred) {
        similarityRes = await runSimilaritySearch(inputs, 5);
      }

      if (pred) {
        addAnalysisHistoryItem({
          id: `analysis-${Date.now()}`,
          simulationTime: state.simulation_time,
          timestamp: new Date().toLocaleTimeString(),
          source: 'MIXED',
          inputs,
          inputSources: {
            temperature: 'TWIN',
            reactor_volume: 'TWIN',
            fermentation_duration: 'TWIN',
            substrate_concentration: 'MANUAL',
            oxygen: 'MANUAL',
          },
          prediction: pred,
          similarityMatches: similarityRes,
        });
      }

      setIsSubmitting(false);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Failed to run twin AI analysis:', err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-bridge-modal-title"
        className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden space-y-4"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 id="ai-bridge-modal-title" className="text-sm font-bold text-slate-900">
                Analyze Current Process Context
              </h2>
              <p className="text-[11px] text-slate-500">
                Digital Twin Context Bridge • Simulation Time: <strong className="font-mono text-blue-600">t={state.simulation_time.toFixed(1)}h</strong>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            aria-label="Close process analysis dialog"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200 text-xs text-blue-900 space-y-1">
            <div className="font-bold flex items-center gap-1 text-blue-800">
              <Info className="w-4 h-4 text-blue-600 shrink-0" /> Scientific Mapping Bridge
            </div>
            <p className="text-[11px] leading-relaxed">
              Direct compatible variables (<strong className="font-mono">Temp, Volume, Duration</strong>) are projected directly from the running Digital Twin. Variables lacking exact biological equivalence (<strong className="font-mono">Substrate, Oxygen Mode</strong>) require explicit user input.
            </p>
          </div>

          {/* Mapping Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Process Parameter Mapping</h3>

            <div className="space-y-2 text-xs font-mono">
              {/* 1. Temp (Direct) */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">Temperature</div>
                  <div className="text-[10px] text-slate-500">Source: CHO Digital Twin</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-700">{tempVal.toFixed(1)} °C</div>
                  <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5 justify-end">
                    <CheckCircle2 className="w-3 h-3" /> Mapped
                  </span>
                </div>
              </div>

              {/* 2. Reactor Volume (Direct) */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">Reactor Volume</div>
                  <div className="text-[10px] text-slate-500">Source: CHO Digital Twin</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-700">{volVal.toFixed(2)} L</div>
                  <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5 justify-end">
                    <CheckCircle2 className="w-3 h-3" /> Mapped
                  </span>
                </div>
              </div>

              {/* 3. Duration (Derived) */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">Fermentation Duration</div>
                  <div className="text-[10px] text-slate-500">Source: Elapsed Simulation Time</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-700">{durVal.toFixed(1)} h</div>
                  <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5 justify-end">
                    <CheckCircle2 className="w-3 h-3" /> Mapped
                  </span>
                </div>
              </div>

              {/* 4. Substrate (Manual) */}
              <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200 space-y-1.5 font-sans">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <label className="font-bold text-amber-900">Substrate Concentration (g/L)</label>
                    <div className="text-[10px] text-amber-700 font-mono">Dataset 2 microbial feedstock proxy</div>
                  </div>
                  <span className="text-[10px] font-bold text-amber-700 flex items-center gap-0.5">
                    <AlertTriangle className="w-3 h-3 text-amber-600" /> Manual Input
                  </span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={manualSubstrate}
                  onChange={(e) => setManualSubstrate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded text-xs font-mono border border-amber-300 bg-white outline-none focus:border-blue-500"
                />
              </div>

              {/* 5. Oxygen Mode (Manual) */}
              <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200 space-y-1.5 font-sans">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <label className="font-bold text-amber-900">Oxygenation Mode</label>
                    <div className="text-[10px] text-amber-700 font-mono">Dataset 2 binary indicator (Aerobic/Anaerobic)</div>
                  </div>
                  <span className="text-[10px] font-bold text-amber-700 flex items-center gap-0.5">
                    <AlertTriangle className="w-3 h-3 text-amber-600" /> Manual Selection
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setManualOxygen(1.0)}
                    className={`px-3 py-1.5 rounded text-xs font-bold border transition ${
                      manualOxygen === 1.0 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-amber-300'
                    }`}
                  >
                    Aerobic (1.0)
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualOxygen(0.0)}
                    className={`px-3 py-1.5 rounded text-xs font-bold border transition ${
                      manualOxygen === 0.0 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-amber-300'
                    }`}
                  >
                    Anaerobic (0.0)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mapping Summary Badge Bar */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px] font-mono">
            <div className="flex items-center gap-3">
              <span>Compatible Copied: <strong className="text-emerald-700 font-bold">3</strong></span>
              <span className="text-slate-300">|</span>
              <span>Manual Required: <strong className="text-amber-700 font-bold">2</strong></span>
              <span className="text-slate-300">|</span>
              <span>Non-Equivalent: <strong className="text-amber-700 font-bold">2</strong></span>
            </div>
            <span className="text-[10px] text-slate-400">PARTIAL ALIGNMENT</span>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!available || isSubmitting}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 text-white transition ${
                available && !isSubmitting ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Executing Analysis...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Execute AI Analysis
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
