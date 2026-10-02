import {
  Maximize2,
  Minimize2,
  Download,
  RotateCcw,
  Bell,
  BellOff
} from 'lucide-react';

interface ChartToolbarProps {
  isMaximized: boolean;
  onToggleMaximize: () => void;
  isZoomed: boolean;
  onResetZoom: () => void;
  showEvents: boolean;
  onToggleEvents: () => void;
  onExportCSV: () => void;
  timeRange: string;
  onChangeTimeRange: (range: string) => void;
  availableRanges?: string[];
}

export default function ChartToolbar({
  isMaximized,
  onToggleMaximize,
  isZoomed,
  onResetZoom,
  showEvents,
  onToggleEvents,
  onExportCSV,
  timeRange,
  onChangeTimeRange,
  availableRanges = ['12H', '24H', '48H', 'ALL'],
}: ChartToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/80 p-2 rounded-lg border border-slate-100 text-xs">
      {/* Time Range Selector */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-slate-600 font-mono mr-1">RANGE:</span>
        <div className="flex bg-slate-200/60 p-0.5 rounded-md">
          {availableRanges.map((range) => (
            <button
              key={range}
              onClick={() => onChangeTimeRange(range)}
              aria-label={`Show ${range === 'ALL' ? 'all' : range} simulation time range`}
              className={`px-2.5 py-1 rounded-sm text-[11px] font-bold transition-all ${
                timeRange === range
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-1.5 ml-auto">
        {/* Reset Zoom Button */}
        {isZoomed && (
          <button
            onClick={onResetZoom}
            title="Reset Zoom"
            aria-label="Reset chart zoom to default scale"
            className="flex items-center gap-1 px-2 py-1 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Zoom</span>
          </button>
        )}

        {/* Event Markers Toggle */}
        <button
          onClick={onToggleEvents}
          title={showEvents ? 'Hide Process Events' : 'Show Process Events'}
          aria-label={showEvents ? 'Hide process event markers on chart' : 'Show process event markers on chart'}
          className={`flex items-center gap-1 px-2.5 py-1 rounded border transition font-bold ${
            showEvents
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {showEvents ? <Bell className="w-3.5 h-3.5 text-blue-600" /> : <BellOff className="w-3.5 h-3.5 text-slate-400" />}
          <span>Events</span>
        </button>

        {/* CSV Export Button */}
        <button
          onClick={onExportCSV}
          title="Export CSV"
          aria-label="Export chart telemetry data as raw CSV"
          className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 font-bold transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>

        {/* Maximize / Minimize Button */}
        <button
          onClick={onToggleMaximize}
          title={isMaximized ? 'Minimize Chart' : 'Maximize Chart'}
          aria-label={isMaximized ? 'Restore chart to dashboard layout' : 'Maximize chart to full screen overlay'}
          className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 font-bold transition"
        >
          {isMaximized ? (
            <>
              <Minimize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Restore</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Maximize</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
