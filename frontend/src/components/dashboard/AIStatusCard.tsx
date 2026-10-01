import { useState } from 'react';
import { useAI } from '../../context/AIContext';
import { DATA_STATE_BADGES } from '../../types/ai';
import { BioreactorState } from '../../types/simulation';
import AIContextBridgeModal from './AIContextBridgeModal';
import { Cpu, Database, CheckCircle2, AlertCircle, Loader2, ArrowRight, Sparkles, Clock, Info, RotateCcw } from 'lucide-react';

interface AIStatusCardProps {
  state?: BioreactorState;
  onNavigateToAI?: () => void;
}

export default function AIStatusCard({ state, onNavigateToAI }: AIStatusCardProps) {
  const { available, loading, error, modelInfo, modelPerformance, analysisHistory, refreshAIModelStatus } = useAI();
  const [isBridgeModalOpen, setIsBridgeModalOpen] = useState(false);

  const mechBadge = DATA_STATE_BADGES['MECHANISTIC'];
  const aiBadge = DATA_STATE_BADGES['AI PREDICTION'];
  const histBadge = DATA_STATE_BADGES['HISTORICAL'];

  const latestAnalysis = analysisHistory.length > 0 ? analysisHistory[0] : null;

  return (
    <div className="glass-panel p-5 rounded-xl border border-slate-200 bg-white space-y-4 shadow-sm">
      {/* Header with Title & Dual Intelligence Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">Digital Twin Intelligence</h3>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Mechanistic CHO simulation + auxiliary data-driven process intelligence
          </p>
        </div>

        {/* Data Category Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${mechBadge.bgColor} ${mechBadge.textColor} ${mechBadge.borderColor}`}
            title={mechBadge.description}
          >
            {mechBadge.label}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${aiBadge.bgColor} ${aiBadge.textColor} ${aiBadge.borderColor}`}
            title={aiBadge.description}
          >
            AUXILIARY AI
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${histBadge.bgColor} ${histBadge.textColor} ${histBadge.borderColor}`}
            title={histBadge.description}
          >
            {histBadge.label}
          </span>
        </div>
      </div>

      {/* Main Content Area based on Service State */}
      {loading ? (
        <div className="py-4 flex items-center justify-center gap-2 text-xs text-slate-500 font-mono">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          Loading AI model status &amp; metadata...
        </div>
      ) : available && modelInfo && modelPerformance ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Column 1: Model Provenance */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Status:
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                  ● Available
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Model:</span>
                <strong className="text-slate-800">{modelInfo.algorithm}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Version:</span>
                <strong className="text-slate-800 font-mono">{modelInfo.model_version}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Target:</span>
                <strong className="text-slate-800 font-mono">{modelInfo.target} ({modelInfo.target_unit})</strong>
              </div>
            </div>

            {/* Column 2: Dataset Provenance */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1.5">
              <div className="font-bold text-slate-700 flex items-center gap-1 mb-1">
                <Database className="w-3.5 h-3.5 text-blue-600" /> Training Dataset:
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Source:</span>
                <strong className="text-slate-800 truncate max-w-[120px]" title={modelInfo.dataset}>
                  {modelInfo.dataset}
                </strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Observations:</span>
                <strong className="text-slate-800 font-mono">{modelInfo.dataset_observations.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Literature Studies:</span>
                <strong className="text-slate-800 font-mono">{modelInfo.dataset_papers} papers</strong>
              </div>
            </div>

            {/* Column 3: Paper-Aware Test Metrics */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1.5">
              <div className="font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>Test Performance:</span>
                <span className="text-[10px] text-slate-400 font-normal">Paper-Aware</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-center font-mono">
                <div className="p-1 rounded bg-white border border-slate-200">
                  <div className="text-[10px] text-slate-400">Test R²</div>
                  <div className="font-bold text-emerald-700">{modelPerformance.test_metrics.r2.toFixed(3)}</div>
                </div>
                <div className="p-1 rounded bg-white border border-slate-200">
                  <div className="text-[10px] text-slate-400">Test MAE</div>
                  <div className="font-bold text-slate-800">{modelPerformance.test_metrics.mae.toFixed(2)}</div>
                </div>
                <div className="p-1 rounded bg-white border border-slate-200">
                  <div className="text-[10px] text-slate-400">MedAE</div>
                  <div className="font-bold text-blue-700">{modelPerformance.test_metrics.medae.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Model Compatibility & Advisory Role Notice */}
          <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-0.5">
              <div className="font-bold">AI Model Compatibility &amp; Role</div>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                <strong>Dataset:</strong> Oyetunde et al. bioprocess literature • <strong>Direct CHO Compatibility:</strong> No • <strong>Role:</strong> Auxiliary Process Intelligence (Advisory only — does not modify CHO control parameters).
              </p>
            </div>
          </div>

          {/* Latest Analysis History Record (if available) */}
          {latestAnalysis && (
            <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900 font-mono">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>
                  Latest Auxiliary AI Titer Estimate (t={latestAnalysis.simulationTime.toFixed(1)}h): <strong>{latestAnalysis.prediction.prediction.toFixed(2)} g/L</strong>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 font-bold">
                  Source: {latestAnalysis.source}
                </span>
              </div>
              <span className="text-[10px] text-emerald-700">{latestAnalysis.timestamp}</span>
            </div>
          )}
        </div>
      ) : (
        /* Graceful Degraded Offline / Unavailable State */
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <div>
              <div className="font-bold">AI Process Intelligence Unavailable</div>
              <p className="text-[11px] text-amber-700 mt-0.5">
                {error || 'Auxiliary AI model service is currently offline.'} The CHO Mechanistic Digital Twin remains fully operational.
              </p>
            </div>
            <button
              onClick={() => refreshAIModelStatus()}
              className="flex items-center gap-1.5 px-3 py-1 rounded border border-amber-300 bg-amber-100 hover:bg-amber-200/80 text-amber-900 font-bold transition text-[10px]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
          </div>
        </div>
      )}

      {/* Footer Explanation & Navigation / Context Bridge Link */}
      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-500">
        <p className="leading-relaxed">
          The AI layer provides auxiliary process intelligence from historical bioprocess data. The CHO mechanistic model remains the primary digital-twin state engine.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {state && available && (
            <button
              onClick={() => setIsBridgeModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" /> Analyze Current Context
            </button>
          )}
          {onNavigateToAI && available && (
            <button
              onClick={onNavigateToAI}
              className="flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800 transition"
            >
              Open AI Intelligence <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Modal Dialog for Contextual AI Analysis */}
      {state && (
        <AIContextBridgeModal
          state={state}
          isOpen={isBridgeModalOpen}
          onClose={() => setIsBridgeModalOpen(false)}
          onSuccess={() => {
            if (onNavigateToAI) onNavigateToAI();
          }}
        />
      )}
    </div>
  );
}
