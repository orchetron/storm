import React, { useRef } from "react";
import { useColors } from "../../hooks/useColors.js";
import type { StormColors } from "../../theme/colors.js";
import { useInput } from "../../hooks/useInput.js";
import { useTui } from "../../context/TuiContext.js";
import { useCleanup } from "../../hooks/useCleanup.js";
import type { BarData, StackedBarData } from "./chart-types.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { getSeriesPalette } from "../../utils/chart-helpers.js";

const VBLOCK = [" ", "\u2581", "\u2582", "\u2583", "\u2584", "\u2585", "\u2586", "\u2587", "\u2588"];
const VBLOCK_NEG = [" ", "\u2594", "\u2594", "\u2580", "\u2580", "\u2580", "\u2580", "\u2580", "\u2588"];
const HBLOCK = [" ", "\u258F", "\u258E", "\u258D", "\u258C", "\u258B", "\u258A", "\u2589", "\u2588"];

const Y_GUTTER_WIDTH = 6; // chars reserved for Y-axis labels + border

export interface BarChartProps {
  /** Simple bars: [{label, value, color?}] */
  bars?: BarData[];
  /** Stacked bars: [{label, segments: [{value, color?, name?}]}] */
  stacked?: StackedBarData[];
  /** Grouped bars: multiple series shown side by side */
  grouped?: {
    series: { name: string; data: number[]; color?: string | number }[];
    labels: string[];
  };
  orientation?: "vertical" | "horizontal";
  showValues?: boolean;
  width?: number;
  height?: number;
  color?: string | number;
  barGap?: number;
  /** Bar width in characters (horizontal) or columns (vertical) */
  barWidth?: number;
  title?: string;
  showAxes?: boolean;
  axisColor?: string | number;
  showLegend?: boolean;
  interactive?: boolean;
  /** Whether this chart is currently focused (required for interactive mode). */
  isFocused?: boolean;
  /** When true, animate bar height transitions when data changes (~200ms). */
  animated?: boolean;
  renderTooltip?: (bar: { label: string; value: number; color: string }, index: number) => React.ReactNode;
}

// Not replaced by formatAxisLabel: uses toFixed(1) for decimals (not toFixed(2)), omits exponential notation for tiny values, and does not padStart.
function formatValue(value: number, maxWidth: number): string {
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

  if (str.length > maxWidth) {
    str = str.slice(0, maxWidth);
  }
  return str;
}

function padCenter(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  const padTotal = width - text.length;
  const padLeft = Math.floor(padTotal / 2);
  const padRight = padTotal - padLeft;
  return " ".repeat(padLeft) + text + " ".repeat(padRight);
}

function paletteColor(index: number, palette: readonly string[]): string {
  return palette[index % palette.length]!;
}

/** Unified internal representation: each category has one or more colored segments. */
interface InternalBar {
  label: string;
  /** For simple/stacked: segments stacked. For grouped: segments side-by-side. */
  segments: { value: number; color: string | number; name?: string }[];
}

function normalizeData(props: BarChartProps, palette: readonly string[], colors: StormColors): { bars: InternalBar[]; mode: "simple" | "stacked" | "grouped" } {
  if (props.grouped) {
    const { series, labels } = props.grouped;
    const bars: InternalBar[] = labels.map((label, li) => ({
      label,
      segments: series.map((s, si) => ({
        value: s.data[li] ?? 0,
        color: s.color ?? paletteColor(si, palette),
        ...(s.name ? { name: s.name } : {}),
      })),
    }));
    return { bars, mode: "grouped" };
  }

  if (props.stacked) {
    const bars: InternalBar[] = props.stacked.map((bar) => ({
      label: bar.label,
      segments: bar.segments.map((seg, si) => ({
        value: seg.value,
        color: seg.color ?? paletteColor(si, palette),
        ...(seg.name ? { name: seg.name } : {}),
      })),
    }));
    return { bars, mode: "stacked" };
  }

  if (props.bars) {
    const defaultColor = props.color ?? colors.brand.primary;
    const bars: InternalBar[] = props.bars.map((bar) => ({
      label: bar.label,
      segments: [{ value: bar.value, color: bar.color ?? defaultColor }],
    }));
    return { bars, mode: "simple" };
  }

  return { bars: [], mode: "simple" };
}

/** Compute the total value for each bar (stacked) or the max segment (grouped). */
function barTotal(bar: InternalBar, mode: "simple" | "stacked" | "grouped"): number {
  if (mode === "grouped") {
    return Math.max(...bar.segments.map((s) => s.value), 0);
  }
  return bar.segments.reduce((sum, s) => sum + s.value, 0);
}

/** Check if any bar has negative values. */
function hasNegativeValues(data: InternalBar[]): boolean {
  for (const bar of data) {
    for (const seg of bar.segments) {
      if (seg.value < 0) return true;
    }
  }
  return false;
}

// ── Shared context type for vertical render helpers ──

interface VerticalCtx {
  data: InternalBar[];
  mode: "simple" | "stacked" | "grouped";
  props: BarChartProps;
  selectedIdx: number;
  isInteractive: boolean;
  colors: StormColors;
  chartHeight: number;
  totalWidth: number;
  showAxes: boolean;
  axisColor: string | number;
  showValues: boolean;
  barGap: number;
  gutterWidth: number;
  plotWidth: number;
  numBars: number;
  colWidth: number;
  subColWidth: number;
  seriesCount: number;
  hasNeg: boolean;
  minVal: number;
  maxVal: number;
  posRows: number;
  negRows: number;
  posLevels: number;
  negLevels: number;
}

function buildVerticalCtx(
  data: InternalBar[],
  mode: "simple" | "stacked" | "grouped",
  props: BarChartProps,
  selectedIdx: number,
  isInteractive: boolean,
  colors: StormColors,
): VerticalCtx {
  const chartHeight = Math.max(1, props.height ?? 8);
  const totalWidth = props.width ?? 60;
  const showAxes = props.showAxes !== false;
  const axisColor = props.axisColor ?? colors.text.dim;
  const showValues = props.showValues === true;
  const barGap = props.barGap ?? 1;

  const gutterWidth = showAxes ? Y_GUTTER_WIDTH : 0;
  const plotWidth = totalWidth - gutterWidth;

  const numBars = data.length;

  const totalGapChars = barGap * (numBars - 1);
  let colWidth: number;
  if (props.barWidth !== undefined) {
    colWidth = props.barWidth;
  } else {
    colWidth = Math.max(1, Math.floor((plotWidth - totalGapChars) / numBars));
  }

  const seriesCount = mode === "grouped" ? data[0]!.segments.length : 1;
  const subColWidth = mode === "grouped" ? Math.max(1, Math.floor(colWidth / seriesCount)) : colWidth;

  const hasNeg = hasNegativeValues(data);

  let minVal = 0;
  let maxVal = 0;
  for (const b of data) {
    const total = barTotal(b, mode);
    if (total > maxVal) maxVal = total;
    if (mode === "grouped") {
      for (const seg of b.segments) {
        if (seg.value < minVal) minVal = seg.value;
        if (seg.value > maxVal) maxVal = seg.value;
      }
    } else {
      if (total < minVal) minVal = total;
    }
  }

  const totalRange = maxVal - minVal;
  let posRows: number;
  let negRows: number;
  if (hasNeg && minVal < 0) {
    const posFraction = maxVal / totalRange;
    posRows = Math.max(1, Math.round(chartHeight * posFraction));
    negRows = Math.max(1, chartHeight - posRows);
  } else {
    posRows = chartHeight;
    negRows = 0;
  }

  const posLevels = posRows * 8;
  const negLevels = negRows * 8;

  return {
    data, mode, props, selectedIdx, isInteractive, colors,
    chartHeight, totalWidth, showAxes, axisColor, showValues, barGap,
    gutterWidth, plotWidth, numBars, colWidth, subColWidth, seriesCount,
    hasNeg, minVal, maxVal, posRows, negRows, posLevels, negLevels,
  };
}

function renderVerticalTitle(ctx: VerticalCtx): React.ReactElement | null {
  if (ctx.props.title === undefined) return null;
  return React.createElement(
    "tui-box",
    { key: "title", flexDirection: "row" },
    React.createElement(
      "tui-text",
      { bold: true, color: ctx.colors.text.primary },
      " ".repeat(ctx.gutterWidth) + ctx.props.title,
    ),
  );
}

function renderVerticalTooltip(ctx: VerticalCtx): React.ReactElement | null {
  if (!ctx.isInteractive) return null;
  const selBar = ctx.data[ctx.selectedIdx];
  if (!selBar) return null;

  const total = barTotal(selBar, ctx.mode);

  if (ctx.props.renderTooltip) {
    const barColor = (selBar.segments[0]?.color ?? ctx.colors.brand.primary) as string;
    return React.createElement(
      "tui-box",
      { key: "sel-info", flexDirection: "row" },
      ctx.props.renderTooltip({ label: selBar.label, value: total, color: barColor }, ctx.selectedIdx),
    );
  }

  const valStr = formatValue(total, 12);
  const valChildren: React.ReactElement[] = [];
  if (ctx.showAxes) {
    valChildren.push(
      React.createElement("tui-text", { key: "gutter" }, " ".repeat(ctx.gutterWidth)),
    );
  }
  valChildren.push(
    React.createElement(
      "tui-text",
      { key: "sel-val", bold: true, color: ctx.colors.text.primary },
      `${selBar.label}: ${valStr}`,
    ),
  );
  return React.createElement("tui-box", { key: "sel-info", flexDirection: "row" }, ...valChildren);
}

function renderVerticalValueLabels(ctx: VerticalCtx): React.ReactElement | null {
  if (!ctx.showValues || ctx.isInteractive) return null;

  const valChildren: React.ReactElement[] = [];
  if (ctx.showAxes) {
    valChildren.push(
      React.createElement("tui-text", { key: "gutter" }, " ".repeat(ctx.gutterWidth)),
    );
  }
  for (let bi = 0; bi < ctx.numBars; bi++) {
    if (bi > 0 && ctx.barGap > 0) {
      valChildren.push(
        React.createElement("tui-text", { key: `vg-${bi}` }, " ".repeat(ctx.barGap)),
      );
    }
    const total = barTotal(ctx.data[bi]!, ctx.mode);
    const valStr = formatValue(total, ctx.colWidth);
    valChildren.push(
      React.createElement(
        "tui-text",
        { key: `val-${bi}`, color: ctx.colors.text.secondary },
        padCenter(valStr, ctx.colWidth),
      ),
    );
  }
  return React.createElement("tui-box", { key: "values", flexDirection: "row" }, ...valChildren);
}

function renderVerticalPositiveRows(ctx: VerticalCtx): React.ReactElement[] {
  const rows: React.ReactElement[] = [];

  for (let row = ctx.posRows - 1; row >= 0; row--) {
    const rowChildren: React.ReactElement[] = [];
    const rowStart = row * 8;

    // Y-axis label
    if (ctx.showAxes) {
      let yLabel: string;
      if (row === ctx.posRows - 1) {
        yLabel = formatValue(ctx.maxVal, ctx.gutterWidth - 2).padStart(ctx.gutterWidth - 2);
      } else if (row === 0 && !ctx.hasNeg) {
        yLabel = formatValue(0, ctx.gutterWidth - 2).padStart(ctx.gutterWidth - 2);
      } else if (row === Math.floor(ctx.posRows / 2)) {
        yLabel = formatValue(Math.round(ctx.maxVal / 2), ctx.gutterWidth - 2).padStart(ctx.gutterWidth - 2);
      } else {
        yLabel = " ".repeat(ctx.gutterWidth - 2);
      }

      rowChildren.push(
        React.createElement(
          "tui-text",
          { key: "y-label", color: ctx.axisColor },
          yLabel + " \u2502",
        ),
      );
    }

    // Bars for this row (positive region)
    for (let bi = 0; bi < ctx.numBars; bi++) {
      if (bi > 0 && ctx.barGap > 0) {
        rowChildren.push(
          React.createElement("tui-text", { key: `gap-${bi}` }, " ".repeat(ctx.barGap)),
        );
      }

      const bar = ctx.data[bi]!;
      const isSelected = ctx.isInteractive && bi === ctx.selectedIdx;
      const highlightColor = isSelected ? ctx.colors.brand.light : undefined;

      if (ctx.mode === "grouped") {
        for (let si = 0; si < bar.segments.length; si++) {
          const seg = bar.segments[si]!;
          const val = Math.max(0, seg.value);
          const h = ctx.maxVal > 0 ? (val / ctx.maxVal) * ctx.posLevels : 0;
          let char: string;
          if (h >= rowStart + 8) {
            char = VBLOCK[8]!;
          } else if (h > rowStart) {
            const fraction = h - rowStart;
            const charIdx = Math.max(1, Math.min(8, Math.round(fraction)));
            char = VBLOCK[charIdx]!;
          } else {
            char = " ";
          }
          rowChildren.push(
            React.createElement(
              "tui-text",
              { key: `b-${bi}-${si}`, color: highlightColor ?? seg.color },
              char.repeat(ctx.subColWidth),
            ),
          );
        }
      } else {
        const segHeights: number[] = [];
        let cumulative = 0;
        for (const seg of bar.segments) {
          const val = Math.max(0, seg.value);
          cumulative += val;
          segHeights.push(ctx.maxVal > 0 ? (cumulative / ctx.maxVal) * ctx.posLevels : 0);
        }

        let segIdx = -1;
        let segStart = 0;
        let segEnd = 0;
        let prevEnd = 0;
        for (let si = 0; si < bar.segments.length; si++) {
          segStart = prevEnd;
          segEnd = segHeights[si]!;
          if (segEnd > rowStart) {
            segIdx = si;
            break;
          }
          prevEnd = segEnd;
        }

        if (segIdx === -1) {
          rowChildren.push(
            React.createElement(
              "tui-text",
              { key: `b-${bi}` },
              " ".repeat(ctx.colWidth),
            ),
          );
        } else {
          const segColor = highlightColor ?? bar.segments[segIdx]!.color;
          if (segStart <= rowStart && segEnd >= rowStart + 8) {
            rowChildren.push(
              React.createElement(
                "tui-text",
                { key: `b-${bi}`, color: segColor },
                VBLOCK[8]!.repeat(ctx.colWidth),
              ),
            );
          } else if (segEnd > rowStart && segEnd < rowStart + 8 && segStart <= rowStart) {
            const fraction = segEnd - rowStart;
            const charIdx = Math.max(1, Math.min(8, Math.round(fraction)));
            rowChildren.push(
              React.createElement(
                "tui-text",
                { key: `b-${bi}`, color: segColor },
                VBLOCK[charIdx]!.repeat(ctx.colWidth),
              ),
            );
          } else {
            rowChildren.push(
              React.createElement(
                "tui-text",
                { key: `b-${bi}`, color: segColor },
                VBLOCK[8]!.repeat(ctx.colWidth),
              ),
            );
          }
        }
      }
    }

    rows.push(
      React.createElement(
        "tui-box",
        { key: `row-${row}`, flexDirection: "row" },
        ...rowChildren,
      ),
    );
  }

  return rows;
}

function renderVerticalNegativeRegion(ctx: VerticalCtx): React.ReactElement[] {
  if (!ctx.hasNeg) return [];

  const rows: React.ReactElement[] = [];

  // Zero-line separator
  const zeroLineChildren: React.ReactElement[] = [];
  if (ctx.showAxes) {
    const zeroLabel = formatValue(0, ctx.gutterWidth - 2).padStart(ctx.gutterWidth - 2);
    zeroLineChildren.push(
      React.createElement(
        "tui-text",
        { key: "y-zero", color: ctx.axisColor },
        zeroLabel + " \u253C", // ┼ cross
      ),
    );
  }
  const axisBarWidth = ctx.numBars * ctx.colWidth + (ctx.numBars - 1) * ctx.barGap;
  zeroLineChildren.push(
    React.createElement(
      "tui-text",
      { key: "zero-line", color: ctx.axisColor },
      "\u2500".repeat(axisBarWidth),
    ),
  );
  rows.push(
    React.createElement(
      "tui-box",
      { key: "zero-line-row", flexDirection: "row" },
      ...zeroLineChildren,
    ),
  );

  // Negative region chart rows (top to bottom, i.e. just below zero)
  for (let row = ctx.negRows - 1; row >= 0; row--) {
    const rowChildren: React.ReactElement[] = [];
    const rowStart = row * 8;

    if (ctx.showAxes) {
      let yLabel: string;
      if (row === 0) {
        yLabel = formatValue(ctx.minVal, ctx.gutterWidth - 2).padStart(ctx.gutterWidth - 2);
      } else if (row === Math.floor(ctx.negRows / 2)) {
        yLabel = formatValue(Math.round(ctx.minVal / 2), ctx.gutterWidth - 2).padStart(ctx.gutterWidth - 2);
      } else {
        yLabel = " ".repeat(ctx.gutterWidth - 2);
      }
      rowChildren.push(
        React.createElement(
          "tui-text",
          { key: "y-label", color: ctx.axisColor },
          yLabel + " \u2502",
        ),
      );
    }

    for (let bi = 0; bi < ctx.numBars; bi++) {
      if (bi > 0 && ctx.barGap > 0) {
        rowChildren.push(
          React.createElement("tui-text", { key: `gap-${bi}` }, " ".repeat(ctx.barGap)),
        );
      }

      const bar = ctx.data[bi]!;
      const isSelected = ctx.isInteractive && bi === ctx.selectedIdx;
      const highlightColor = isSelected ? ctx.colors.brand.light : undefined;

      // For negative bars, we draw from the top (zero line) downward
      if (ctx.mode === "grouped") {
        for (let si = 0; si < bar.segments.length; si++) {
          const seg = bar.segments[si]!;
          const val = Math.min(0, seg.value);
          const absVal = Math.abs(val);
          const h = ctx.minVal < 0 ? (absVal / Math.abs(ctx.minVal)) * ctx.negLevels : 0;
          // Negative bars fill from top of negative region downward
          const invertedRowStart = (ctx.negRows - 1 - row) * 8;
          let char: string;
          if (h >= invertedRowStart + 8) {
            char = VBLOCK[8]!;
          } else if (h > invertedRowStart) {
            const fraction = h - invertedRowStart;
            const charIdx = Math.max(1, Math.min(8, Math.round(fraction)));
            char = VBLOCK_NEG[charIdx]!;
          } else {
            char = " ";
          }
          rowChildren.push(
            React.createElement(
              "tui-text",
              { key: `b-${bi}-${si}`, color: highlightColor ?? seg.color },
              char.repeat(ctx.subColWidth),
            ),
          );
        }
      } else {
        const val = barTotal(bar, ctx.mode);
        const absVal = Math.abs(Math.min(0, val));
        const h = ctx.minVal < 0 ? (absVal / Math.abs(ctx.minVal)) * ctx.negLevels : 0;
        const invertedRowStart = (ctx.negRows - 1 - row) * 8;
        let char: string;
        if (h >= invertedRowStart + 8) {
          char = VBLOCK[8]!;
        } else if (h > invertedRowStart) {
          const fraction = h - invertedRowStart;
          const charIdx = Math.max(1, Math.min(8, Math.round(fraction)));
          char = VBLOCK_NEG[charIdx]!;
        } else {
          char = " ";
        }
        const segColor = highlightColor ?? bar.segments[0]!.color;
        rowChildren.push(
          React.createElement(
            "tui-text",
            { key: `b-${bi}`, color: segColor },
            char.repeat(ctx.colWidth),
          ),
        );
      }
    }

    rows.push(
      React.createElement(
        "tui-box",
        { key: `neg-row-${row}`, flexDirection: "row" },
        ...rowChildren,
      ),
    );
  }

  return rows;
}

function renderVerticalXAxis(ctx: VerticalCtx): React.ReactElement | null {
  if (!ctx.showAxes || ctx.hasNeg) return null;

  const axisWidth = ctx.numBars * ctx.colWidth + (ctx.numBars - 1) * ctx.barGap;
  const xAxisLine =
    " ".repeat(ctx.gutterWidth - 1) + "\u2514" + "\u2500".repeat(axisWidth);
  return React.createElement(
    "tui-text",
    { key: "x-axis", color: ctx.axisColor },
    xAxisLine,
  );
}

function renderVerticalXLabels(ctx: VerticalCtx): React.ReactElement {
  const labelChildren: React.ReactElement[] = [];
  if (ctx.showAxes) {
    labelChildren.push(
      React.createElement("tui-text", { key: "x-pad" }, " ".repeat(ctx.gutterWidth)),
    );
  }
  for (let bi = 0; bi < ctx.numBars; bi++) {
    if (bi > 0 && ctx.barGap > 0) {
      labelChildren.push(
        React.createElement("tui-text", { key: `lg-${bi}` }, " ".repeat(ctx.barGap)),
      );
    }
    const isSelected = ctx.isInteractive && bi === ctx.selectedIdx;
    labelChildren.push(
      React.createElement(
        "tui-text",
        {
          key: `xl-${bi}`,
          color: isSelected ? ctx.colors.text.primary : ctx.colors.text.secondary,
          ...(isSelected ? { bold: true } : {}),
        },
        padCenter(isSelected ? `[${ctx.data[bi]!.label}]` : ctx.data[bi]!.label, ctx.colWidth),
      ),
    );
  }
  return React.createElement("tui-box", { key: "x-labels", flexDirection: "row" }, ...labelChildren);
}

function renderVertical(
  data: InternalBar[],
  mode: "simple" | "stacked" | "grouped",
  props: BarChartProps,
  selectedIdx: number,
  isInteractive: boolean,
  colors: import("../../theme/colors.js").StormColors,
): React.ReactElement {
  const numBars = data.length;
  if (numBars === 0) {
    return React.createElement("tui-text", { color: colors.text.dim }, "(no data)");
  }

  const ctx = buildVerticalCtx(data, mode, props, selectedIdx, isInteractive, colors);

  if (ctx.maxVal === 0 && ctx.minVal === 0) {
    return React.createElement("tui-text", { color: colors.text.dim }, "(all zero)");
  }

  const rows: React.ReactElement[] = [];

  const title = renderVerticalTitle(ctx);
  if (title) rows.push(title);

  const tooltip = renderVerticalTooltip(ctx);
  if (tooltip) rows.push(tooltip);

  const valueLabels = renderVerticalValueLabels(ctx);
  if (valueLabels) rows.push(valueLabels);

  rows.push(...renderVerticalPositiveRows(ctx));
  rows.push(...renderVerticalNegativeRegion(ctx));

  const xAxis = renderVerticalXAxis(ctx);
  if (xAxis) rows.push(xAxis);

  rows.push(renderVerticalXLabels(ctx));

  // Legend
  if (props.showLegend && mode !== "simple") {
    const legend = buildLegend(data, mode, colors);
    if (legend) rows.push(legend);
  }

  return React.createElement("tui-box", { flexDirection: "column", role: "img" }, ...rows);
}

// ── Shared context type for horizontal render helpers ──

interface HorizontalCtx {
  data: InternalBar[];
  mode: "simple" | "stacked" | "grouped";
  props: BarChartProps;
  selectedIdx: number;
  isInteractive: boolean;
  colors: StormColors;
  totalWidth: number;
  axisColor: string | number;
  showValues: boolean;
  barGap: number;
  showAxes: boolean;
  numBars: number;
  maxLabelWidth: number;
  labelGutter: number;
  maxVal: number;
  valueWidth: number;
  axisWidth: number;
  barAreaWidth: number;
  totalLevels: number;
}

function buildHorizontalCtx(
  data: InternalBar[],
  mode: "simple" | "stacked" | "grouped",
  props: BarChartProps,
  selectedIdx: number,
  isInteractive: boolean,
  colors: StormColors,
): HorizontalCtx {
  const totalWidth = props.width ?? 60;
  const axisColor = props.axisColor ?? colors.text.dim;
  const showValues = props.showValues === true;
  const barGap = props.barGap ?? 0;
  const showAxes = props.showAxes !== false;

  const numBars = data.length;

  const maxLabelWidth = Math.max(...data.map((b) => b.label.length), 3);
  const labelGutter = maxLabelWidth + 1;

  const maxVal = Math.max(...data.map((b) => barTotal(b, mode)), 0);

  const valueWidth = showValues ? 8 : 0;
  const axisW = showAxes ? 1 : 0;
  const barAreaWidth = Math.max(1, totalWidth - labelGutter - axisW - valueWidth);
  const totalLevels = barAreaWidth * 8;

  return {
    data, mode, props, selectedIdx, isInteractive, colors,
    totalWidth, axisColor, showValues, barGap, showAxes,
    numBars, maxLabelWidth, labelGutter, maxVal,
    valueWidth, axisWidth: axisW, barAreaWidth, totalLevels,
  };
}

function renderHorizontalTitle(ctx: HorizontalCtx): React.ReactElement | null {
  if (ctx.props.title === undefined) return null;
  return React.createElement(
    "tui-box",
    { key: "title", flexDirection: "row" },
    React.createElement(
      "tui-text",
      { bold: true, color: ctx.colors.text.primary },
      ctx.props.title,
    ),
  );
}

function renderHorizontalGroupedBar(ctx: HorizontalCtx, bi: number): React.ReactElement[] {
  const bar = ctx.data[bi]!;
  const isSelected = ctx.isInteractive && bi === ctx.selectedIdx;
  const elements: React.ReactElement[] = [];

  for (let si = 0; si < bar.segments.length; si++) {
    const seg = bar.segments[si]!;
    const rowKey = `bar-${bi}-${si}`;
    const rowChildren: React.ReactElement[] = [];

    // Label (only on first sub-bar)
    const labelText = si === 0 ? bar.label.padEnd(ctx.labelGutter) : " ".repeat(ctx.labelGutter);
    rowChildren.push(
      React.createElement(
        "tui-text",
        {
          key: "label",
          color: isSelected ? ctx.colors.text.primary : ctx.colors.text.secondary,
          ...(isSelected ? { bold: true } : {}),
        },
        labelText,
      ),
    );

    // Axis
    if (ctx.showAxes) {
      rowChildren.push(
        React.createElement("tui-text", { key: "axis", color: ctx.axisColor }, "\u2502"),
      );
    }

    // Bar
    const h = (seg.value / ctx.maxVal) * ctx.totalLevels;
    const fullChars = Math.floor(h / 8);
    const remainder = h - fullChars * 8;
    const partialIdx = Math.round(remainder);
    let barStr = HBLOCK[8]!.repeat(fullChars);
    if (partialIdx > 0 && partialIdx < 8) {
      barStr += HBLOCK[partialIdx]!;
    } else if (partialIdx === 8) {
      barStr += HBLOCK[8]!;
    }

    rowChildren.push(
      React.createElement(
        "tui-text",
        { key: "bar", color: isSelected ? ctx.colors.brand.light : seg.color },
        barStr,
      ),
    );

    // Value label
    if (ctx.showValues) {
      rowChildren.push(
        React.createElement(
          "tui-text",
          { key: "value", color: ctx.colors.text.secondary },
          " " + formatValue(seg.value, ctx.valueWidth - 1),
        ),
      );
    }

    elements.push(
      React.createElement("tui-box", { key: rowKey, flexDirection: "row" }, ...rowChildren),
    );
  }

  return elements;
}

function renderHorizontalSimpleOrStackedBar(ctx: HorizontalCtx, bi: number): React.ReactElement {
  const bar = ctx.data[bi]!;
  const isSelected = ctx.isInteractive && bi === ctx.selectedIdx;
  const rowChildren: React.ReactElement[] = [];

  // Label
  rowChildren.push(
    React.createElement(
      "tui-text",
      {
        key: "label",
        color: isSelected ? ctx.colors.text.primary : ctx.colors.text.secondary,
        ...(isSelected ? { bold: true } : {}),
      },
      bar.label.padEnd(ctx.labelGutter),
    ),
  );

  // Axis
  if (ctx.showAxes) {
    rowChildren.push(
      React.createElement("tui-text", { key: "axis", color: ctx.axisColor }, "\u2502"),
    );
  }

  if (ctx.mode === "stacked") {
    let cumulativeValue = 0;
    let prevCharPos = 0;
    for (let si = 0; si < bar.segments.length; si++) {
      const seg = bar.segments[si]!;
      cumulativeValue += seg.value;
      const cumulativeLevels = (cumulativeValue / ctx.maxVal) * ctx.totalLevels;
      const endCharPos = Math.round(cumulativeLevels / 8);
      const segChars = endCharPos - prevCharPos;

      if (segChars > 0) {
        const exactEnd = cumulativeLevels / 8;
        const fullChars = Math.floor(exactEnd) - prevCharPos;
        const remainder = cumulativeLevels - Math.floor(exactEnd) * 8;
        const partialIdx = Math.round(remainder);

        if (fullChars > 0 && partialIdx > 0 && partialIdx < 8) {
          let barStr = HBLOCK[8]!.repeat(fullChars);
          barStr += HBLOCK[partialIdx]!;
          rowChildren.push(
            React.createElement(
              "tui-text",
              { key: `seg-${si}`, color: isSelected ? ctx.colors.brand.light : seg.color },
              barStr,
            ),
          );
        } else {
          rowChildren.push(
            React.createElement(
              "tui-text",
              { key: `seg-${si}`, color: isSelected ? ctx.colors.brand.light : seg.color },
              HBLOCK[8]!.repeat(segChars),
            ),
          );
        }
      }
      prevCharPos = endCharPos;
    }
  } else {
    // Simple bar
    const seg = bar.segments[0]!;
    const h = (Math.abs(seg.value) / ctx.maxVal) * ctx.totalLevels;
    const fullChars = Math.floor(h / 8);
    const remainder = h - fullChars * 8;
    const partialIdx = Math.round(remainder);
    let barStr = HBLOCK[8]!.repeat(fullChars);
    if (partialIdx > 0 && partialIdx < 8) {
      barStr += HBLOCK[partialIdx]!;
    } else if (partialIdx === 8) {
      barStr += HBLOCK[8]!;
    }

    rowChildren.push(
      React.createElement(
        "tui-text",
        { key: "bar", color: isSelected ? ctx.colors.brand.light : seg.color },
        barStr,
      ),
    );
  }

  // Value label
  if (ctx.showValues) {
    const total = barTotal(bar, ctx.mode);
    rowChildren.push(
      React.createElement(
        "tui-text",
        { key: "value", color: ctx.colors.text.secondary },
        " " + formatValue(total, ctx.valueWidth - 1),
      ),
    );
  }

  return React.createElement("tui-box", { key: `bar-${bi}`, flexDirection: "row" }, ...rowChildren);
}

function renderHorizontalBarGap(ctx: HorizontalCtx, bi: number): React.ReactElement[] {
  const gaps: React.ReactElement[] = [];
  if (bi < ctx.numBars - 1 && ctx.barGap > 0) {
    for (let g = 0; g < ctx.barGap; g++) {
      gaps.push(
        React.createElement(
          "tui-box",
          { key: `gap-${bi}-${g}`, flexDirection: "row" },
          React.createElement("tui-text", null, " "),
        ),
      );
    }
  }
  return gaps;
}

function renderHorizontalBars(ctx: HorizontalCtx): React.ReactElement[] {
  const rows: React.ReactElement[] = [];

  for (let bi = 0; bi < ctx.numBars; bi++) {
    if (ctx.mode === "grouped") {
      rows.push(...renderHorizontalGroupedBar(ctx, bi));
    } else {
      rows.push(renderHorizontalSimpleOrStackedBar(ctx, bi));
    }
    rows.push(...renderHorizontalBarGap(ctx, bi));
  }

  return rows;
}

function renderHorizontal(
  data: InternalBar[],
  mode: "simple" | "stacked" | "grouped",
  props: BarChartProps,
  selectedIdx: number,
  isInteractive: boolean,
  colors: import("../../theme/colors.js").StormColors,
): React.ReactElement {
  const numBars = data.length;
  if (numBars === 0) {
    return React.createElement("tui-text", { color: colors.text.dim }, "(no data)");
  }

  const ctx = buildHorizontalCtx(data, mode, props, selectedIdx, isInteractive, colors);

  if (ctx.maxVal === 0) {
    return React.createElement("tui-text", { color: colors.text.dim }, "(all zero)");
  }

  const rows: React.ReactElement[] = [];

  const title = renderHorizontalTitle(ctx);
  if (title) rows.push(title);

  rows.push(...renderHorizontalBars(ctx));

  // Legend
  if (props.showLegend && mode !== "simple") {
    const legend = buildLegend(data, mode, colors);
    if (legend) rows.push(legend);
  }

  return React.createElement("tui-box", { flexDirection: "column", role: "img" }, ...rows);
}

function buildLegend(
  data: InternalBar[],
  mode: "simple" | "stacked" | "grouped",
  colors: import("../../theme/colors.js").StormColors,
): React.ReactElement | null {
  const seen = new Map<string, string | number>();
  for (const bar of data) {
    for (const seg of bar.segments) {
      const name = seg.name ?? "";
      if (name && !seen.has(name)) {
        seen.set(name, seg.color);
      }
    }
  }

  const legendChildren: React.ReactElement[] = [];
  let idx = 0;
  for (const [name, color] of seen) {
    if (idx > 0) {
      legendChildren.push(
        React.createElement("tui-text", { key: `ls-${idx}` }, "  "),
      );
    }
    legendChildren.push(
      React.createElement("tui-text", { key: `lc-${idx}`, color }, "\u2588\u2588"),
    );
    legendChildren.push(
      React.createElement(
        "tui-text",
        { key: `ln-${idx}`, color: colors.text.secondary },
        " " + name,
      ),
    );
    idx++;
  }

  return React.createElement(
    "tui-box",
    { key: "legend", flexDirection: "row", marginTop: 1 },
    ...legendChildren,
  );
}

export const BarChart = React.memo(function BarChart(rawProps: BarChartProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("BarChart", rawProps);
  const seriesPalette = getSeriesPalette(colors);
  const { bars: normalizedBars, mode } = normalizeData(props, seriesPalette, colors);
  const { interactive = false, isFocused = false, animated = false } = props;
  const { requestRender } = useTui();
  const selectedRef = useRef(0);

  // ── Animation state (imperative refs) ───
  const prevHeightsRef = useRef<number[]>([]);
  const animHeightsRef = useRef<number[]>([]);
  const targetHeightsRef = useRef<number[]>([]);
  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animStartRef = useRef(0);

  const isInteractive = interactive && isFocused;

  useInput(
    (event) => {
      if (!isInteractive) return;
      if (event.key === "left") {
        selectedRef.current = Math.max(0, selectedRef.current - 1);
        requestRender();
      } else if (event.key === "right") {
        selectedRef.current = Math.min(normalizedBars.length - 1, selectedRef.current + 1);
        requestRender();
      }
    },
    { isActive: isInteractive },
  );

  // Clean up animation timer
  useCleanup(() => {
    if (animTimerRef.current !== null) {
      clearInterval(animTimerRef.current);
      animTimerRef.current = null;
    }
  });

  if (normalizedBars.length === 0) {
    return React.createElement("tui-text", { color: colors.text.dim }, "(no data)");
  }

  // ── Compute current target bar totals for animation ───
  const currentHeights = normalizedBars.map((b) => barTotal(b, mode));

  if (animated) {
    const prevH = targetHeightsRef.current;
    let changed = prevH.length !== currentHeights.length;
    if (!changed) {
      for (let i = 0; i < currentHeights.length; i++) {
        if (prevH[i] !== currentHeights[i]) { changed = true; break; }
      }
    }

    if (changed && prevH.length > 0) {
      // Start animation from previous values to new values
      prevHeightsRef.current = animHeightsRef.current.length > 0
        ? [...animHeightsRef.current]
        : [...prevH];
      targetHeightsRef.current = [...currentHeights];
      animStartRef.current = Date.now();

      if (animTimerRef.current !== null) {
        clearInterval(animTimerRef.current);
      }

      animTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - animStartRef.current;
        const duration = 200; // ms
        const t = Math.min(1, elapsed / duration);

        const prev = prevHeightsRef.current;
        const target = targetHeightsRef.current;
        const interpolated: number[] = [];
        const len = Math.max(prev.length, target.length);
        for (let i = 0; i < len; i++) {
          const from = prev[i] ?? 0;
          const to = target[i] ?? 0;
          interpolated.push(from + (to - from) * t);
        }
        animHeightsRef.current = interpolated;
        requestRender();

        if (t >= 1) {
          clearInterval(animTimerRef.current!);
          animTimerRef.current = null;
        }
      }, 33);
    } else if (prevH.length === 0) {
      // First render: no animation, just set values
      targetHeightsRef.current = [...currentHeights];
      animHeightsRef.current = [...currentHeights];
    }
  }

  // ── Apply animated values to bars if animating ───
  let renderBars = normalizedBars;
  if (animated && animHeightsRef.current.length > 0 && animTimerRef.current !== null) {
    renderBars = normalizedBars.map((bar, idx) => {
      const animVal = animHeightsRef.current[idx] ?? barTotal(bar, mode);
      const actualVal = barTotal(bar, mode);
      if (actualVal === 0) return bar;
      const scale = animVal / actualVal;
      return {
        ...bar,
        segments: bar.segments.map((seg) => ({
          ...seg,
          value: seg.value * scale,
        })),
      };
    });
  }

  const selectedIdx = Math.min(selectedRef.current, renderBars.length - 1);
  const orientation = props.orientation ?? "vertical";

  if (orientation === "horizontal") {
    return renderHorizontal(renderBars, mode, props, selectedIdx, isInteractive, colors);
  }

  return renderVertical(renderBars, mode, props, selectedIdx, isInteractive, colors);
});
