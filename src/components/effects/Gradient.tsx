
import React, { useRef } from "react";
import { usePluginProps } from "../../hooks/usePluginProps.js";

export interface GradientProps {
  children: string;
  colors: string[];
  /** Gradient direction: "horizontal" (default) or "vertical". */
  direction?: "horizontal" | "vertical";
}

import { interpolateColor, getColorAt } from "../../utils/color.js";

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
  const props = usePluginProps("Gradient", rawProps);
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
