export interface TimeSeriesDataPoint {
  time: number;
  [key: string]: any;
}

export interface EventMarker {
  time: number;
  type: 'PROCESS' | 'CONTROL' | 'FAULT' | 'AI';
  label: string;
  description?: string;
}

/**
 * A single vertical marker that represents one or more EventMarkers
 * that fell within the same ±0.25 h grouping window.
 * The underlying `events` array preserves all original event detail.
 */
export interface CompositeEventMarker {
  /** Representative timestamp (earliest event in the group) */
  time: number;
  /** All unique event types present in this group */
  types: Array<'PROCESS' | 'CONTROL' | 'FAULT' | 'AI'>;
  /** Short summary label */
  label: string;
  /** True when more than one source event was merged */
  isComposite: boolean;
  /** All source events — preserved in full for tooltip display */
  events: EventMarker[];
}

export interface OperatingEnvelope {
  yMin?: number;
  yMax?: number;
  color?: string; // background color for shaded band
  label?: string;
}

export interface SeriesConfig {
  key: string;
  name: string;
  stroke: string;
  type?: 'monotone' | 'linear' | 'step' | 'stepAfter';
  strokeDasharray?: string;
  unit?: string;
}

export type DistributionType = 'histogram' | 'boxplot';

export interface DistributionSeries {
  key: string;
  label: string;
  values: number[];
  unit?: string;
  metadata?: Record<string, string | number>;
}
