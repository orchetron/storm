/**
 * AreaChart — braille-based area chart for terminal UI.
 *
 * Like LineChart, but fills the area below each line using BrailleCanvas.
 * Supports multiple series, axes, legend, configurable fill density,
 * and stacked mode where series stack on top of each other.
 */

import React from "react";
import { useColors } from "../hooks/useColors.js";
import type { StormColors } from "../theme/colors.js";
import { BrailleCanvas, BRAILLE_BASE } from "../utils/braille-canvas.js";
import type { StormLayoutStyleProps } from "../styles/styleProps.js";
import type { ChartSeries } from "./chart-types.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

// ── Public types ────────────────────────────────────────────────────

export interface AreaChartProps extends StormLayoutStyleProps {
  series: ChartSeries[];
  /** Override: must be numeric for chart cell column calculation. */
  width?: number;
  /** Override: must be numeric for chart cell row calculation. */
  height?: number;
  yMin?: number;
  yMax?: number;
  showAxes?: boolean;
  showLegend?: boolean;
  axisColor?: string | number;
  title?: string;
  xLabels?: string[];
  /** Controls fill density: "full" fills every dot, "sparse" uses checkerboard. */
  fillDensity?: "full" | "sparse";
  /** When true, stack series on top of each other (cumulative Y values). */
  stacked?: boolean;
  /** Custom render for chart tooltip (shown alongside data). */
  renderTooltip?: (series: ChartSeries, index: number, value: number) => React.ReactNode;
}

// Default series colors — same palette as LineChart.
function getSeriesPalette(colors: StormColors): readonly string[] {
  return [
    colors.brand.primary,
    colors.success,
    colors.warning,
    colors.error,
    colors.brand.light,
    "#A78BFA",
    "#FB923C",
    "#F472B6",
  ];
}

const Y_GUTTER_WIDTH = 7;

// ── Data helpers ────────────────────────────────────────────────────

function resample(data: number[], targetWidth: number): number[] {
  if (data.length <= targetWidth) return data;

  const result: number[] = [];
  const bucketSize = data.length / targetWidth;

  for (let i = 0; i < targetWidth; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.floor((i + 1) * bucketSize);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end && j < data.length; j++) {
      sum += data[j]!;
      count++;
    }
    result.push(count > 0 ? sum / count : 0);
  }

  return result;
}

function formatAxisLabel(value: number, width: number): string {
  let str: string;

  if (value === 0) {
    str = "0";
  } else if (Math.abs(value) >= 1_000_000) {
    str = (value / 1_000_000).toFixed(1) + "M";
  } else if (Math.abs(value) >= 10_000) {
    str = (value / 1_000).toFixed(1) + "k";
  } else if (Math.abs(value) >= 1_000) {
    str = (value / 1_000).toFixed(2) + "k";
  } else if (Math.abs(value) < 0.01 && value !== 0) {
    str = value.toExponential(1);
  } else if (Number.isInteger(value)) {
    str = String(value);
  } else {
    str = value.toFixed(2);
  }

  if (str.length > width) {
    str = str.slice(0, width);
  }
  return str.padStart(width);
}

// ── Component ───────────────────────────────────────────────────────

export const AreaChart = React.memo(function AreaChart(rawProps: AreaChartProps): React.ReactElement {
  const colors = useColors();
  const SERIES_PALETTE = getSeriesPalette(colors);
  const props = usePluginProps("AreaChart", rawProps as unknown as Record<string, unknown>) as unknown as AreaChartProps;
  const {
    series,
    width: cellWidth = 60,
    height: cellHeight = 10,
    showAxes = true,
    axisColor = colors.text.dim,
    title,
    xLabels,
    fillDensity = "full",
    stacked = false,
    margin,
    marginX,
    marginY,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    minWidth,
    maxWidth,
  } = props;

  const showLegend = props.showLegend ?? (series.length > 1);

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

  // ── Pre-compute stacked data ──────────────────────────────────
  // When stacked, each series' Y values are cumulative sums of all
  // previous series + itself. We compute these resampled arrays first.

  const resampledSeries: number[][] = [];
  for (const s of series) {
    resampledSeries.push(s.data.length > 0 ? resample(s.data, pixelWidth) : []);
  }

  // Build cumulative stacked arrays
  const stackedSamples: number[][] = [];
  if (stacked) {
    for (let si = 0; si < resampledSeries.length; si++) {
      const samples = resampledSeries[si]!;
      if (samples.length === 0) {
        stackedSamples.push([]);
        continue;
      }
      const cumulative: number[] = new Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        const prevVal = si > 0 && stackedSamples[si - 1]!.length > i
          ? stackedSamples[si - 1]![i]!
          : 0;
        cumulative[i] = prevVal + samples[i]!;
      }
      stackedSamples.push(cumulative);
    }
  }

  // ── Determine Y range across all series ───────────────────────

  let yMin = props.yMin ?? Infinity;
  let yMax = props.yMax ?? -Infinity;

  if (stacked) {
    // For stacked mode, range is based on the cumulative totals
    for (const samples of stackedSamples) {
      for (const v of samples) {
        if (props.yMin === undefined && v < yMin) yMin = v;
        if (props.yMax === undefined && v > yMax) yMax = v;
      }
    }
    // Also check 0 as the minimum for stacked
    if (props.yMin === undefined && 0 < yMin) yMin = 0;
  } else {
    for (const s of series) {
      if (s.data.length === 0) continue;
      for (const v of s.data) {
        if (props.yMin === undefined && v < yMin) yMin = v;
        if (props.yMax === undefined && v > yMax) yMax = v;
      }
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
    const normalized = (value - yMin) / yRange;
    return Math.round((1 - normalized) * (pixelHeight - 1));
  };

  // ── Render each series onto its own canvas ────────────────────

  const canvases: { canvas: BrailleCanvas; color: string | number }[] = [];

  for (let si = 0; si < series.length; si++) {
    const s = series[si]!;
    if (s.data.length === 0) continue;

    const seriesColor = s.color ?? SERIES_PALETTE[si % SERIES_PALETTE.length]!;
    const samples = stacked ? stackedSamples[si]! : resampledSeries[si]!;

    // For stacked mode, the "floor" is the previous series' line
    const prevSamples = stacked && si > 0 ? stackedSamples[si - 1]! : null;

    const canvas = new BrailleCanvas(chartCols, chartRows);

    // Plot data points, connect with lines, and fill below
    for (let i = 0; i < samples.length; i++) {
      const px = i;
      const py = toPixelY(samples[i]!);

      // Draw the line segment
      canvas.set(px, py);
      if (i > 0) {
        const prevPx = i - 1;
        const prevPy = toPixelY(samples[i - 1]!);
        canvas.line(prevPx, prevPy, px, py);
      }

      // Determine the floor Y (bottom of fill area)
      let floorPy: number;
      if (prevSamples !== null && i < prevSamples.length) {
        floorPy = toPixelY(prevSamples[i]!);
      } else {
        floorPy = pixelHeight; // fill to bottom
      }

      // Fill from just below the line to the floor
      if (fillDensity === "sparse") {
        for (let y = py + 1; y < floorPy; y++) {
          if ((px + y) % 2 === 0) {
            canvas.set(px, y);
          }
        }
      } else {
        // Full fill from line+1 down to floor
        for (let y = py + 1; y < floorPy; y++) {
          canvas.set(px, y, seriesColor);
        }
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
      const cellColors: (string | number)[] = new Array(chartCols);
      const cellChars: string[] = new Array(chartCols);

      for (let c = 0; c < chartCols; c++) {
        cellChars[c] = String.fromCharCode(BRAILLE_BASE);
        cellColors[c] = renderedCanvases[0]!.color;
      }

      for (const rc of renderedCanvases) {
        const line = rc.lines[r]!;
        for (let c = 0; c < chartCols; c++) {
          const ch = line[c]!;
          const bits = ch.charCodeAt(0) - BRAILLE_BASE;
          if (bits !== 0) {
            const existingBits = cellChars[c]!.charCodeAt(0) - BRAILLE_BASE;
            cellChars[c] = String.fromCharCode(BRAILLE_BASE + (existingBits | bits));
            cellColors[c] = rc.color;
          }
        }
      }

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

        const lbl = xLabels[li]!;
        const startPos = absPos - Math.floor(lbl.length / 2);

        for (let ci = 0; ci < lbl.length; ci++) {
          const targetCol = startPos + ci;
          if (targetCol >= gutterWidth && targetCol < gutterWidth + chartCols) {
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
    ...(margin !== undefined ? { margin } : {}),
    ...(marginX !== undefined ? { marginX } : {}),
    ...(marginY !== undefined ? { marginY } : {}),
    ...(marginTop !== undefined ? { marginTop } : {}),
    ...(marginBottom !== undefined ? { marginBottom } : {}),
    ...(marginLeft !== undefined ? { marginLeft } : {}),
    ...(marginRight !== undefined ? { marginRight } : {}),
    ...(minWidth !== undefined ? { minWidth } : {}),
    ...(maxWidth !== undefined ? { maxWidth } : {}),
  };

  return React.createElement(
    "tui-box",
    outerBoxProps,
    ...rows,
  );
});
