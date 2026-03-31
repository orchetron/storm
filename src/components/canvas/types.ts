/**
 * Canvas data model — JSON-serializable format for LLM-generated visualizations.
 */

export interface CanvasNode {
  id: string;
  type: "container" | "box" | "text" | "badge" | "divider";
  label?: string;
  sublabel?: string;
  color?: string | number;
  borderColor?: string | number;
  backgroundColor?: string | number;
  borderStyle?: "round" | "single" | "double" | "heavy" | "none";
  direction?: "horizontal" | "vertical";
  gap?: number;
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  width?: number | `${number}%`;
  minWidth?: number;
  flex?: number;
  children?: CanvasNode[];
  status?: "success" | "error" | "warning" | "info" | "running";
  bold?: boolean;
  dim?: boolean;
  icon?: string;
}

export interface CanvasEdge {
  from: string;
  to: string;
  label?: string;
  color?: string | number;
  style?: "solid" | "dashed" | "dotted";
}

export interface CanvasProps {
  nodes: CanvasNode[];
  edges?: CanvasEdge[];
  title?: string;
  direction?: "horizontal" | "vertical";
  width?: number;
  borderStyle?: "round" | "single" | "double" | "heavy" | "none";
  borderColor?: string | number;
  padding?: number;
}
