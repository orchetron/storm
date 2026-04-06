import React, { useRef } from "react";
import { useColors } from "../../hooks/useColors.js";
import { BrailleCanvas } from "../../utils/braille-canvas.js";
import { useInput } from "../../hooks/useInput.js";
import { useTui } from "../../context/TuiContext.js";
import type { StormLayoutStyleProps } from "../../styles/styleProps.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { formatAxisLabel, getSeriesPalette, composeBrailleCells } from "../../utils/chart-helpers.js";
import { pickLayoutProps } from "../../styles/applyStyles.js";
import { batchColorRuns } from "../../utils/color.js";

export interface ScatterPlotSeries {
  data: [number, number][];
  name?: string;
  color?: string | number;
}

export interface ScatterPlotProps extends StormLayoutStyleProps {
  series: ScatterPlotSeries[];
  /** Override: must be numeric for chart cell column calculation. */
  width?: number;
  /** Override: must be numeric for chart cell row calculation. */
  height?: number;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  showAxes?: boolean;
  showLegend?: boolean;
  axisColor?: string | number;
  title?: string;
  /** Dot size: 1 = single dot, 2 = 2x2 cluster. */
  dotSize?: 1 | 2;
  /** When true, compute and display a linear regression trend line. */
  showTrend?: boolean;
  /** When true, enable interactive mode. */
  interactive?: boolean;
  /** Whether this chart is currently focused (required for interactive/zoomable mode). */
  isFocused?: boolean;
  /** When true, enable zoom (+/-) and pan (arrow keys). Requires interactive+isFocused. */
  zoomable?: boolean;
  /** Custom renderer for a tooltip (not yet connected to cursor — placeholder for future interactive hover). */
  renderTooltip?: (point: [number, number], seriesIndex: number) => React.ReactNode;
}

interface LinearRegression {
  slope: number;
  intercept: number;
  rSquared: number;
}

/**
 * Compute simple linear regression (least squares) across all data points
 * from all series. Returns slope, intercept, and R-squared coefficient.
 */
function computeLinearRegression(allPoints: [number, number][]): LinearRegression | null {
  const n = allPoints.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;

  for (const [x, y] of allPoints) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
    sumYY += y * y;
  }

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R-squared: coefficient of determination
  const meanY = sumY / n;
  let ssRes = 0;
  let ssTot = 0;
  for (const [x, y] of allPoints) {
    const predicted = slope * x + intercept;
    ssRes += (y - predicted) ** 2;
    ssTot += (y - meanY) ** 2;
  }

  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, rSquared };
}

const Y_GUTTER_WIDTH = 7; // chars reserved for Y-axis labels + border

export const ScatterPlot = React.memo(function ScatterPlot(rawProps: ScatterPlotProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("ScatterPlot", rawProps);
  const {
    series,
    width: cellWidth = 60,
    height: cellHeight = 10,
    showAxes = true,
    axisColor: axisColorProp,
    title,
    dotSize = 1,
    showTrend = false,
    interactive = false,
    isFocused = false,
    zoomable = false,
  } = props;

  const axisColor = axisColorProp ?? colors.text.dim;
  const SERIES_PALETTE = getSeriesPalette(colors);
  const showLegend = props.showLegend ?? (series.length > 1);
  const { requestRender } = useTui();

  // ── Zoom/pan state (imperative refs) ───
  const zoomXMinRef = useRef<number | null>(null);
  const zoomXMaxRef = useRef<number | null>(null);
  const zoomYMinRef = useRef<number | null>(null);
  const zoomYMaxRef = useRef<number | null>(null);

  const zoomPanActive = zoomable && interactive && isFocused;

  // ── Validate inputs ───────────────────────────────────────────

  if (series.length === 0 || series.every((s) => s.data.length === 0)) {
    return React.createElement(
      "tui-text",
      { color: colors.text.dim },
      "(no data)",
    );
  }

  // ── Compute chart area dimensions ─────────────────────────────

  const gutterWidth = showAxes ? Y_GUTTER_WIDTH : 0;
  const chartCols = Math.max(1, cellWidth - gutterWidth);
  const chartRows = Math.max(1, cellHeight);
  const pixelWidth = chartCols * 2;
  const pixelHeight = chartRows * 4;

  // ── Determine X and Y ranges across all series ────────────────

  let dataXMin = props.xMin ?? Infinity;
  let dataXMax = props.xMax ?? -Infinity;
  let dataYMin = props.yMin ?? Infinity;
  let dataYMax = props.yMax ?? -Infinity;

  for (const s of series) {
    for (const [x, y] of s.data) {
      if (props.xMin === undefined && x < dataXMin) dataXMin = x;
      if (props.xMax === undefined && x > dataXMax) dataXMax = x;
      if (props.yMin === undefined && y < dataYMin) dataYMin = y;
      if (props.yMax === undefined && y > dataYMax) dataYMax = y;
    }
  }

  if (dataXMin === dataXMax) { dataXMin -= 1; dataXMax += 1; }
  if (dataYMin === dataYMax) { dataYMin -= 1; dataYMax += 1; }
  if (!Number.isFinite(dataXMin)) dataXMin = 0;
  if (!Number.isFinite(dataXMax)) dataXMax = 1;
  if (!Number.isFinite(dataYMin)) dataYMin = 0;
  if (!Number.isFinite(dataYMax)) dataYMax = 1;

  let xMin = zoomXMinRef.current ?? dataXMin;
  let xMax = zoomXMaxRef.current ?? dataXMax;
  let yMin = zoomYMinRef.current ?? dataYMin;
  let yMax = zoomYMaxRef.current ?? dataYMax;

  if (xMin >= xMax) { xMin = dataXMin; xMax = dataXMax; }
  if (yMin >= yMax) { yMin = dataYMin; yMax = dataYMax; }

  const xRange = xMax - xMin;
  const yRange = yMax - yMin;

  // ── Zoom/pan input handling ───
  useInput(
    (event) => {
      if (!zoomPanActive) return;

      const curXMin = zoomXMinRef.current ?? dataXMin;
      const curXMax = zoomXMaxRef.current ?? dataXMax;
      const curYMin = zoomYMinRef.current ?? dataYMin;
      const curYMax = zoomYMaxRef.current ?? dataYMax;
      const curXRange = curXMax - curXMin;
      const curYRange = curYMax - curYMin;

      if (event.char === "+" || event.char === "=") {
        // Zoom in: narrow both X and Y ranges around center
        const xCenter = (curXMin + curXMax) / 2;
        const yCenter = (curYMin + curYMax) / 2;
        const newXHalf = curXRange * 0.3;
        const newYHalf = curYRange * 0.3;
        zoomXMinRef.current = xCenter - newXHalf;
        zoomXMaxRef.current = xCenter + newXHalf;
        zoomYMinRef.current = yCenter - newYHalf;
        zoomYMaxRef.current = yCenter + newYHalf;
        requestRender();
      } else if (event.char === "-") {
        // Zoom out: widen both X and Y ranges
        const xCenter = (curXMin + curXMax) / 2;
        const yCenter = (curYMin + curYMax) / 2;
        const newXHalf = curXRange / 0.6 / 2;
        const newYHalf = curYRange / 0.6 / 2;
        zoomXMinRef.current = xCenter - newXHalf;
        zoomXMaxRef.current = xCenter + newXHalf;
        zoomYMinRef.current = yCenter - newYHalf;
        zoomYMaxRef.current = yCenter + newYHalf;
        requestRender();
      } else if (event.char === "0") {
        zoomXMinRef.current = null;
        zoomXMaxRef.current = null;
        zoomYMinRef.current = null;
        zoomYMaxRef.current = null;
        requestRender();
      } else if (event.key === "left") {
        // Pan left
        const shift = curXRange * 0.1;
        zoomXMinRef.current = curXMin - shift;
        zoomXMaxRef.current = curXMax - shift;
        requestRender();
      } else if (event.key === "right") {
        // Pan right
        const shift = curXRange * 0.1;
        zoomXMinRef.current = curXMin + shift;
        zoomXMaxRef.current = curXMax + shift;
        requestRender();
      } else if (event.key === "up") {
        // Pan up (increase Y values shown)
        const shift = curYRange * 0.1;
        zoomYMinRef.current = curYMin + shift;
        zoomYMaxRef.current = curYMax + shift;
        requestRender();
      } else if (event.key === "down") {
        // Pan down (decrease Y values shown)
        const shift = curYRange * 0.1;
        zoomYMinRef.current = curYMin - shift;
        zoomYMaxRef.current = curYMax - shift;
        requestRender();
      }
    },
    { isActive: zoomPanActive },
  );

  // ── Map data to pixel coordinates ─────────────────────────────

  const toPixelX = (value: number): number => {
    const normalized = (value - xMin) / xRange;
    return Math.round(normalized * (pixelWidth - 1));
  };

  const toPixelY = (value: number): number => {
    const normalized = (value - yMin) / yRange;
    return Math.round((1 - normalized) * (pixelHeight - 1));
  };

  // ── Compute trend line ─────────────────────────────────────────

  let regression: LinearRegression | null = null;
  if (showTrend) {
    const allPoints: [number, number][] = [];
    for (const s of series) {
      for (const pt of s.data) {
        allPoints.push(pt);
      }
    }
    regression = computeLinearRegression(allPoints);
  }

  // ── Render trend line onto its own canvas ──────────────────────

  let trendCanvas: BrailleCanvas | undefined;
  if (regression !== null) {
    trendCanvas = new BrailleCanvas(chartCols, chartRows);
    // Draw trend line as dashed: set dots at regular intervals with gaps
    const steps = pixelWidth * 2; // Fine-grained stepping for smooth line
    for (let step = 0; step < steps; step++) {
      // Create dashed effect: draw 3 dots, skip 3
      const dashPhase = step % 6;
      if (dashPhase >= 3) continue; // gap portion

      const t = step / (steps - 1);
      const dataX = xMin + t * xRange;
      const dataY = regression.slope * dataX + regression.intercept;
      const px = toPixelX(dataX);
      const py = toPixelY(dataY);
      trendCanvas.set(px, py);
    }
  }

  // ── Render each series onto its own canvas ────────────────────

  const canvases: { canvas: BrailleCanvas; color: string | number }[] = [];

  // Add trend line as bottom layer (behind data)
  if (trendCanvas) {
    canvases.push({ canvas: trendCanvas, color: colors.text.dim });
  }

  for (let si = 0; si < series.length; si++) {
    const s = series[si]!;
    if (s.data.length === 0) continue;

    const seriesColor = s.color ?? SERIES_PALETTE[si % SERIES_PALETTE.length]!;
    const canvas = new BrailleCanvas(chartCols, chartRows);

    for (const [x, y] of s.data) {
      const px = toPixelX(x);
      const py = toPixelY(y);

      canvas.set(px, py);

      if (dotSize === 2) {
        // 2x2 cluster for better visibility
        canvas.set(px + 1, py);
        canvas.set(px, py + 1);
        canvas.set(px + 1, py + 1);
      }
    }

    canvases.push({ canvas, color: seriesColor });
  }

  // ── Compose rendered lines ────────────────────────────────────

  const renderedCanvases = canvases.map((c) => ({
    lines: c.canvas.render(),
    color: c.color,
  }));

  const rows: React.ReactElement[] = [];

  // ── Title row ─────────────────────────────────────────────────

  if (title !== undefined) {
    rows.push(
      React.createElement(
        "tui-box",
        { key: "title", flexDirection: "row" },
        React.createElement(
          "tui-text",
          { bold: true, color: colors.text.primary },
          showAxes ? " ".repeat(gutterWidth) + title : title,
        ),
      ),
    );
  }

  // ── Chart rows ────────────────────────────────────────────────

  for (let r = 0; r < chartRows; r++) {
    const rowChildren: React.ReactElement[] = [];

    // Y-axis gutter
    if (showAxes) {
      let label = "";
      if (r === 0) {
        label = formatAxisLabel(yMax, gutterWidth - 2);
      } else if (r === chartRows - 1) {
        label = formatAxisLabel(yMin, gutterWidth - 2);
      } else if (r === Math.floor(chartRows / 2)) {
        label = formatAxisLabel(yMin + yRange / 2, gutterWidth - 2);
      } else {
        label = " ".repeat(gutterWidth - 2);
      }

      rowChildren.push(
        React.createElement(
          "tui-text",
          { key: "y-label", color: axisColor },
          label + " \u2502",
        ),
      );
    }

    // Composite character by character
    if (canvases.length === 1) {
      rowChildren.push(
        React.createElement(
          "tui-text",
          { key: "data", color: renderedCanvases[0]!.color },
          renderedCanvases[0]!.lines[r]!,
        ),
      );
    } else {
      const { cellChars, cellColors } = composeBrailleCells(renderedCanvases, chartCols, r);

      rowChildren.push(...batchColorRuns(cellChars, cellColors as (string | number)[], "s"));
    }

    rows.push(
      React.createElement(
        "tui-box",
        { key: `row-${r}`, flexDirection: "row" },
        ...rowChildren,
      ),
    );
  }

  // ── X-axis line and labels ────────────────────────────────────

  if (showAxes) {
    const xAxisLine = " ".repeat(gutterWidth - 1) + "\u2514" + "\u2500".repeat(chartCols);
    rows.push(
      React.createElement(
        "tui-text",
        { key: "x-axis", color: axisColor },
        xAxisLine,
      ),
    );

    // X-axis numeric labels (min, mid, max) — trimStart since formatAxisLabel right-pads
    const xMinLabel = formatAxisLabel(xMin, 8).trimStart();
    const xMidLabel = formatAxisLabel(xMin + xRange / 2, 8).trimStart();
    const xMaxLabel = formatAxisLabel(xMax, 8).trimStart();

    const midPos = Math.max(0, Math.floor(chartCols / 2) - Math.floor(xMidLabel.length / 2));
    const maxPos = Math.max(0, chartCols - xMaxLabel.length);

    let xLabelLine = " ".repeat(gutterWidth);
    // Place min label
    xLabelLine += xMinLabel;
    // Pad to mid position
    const afterMin = xMinLabel.length;
    if (midPos > afterMin) {
      xLabelLine += " ".repeat(midPos - afterMin);
      xLabelLine += xMidLabel;
    }
    // Pad to max position
    const currentLen = xLabelLine.length - gutterWidth;
    if (maxPos > currentLen) {
      xLabelLine += " ".repeat(maxPos - currentLen);
      xLabelLine += xMaxLabel;
    }

    rows.push(
      React.createElement(
        "tui-text",
        { key: "x-labels", color: axisColor },
        xLabelLine,
      ),
    );
  }

  // ── Legend ─────────────────────────────────────────────────────

  if (showLegend || (showTrend && regression !== null)) {
    const legendChildren: React.ReactElement[] = [];
    const pad = showAxes ? " ".repeat(gutterWidth) : "";

    for (let si = 0; si < series.length; si++) {
      const s = series[si]!;
      if (s.data.length === 0) continue;

      const seriesColor = s.color ?? SERIES_PALETTE[si % SERIES_PALETTE.length]!;
      const name = s.name ?? `Series ${si + 1}`;
      const separator = si > 0 ? "  " : pad;

      if (si > 0) {
        legendChildren.push(
          React.createElement("tui-text", { key: `sep-${si}` }, separator),
        );
      } else {
        legendChildren.push(
          React.createElement("tui-text", { key: "pad" }, pad),
        );
      }

      legendChildren.push(
        React.createElement(
          "tui-text",
          { key: `dot-${si}`, color: seriesColor },
          "\u25CF ",
        ),
      );
      legendChildren.push(
        React.createElement(
          "tui-text",
          { key: `name-${si}`, color: colors.text.secondary },
          name,
        ),
      );
    }

    // Add trend line info to legend
    if (showTrend && regression !== null) {
      const trendSep = series.length > 0 ? "  " : pad;
      legendChildren.push(
        React.createElement("tui-text", { key: "trend-sep" }, trendSep),
      );
      legendChildren.push(
        React.createElement(
          "tui-text",
          { key: "trend-dot", color: colors.text.dim },
          "\u2504 ", // ┄ dashed line symbol
        ),
      );
      legendChildren.push(
        React.createElement(
          "tui-text",
          { key: "trend-label", color: colors.text.secondary },
          `Trend (R\u00B2=${regression.rSquared.toFixed(3)})`,
        ),
      );
    }

    rows.push(
      React.createElement(
        "tui-box",
        { key: "legend", flexDirection: "row" },
        ...legendChildren,
      ),
    );
  }

  // ── Assemble ──────────────────────────────────────────────────

  const outerBoxProps: Record<string, unknown> = {
    flexDirection: "column",
    role: "img",
    ...pickLayoutProps(props),
  };

  return React.createElement(
    "tui-box",
    outerBoxProps,
    ...rows,
  );
});
