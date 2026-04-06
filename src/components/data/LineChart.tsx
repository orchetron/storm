import React, { useRef } from "react";
import { BrailleCanvas } from "../../utils/braille-canvas.js";
import { useInput } from "../../hooks/useInput.js";
import { useTui } from "../../context/TuiContext.js";
import type { StormLayoutStyleProps } from "../../styles/styleProps.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { useColors } from "../../hooks/useColors.js";
import { resample, formatAxisLabel, getSeriesPalette, composeBrailleCells } from "../../utils/chart-helpers.js";
import { pickLayoutProps } from "../../styles/applyStyles.js";

export interface LineChartSeries {
  data: number[];
  color?: string | number;
  name?: string;
}

export interface LineChartProps extends StormLayoutStyleProps {
  series: LineChartSeries[];
  /** Override: must be numeric for chart cell column calculation. */
  width?: number;
  /** Override: must be numeric for chart cell row calculation. */
  height?: number;
  yMin?: number;         // auto-scale if omitted
  yMax?: number;         // auto-scale if omitted
  showAxes?: boolean;    // default true
  showLegend?: boolean;  // default true when multiple series
  axisColor?: string | number;
  title?: string;
  /** Labels to display along the X-axis. Spaced evenly across the chart width. */
  xLabels?: string[];
  /** When true, draw faint horizontal dotted grid lines at Y-axis tick positions. */
  showGrid?: boolean;
  /** When true, render a 3x3 braille dot cluster at each actual data point. */
  showPoints?: boolean;
  /** When true, enable interactive crosshair navigation with arrow keys. */
  interactive?: boolean;
  /** Whether this chart is currently focused (required for interactive mode). */
  isFocused?: boolean;
  /** When true, enable zoom with +/- keys around the crosshair position. Requires interactive+isFocused. */
  zoomable?: boolean;
  /** Custom renderer for the crosshair tooltip. */
  renderTooltip?: (seriesValues: Array<{ name: string; value: number; color: string }>, xIndex: number) => React.ReactNode;
}

// Default series colors — moved inside component to support theme switching.

const Y_GUTTER_WIDTH = 7; // chars reserved for Y-axis labels + border

function formatTooltipValue(value: number): string {
  if (Number.isInteger(value)) {
    return value.toLocaleString("en-US");
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export const LineChart = React.memo(function LineChart(rawProps: LineChartProps): React.ReactElement {
  const colors = useColors();
  const SERIES_PALETTE = getSeriesPalette(colors);
  const props = usePluginProps("LineChart", rawProps);
  const {
    series,
    width: cellWidth = 60,
    height: cellHeight = 10,
    showAxes = true,
    axisColor = colors.text.dim,
    title,
    xLabels,
    showGrid = false,
    showPoints = false,
    interactive = false,
    isFocused = false,
    zoomable = false,
  } = props;

  const showLegend = props.showLegend ?? (series.length > 1);

  // ── Interactive crosshair state (imperative, not React state) ───
  const { requestRender } = useTui();
  const crosshairRef = useRef(0);

  // ── Zoom state (imperative refs) ───
  const zoomStartRef = useRef(0);
  const zoomEndRef = useRef(0);

  let maxDataLen = 0;
  for (const s of series) {
    if (s.data.length > maxDataLen) maxDataLen = s.data.length;
  }

  if (zoomEndRef.current === 0 && maxDataLen > 0) {
    zoomEndRef.current = maxDataLen;
  }

  // Visible data range (zoom window)
  const zoomActive = zoomable && interactive && isFocused;
  const visibleStart = zoomActive ? zoomStartRef.current : 0;
  const visibleEnd = zoomActive ? zoomEndRef.current : maxDataLen;
  const visibleLen = visibleEnd - visibleStart;

  useInput(
    (event) => {
      if (!interactive || !isFocused) return;
      if (event.key === "left") {
        crosshairRef.current = Math.max(0, crosshairRef.current - 1);
        requestRender();
      } else if (event.key === "right") {
        crosshairRef.current = Math.min(maxDataLen - 1, crosshairRef.current + 1);
        requestRender();
      }

      if (zoomable) {
        if (event.char === "+" || event.char === "=") {
          // Zoom in: narrow visible range around crosshair
          const currentLen = zoomEndRef.current - zoomStartRef.current;
          const newLen = Math.max(4, Math.floor(currentLen * 0.6));
          const center = crosshairRef.current;
          const half = Math.floor(newLen / 2);
          let newStart = center - half;
          let newEnd = newStart + newLen;
          if (newStart < 0) { newStart = 0; newEnd = newLen; }
          if (newEnd > maxDataLen) { newEnd = maxDataLen; newStart = Math.max(0, newEnd - newLen); }
          zoomStartRef.current = newStart;
          zoomEndRef.current = newEnd;
          requestRender();
        } else if (event.char === "-") {
          // Zoom out: widen visible range
          const currentLen = zoomEndRef.current - zoomStartRef.current;
          const newLen = Math.min(maxDataLen, Math.ceil(currentLen / 0.6));
          const center = Math.floor((zoomStartRef.current + zoomEndRef.current) / 2);
          const half = Math.floor(newLen / 2);
          let newStart = center - half;
          let newEnd = newStart + newLen;
          if (newStart < 0) { newStart = 0; newEnd = Math.min(maxDataLen, newLen); }
          if (newEnd > maxDataLen) { newEnd = maxDataLen; newStart = Math.max(0, newEnd - newLen); }
          zoomStartRef.current = newStart;
          zoomEndRef.current = newEnd;
          requestRender();
        } else if (event.char === "0") {
          zoomStartRef.current = 0;
          zoomEndRef.current = maxDataLen;
          requestRender();
        }
      }
    },
    { isActive: interactive && isFocused },
  );

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

  // ── Slice data to zoom window ─────────────────────────────────

  const zoomedSeries = zoomActive
    ? series.map((s) => ({
        ...s,
        data: s.data.slice(visibleStart, visibleEnd),
      }))
    : series;

  // ── Determine Y range across all series (within zoom window) ──

  let yMin = props.yMin ?? Infinity;
  let yMax = props.yMax ?? -Infinity;

  for (const s of zoomedSeries) {
    if (s.data.length === 0) continue;
    for (const v of s.data) {
      if (props.yMin === undefined && v < yMin) yMin = v;
      if (props.yMax === undefined && v > yMax) yMax = v;
    }
  }

  if (yMin === yMax) {
    yMin = yMin - 1;
    yMax = yMax + 1;
  }
  if (!Number.isFinite(yMin)) yMin = 0;
  if (!Number.isFinite(yMax)) yMax = 1;

  const yRange = yMax - yMin;

  // ── Map data value to pixel Y coordinate ──────────────────────

  const toPixelY = (value: number): number => {
    // Pixel Y=0 is the top of the canvas; higher values go to lower Y
    const normalized = (value - yMin) / yRange;
    return Math.round((1 - normalized) * (pixelHeight - 1));
  };

  // ── Grid canvas (rendered behind data series) ──────────────────
  // Horizontal dotted lines at Y-axis tick positions using braille dots.

  let gridCanvas: BrailleCanvas | undefined;
  if (showGrid) {
    gridCanvas = new BrailleCanvas(chartCols, chartRows);
    // Draw at top (yMax), middle, and bottom (yMin) — same as the Y-axis labels
    const gridYPositions = [yMax, yMin + yRange / 2, yMin];
    for (const yVal of gridYPositions) {
      const py = toPixelY(yVal);
      // Draw dotted line: every 4th pixel across the width
      for (let px = 0; px < pixelWidth; px += 4) {
        gridCanvas.set(px, py);
      }
    }
  }

  // ── Crosshair canvas (rendered as a dim overlay) ────────────────

  let crosshairCanvas: BrailleCanvas | undefined;
  let crosshairDataIdx = 0;
  if (interactive && isFocused && maxDataLen > 0) {
    crosshairDataIdx = Math.min(crosshairRef.current, maxDataLen - 1);
    crosshairCanvas = new BrailleCanvas(chartCols, chartRows);
    const relativeIdx = crosshairDataIdx - visibleStart;
    const effectiveLen = visibleLen <= 1 ? 1 : visibleLen - 1;
    const crosshairPx = relativeIdx < 0 || relativeIdx >= visibleLen
      ? -1  // offscreen
      : Math.round((relativeIdx / effectiveLen) * (pixelWidth - 1));
    // Draw vertical dotted line at crosshair position
    if (crosshairPx >= 0 && crosshairPx < pixelWidth) {
      for (let py = 0; py < pixelHeight; py += 2) {
        crosshairCanvas.set(crosshairPx, py);
      }
    }
  }

  // ── Render each series onto its own canvas ────────────────────
  // Each series gets a separate canvas so we can colorize independently.
  // Later series render on top (drawn last).

  const canvases: { canvas: BrailleCanvas; color: string | number }[] = [];

  // Add grid as the first (bottom) layer if enabled
  if (gridCanvas) {
    canvases.push({ canvas: gridCanvas, color: colors.text.dim });
  }

  // Add crosshair as next layer (behind data but above grid)
  if (crosshairCanvas) {
    canvases.push({ canvas: crosshairCanvas, color: colors.text.dim });
  }

  for (let si = 0; si < zoomedSeries.length; si++) {
    const s = zoomedSeries[si]!;
    if (s.data.length === 0) continue;

    const seriesColor = s.color ?? SERIES_PALETTE[si % SERIES_PALETTE.length]!;
    const samples = resample(s.data, pixelWidth);

    const canvas = new BrailleCanvas(chartCols, chartRows);

    // Plot data points and connect with lines
    for (let i = 0; i < samples.length; i++) {
      const px = i;
      const py = toPixelY(samples[i]!);

      canvas.set(px, py);

      if (i > 0) {
        const prevPx = i - 1;
        const prevPy = toPixelY(samples[i - 1]!);
        canvas.line(prevPx, prevPy, px, py);
      }

      // Point markers: set a 3x3 cluster of braille dots at each data point
      if (showPoints) {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            canvas.set(px + dx, py + dy);
          }
        }
      }
    }

    canvases.push({ canvas, color: seriesColor });
  }

  // ── Compose rendered lines ────────────────────────────────────
  // For each cell row, build a sequence of colored text spans.
  // When multiple series occupy the same cell, the last series wins
  // (later = on top).

  const renderedCanvases = canvases.map((c) => ({
    lines: c.canvas.render(),
    color: c.color,
  }));

  const rows: React.ReactElement[] = [];

  // ── Crosshair tooltip row (above chart) ─────────────────────────

  if (interactive && isFocused && maxDataLen > 0) {
    if (props.renderTooltip) {
      const seriesValues: Array<{ name: string; value: number; color: string }> = [];
      for (let si = 0; si < series.length; si++) {
        const s = series[si]!;
        if (s.data.length === 0) continue;
        const idx = Math.min(crosshairDataIdx, s.data.length - 1);
        seriesValues.push({
          name: s.name ?? `S${si + 1}`,
          value: s.data[idx]!,
          color: (s.color ?? SERIES_PALETTE[si % SERIES_PALETTE.length]!) as string,
        });
      }
      rows.push(
        React.createElement(
          "tui-box",
          { key: "tooltip", flexDirection: "row" },
          props.renderTooltip(seriesValues, crosshairDataIdx),
        ),
      );
    } else {
      const tooltipParts: string[] = [];
      for (let si = 0; si < series.length; si++) {
        const s = series[si]!;
        if (s.data.length === 0) continue;
        const idx = Math.min(crosshairDataIdx, s.data.length - 1);
        const val = s.data[idx]!;
        const name = s.name ?? `S${si + 1}`;
        tooltipParts.push(`${name}: ${formatTooltipValue(val)}`);
      }
      const tooltipText = tooltipParts.join("  ");
      // Position the tooltip above the crosshair column
      const pad = showAxes ? " ".repeat(gutterWidth) : "";
      rows.push(
        React.createElement(
          "tui-box",
          { key: "tooltip", flexDirection: "row" },
          React.createElement(
            "tui-text",
            { color: colors.text.primary, bold: true },
            pad + tooltipText,
          ),
        ),
      );
    }
  }

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
          label + " \u2502", // │ vertical bar
        ),
      );
    }

    if (canvases.length === 1) {
      // Fast path: single series, no compositing needed
      rowChildren.push(
        React.createElement(
          "tui-text",
          { key: "data", color: renderedCanvases[0]!.color },
          renderedCanvases[0]!.lines[r]!,
        ),
      );
    } else {
      // Multi-series: composite character by character.
      const { cellChars, cellColors } = composeBrailleCells(renderedCanvases, chartCols, r);

      // Batch consecutive same-color characters into spans
      let runStart = 0;
      let spanIdx = 0;
      while (runStart < chartCols) {
        const runColor = cellColors[runStart]!;
        let runEnd = runStart + 1;
        while (runEnd < chartCols && cellColors[runEnd] === runColor) {
          runEnd++;
        }

        let text = "";
        for (let c = runStart; c < runEnd; c++) {
          text += cellChars[c]!;
        }

        rowChildren.push(
          React.createElement(
            "tui-text",
            { key: `s-${spanIdx}`, color: runColor },
            text,
          ),
        );
        spanIdx++;
        runStart = runEnd;
      }
    }

    rows.push(
      React.createElement(
        "tui-box",
        { key: `row-${r}`, flexDirection: "row" },
        ...rowChildren,
      ),
    );
  }

  // ── X-axis line ───────────────────────────────────────────────

  if (showAxes) {
    const xAxisLine = " ".repeat(gutterWidth - 1) + "\u2514" + "\u2500".repeat(chartCols);
    rows.push(
      React.createElement(
        "tui-text",
        { key: "x-axis", color: axisColor },
        xAxisLine,
      ),
    );

    // X-axis labels
    if (xLabels !== undefined && xLabels.length > 0) {
      const labelRowChars: string[] = new Array(gutterWidth + chartCols).fill(" ");

      const labelCount = xLabels.length;

      for (let li = 0; li < labelCount; li++) {
        const chartPos = labelCount === 1
          ? Math.floor(chartCols / 2)
          : Math.round((li / (labelCount - 1)) * (chartCols - 1));
        const absPos = gutterWidth + chartPos;

        // Place a tick mark at the axis line position
        // (The tick is part of the x-axis line row above; we add label text below)

        const lbl = xLabels[li]!;
        // Center the label around the position
        const startPos = absPos - Math.floor(lbl.length / 2);

        for (let ci = 0; ci < lbl.length; ci++) {
          const targetCol = startPos + ci;
          if (targetCol >= gutterWidth && targetCol < gutterWidth + chartCols) {
            // Don't overwrite if there's already a non-space char (overlap protection)
            if (labelRowChars[targetCol] === " ") {
              labelRowChars[targetCol] = lbl[ci]!;
            }
          }
        }
      }

      rows.push(
        React.createElement(
          "tui-text",
          { key: "x-labels", color: axisColor },
          labelRowChars.join(""),
        ),
      );
    }
  }

  // ── Crosshair coordinate display (below X-axis) ────────────────

  if (interactive && isFocused && maxDataLen > 0) {
    const xVal = crosshairDataIdx;
    // Show the value of the first series at the crosshair position
    const firstSeries = series.find((s) => s.data.length > 0);
    const yVal = firstSeries
      ? firstSeries.data[Math.min(crosshairDataIdx, firstSeries.data.length - 1)]!
      : 0;
    const coordText = `x: ${xVal}  y: ${formatTooltipValue(yVal)}`;
    const pad = showAxes ? " ".repeat(gutterWidth) : "";
    rows.push(
      React.createElement(
        "tui-text",
        { key: "coords", color: colors.text.secondary },
        pad + coordText,
      ),
    );
  }

  // ── Zoom indicator ───────────────────────────────────────────────

  if (zoomActive && visibleLen < maxDataLen) {
    const pad = showAxes ? " ".repeat(gutterWidth) : "";
    const zoomText = `Zoom: ${visibleStart}-${visibleEnd} of ${maxDataLen}`;
    rows.push(
      React.createElement(
        "tui-text",
        { key: "zoom-indicator", color: colors.text.dim },
        pad + zoomText,
      ),
    );
  }

  // ── Legend ─────────────────────────────────────────────────────

  if (showLegend) {
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
          "\u25CF ", // ● filled circle
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
