import React from "react";
import { useColors } from "../../hooks/useColors.js";
import type { StormLayoutStyleProps } from "../../styles/styleProps.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { pickLayoutProps } from "../../styles/applyStyles.js";

export interface HistogramProps extends StormLayoutStyleProps {
  /** Raw data values to bin */
  data: number[];
  /** Number of bins (default: auto-computed as sqrt(n), clamped to 3..50) */
  bins?: number;
  /** Bar color */
  color?: string | number;
  /** Show bin count above each bar */
  showCounts?: boolean;
  title?: string;
  /** Override: must be numeric for chart width. */
  width?: number;
  /** Override: must be numeric for chart height (rows for bars). */
  height?: number;
  axisColor?: string | number;
  /** When true, render a vertical line at the mean value. */
  showMean?: boolean;
  /** When true, render a vertical line at the median value. */
  showMedian?: boolean;
  /** When true, show cumulative distribution (each bin = sum of all bins up to and including it). */
  cumulative?: boolean;
  /** Custom render for each histogram bar. */
  renderBar?: (bin: { min: number; max: number; count: number }, index: number) => React.ReactNode;
}

// 9 levels: empty through full block (indices 0-8)
const BLOCK_CHARS = [" ", "\u2581", "\u2582", "\u2583", "\u2584", "\u2585", "\u2586", "\u2587", "\u2588"];
// ▁▂▃▄▅▆▇█

const Y_GUTTER_WIDTH = 6; // chars reserved for Y-axis labels + border

interface Bin {
  low: number;
  high: number;
  count: number;
}

function computeBins(data: number[], binCount: number): Bin[] {
  if (data.length === 0) return [];

  // Single-pass min/max instead of sorting just for range
  let min = data[0]!;
  let max = data[0]!;
  for (let i = 1; i < data.length; i++) {
    const v = data[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  const step = range / binCount;

  const bins: Bin[] = [];
  for (let i = 0; i < binCount; i++) {
    bins.push({
      low: min + i * step,
      high: min + (i + 1) * step,
      count: 0,
    });
  }

  for (const v of data) {
    let idx = Math.floor((v - min) / step);
    if (idx >= binCount) idx = binCount - 1; // clamp max value into last bin
    bins[idx]!.count++;
  }

  return bins;
}

function formatLabel(value: number, width: number): string {
  let str: string;

  if (value === 0) {
    str = "0";
  } else if (Math.abs(value) >= 1_000_000) {
    str = (value / 1_000_000).toFixed(1) + "M";
  } else if (Math.abs(value) >= 10_000) {
    str = (value / 1_000).toFixed(1) + "k";
  } else if (Math.abs(value) >= 1_000) {
    str = (value / 1_000).toFixed(2) + "k";
  } else if (Number.isInteger(value)) {
    str = String(value);
  } else {
    str = value.toFixed(1);
  }

  if (str.length > width) {
    str = str.slice(0, width);
  }
  return str.padStart(width);
}

function computeMean(data: number[]): number {
  let sum = 0;
  for (const v of data) sum += v;
  return sum / data.length;
}

function computeMedian(data: number[]): number {
  const sorted = [...data].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function valueToBarCol(
  value: number,
  bins: Bin[],
  barWidth: number,
): number {
  if (bins.length === 0) return 0;
  const dataMin = bins[0]!.low;
  const dataMax = bins[bins.length - 1]!.high;
  const dataRange = dataMax - dataMin;
  if (dataRange === 0) return 0;
  const normalized = (value - dataMin) / dataRange;
  return Math.round(normalized * (bins.length * barWidth - 1));
}

export const Histogram = React.memo(function Histogram(rawProps: HistogramProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Histogram", rawProps);
  const {
    data,
    color: barColor = colors.brand.primary,
    showCounts = false,
    title,
    axisColor = colors.text.dim,
    showMean = false,
    showMedian = false,
    cumulative = false,
  } = props;

  const chartHeight = Math.max(1, props.height ?? 8);

  // ── Validate ────────────────────────────────────────────────────

  if (data.length === 0) {
    return React.createElement(
      "tui-text",
      { color: colors.text.dim },
      "(no data)",
    );
  }

  // ── Compute bins ────────────────────────────────────────────────

  const binCount = Math.max(
    3,
    Math.min(50, props.bins ?? Math.ceil(Math.sqrt(data.length))),
  );
  const bins = computeBins(data, binCount);

  if (bins.length === 0) {
    return React.createElement(
      "tui-text",
      { color: colors.text.dim },
      "(no data)",
    );
  }

  // ── Apply cumulative distribution if enabled ───────────────────
  if (cumulative) {
    let runningTotal = 0;
    for (const bin of bins) {
      runningTotal += bin.count;
      bin.count = runningTotal;
    }
  }

  const maxCount = Math.max(...bins.map((b) => b.count));
  if (maxCount === 0) {
    return React.createElement(
      "tui-text",
      { color: colors.text.dim },
      "(empty bins)",
    );
  }

  // ── Determine bar width ─────────────────────────────────────────

  // Each bin gets barWidth characters. Default: fit within available width.
  const totalWidth = props.width ?? 60;
  const plotWidth = totalWidth - Y_GUTTER_WIDTH;
  const barWidth = Math.max(1, Math.floor(plotWidth / bins.length));

  // ── Compute statistical markers ─────────────────────────────────

  const meanVal = showMean ? computeMean(data) : 0;
  const medianVal = showMedian ? computeMedian(data) : 0;
  const meanCol = showMean ? valueToBarCol(meanVal, bins, barWidth) : -1;
  const medianCol = showMedian ? valueToBarCol(medianVal, bins, barWidth) : -1;

  // ── Normalize bin heights ───────────────────────────────────────

  // Height in "sub-rows": chartHeight rows * 8 block levels per row
  const totalLevels = chartHeight * 8;
  const binHeights = bins.map(
    (b) => (b.count / maxCount) * totalLevels,
  );

  // ── Build rows ─────────────────────────────────────────────────

  const rows: React.ReactElement[] = [];

  // Title
  if (title !== undefined) {
    rows.push(
      React.createElement(
        "tui-box",
        { key: "title", flexDirection: "row" },
        React.createElement(
          "tui-text",
          { bold: true, color: colors.text.primary },
          " ".repeat(Y_GUTTER_WIDTH) + title,
        ),
      ),
    );
  }

  // Custom per-bin render delegate
  if (props.renderBar) {
    const customBins: React.ReactElement[] = bins.map((bin, bi) =>
      React.createElement(React.Fragment, { key: `bin-${bi}` }, props.renderBar!({ min: bin.low, max: bin.high, count: bin.count }, bi)),
    );
    rows.push(
      React.createElement("tui-box", { key: "custom-bars", flexDirection: "row" }, ...customBins),
    );
    const outerBoxProps: Record<string, unknown> = {
      flexDirection: "column",
      ...pickLayoutProps(props),
    };
    return React.createElement("tui-box", outerBoxProps, ...rows);
  }

  // Count labels row (above bars)
  if (showCounts) {
    const countChildren: React.ReactElement[] = [];
    countChildren.push(
      React.createElement(
        "tui-text",
        { key: "gutter" },
        " ".repeat(Y_GUTTER_WIDTH),
      ),
    );

    for (let bi = 0; bi < bins.length; bi++) {
      const countStr = String(bins[bi]!.count);
      const truncated = countStr.length > barWidth
        ? countStr.slice(0, barWidth)
        : countStr;
      const padTotal = Math.max(0, barWidth - truncated.length);
      const padLeft = Math.floor(padTotal / 2);
      const padRight = padTotal - padLeft;
      const formatted = " ".repeat(padLeft) + truncated + " ".repeat(padRight);

      countChildren.push(
        React.createElement(
          "tui-text",
          { key: `cnt-${bi}`, color: colors.text.secondary },
          formatted,
        ),
      );
    }

    rows.push(
      React.createElement(
        "tui-box",
        { key: "counts", flexDirection: "row" },
        ...countChildren,
      ),
    );
  }

  // Chart rows (top to bottom)
  const totalBarCols = barWidth * bins.length;

  for (let row = chartHeight - 1; row >= 0; row--) {
    const rowChildren: React.ReactElement[] = [];

    // Y-axis label
    let yLabel: string;
    if (row === chartHeight - 1) {
      yLabel = formatLabel(maxCount, Y_GUTTER_WIDTH - 2);
    } else if (row === 0) {
      yLabel = formatLabel(0, Y_GUTTER_WIDTH - 2);
    } else if (row === Math.floor(chartHeight / 2)) {
      yLabel = formatLabel(Math.round(maxCount / 2), Y_GUTTER_WIDTH - 2);
    } else {
      yLabel = " ".repeat(Y_GUTTER_WIDTH - 2);
    }

    rowChildren.push(
      React.createElement(
        "tui-text",
        { key: "y-label", color: axisColor },
        yLabel + " \u2502", // │
      ),
    );

    const rowStart = row * 8;
    const barChars: string[] = [];
    const barCharColors: (string | number)[] = [];

    for (let bi = 0; bi < bins.length; bi++) {
      const h = binHeights[bi]!;
      let char: string;

      if (h >= rowStart + 8) {
        char = BLOCK_CHARS[8]!;
      } else if (h > rowStart) {
        const fraction = h - rowStart;
        const charIdx = Math.max(1, Math.min(8, Math.round(fraction)));
        char = BLOCK_CHARS[charIdx]!;
      } else {
        char = " ";
      }

      for (let w = 0; w < barWidth; w++) {
        barChars.push(char);
        barCharColors.push(barColor);
      }
    }

    // Overlay mean marker
    if (showMean && meanCol >= 0 && meanCol < totalBarCols) {
      // Only overlay if the cell is currently empty (space) to avoid hiding bars
      // For occupied cells, show the marker with a different color
      if (barChars[meanCol] === " ") {
        barChars[meanCol] = "\u2502"; // │
      }
      barCharColors[meanCol] = colors.warning;
    }

    // Overlay median marker
    if (showMedian && medianCol >= 0 && medianCol < totalBarCols) {
      if (barChars[medianCol] === " ") {
        barChars[medianCol] = "\u2502"; // │
      }
      barCharColors[medianCol] = colors.success;
    }

    // Batch consecutive same-color characters into spans
    let runStart = 0;
    let spanIdx = 0;
    while (runStart < barChars.length) {
      const runColor = barCharColors[runStart]!;
      let runEnd = runStart + 1;
      while (runEnd < barChars.length && barCharColors[runEnd] === runColor) {
        runEnd++;
      }
      let text = "";
      for (let c = runStart; c < runEnd; c++) {
        text += barChars[c]!;
      }
      rowChildren.push(
        React.createElement(
          "tui-text",
          { key: `b-${spanIdx}`, color: runColor },
          text,
        ),
      );
      spanIdx++;
      runStart = runEnd;
    }

    rows.push(
      React.createElement(
        "tui-box",
        { key: `row-${row}`, flexDirection: "row" },
        ...rowChildren,
      ),
    );
  }

  // X-axis line
  const xAxisWidth = barWidth * bins.length;
  const xAxisLine =
    " ".repeat(Y_GUTTER_WIDTH - 1) + "\u2514" + "\u2500".repeat(xAxisWidth);
  rows.push(
    React.createElement(
      "tui-text",
      { key: "x-axis", color: axisColor },
      xAxisLine,
    ),
  );

  // X-axis bin range labels
  const xLabelChildren: React.ReactElement[] = [];
  xLabelChildren.push(
    React.createElement(
      "tui-text",
      { key: "x-pad" },
      " ".repeat(Y_GUTTER_WIDTH),
    ),
  );

  for (let bi = 0; bi < bins.length; bi++) {
    const bin = bins[bi]!;
    // Show the low edge of each bin
    const labelStr = formatLabel(bin.low, barWidth).trimStart();
    const truncated = labelStr.length > barWidth
      ? labelStr.slice(0, barWidth)
      : labelStr;
    const padTotal = Math.max(0, barWidth - truncated.length);
    const padLeft = Math.floor(padTotal / 2);
    const padRight = padTotal - padLeft;
    const formatted = " ".repeat(padLeft) + truncated + " ".repeat(padRight);

    xLabelChildren.push(
      React.createElement(
        "tui-text",
        { key: `xl-${bi}`, color: colors.text.secondary },
        formatted,
      ),
    );
  }

  rows.push(
    React.createElement(
      "tui-box",
      { key: "x-labels", flexDirection: "row" },
      ...xLabelChildren,
    ),
  );

  // ── Statistical marker legend ─────────────────────────────────────

  if (showMean || showMedian) {
    const markerChildren: React.ReactElement[] = [];
    markerChildren.push(
      React.createElement("tui-text", { key: "marker-pad" }, " ".repeat(Y_GUTTER_WIDTH)),
    );

    if (showMean) {
      markerChildren.push(
        React.createElement(
          "tui-text",
          { key: "mean-marker", color: colors.warning },
          "\u2502 ",
        ),
      );
      markerChildren.push(
        React.createElement(
          "tui-text",
          { key: "mean-label", color: colors.text.secondary },
          `Mean: ${meanVal.toFixed(1)}`,
        ),
      );
    }

    if (showMedian) {
      if (showMean) {
        markerChildren.push(
          React.createElement("tui-text", { key: "marker-sep" }, "  "),
        );
      }
      markerChildren.push(
        React.createElement(
          "tui-text",
          { key: "median-marker", color: colors.success },
          "\u2502 ",
        ),
      );
      markerChildren.push(
        React.createElement(
          "tui-text",
          { key: "median-label", color: colors.text.secondary },
          `Median: ${medianVal.toFixed(1)}`,
        ),
      );
    }

    rows.push(
      React.createElement(
        "tui-box",
        { key: "markers-legend", flexDirection: "row" },
        ...markerChildren,
      ),
    );
  }

  // ── Assemble ────────────────────────────────────────────────────

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
