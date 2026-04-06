import React, { useRef } from "react";
import { useColors } from "../../hooks/useColors.js";
import { fmtNum } from "../../utils/format.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { miniSparkline } from "../../utils/sparkline.js";

export interface PerformanceHUDProps {
  visible?: boolean;
  /** Render time of last frame in ms */
  renderTimeMs?: number;
  /** Frames per second */
  fps?: number;
  /** Number of components rendered */
  componentCount?: number;
  /** Number of cells changed in last frame */
  cellsChanged?: number;
  /** Total cells in buffer */
  totalCells?: number;
  /** Memory usage in MB (RSS) */
  memoryMB?: number;
  /** Heap used in MB */
  heapUsedMB?: number;
  /** Heap total in MB */
  heapTotalMB?: number;
  /** GC pressure estimate (0-1) */
  gcPressure?: number;
  /** Cell buffer size in KB */
  bufferKB?: number;
  /** Number of active timers/cleanups */
  activeTimerCount?: number;
  /** Layout computation time in ms */
  layoutMs?: number;
  /** Position */
  position?: "top-right" | "bottom-right" | "top-left" | "bottom-left";
  /** Custom render for each metric row */
  renderMetric?: (label: string, value: string, sparkline: string) => React.ReactNode;
  /** Number of history samples to keep for sparklines (default 20) */
  historySize?: number;
  /** HUD title (default "Storm HUD") */
  title?: string;
}

/**
 * Returns a threshold-based color: good/warn/error.
 * When `invert` is true, values below goodThreshold are good (e.g., render time).
 * When `invert` is false, values above goodThreshold are good (e.g., FPS).
 */
function thresholdColor(
  value: number,
  goodThreshold: number,
  warnThreshold: number,
  invert: boolean,
  colors: import("../../theme/colors.js").StormColors,
): string {
  if (invert) {
    // Lower is better (render time, GC pressure)
    if (value < goodThreshold) return colors.success;
    if (value <= warnThreshold) return colors.warning;
    return colors.error;
  }
  // Higher is better (FPS)
  if (value > goodThreshold) return colors.success;
  if (value >= warnThreshold) return colors.warning;
  return colors.error;
}

const fpsColor = (fps: number, c: import("../../theme/colors.js").StormColors) => thresholdColor(fps, 30, 15, false, c);
const renderTimeColor = (ms: number, c: import("../../theme/colors.js").StormColors) => thresholdColor(ms, 8, 16, true, c);
const gcPressureColor = (pressure: number, c: import("../../theme/colors.js").StormColors) => thresholdColor(pressure, 0.3, 0.7, true, c);

const HISTORY_SIZE = 20;

export const PerformanceHUD = React.memo(function PerformanceHUD(rawProps: PerformanceHUDProps): React.ReactElement | null {
  const colors = useColors();
  const props = usePluginProps("PerformanceHUD", rawProps);
  const {
    visible = true,
    renderTimeMs = 0,
    fps = 0,
    componentCount,
    cellsChanged = 0,
    totalCells = 0,
    memoryMB,
    heapUsedMB,
    heapTotalMB,
    gcPressure,
    bufferKB,
    activeTimerCount,
    layoutMs,
    position = "top-right",
    renderMetric,
    historySize = HISTORY_SIZE,
    title: hudTitle = "Storm HUD",
  } = props;

  // ── History tracking (imperative, no setState) ──────────────────────
  const fpsHistoryRef = useRef<number[]>([]);
  const rtHistoryRef = useRef<number[]>([]);
  const memHistoryRef = useRef<number[]>([]);
  const gcHistoryRef = useRef<number[]>([]);

  if (visible) {
    fpsHistoryRef.current.push(fps);
    if (fpsHistoryRef.current.length > historySize) fpsHistoryRef.current.shift();
    rtHistoryRef.current.push(renderTimeMs);
    if (rtHistoryRef.current.length > historySize) rtHistoryRef.current.shift();
    if (memoryMB !== undefined) {
      memHistoryRef.current.push(memoryMB);
      if (memHistoryRef.current.length > historySize) memHistoryRef.current.shift();
    }
    if (gcPressure !== undefined) {
      gcHistoryRef.current.push(gcPressure * 100);
      if (gcHistoryRef.current.length > historySize) gcHistoryRef.current.shift();
    }
  }

  if (!visible) {
    return null;
  }

  const lines: React.ReactElement[] = [];

  // Line 1: FPS + sparkline + render time + sparkline
  const fpsSparkStr = miniSparkline(fpsHistoryRef.current);
  const rtSparkStr = miniSparkline(rtHistoryRef.current);

  if (renderMetric) {
    lines.push(
      React.createElement(
        "tui-box",
        { key: "line-fps", flexDirection: "row" },
        React.createElement(React.Fragment, { key: "fps-custom" }, renderMetric("FPS", String(fps), fpsSparkStr)),
        React.createElement(React.Fragment, { key: "rt-custom" }, renderMetric("RT", `${renderTimeMs.toFixed(1)}ms`, rtSparkStr)),
      ),
    );
  } else {
    const fpsText = React.createElement(
      "tui-text",
      { key: "fps", color: fpsColor(fps, colors), dim: true },
      `FPS: ${fps}`,
    );
    const fpsSpark = React.createElement(
      "tui-text",
      { key: "fps-spark", color: fpsColor(fps, colors), dim: true },
      ` ${fpsSparkStr}`,
    );
    const rtText = React.createElement(
      "tui-text",
      { key: "rt", color: renderTimeColor(renderTimeMs, colors), dim: true },
      `  RT: ${renderTimeMs.toFixed(1)}ms`,
    );
    const rtSpark = React.createElement(
      "tui-text",
      { key: "rt-spark", color: renderTimeColor(renderTimeMs, colors), dim: true },
      ` ${rtSparkStr}`,
    );
    lines.push(
      React.createElement(
        "tui-box",
        { key: "line-fps", flexDirection: "row" },
        fpsText,
        fpsSpark,
        rtText,
        rtSpark,
      ),
    );
  }

  // Line 2: Cells changed / total
  lines.push(
    React.createElement(
      "tui-text",
      { key: "line-cells", dim: true, color: colors.text.dim },
      `Cells: ${fmtNum(cellsChanged)}/${fmtNum(totalCells)}`,
    ),
  );

  // Line 3: Memory — RSS / Heap Used / Heap Total with sparkline
  if (memoryMB !== undefined) {
    const memSparkStr = miniSparkline(memHistoryRef.current);
    const heapInfo = heapUsedMB !== undefined && heapTotalMB !== undefined
      ? `  Heap: ${heapUsedMB.toFixed(1)}/${heapTotalMB.toFixed(1)}MB`
      : "";
    lines.push(
      React.createElement(
        "tui-box",
        { key: "line-mem", flexDirection: "row" },
        React.createElement(
          "tui-text",
          { key: "mem-label", dim: true, color: colors.text.dim },
          `RSS: ${memoryMB.toFixed(1)}MB${heapInfo}`,
        ),
        React.createElement(
          "tui-text",
          { key: "mem-spark", dim: true, color: colors.text.dim },
          ` ${memSparkStr}`,
        ),
      ),
    );
  }

  // Line 4: GC Pressure with sparkline and color coding
  if (gcPressure !== undefined) {
    const gcSparkStr = miniSparkline(gcHistoryRef.current);
    const gcPct = (gcPressure * 100).toFixed(0);
    lines.push(
      React.createElement(
        "tui-box",
        { key: "line-gc", flexDirection: "row" },
        React.createElement(
          "tui-text",
          { key: "gc-label", dim: true, color: gcPressureColor(gcPressure, colors) },
          `GC: ${gcPct}%`,
        ),
        React.createElement(
          "tui-text",
          { key: "gc-spark", dim: true, color: gcPressureColor(gcPressure, colors) },
          ` ${gcSparkStr}`,
        ),
      ),
    );
  }

  // Line 5: Buffer size in KB
  if (bufferKB !== undefined) {
    lines.push(
      React.createElement(
        "tui-text",
        { key: "line-buf", dim: true, color: colors.text.dim },
        `Buffer: ${bufferKB.toFixed(1)}KB`,
      ),
    );
  }

  // Line 6: Active timer count
  if (activeTimerCount !== undefined) {
    lines.push(
      React.createElement(
        "tui-text",
        { key: "line-timers", dim: true, color: colors.text.dim },
        `Timers: ${activeTimerCount}`,
      ),
    );
  }

  // Line 7: Layout computation time
  if (layoutMs !== undefined) {
    lines.push(
      React.createElement(
        "tui-text",
        { key: "line-layout", dim: true, color: renderTimeColor(layoutMs, colors) },
        `Layout: ${layoutMs.toFixed(1)}ms`,
      ),
    );
  }

  // Line 8: Component count (if provided)
  if (componentCount !== undefined) {
    lines.push(
      React.createElement(
        "tui-text",
        { key: "line-comp", dim: true, color: colors.text.dim },
        `Components: ${componentCount}`,
      ),
    );
  }

  // Position as alignment hints — the parent is expected to position
  // this overlay; we provide alignSelf hints.
  const isRight = position === "top-right" || position === "bottom-right";

  const boxProps: Record<string, unknown> = {
    flexDirection: "column",
    borderStyle: "round",
    borderColor: colors.text.dim,
    paddingLeft: 1,
    paddingRight: 1,
    ...(isRight ? { alignSelf: "flex-end" as const } : {}),
  };

  // Title rendered via border — use a box with the title above content
  const titleLine = React.createElement(
    "tui-text",
    { key: "title", bold: true, dim: true, color: colors.brand.primary },
    hudTitle,
  );

  return React.createElement(
    "tui-box",
    boxProps,
    titleLine,
    ...lines,
  );
});
