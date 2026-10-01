export type Status = 'optimal' | 'normal' | 'warning' | 'critical';

const defaultLabels: Record<Status, string> = {
  optimal: 'Normal',
  normal: 'Normal',
  warning: 'Warning',
  critical: 'Alarm',
};

interface StatusBadgeProps {
  status: Status;
  label?: string;
  className?: string;
  showNormal?: boolean;
}

/**
 * StatusBadge: Process-control status indicator.
 * Stays visually quiet (neutral dot or hidden) when within normal operating parameters.
 * Only draws colored attention when a parameter is in Warning or Alarm/Critical state.
 */
export function StatusBadge({ status, label, className = '', showNormal = false }: StatusBadgeProps) {
  const displayLabel = label || defaultLabels[status];

  if (status === 'critical') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
        <span>{displayLabel}</span>
      </span>
    );
  }

  if (status === 'warning') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
        <span>{displayLabel}</span>
      </span>
    );
  }

  if (!showNormal) {
    return null;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] text-slate-500 ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
      <span>{displayLabel}</span>
    </span>
  );
}

interface MetaTagProps {
  label: string;
  className?: string;
}

/**
 * MetaTag: Subtle, low-contrast technical tag (Linear / Grafana style).
 */
export function MetaTag({ label, className = '' }: MetaTagProps) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border border-slate-200 bg-slate-50 text-slate-600 tracking-wide whitespace-nowrap ${className}`}
    >
      {label}
    </span>
  );
}

interface GoalProgressProps {
  currentPercent: number;
  label?: string;
  className?: string;
}

/**
 * GoalProgress: Replaces status-pill misuse for "X% Target".
 * Renders an inline visual progress indicator near the metric itself.
 */
export function GoalProgress({
  currentPercent,
  label = 'of target',
  className = '',
}: GoalProgressProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(currentPercent)));
  return (
    <div className={`flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-medium ${className}`}>
      <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 shrink-0">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${Math.max(2, clamped)}%` }}
        />
      </div>
      <span className="font-mono text-slate-600 text-[11px] font-semibold">
        {clamped}% {label}
      </span>
    </div>
  );
}
