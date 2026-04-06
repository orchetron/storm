import React from "react";

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

/**
 * Run-length encode consecutive same-color characters into tui-text elements.
 *
 * Given parallel arrays of characters and colors, batches consecutive runs
 * of the same color into single tui-text elements for efficient rendering.
 */
export function batchColorRuns(
  chars: string[],
  colors: (string | number)[],
  keyPrefix: string = "s",
): React.ReactElement[] {
  const elements: React.ReactElement[] = [];
  let runStart = 0;
  let spanIdx = 0;
  while (runStart < chars.length) {
    const runColor = colors[runStart]!;
    let runEnd = runStart + 1;
    while (runEnd < chars.length && colors[runEnd] === runColor) {
      runEnd++;
    }
    let text = "";
    for (let c = runStart; c < runEnd; c++) {
      text += chars[c]!;
    }
    elements.push(
      React.createElement(
        "tui-text",
        { key: `${keyPrefix}-${spanIdx}`, color: runColor },
        text,
      ),
    );
    spanIdx++;
    runStart = runEnd;
  }
  return elements;
}

/**
 * Interpolate across multiple color stops evenly spaced from 0 to 1.
 */
export function getColorAt(stops: string[], position: number): string {
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
