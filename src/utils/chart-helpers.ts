import type { StormColors } from "../theme/colors.js";
import { BRAILLE_BASE } from "./braille-canvas.js";

export function resample(data: number[], targetWidth: number): number[] {
  if (data.length <= targetWidth) return data;
  const result: number[] = [];
  const bucketSize = data.length / targetWidth;
  for (let i = 0; i < targetWidth; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.floor((i + 1) * bucketSize);
    let sum = 0, count = 0;
    for (let j = start; j < end && j < data.length; j++) { sum += data[j]!; count++; }
    result.push(count > 0 ? sum / count : 0);
  }
  return result;
}

export function formatAxisLabel(value: number, width: number): string {
  let str: string;
  if (value === 0) str = "0";
  else if (Math.abs(value) >= 1_000_000) str = (value / 1_000_000).toFixed(1) + "M";
  else if (Math.abs(value) >= 10_000) str = (value / 1_000).toFixed(1) + "k";
  else if (Math.abs(value) >= 1_000) str = (value / 1_000).toFixed(2) + "k";
  else if (Math.abs(value) < 0.01 && value !== 0) str = value.toExponential(1);
  else if (Number.isInteger(value)) str = String(value);
  else str = value.toFixed(2);
  if (str.length > width) str = str.slice(0, width);
  return str.padStart(width);
}

export function getSeriesPalette(colors: StormColors): readonly string[] {
  return [
    colors.brand.primary, colors.success, colors.warning, colors.error,
    colors.brand.light, "#A78BFA", "#FB923C", "#F472B6",
  ];
}

/**
 * Composite multiple rendered braille canvases into per-cell character and color arrays.
 * Later canvases (higher index) take color ownership when their dots are non-empty.
 * Returns { cellChars, cellColors } arrays of length `cols`.
 */
export function composeBrailleCells(
  renderedCanvases: readonly { lines: string[]; color: string | number }[],
  cols: number,
  row: number,
): { cellChars: string[]; cellColors: (string | number)[] } {
  const cellColors: (string | number)[] = new Array(cols);
  const cellChars: string[] = new Array(cols);

  for (let c = 0; c < cols; c++) {
    cellChars[c] = String.fromCharCode(BRAILLE_BASE);
    cellColors[c] = renderedCanvases[0]!.color;
  }

  for (const rc of renderedCanvases) {
    const line = rc.lines[row]!;
    for (let c = 0; c < cols; c++) {
      const ch = line[c]!;
      const bits = ch.charCodeAt(0) - BRAILLE_BASE;
      if (bits !== 0) {
        const existingBits = cellChars[c]!.charCodeAt(0) - BRAILLE_BASE;
        cellChars[c] = String.fromCharCode(BRAILLE_BASE + (existingBits | bits));
        cellColors[c] = rc.color;
      }
    }
  }

  return { cellChars, cellColors };
}
