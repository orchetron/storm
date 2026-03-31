/**
 * GradientProgress — progress bar with color gradient on the filled portion.
 *
 * The filled section transitions across multiple color stops using
 * per-character color interpolation. The leading edge uses a soft
 * falloff (▓▒░). Empty portion renders as dim ░.
 *
 * Supports multi-stop gradients via the `colors` prop, with backwards
 * compatibility for the legacy `fromColor`/`toColor` props.
 */

import React from "react";
import { interpolateColor } from "./Gradient.js";
import type { StormLayoutStyleProps } from "../styles/styleProps.js";
import { usePluginProps } from "../hooks/usePluginProps.js";
import { useColors } from "../hooks/useColors.js";

export interface GradientProgressProps extends StormLayoutStyleProps {
  value: number;
  width?: number;
  /** Multi-stop gradient colors. Array of 2+ hex colors interpolated evenly.
   *  Takes precedence over fromColor/toColor. */
  colors?: string[];
  /** @deprecated Use `colors` array instead. Start color for 2-stop gradient. */
  fromColor?: string;
  /** @deprecated Use `colors` array instead. End color for 2-stop gradient. */
  toColor?: string;
  showPercentage?: boolean;
  label?: string;
  /** Custom render for the label and value display. */
  renderLabel?: (value: number, label?: string) => React.ReactNode;
}

/**
 * Interpolate across multiple color stops evenly spaced from 0 to 1.
 */
function getColorAt(stops: string[], position: number): string {
  if (stops.length === 0) return "#FFFFFF";
  if (stops.length === 1) return stops[0]!;
  if (stops.length === 2) return interpolateColor(stops[0]!, stops[1]!, position);

  const clamped = Math.max(0, Math.min(1, position));
  const segments = stops.length - 1;
  const scaledPos = clamped * segments;
  const segIndex = Math.min(Math.floor(scaledPos), segments - 1);
  const t = scaledPos - segIndex;

  return interpolateColor(stops[segIndex]!, stops[segIndex + 1]!, t);
}

export const GradientProgress = React.memo(function GradientProgress(rawProps: GradientProgressProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("GradientProgress", rawProps as unknown as Record<string, unknown>) as unknown as GradientProgressProps;
  const {
    value,
    width = 20,
    colors: colorsProp,
    fromColor,
    toColor,
    showPercentage = false,
    label,
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

  // Resolve gradient stops: colors prop > fromColor/toColor > defaults
  const defaultViolet = colors.brand.primary;
  const defaultMint = colors.brand.glow;
  let gradientStops: string[];
  if (colorsProp !== undefined && colorsProp.length >= 2) {
    gradientStops = colorsProp;
  } else if (fromColor !== undefined && toColor !== undefined) {
    gradientStops = [fromColor, toColor];
  } else if (fromColor !== undefined) {
    gradientStops = [fromColor, defaultMint];
  } else if (toColor !== undefined) {
    gradientStops = [defaultViolet, toColor];
  } else {
    gradientStops = [defaultViolet, defaultMint];
  }

  const clamped = Math.max(0, Math.min(100, value));
  // Number of fully filled characters (not counting the soft edge)
  const filledExact = (clamped / 100) * width;
  const filledFull = Math.floor(filledExact);
  const fractional = filledExact - filledFull;

  const children: React.ReactElement[] = [];

  if (props.renderLabel) {
    children.push(
      React.createElement(React.Fragment, { key: "label" }, props.renderLabel(value, label)),
    );
  } else if (label !== undefined) {
    children.push(
      React.createElement("tui-text", { key: "label" }, label + " "),
    );
  }

  // Render filled portion with gradient colors
  for (let i = 0; i < filledFull && i < width; i++) {
    const t = filledFull <= 1 ? 0 : i / (filledFull - 1);
    const color = getColorAt(gradientStops, t);
    children.push(
      React.createElement("tui-text", { key: `f${i}`, color }, "\u2588"),
    );
  }

  // Soft leading edge: ▓▒░ for the fractional part
  let edgeChars = 0;
  if (filledFull < width && fractional > 0) {
    const edgeColor = filledFull > 0
      ? getColorAt(gradientStops, 1)
      : gradientStops[0]!;

    if (fractional > 0.66) {
      children.push(
        React.createElement("tui-text", { key: "e0", color: edgeColor }, "\u2593"),
      );
      edgeChars = 1;
    } else if (fractional > 0.33) {
      children.push(
        React.createElement("tui-text", { key: "e0", color: edgeColor }, "\u2592"),
      );
      edgeChars = 1;
    } else {
      children.push(
        React.createElement("tui-text", { key: "e0", color: edgeColor }, "\u2591"),
      );
      edgeChars = 1;
    }
  }

  // Empty portion (guard against negative from rounding)
  const emptyCount = Math.max(0, width - filledFull - edgeChars);
  if (emptyCount > 0) {
    children.push(
      React.createElement(
        "tui-text",
        { key: "empty", color: colors.text.dim, dim: true },
        "\u2591".repeat(Math.max(0, emptyCount)),
      ),
    );
  }

  // Percentage label
  if (showPercentage) {
    children.push(
      React.createElement("tui-text", { key: "pct" }, ` ${Math.round(clamped)}%`),
    );
  }

  const outerBoxProps: Record<string, unknown> = {
    role: "progressbar",
    flexDirection: "row",
    height: 1,
    overflow: "hidden",
    flexShrink: 0,
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
    ...children,
  );
});
