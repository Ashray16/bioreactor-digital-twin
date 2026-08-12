import { useState } from 'react';
import { BioreactorConfig } from '../../types/simulation';
import { X, Save, RotateCcw } from 'lucide-react';

interface ConfigModalProps {
  config: BioreactorConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: (newConfig: BioreactorConfig) => void;
}

export default function ConfigModal({ config, isOpen, onClose, onSave }: ConfigModalProps) {
  const [formData, setFormData] = useState<BioreactorConfig>({ ...config });

  if (!isOpen) return null;

  const handleChange = (key: keyof BioreactorConfig, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0B0F17] border border-slate-800 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white">Configure Bioreactor &amp; Digital Twin Parameters</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">Working Volume (L)</label>
            <input
              type="number"
              step="0.5"
              value={formData.reactor_volume}
              onChange={(e) => handleChange('reactor_volume', parseFloat(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Target Cell Density (cells/mL)</label>
            <input
              type="number"
              step="1e7"
              value={formData.target_cell_density}
              onChange={(e) => handleChange('target_cell_density', parseFloat(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-cyan-400 font-mono font-bold"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Max Specific Growth Rate μ_max (1/h)</label>
            <input
              type="number"
              step="0.005"
              value={formData.max_growth_rate}
              onChange={(e) => handleChange('max_growth_rate', parseFloat(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Feed Glucose Concentration (g/L)</label>
            <input
              type="number"
              step="0.5"
              value={formData.feed_nutrient_concentration}
              onChange={(e) => handleChange('feed_nutrient_concentration', parseFloat(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Initial Perfusion Rate (VVD)</label>
            <input
              type="number"
              step="0.2"
              value={formData.perfusion_rate}
              onChange={(e) => handleChange('perfusion_rate', parseFloat(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Max Controller Perfusion Limit (VVD)</label>
            <input
              type="number"
              step="0.2"
              value={formData.max_perfusion_rate}
              onChange={(e) => handleChange('max_perfusion_rate', parseFloat(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Simulation Duration (Hours)</label>
            <input
              type="number"
              step="12"
              value={formData.simulation_duration}
              onChange={(e) => handleChange('simulation_duration', parseFloat(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Integration Timestep dt (Hours)</label>
            <input
              type="number"
              step="0.1"
              value={formData.timestep}
              onChange={(e) => handleChange('timestep', parseFloat(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <button
            onClick={() => setFormData({ ...config })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Apply &amp; Re-Initialize</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
