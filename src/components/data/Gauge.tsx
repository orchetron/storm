import React, { useId } from "react";
import { useColors } from "../../hooks/useColors.js";
import { BrailleCanvas } from "../../utils/braille-canvas.js";
import type { StormLayoutStyleProps } from "../../styles/styleProps.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { useMeasure } from "../../hooks/useMeasure.js";
import { pickLayoutProps } from "../../styles/applyStyles.js";

export interface GaugeThreshold {
  /** The value at which this threshold color activates (0-100). */
  value: number;
  /** Color to use when the gauge value is at or above this threshold. */
  color: string | number;
}

export interface GaugeProps extends StormLayoutStyleProps {
  value: number;
  label?: string;
  color?: string | number;
  width?: number;
  /** Threshold-based color breakpoints. Sorted ascending by value. */
  thresholds?: GaugeThreshold[];
  /** When true, display the numeric percentage value next to the bar. */
  showValue?: boolean;
  /** Display variant: "bar" (default) for horizontal bar, "arc" for semi-circular gauge. */
  variant?: "bar" | "arc";
  /** Custom render for the value display. */
  renderValue?: (value: number, label?: string) => React.ReactNode;
}

function resolveColor(
  clamped: number,
  color: string | number,
  thresholds: GaugeThreshold[] | undefined,
): string | number {
  let barColor: string | number = color;
  if (thresholds !== undefined && thresholds.length > 0) {
    const sorted = [...thresholds].sort((a, b) => b.value - a.value);
    for (const t of sorted) {
      if (clamped >= t.value) {
        barColor = t.color;
        break;
      }
    }
  }
  return barColor;
}

function renderBar(
  clamped: number,
  barColor: string | number,
  width: number,
  label: string | undefined,
  showValue: boolean,
  outerBoxProps: Record<string, unknown>,
): React.ReactElement {
  const colors = useColors();
  const fillWidth = (clamped / 100) * width;
  const fullBlocks = Math.floor(fillWidth);
  const fractional = fillWidth - fullBlocks;

  let bar = "\u2588".repeat(fullBlocks);

  // Use fractional part to pick intermediate block character
  if (fullBlocks < width) {
    if (fractional > 0.75) {
      bar += "\u2593"; // dark shade
    } else if (fractional > 0.5) {
      bar += "\u2592"; // medium shade
    } else if (fractional > 0.25) {
      bar += "\u2591"; // light shade
    } else if (fractional > 0) {
      bar += "\u2591"; // light shade
    }
  }

  const remaining = width - bar.length;
  const emptyStr = remaining > 0 ? " ".repeat(remaining) : "";

  const pctStr = ` ${Math.round(clamped)}%`;

  const children: React.ReactElement[] = [];

  if (label !== undefined) {
    children.push(
      React.createElement("tui-text", { key: "label" }, label + " "),
    );
  }

  children.push(
    React.createElement("tui-text", { key: "bar", color: barColor }, bar),
  );
  children.push(
    React.createElement("tui-text", { key: "empty", color: colors.text.dim }, emptyStr),
  );

  if (showValue) {
    children.push(
      React.createElement("tui-text", { key: "val", bold: true, color: barColor }, pctStr),
    );
  } else {
    children.push(
      React.createElement("tui-text", { key: "pct", color: colors.text.secondary }, pctStr),
    );
  }

  return React.createElement(
    "tui-box",
    { ...outerBoxProps, height: 1 },
    ...children,
  );
}

function renderArc(
  clamped: number,
  barColor: string | number,
  width: number,
  label: string | undefined,
  showValue: boolean,
  outerBoxProps: Record<string, unknown>,
): React.ReactElement {
  const colors = useColors();
  // Arc dimensions: width determines the horizontal span
  // Height is half the width (semi-circle) rounded up
  const arcCols = Math.max(8, width);
  const arcRows = Math.max(3, Math.ceil(arcCols / 4)); // 4 vertical pixels per row
  const pixelWidth = arcCols * 2;
  const pixelHeight = arcRows * 4;

  // Center of the arc (bottom-center of the canvas)
  const cx = pixelWidth / 2;
  const cy = pixelHeight - 1;

  // Radius: fit within the canvas
  const radius = Math.min(cx - 1, cy - 1);

  const filledCanvas = new BrailleCanvas(arcCols, arcRows);
  const emptyCanvas = new BrailleCanvas(arcCols, arcRows);

  // The arc goes from PI (left) to 0 (right) — a semi-circle
  // Filled portion: from PI to PI * (1 - clamped/100)
  const fillAngle = Math.PI * (1 - clamped / 100);
  const arcThickness = 2; // pixels thick for visibility

  const totalSteps = 200; // smooth arc resolution
  for (let step = 0; step <= totalSteps; step++) {
    const t = step / totalSteps;
    const angle = Math.PI * (1 - t); // PI to 0

    for (let thick = 0; thick < arcThickness; thick++) {
      const r = radius - thick;
      if (r <= 0) continue;

      const px = Math.round(cx + r * Math.cos(angle));
      const py = Math.round(cy - r * Math.sin(angle));

      if (angle >= fillAngle) {
        // Filled portion
        filledCanvas.set(px, py);
      } else {
        // Empty portion
        emptyCanvas.set(px, py);
      }
    }
  }

  const filledLines = filledCanvas.render();
  const emptyLines = emptyCanvas.render();

  const rows: React.ReactElement[] = [];

  // Arc rows
  for (let r = 0; r < arcRows; r++) {
    const rowChildren: React.ReactElement[] = [];

    // Composite: filled on top of empty
    const filledLine = filledLines[r]!;
    const emptyLine = emptyLines[r]!;

    for (let c = 0; c < arcCols; c++) {
      const fChar = filledLine[c]!;
      const eChar = emptyLine[c]!;
      const fBits = fChar.charCodeAt(0) - 0x2800;
      const eBits = eChar.charCodeAt(0) - 0x2800;

      if (fBits !== 0) {
        // Filled dots — merge with any empty dots in same cell
        const merged = String.fromCharCode(0x2800 + (fBits | eBits));
        // If there are both filled and empty dots, we show the filled color
        rowChildren.push(
          React.createElement(
            "tui-text",
            { key: `f-${c}`, color: barColor },
            merged,
          ),
        );
      } else if (eBits !== 0) {
        rowChildren.push(
          React.createElement(
            "tui-text",
            { key: `e-${c}`, color: colors.text.dim },
            eChar,
          ),
        );
      } else {
        rowChildren.push(
          React.createElement(
            "tui-text",
            { key: `s-${c}` },
            String.fromCharCode(0x2800),
          ),
        );
      }
    }

    rows.push(
      React.createElement(
        "tui-box",
        { key: `arc-${r}`, flexDirection: "row" },
        ...rowChildren,
      ),
    );
  }

  // Value label centered below the arc
  const pctStr = `${Math.round(clamped)}%`;
  const valueWidth = pctStr.length;
  const centerPad = Math.max(0, Math.floor((arcCols - valueWidth) / 2));

  rows.push(
    React.createElement(
      "tui-box",
      { key: "value-row", flexDirection: "row" },
      React.createElement("tui-text", { key: "vpad" }, " ".repeat(centerPad)),
      React.createElement(
        "tui-text",
        { key: "vtext", bold: true, color: showValue ? barColor : colors.text.secondary },
        pctStr,
      ),
    ),
  );

  // Optional label below the value
  if (label !== undefined) {
    const labelPad = Math.max(0, Math.floor((arcCols - label.length) / 2));
    rows.push(
      React.createElement(
        "tui-box",
        { key: "label-row", flexDirection: "row" },
        React.createElement("tui-text", { key: "lpad" }, " ".repeat(labelPad)),
        React.createElement(
          "tui-text",
          { key: "ltext", color: colors.text.secondary },
          label,
        ),
      ),
    );
  }

  return React.createElement(
    "tui-box",
    { ...outerBoxProps, flexDirection: "column" },
    ...rows,
  );
}

const DEFAULT_GAUGE_WIDTH = 20;

export const Gauge = React.memo(function Gauge(rawProps: GaugeProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Gauge", rawProps);
  const {
    value,
    label,
    color = colors.brand.primary,
    width: widthProp,
    thresholds,
    showValue = false,
    variant = "bar",
  } = props;

  // Auto-measure width from layout when not explicitly provided
  const measureId = useId();
  const autoMeasure = widthProp === undefined;
  const measured = useMeasure(autoMeasure ? `gauge-${measureId}` : "");
  const width = widthProp ?? measured?.width ?? DEFAULT_GAUGE_WIDTH;

  const clamped = Math.max(0, Math.min(100, value));
  const barColor = resolveColor(clamped, color, thresholds);

  const outerBoxProps: Record<string, unknown> = {
    flexDirection: "row",
    role: "meter",
    ...pickLayoutProps(props),
  };

  /** Wrap result in a measurement box when auto-measuring. */
  const wrapMeasure = (el: React.ReactElement): React.ReactElement => {
    if (!autoMeasure) return el;
    return React.createElement(
      "tui-box",
      { _measureId: `gauge-${measureId}`, flex: 1 },
      el,
    );
  };

  if (props.renderValue) {
    return wrapMeasure(React.createElement(
      "tui-box",
      outerBoxProps,
      props.renderValue(value, label),
    ));
  }

  if (variant === "arc") {
    return wrapMeasure(renderArc(clamped, barColor, width, label, showValue, outerBoxProps));
  }

  return wrapMeasure(renderBar(clamped, barColor, width, label, showValue, outerBoxProps));
});
