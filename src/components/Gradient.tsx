/**
 * Gradient — text with color gradient.
 *
 * Interpolates between an array of hex colors across the text length,
 * rendering each character as an individual tui-text element with its
 * computed color.
 *
 * Features:
 *   - direction: "horizontal" (default) applies gradient across columns,
 *     "vertical" applies gradient across rows (newline-separated lines)
 */

import React, { useRef } from "react";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface GradientProps {
  children: string;
  colors: string[];
  /** Gradient direction: "horizontal" (default) or "vertical". */
  direction?: "horizontal" | "vertical";
}

/**
 * Linearly interpolate between two hex colors.
 * @param color1 - Start hex color (e.g. "#D4A053")
 * @param color2 - End hex color (e.g. "#6DBF8B")
 * @param t - Interpolation factor from 0 to 1
 * @returns Interpolated hex color string
 */
export function interpolateColor(color1: string, color2: string, t: number): string {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  const toHex = (n: number): string => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getColorAt(colorStops: string[], position: number): string {
  if (colorStops.length === 0) return "#FFFFFF";
  if (colorStops.length === 1) return colorStops[0]!;

  const segments = colorStops.length - 1;
  const scaledPos = position * segments;
  const segIndex = Math.min(Math.floor(scaledPos), segments - 1);
  const t = scaledPos - segIndex;

  return interpolateColor(colorStops[segIndex]!, colorStops[segIndex + 1]!, t);
}

/**
 * Build horizontal gradient elements — gradient across columns (characters).
 */
function buildHorizontalElements(text: string, colorStops: string[]): React.ReactElement[] {
  const chars = [...text];
  const len = chars.length;

  const elements: React.ReactElement[] = [];
  let batchStart = 0;
  let batchColor = getColorAt(colorStops, 0);
  let batchChars = "";

  for (let i = 0; i < len; i++) {
    const position = len <= 1 ? 0 : i / (len - 1);
    const charColor = getColorAt(colorStops, position);

    if (charColor === batchColor) {
      batchChars += chars[i]!;
    } else {
      elements.push(
        React.createElement("tui-text", { color: batchColor, key: batchStart }, batchChars),
      );
      batchStart = i;
      batchColor = charColor;
      batchChars = chars[i]!;
    }
  }
  if (batchChars.length > 0) {
    elements.push(
      React.createElement("tui-text", { color: batchColor, key: batchStart }, batchChars),
    );
  }

  return elements;
}

/**
 * Build vertical gradient elements — gradient across rows (lines).
 * Each line gets a uniform color based on its row position.
 */
function buildVerticalElements(text: string, colorStops: string[]): React.ReactElement[] {
  const lines = text.split("\n");
  const lineCount = lines.length;

  return lines.map((line, i) => {
    const position = lineCount <= 1 ? 0 : i / (lineCount - 1);
    const lineColor = getColorAt(colorStops, position);
    return React.createElement("tui-text", { color: lineColor, key: i }, line);
  });
}

export const Gradient = React.memo(function Gradient(rawProps: GradientProps): React.ReactElement {
  const props = usePluginProps("Gradient", rawProps as unknown as Record<string, unknown>) as unknown as GradientProps;
  const { children: text, colors: colorStops, direction = "horizontal" } = props;

  const gradientCacheRef = useRef<{ text: string; colors: string; direction: string; elements: React.ReactElement[] } | null>(null);
  const colorsKey = JSON.stringify(colorStops);

  let elements: React.ReactElement[];

  if (
    gradientCacheRef.current?.text === text &&
    gradientCacheRef.current?.colors === colorsKey &&
    gradientCacheRef.current?.direction === direction
  ) {
    elements = gradientCacheRef.current.elements;
  } else {
    if (direction === "vertical") {
      elements = buildVerticalElements(text, colorStops);
    } else {
      elements = buildHorizontalElements(text, colorStops);
    }
    gradientCacheRef.current = { text, colors: colorsKey, direction, elements };
  }

  return React.createElement(
    "tui-box",
    { flexDirection: direction === "vertical" ? "column" : "row" },
    ...elements,
  );
});
