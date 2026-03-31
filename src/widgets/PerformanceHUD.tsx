/**
 * PerformanceHUD — real-time performance profiler overlay.
 *
 * Developer tool for debugging rendering performance.
 * Renders a compact bordered box showing FPS, render time, cell diff count,
 * and memory usage. FPS is color-coded: green >30, amber 15-30, red <15.
 * Render time color-coded: green <8ms, amber 8-16ms, red >16ms.
 * Uses dim styling to avoid distracting from the main UI.
 *
 * @module
 */

import React, { useRef } from "react";
import { useColors } from "../hooks/useColors.js";
import { fmtNum } from "../utils/format.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

// ── Types ────────────────────────────────────────────────────────────

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
  /** Memory usage in MB */
  memoryMB?: number;
  /** Position */
  position?: "top-right" | "bottom-right" | "top-left" | "bottom-left";
  /** Custom render for each metric row */
  renderMetric?: (label: string, value: string, sparkline: string) => React.ReactNode;
  /** Number of history samples to keep for sparklines (default 20) */
  historySize?: number;
  /** HUD title (default "Storm HUD") */
  title?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function fpsColor(fps: number, colors: import("../theme/colors.js").StormColors): string {
  if (fps > 30) return colors.success;
  if (fps >= 15) return colors.warning;
  return colors.error;
}

function renderTimeColor(ms: number, colors: import("../theme/colors.js").StormColors): string {
  if (ms < 8) return colors.success;
  if (ms <= 16) return colors.warning;
  return colors.error;
}

// PerformanceHUD uses a slightly different threshold (10K vs 1K) for K suffix,
// but we unify on the shared fmtNum for consistency.
const formatNum = fmtNum;

const SPARK_CHARS = ["\u2581", "\u2582", "\u2583", "\u2584", "\u2585", "\u2586", "\u2587", "\u2588"];
const HISTORY_SIZE = 20;

function miniSparkline(data: number[]): string {
  if (data.length === 0) return "";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  return data
    .map((v) => {
      const idx = Math.min(SPARK_CHARS.length - 1, Math.floor(((v - min) / range) * (SPARK_CHARS.length - 1)));
      return SPARK_CHARS[idx]!;
    })
    .join("");
}

// ── Component ────────────────────────────────────────────────────────

export const PerformanceHUD = React.memo(function PerformanceHUD(rawProps: PerformanceHUDProps): React.ReactElement | null {
  const colors = useColors();
  const props = usePluginProps("PerformanceHUD", rawProps as unknown as Record<string, unknown>) as unknown as PerformanceHUDProps;
  const {
    visible = true,
    renderTimeMs = 0,
    fps = 0,
    componentCount,
    cellsChanged = 0,
    totalCells = 0,
    memoryMB,
    position = "top-right",
    renderMetric,
    historySize = HISTORY_SIZE,
    title: hudTitle = "Storm HUD",
  } = props;

  // ── History tracking (imperative, no setState) ──────────────────────
  const fpsHistoryRef = useRef<number[]>([]);
  const rtHistoryRef = useRef<number[]>([]);

  if (visible) {
    // Push current values and trim to historySize
    fpsHistoryRef.current.push(fps);
    if (fpsHistoryRef.current.length > historySize) fpsHistoryRef.current.shift();
    rtHistoryRef.current.push(renderTimeMs);
    if (rtHistoryRef.current.length > historySize) rtHistoryRef.current.shift();
  }

  if (!visible) {
    return null;
  }

  // Build lines
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
      `Cells: ${formatNum(cellsChanged)}/${formatNum(totalCells)}`,
    ),
  );

  // Line 3: Memory (if provided)
  if (memoryMB !== undefined) {
    lines.push(
      React.createElement(
        "tui-text",
        { key: "line-mem", dim: true, color: colors.text.dim },
        `Mem: ${memoryMB.toFixed(1)} MB`,
      ),
    );
  }

  // Line 4: Component count (if provided)
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
