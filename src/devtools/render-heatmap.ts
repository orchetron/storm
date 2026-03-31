/**
 * Render Diff Heatmap — visualizes which cells changed between frames.
 *
 * No other TUI framework has this. It shows a real-time overlay where:
 * - Cells that changed THIS frame glow bright (hot red/orange)
 * - Cells that changed 2-5 frames ago fade (warm yellow)
 * - Cells that changed 6-15 frames ago are cool (dim blue)
 * - Stable cells (unchanged 15+ frames) are invisible (no overlay)
 *
 * This instantly reveals:
 * - Which parts of your UI are thrashing (constantly changing)
 * - Animation hotspots
 * - Unnecessary re-renders (cells changing when they shouldn't)
 * - Stable regions (everything that doesn't need repainting)
 */

import type { ScreenBuffer } from "../core/buffer.js";
import type { RenderMiddleware } from "../core/middleware.js";
import { parseColor, DEFAULT_COLOR, Attr } from "../core/types.js";

export interface HeatmapOptions {
  /** How many frames before a cell is considered "cold" (default: 15) */
  cooldownFrames?: number;
  /** Opacity of the heatmap overlay 0-1 (default: 0.5) — controls how much original content shows through */
  opacity?: number;
}

// Precomputed heatmap colors
const HOT_COLOR = parseColor("#FF4444");
const WARM_COLOR = parseColor("#FF8800");
const COOLING_COLOR = parseColor("#FFCC00");
const COOL_COLOR = parseColor("#334466");

// Legend colors
const LEGEND_BG = parseColor("#1C1C1C");
const LEGEND_FG = parseColor("#D4D4D4");
const LEGEND_DIM_FG = parseColor("#808080");

export function createRenderHeatmap(options?: HeatmapOptions): {
  /** Middleware that tracks changes and renders the heatmap overlay */
  middleware: RenderMiddleware;
  /** Toggle heatmap visibility */
  toggle: () => void;
  /** Whether heatmap is currently visible */
  isVisible: () => boolean;
  /** Get stats: total cells, hot cells, warm cells, cold cells, stable cells */
  getStats: () => { total: number; hot: number; warm: number; cool: number; stable: number };
  /** Reset all tracking data */
  reset: () => void;
} {
  const cooldownFrames = options?.cooldownFrames ?? 15;
  const _opacity = Math.max(0, Math.min(1, options?.opacity ?? 0.5));

  let visible = false;
  let frameCounter = 0;

  // Tracking arrays — allocated lazily on first paint
  let lastChanged: Uint16Array | null = null;
  let prevChars: string[] | null = null;
  let prevFgs: Int32Array | null = null;
  let prevBgs: Int32Array | null = null;
  let prevAttrs: Uint8Array | null = null;
  let prevUlColors: Int32Array | null = null;
  let trackedWidth = 0;
  let trackedHeight = 0;

  function allocate(width: number, height: number): void {
    const size = width * height;
    lastChanged = new Uint16Array(size); // all zeros — everything starts as "never changed"
    prevChars = new Array<string>(size).fill(" ");
    prevFgs = new Int32Array(size).fill(DEFAULT_COLOR);
    prevBgs = new Int32Array(size).fill(DEFAULT_COLOR);
    prevAttrs = new Uint8Array(size);
    prevUlColors = new Int32Array(size).fill(DEFAULT_COLOR);
    trackedWidth = width;
    trackedHeight = height;
  }

  function blendColor(original: number, overlay: number, opacity: number): number {
    // If original is default color, treat as black for blending
    let oR: number, oG: number, oB: number;
    if (original === DEFAULT_COLOR || original < 0x1000000) {
      oR = 0;
      oG = 0;
      oB = 0;
    } else {
      oR = (original >> 16) & 0xff;
      oG = (original >> 8) & 0xff;
      oB = original & 0xff;
    }

    const hR = (overlay >> 16) & 0xff;
    const hG = (overlay >> 8) & 0xff;
    const hB = overlay & 0xff;

    const r = Math.round(oR * (1 - opacity) + hR * opacity);
    const g = Math.round(oG * (1 - opacity) + hG * opacity);
    const b = Math.round(oB * (1 - opacity) + hB * opacity);

    return 0x1000000 | (r << 16) | (g << 8) | b;
  }

  // Legend text segments: [Heatmap] * hot  * warm  * cool  * stable
  const legendParts = [
    { text: "[Heatmap] ", fg: LEGEND_DIM_FG },
    { text: "\u2B24", fg: HOT_COLOR },
    { text: " hot  ", fg: LEGEND_FG },
    { text: "\u2B24", fg: WARM_COLOR },
    { text: " warm  ", fg: LEGEND_FG },
    { text: "\u2B24", fg: COOLING_COLOR },
    { text: " cool  ", fg: LEGEND_FG },
    { text: "\u2B24", fg: COOL_COLOR },
    { text: " stable", fg: LEGEND_FG },
  ];
  const legendLength = legendParts.reduce((sum, p) => sum + p.text.length, 0);

  const middleware: RenderMiddleware = {
    name: "render-heatmap",

    onPaint(buffer: ScreenBuffer, width: number, height: number): ScreenBuffer {
      // Handle resize or first call
      if (
        lastChanged === null ||
        trackedWidth !== width ||
        trackedHeight !== height
      ) {
        allocate(width, height);
        frameCounter = 0;
      }

      const size = width * height;
      frameCounter++;
      // Prevent overflow: wrap at 60000 (well within Uint16 range, large enough for cooldown)
      if (frameCounter > 60000) {
        // Shift all lastChanged values to preserve relative distances
        const shift = frameCounter - 1000;
        for (let i = 0; i < size; i++) {
          const v = lastChanged![i]!;
          lastChanged![i] = v > shift ? v - shift : 0;
        }
        frameCounter = 1000;
      }

      // Step 1: Detect changed cells by comparing against previous snapshot
      for (let i = 0; i < size; i++) {
        const ch = buffer.getChar(i % width, Math.floor(i / width));
        const fg = buffer.getFg(i % width, Math.floor(i / width));
        const bg = buffer.getBg(i % width, Math.floor(i / width));
        const at = buffer.getAttrs(i % width, Math.floor(i / width));
        const ul = buffer.getUlColor(i % width, Math.floor(i / width));

        if (
          ch !== prevChars![i] ||
          fg !== prevFgs![i] ||
          bg !== prevBgs![i] ||
          at !== prevAttrs![i] ||
          ul !== prevUlColors![i]
        ) {
          lastChanged![i] = frameCounter;
        }

        // Store current state for next-frame comparison
        prevChars![i] = ch;
        prevFgs![i] = fg;
        prevBgs![i] = bg;
        prevAttrs![i] = at;
        prevUlColors![i] = ul;
      }

      // Step 2: If heatmap is visible, overlay color-coded backgrounds
      if (visible) {
        for (let i = 0; i < size; i++) {
          const age = frameCounter - lastChanged![i]!;
          let overlayColor: number | null = null;

          if (age === 0) {
            overlayColor = HOT_COLOR;
          } else if (age <= 3) {
            overlayColor = WARM_COLOR;
          } else if (age <= 8) {
            overlayColor = COOLING_COLOR;
          } else if (age <= cooldownFrames) {
            overlayColor = COOL_COLOR;
          }
          // age > cooldownFrames → stable, no overlay

          if (overlayColor !== null) {
            const x = i % width;
            const y = Math.floor(i / width);
            const blended = blendColor(buffer.getBg(x, y), overlayColor, _opacity);
            buffer.setCell(x, y, {
              char: buffer.getChar(x, y),
              fg: buffer.getFg(x, y),
              bg: blended,
              attrs: buffer.getAttrs(x, y),
              ulColor: buffer.getUlColor(x, y),
            });
          }
        }

        // Step 3: Draw legend at bottom-right
        if (height > 0 && width >= legendLength + 2) {
          const legendY = height - 1;
          const legendStartX = width - legendLength - 1;
          let cx = legendStartX;
          for (const part of legendParts) {
            for (let ci = 0; ci < part.text.length; ci++) {
              if (cx >= 0 && cx < width) {
                buffer.setCell(cx, legendY, {
                  char: part.text[ci]!,
                  fg: part.fg,
                  bg: LEGEND_BG,
                  attrs: Attr.NONE,
                  ulColor: DEFAULT_COLOR,
                });
              }
              cx++;
            }
          }
        }
      }

      return buffer;
    },
  };

  function computeStats(): {
    total: number;
    hot: number;
    warm: number;
    cool: number;
    stable: number;
  } {
    if (lastChanged === null) {
      return { total: 0, hot: 0, warm: 0, cool: 0, stable: 0 };
    }
    const size = trackedWidth * trackedHeight;
    let hot = 0;
    let warm = 0;
    let cool = 0;
    let stable = 0;

    for (let i = 0; i < size; i++) {
      const age = frameCounter - lastChanged[i]!;
      if (age === 0) {
        hot++;
      } else if (age <= 3) {
        // warm includes the "warm" and "cooling" visual tiers
        warm++;
      } else if (age <= cooldownFrames) {
        cool++;
      } else {
        stable++;
      }
    }

    return { total: size, hot, warm, cool, stable };
  }

  return {
    middleware,
    toggle: () => {
      visible = !visible;
    },
    isVisible: () => visible,
    getStats: computeStats,
    reset: () => {
      lastChanged = null;
      prevChars = null;
      prevFgs = null;
      prevBgs = null;
      prevAttrs = null;
      prevUlColors = null;
      trackedWidth = 0;
      trackedHeight = 0;
      frameCounter = 0;
    },
  };
}
