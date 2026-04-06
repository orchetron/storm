import React, { useId } from "react";
import { BrailleCanvas } from "../../utils/braille-canvas.js";
import type { StormLayoutStyleProps } from "../../styles/styleProps.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { useColors } from "../../hooks/useColors.js";
import { useMeasure } from "../../hooks/useMeasure.js";
import { pickLayoutProps } from "../../styles/applyStyles.js";
import { batchColorRuns } from "../../utils/color.js";

export interface SparklineProps extends StormLayoutStyleProps {
  data: readonly number[];
  /** Override: must be numeric for sparkline width calculation. */
  width?: number;
  /** Override: must be numeric for sparkline height calculation. */
  height?: number;
  min?: number;
  max?: number;
  /** Color for empty space in multi-row mode. */
  fillColor?: string | number;
  /** Label rendered centered below the sparkline. */
  label?: string;
  /** Per-bar conditional color function. Return undefined to fall back to `color` prop. */
  colorFn?: (value: number, index: number, data: readonly number[]) => string | number | undefined;
  /** When true, highlight min bar in error color and max bar in success color. */
  showMinMax?: boolean;
  /** Rendering mode: "bar" (block characters) or "line" (braille connected line). */
  mode?: "bar" | "line";
  /** Custom renderer for the label. */
  renderLabel?: (label: string, data: number[]) => React.ReactNode;
}

// 8 block levels from lowest to highest
const BLOCKS = ["\u2581", "\u2582", "\u2583", "\u2584", "\u2585", "\u2586", "\u2587", "\u2588"];
// ▁▂▃▄▅▆▇█

const MAX_HEIGHT = 4;
/** Default height when not explicitly provided. 3 rows gives good visual resolution. */
const DEFAULT_SPARKLINE_HEIGHT = 3;

function resample(data: readonly number[], targetWidth: number): number[] {
  if (data.length <= targetWidth) {
    return [...data];
  }
  const result: number[] = [];
  const step = data.length / targetWidth;
  for (let i = 0; i < targetWidth; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
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

function renderLineMode(
  samples: number[],
  dataMin: number,
  dataMax: number,
  range: number,
  targetWidth: number,
  height: number,
  lineColor: string | number,
  label: string | undefined,
  outerBoxProps: Record<string, unknown>,
  renderLabelFn?: (label: string, data: number[]) => React.ReactNode,
  originalData?: readonly number[],
): React.ReactElement {
  const chartCols = targetWidth;
  const chartRows = height;
  const pixelWidth = chartCols * 2;
  const pixelHeight = chartRows * 4;

  const canvas = new BrailleCanvas(chartCols, chartRows);

  const isConstant = dataMax === dataMin;

  for (let i = 0; i < samples.length; i++) {
    const normalized = isConstant ? 0.5 : (samples[i]! - dataMin) / range;
    const px = samples.length <= 1
      ? 0
      : Math.round((i / (samples.length - 1)) * (pixelWidth - 1));
    const py = Math.round((1 - normalized) * (pixelHeight - 1));

    canvas.set(px, py);

    if (i > 0) {
      const prevNormalized = isConstant ? 0.5 : (samples[i - 1]! - dataMin) / range;
      const prevPx = Math.round(((i - 1) / (samples.length - 1)) * (pixelWidth - 1));
      const prevPy = Math.round((1 - prevNormalized) * (pixelHeight - 1));
      canvas.line(prevPx, prevPy, px, py);
    }
  }

  const lines = canvas.render();
  const rows: React.ReactElement[] = [];

  for (let r = 0; r < chartRows; r++) {
    rows.push(
      React.createElement(
        "tui-text",
        { key: `row-${r}`, color: lineColor },
        lines[r]!,
      ),
    );
  }

  if (label !== undefined) {
    if (renderLabelFn) {
      rows.push(
        React.createElement(
          "tui-box",
          { key: "label", flexDirection: "row" },
          renderLabelFn(label, [...(originalData ?? samples)]),
        ),
      );
    } else {
      const padTotal = Math.max(0, targetWidth - label.length);
      const padLeft = Math.floor(padTotal / 2);
      const labelText = " ".repeat(padLeft) + label;
      rows.push(
        React.createElement(
          "tui-text",
          { key: "label", dim: true },
          labelText,
        ),
      );
    }
  }

  return React.createElement(
    "tui-box",
    { ...outerBoxProps, flexDirection: "column" },
    ...rows,
  );
}

export const Sparkline = React.memo(function Sparkline(rawProps: SparklineProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Sparkline", rawProps);
  const {
    data,
    color = colors.brand.primary,
    fillColor,
    label,
    colorFn,
    showMinMax = false,
    mode = "bar",
  } = props;

  // Auto-measure width from layout when not explicitly provided
  const measureId = useId();
  const autoMeasure = props.width === undefined;
  const measured = useMeasure(autoMeasure ? `sparkline-${measureId}` : "");

  const height = Math.max(1, Math.min(props.height ?? DEFAULT_SPARKLINE_HEIGHT, MAX_HEIGHT));
  const targetWidth = props.width ?? measured?.width ?? data.length;

  /** Wrap result in a measurement box when auto-measuring. */
  const wrapMeasure = (el: React.ReactElement): React.ReactElement => {
    if (!autoMeasure) return el;
    return React.createElement(
      "tui-box",
      { _measureId: `sparkline-${measureId}`, flex: 1 },
      el,
    );
  };

  if (data.length === 0) {
    return wrapMeasure(React.createElement("tui-text", null, ""));
  }

  // Resample data to target width
  const samples = resample(data, targetWidth);

  let computedMin = Infinity;
  let computedMax = -Infinity;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i]!;
    if (v < computedMin) computedMin = v;
    if (v > computedMax) computedMax = v;
  }
  const dataMin = props.min ?? computedMin;
  const dataMax = props.max ?? computedMax;
  const range = dataMax - dataMin || 1;

  const outerBoxProps: Record<string, unknown> = {
    flexDirection: "column",
    role: "img",
    ...pickLayoutProps(props),
  };

  // ── Line mode ─────────────────────────────────────────────────

  if (mode === "line") {
    return wrapMeasure(renderLineMode(
      samples,
      dataMin,
      dataMax,
      range,
      targetWidth,
      height,
      color,
      label,
      outerBoxProps,
      props.renderLabel,
      data,
    ));
  }

  // ── Bar mode (original) ───────────────────────────────────────

  // Total levels across all rows
  const totalLevels = height * BLOCKS.length;

  // When all values are identical, render at mid-height instead of flat at 0
  const isConstant = dataMax === dataMin;
  const levels = samples.map((v) => {
    if (isConstant) return Math.floor(totalLevels / 2);
    const normalized = (v - dataMin) / range;
    return Math.max(0, Math.min(totalLevels - 1, Math.round(normalized * (totalLevels - 1))));
  });

  let minIdx = -1;
  let maxIdx = -1;
  if (showMinMax && samples.length > 0) {
    let sMin = Infinity;
    let sMax = -Infinity;
    for (let i = 0; i < samples.length; i++) {
      if (samples[i]! < sMin) { sMin = samples[i]!; minIdx = i; }
      if (samples[i]! > sMax) { sMax = samples[i]!; maxIdx = i; }
    }
  }

  /** Resolve the color for a given bar index. */
  const resolveBarColor = (index: number): string | number => {
    // Min/max markers take priority
    if (showMinMax && index === minIdx) return colors.error;
    if (showMinMax && index === maxIdx) return colors.success;
    // Per-bar color function
    if (colorFn !== undefined) {
      const result = colorFn(samples[index]!, index, data);
      if (result !== undefined) return result;
    }
    return color;
  };

  /** Check if any bar needs individual coloring. */
  const needsPerBarColor = colorFn !== undefined || showMinMax;

  if (height === 1) {
    if (!needsPerBarColor) {
      // Fast path: uniform color
      const line = levels.map((level) => BLOCKS[Math.min(level, BLOCKS.length - 1)]!).join("");
      return wrapMeasure(React.createElement(
        "tui-text",
        { color },
        line,
      ));
    }

    // Per-bar coloring: batch consecutive same-color chars into spans
    const barChars = levels.map((level) => BLOCKS[Math.min(level, BLOCKS.length - 1)]!);
    const barColors = levels.map((_, i) => resolveBarColor(i));
    const children = batchColorRuns(barChars, barColors, "b");
    return wrapMeasure(React.createElement("tui-box", { flexDirection: "row" }, ...children));
  }

  // Multi-row mode: render from top row (highest) to bottom row (lowest)
  const rows: React.ReactElement[] = [];

  for (let row = height - 1; row >= 0; row--) {
    const rowStart = row * BLOCKS.length;

    if (needsPerBarColor || fillColor !== undefined) {
      // Per-character tracking path: batch consecutive same-color spans
      const cellChars: string[] = [];
      const cellBarColors: (string | number | null)[] = [];

      for (let ci = 0; ci < levels.length; ci++) {
        const level = levels[ci]!;
        if (level >= rowStart + BLOCKS.length) {
          cellChars.push(BLOCKS[BLOCKS.length - 1]!);
          cellBarColors.push(resolveBarColor(ci));
        } else if (level > rowStart) {
          const blockIndex = Math.max(0, level - rowStart - 1);
          cellChars.push(BLOCKS[Math.min(blockIndex, BLOCKS.length - 1)]!);
          cellBarColors.push(resolveBarColor(ci));
        } else {
          cellChars.push(" ");
          cellBarColors.push(null); // empty — use fillColor or no color
        }
      }

      // Batch consecutive same-color characters into spans
      const rowChildren: React.ReactElement[] = [];
      let runStart = 0;
      let spanIdx = 0;
      while (runStart < cellChars.length) {
        const isEmptyRun = cellBarColors[runStart] === null;
        const runColor = isEmptyRun ? fillColor : cellBarColors[runStart];
        let runEnd = runStart + 1;
        while (runEnd < cellChars.length) {
          const nextEmpty = cellBarColors[runEnd] === null;
          const nextColor = nextEmpty ? fillColor : cellBarColors[runEnd];
          if (isEmptyRun !== nextEmpty || runColor !== nextColor) break;
          runEnd++;
        }
        let text = "";
        for (let i = runStart; i < runEnd; i++) text += cellChars[i]!;

        const spanProps: Record<string, unknown> = { key: `s-${spanIdx}` };
        if (runColor !== undefined && runColor !== null) spanProps.color = runColor;
        rowChildren.push(React.createElement("tui-text", spanProps, text));
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
    } else {
      // Simple: uniform color, no fillColor, no per-bar coloring
      let simpleLine = "";
      for (const level of levels) {
        if (level >= rowStart + BLOCKS.length) {
          simpleLine += BLOCKS[BLOCKS.length - 1]!;
        } else if (level > rowStart) {
          const blockIndex = Math.max(0, level - rowStart - 1);
          simpleLine += BLOCKS[Math.min(blockIndex, BLOCKS.length - 1)]!;
        } else {
          simpleLine += " ";
        }
      }
      rows.push(
        React.createElement(
          "tui-text",
          { key: `row-${row}`, color },
          simpleLine,
        ),
      );
    }
  }

  if (label !== undefined) {
    if (props.renderLabel) {
      rows.push(
        React.createElement(
          "tui-box",
          { key: "label", flexDirection: "row" },
          props.renderLabel(label, [...data]),
        ),
      );
    } else {
      // Add centered label below the sparkline
      const padTotal = Math.max(0, targetWidth - label.length);
      const padLeft = Math.floor(padTotal / 2);
      const labelText = " ".repeat(padLeft) + label;
      rows.push(
        React.createElement(
          "tui-text",
          { key: "label", dim: true },
          labelText,
        ),
      );
    }
  }

  return wrapMeasure(React.createElement(
    "tui-box",
    outerBoxProps,
    ...rows,
  ));
});
