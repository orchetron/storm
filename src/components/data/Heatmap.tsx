
import React, { useRef } from "react";
import { useColors } from "../../hooks/useColors.js";
import { useInput } from "../../hooks/useInput.js";
import { useTui } from "../../context/TuiContext.js";
import type { StormLayoutStyleProps } from "../../styles/styleProps.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { getColorAt } from "../../utils/color.js";
import { pickLayoutProps } from "../../styles/applyStyles.js";

export interface HeatmapProps extends StormLayoutStyleProps {
  /** 2D data: rows of values. data[row][col] */
  data: number[][];
  /** Row labels (left side) */
  rowLabels?: string[];
  /** Column labels (bottom) */
  colLabels?: string[];
  /** Color ramp: [low, high] hex colors. Default: dark surface to brand primary.
   *  @deprecated Use `colorStops` for multi-stop gradients. */
  colors?: [string, string];
  /** Multi-stop color gradient. Array of 2+ hex colors interpolated evenly.
   *  Takes precedence over `colors` prop when provided. */
  colorStops?: string[];
  /** Show numeric values inside cells */
  showValues?: boolean;
  /** Cell width in characters (default 3) */
  cellWidth?: number;
  title?: string;
  /** Override: must be numeric for layout width. */
  width?: number;
  /** Override: must be numeric for layout height. */
  height?: number;
  /** When true, enable interactive cell cursor navigation with arrow keys. */
  interactive?: boolean;
  /** Whether this chart is currently focused (required for interactive mode). */
  isFocused?: boolean;
  /** Custom renderer for the cursor tooltip. */
  renderTooltip?: (value: number, row: number, col: number) => React.ReactNode;
}

// FALLBACK_COLOR is used only as a static fallback when color interpolation gets
// invalid inputs. It intentionally lives outside the component/hook scope.
const FALLBACK_COLOR = "#888888";

function brightness(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // ITU-R BT.601 luma
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function formatLegendValue(value: number): string {
  if (value === 0) return "0";
  if (Math.abs(value) >= 1_000_000) return (value / 1_000_000).toFixed(1) + "M";
  if (Math.abs(value) >= 1_000) return (value / 1_000).toFixed(1) + "k";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

export const Heatmap = React.memo(function Heatmap(rawProps: HeatmapProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Heatmap", rawProps);
  const {
    data,
    rowLabels,
    colLabels,
    colors: colorRamp = [colors.surface.raised, colors.brand.primary],
    colorStops: colorStopsProp,
    showValues = false,
    cellWidth: cw = 3,
    title,
    interactive = false,
    isFocused = false,
  } = props;

  const { requestRender } = useTui();
  const cursorRowRef = useRef(0);
  const cursorColRef = useRef(0);

  const isInteractive = interactive && isFocused;

  const numRows = data.length;
  const numColsForCursor = numRows > 0 ? (data[0]?.length ?? 0) : 0;

  useInput(
    (event) => {
      if (!isInteractive) return;
      if (event.key === "left") {
        cursorColRef.current = Math.max(0, cursorColRef.current - 1);
        requestRender();
      } else if (event.key === "right") {
        cursorColRef.current = Math.min(numColsForCursor - 1, cursorColRef.current + 1);
        requestRender();
      } else if (event.key === "up") {
        cursorRowRef.current = Math.max(0, cursorRowRef.current - 1);
        requestRender();
      } else if (event.key === "down") {
        cursorRowRef.current = Math.min(numRows - 1, cursorRowRef.current + 1);
        requestRender();
      }
    },
    { isActive: isInteractive },
  );

  // Resolve color stops: colorStops takes precedence over colors
  const resolvedStops: string[] = colorStopsProp && colorStopsProp.length >= 2
    ? colorStopsProp
    : [colorRamp[0], colorRamp[1]];

  // ── Validate ────────────────────────────────────────────────────

  if (data.length === 0 || data.every((row) => row.length === 0)) {
    return React.createElement(
      "tui-text",
      { color: colors.text.dim },
      "(no data)",
    );
  }

  // ── Compute value range ─────────────────────────────────────────

  let vMin = Infinity;
  let vMax = -Infinity;

  for (const row of data) {
    for (const v of row) {
      if (v < vMin) vMin = v;
      if (v > vMax) vMax = v;
    }
  }

  if (vMin === vMax) {
    vMin = vMin - 1;
    vMax = vMax + 1;
  }
  if (!Number.isFinite(vMin)) vMin = 0;
  if (!Number.isFinite(vMax)) vMax = 1;

  const vRange = vMax - vMin;

  // ── Row label gutter width ──────────────────────────────────────

  const labelWidth = rowLabels
    ? Math.max(...rowLabels.map((l) => l.length)) + 1
    : 0;

  // ── Build rows ─────────────────────────────────────────────────

  const rows: React.ReactElement[] = [];

  // Title
  if (title !== undefined) {
    const pad = labelWidth > 0 ? " ".repeat(labelWidth) : "";
    rows.push(
      React.createElement(
        "tui-box",
        { key: "title", flexDirection: "row" },
        React.createElement(
          "tui-text",
          { bold: true, color: colors.text.primary },
          pad + title,
        ),
      ),
    );
  }

  // ── Cursor tooltip (above data) ────────────────────────────────
  if (isInteractive && numRows > 0 && numColsForCursor > 0) {
    const curRow = Math.min(cursorRowRef.current, numRows - 1);
    const curCol = Math.min(cursorColRef.current, numColsForCursor - 1);
    const curVal = data[curRow]?.[curCol] ?? 0;

    if (props.renderTooltip) {
      rows.push(
        React.createElement(
          "tui-box",
          { key: "cursor-tooltip", flexDirection: "row" },
          props.renderTooltip(curVal, curRow, curCol),
        ),
      );
    } else {
      const pad = labelWidth > 0 ? " ".repeat(labelWidth) : "";
      const rowLbl = rowLabels?.[curRow] ?? `R${curRow}`;
      const colLbl = colLabels?.[curCol] ?? `C${curCol}`;
      const tooltipText = `[${rowLbl}, ${colLbl}] = ${Number.isInteger(curVal) ? String(curVal) : curVal.toFixed(2)}`;
      rows.push(
        React.createElement(
          "tui-box",
          { key: "cursor-tooltip", flexDirection: "row" },
          React.createElement(
            "tui-text",
            { bold: true, color: colors.text.primary },
            pad + tooltipText,
          ),
        ),
      );
    }
  }

  // Data rows
  for (let ri = 0; ri < data.length; ri++) {
    const row = data[ri]!;
    const rowChildren: React.ReactElement[] = [];

    // Row label
    if (rowLabels) {
      const label = (rowLabels[ri] ?? "").padStart(labelWidth - 1) + " ";
      rowChildren.push(
        React.createElement(
          "tui-text",
          { key: "label", color: colors.text.secondary },
          label,
        ),
      );
    }

    // Cells
    const isCursorRow = isInteractive && ri === Math.min(cursorRowRef.current, numRows - 1);
    for (let ci = 0; ci < row.length; ci++) {
      const value = row[ci]!;
      const t = (value - vMin) / vRange;
      const cellColor = getColorAt(resolvedStops, t);
      const isCursorCell = isCursorRow && ci === Math.min(cursorColRef.current, numColsForCursor - 1);

      let cellContent: string;
      if (showValues) {
        // Center the value within cellWidth
        const valStr = Number.isInteger(value)
          ? String(value)
          : value.toFixed(1);
        const truncated = valStr.length > cw ? valStr.slice(0, cw) : valStr;
        const padTotal = Math.max(0, cw - truncated.length);
        const padLeft = Math.floor(padTotal / 2);
        const padRight = padTotal - padLeft;
        cellContent = " ".repeat(padLeft) + truncated + " ".repeat(padRight);
      } else {
        cellContent = " ".repeat(cw);
      }

      // Choose text color for contrast against the background
      const textColor = showValues
        ? brightness(cellColor) > 128
          ? colors.surface.base
          : colors.text.primary
        : cellColor; // when no values, text color doesn't matter

      if (isCursorCell) {
        // Highlight cursor cell with inverse styling (swap fg/bg)
        rowChildren.push(
          React.createElement(
            "tui-text",
            {
              key: `c-${ci}`,
              backgroundColor: colors.text.primary,
              color: colors.surface.base,
              bold: true,
            },
            cellContent,
          ),
        );
      } else {
        rowChildren.push(
          React.createElement(
            "tui-text",
            {
              key: `c-${ci}`,
              backgroundColor: cellColor,
              ...(showValues ? { color: textColor } : {}),
            },
            cellContent,
          ),
        );
      }
    }

    rows.push(
      React.createElement(
        "tui-box",
        { key: `row-${ri}`, flexDirection: "row" },
        ...rowChildren,
      ),
    );
  }

  // Column labels
  if (colLabels && colLabels.length > 0) {
    const colLabelChildren: React.ReactElement[] = [];

    // Pad for row label gutter
    if (labelWidth > 0) {
      colLabelChildren.push(
        React.createElement(
          "tui-text",
          { key: "pad" },
          " ".repeat(labelWidth),
        ),
      );
    }

    for (let ci = 0; ci < colLabels.length; ci++) {
      const label = colLabels[ci] ?? "";
      // Truncate / pad to cellWidth
      const truncated = label.length > cw ? label.slice(0, cw) : label;
      const padTotal = Math.max(0, cw - truncated.length);
      const padLeft = Math.floor(padTotal / 2);
      const padRight = padTotal - padLeft;
      const formatted = " ".repeat(padLeft) + truncated + " ".repeat(padRight);

      colLabelChildren.push(
        React.createElement(
          "tui-text",
          { key: `cl-${ci}`, color: colors.text.secondary },
          formatted,
        ),
      );
    }

    rows.push(
      React.createElement(
        "tui-box",
        { key: "col-labels", flexDirection: "row" },
        ...colLabelChildren,
      ),
    );
  }

  // ── Color legend bar ──────────────────────────────────────────────
  // Horizontal gradient bar showing the color scale from min to max.

  const numCols = data[0]?.length ?? 0;
  const legendBarWidth = Math.max(10, numCols * cw);
  const legendChildren: React.ReactElement[] = [];

  // Pad for row label gutter
  if (labelWidth > 0) {
    legendChildren.push(
      React.createElement("tui-text", { key: "legend-pad" }, " ".repeat(labelWidth)),
    );
  }

  // Min label
  const minLabel = formatLegendValue(vMin);
  legendChildren.push(
    React.createElement(
      "tui-text",
      { key: "legend-min", color: colors.text.secondary },
      minLabel + " ",
    ),
  );

  // Gradient bar: each character gets a different background color
  const barWidth = Math.max(4, legendBarWidth - minLabel.length - formatLegendValue(vMax).length - 2);
  for (let i = 0; i < barWidth; i++) {
    const t = barWidth <= 1 ? 0 : i / (barWidth - 1);
    const barColor = getColorAt(resolvedStops, t);
    legendChildren.push(
      React.createElement(
        "tui-text",
        { key: `lb-${i}`, backgroundColor: barColor },
        " ",
      ),
    );
  }

  // Max label
  const maxLabel = formatLegendValue(vMax);
  legendChildren.push(
    React.createElement(
      "tui-text",
      { key: "legend-max", color: colors.text.secondary },
      " " + maxLabel,
    ),
  );

  rows.push(
    React.createElement(
      "tui-box",
      { key: "color-legend", flexDirection: "row", marginTop: 1 },
      ...legendChildren,
    ),
  );

  // ── Assemble ────────────────────────────────────────────────────

  const outerBoxProps: Record<string, unknown> = {
    flexDirection: "column",
    overflow: "hidden",
    role: "img",
    ...pickLayoutProps(props),
  };

  return React.createElement(
    "tui-box",
    outerBoxProps,
    ...rows,
  );
});
