export interface DataPoint {
  value: number;
  label?: string;
  color?: string | number;
}

export interface ChartSeries {
  data: number[];
  name?: string;
  color?: string | number;
}

export interface BarData {
  label: string;
  value: number;
  color?: string | number;
}

export interface StackedBarData {
  label: string;
  segments: { value: number; color?: string | number; name?: string }[];
}

export interface AxisConfig {
  title?: string;
  labels?: string[];
  min?: number;
  max?: number;
  color?: string | number;
}

export interface ChartBaseProps {
  width?: number;
  height?: number;
  title?: string;
  showAxes?: boolean;
  showLegend?: boolean;
  axisColor?: string | number;
}
