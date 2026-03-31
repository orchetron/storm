/**
 * Common data types for all Storm chart components.
 *
 * Provides consistent data formats for LLM/agent-generated visualizations.
 */

/** A single data point with optional label. */
export interface DataPoint {
  value: number;
  label?: string;
  color?: string | number;
}

/** A data series for multi-series charts (line, area, scatter). */
export interface ChartSeries {
  data: number[];
  name?: string;
  color?: string | number;
}

/** A labeled bar for bar charts. */
export interface BarData {
  label: string;
  value: number;
  color?: string | number;
}

/** A stacked bar with multiple segments. */
export interface StackedBarData {
  label: string;
  segments: { value: number; color?: string | number; name?: string }[];
}

/** Common axis configuration. */
export interface AxisConfig {
  title?: string;
  labels?: string[];
  min?: number;
  max?: number;
  color?: string | number;
}

/** Common chart base props. */
export interface ChartBaseProps {
  width?: number;
  height?: number;
  title?: string;
  showAxes?: boolean;
  showLegend?: boolean;
  axisColor?: string | number;
}
