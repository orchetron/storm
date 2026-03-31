/**
 * Placeholder — filler widget that shows its dimensions.
 *
 * Fills an area with dim dots and optionally centers a label.
 * Useful for prototyping layouts before real content is available.
 *
 * When `loading` is true, animates a shimmer effect by cycling
 * brightness on the dot pattern.
 *
 * Supports multiple shapes:
 * - "rectangle" (default): full-area dot fill
 * - "text": single-line shimmer placeholder
 * - "circle": square aspect ratio with rounded corners
 * - "card": rectangle with internal line placeholders of varying widths
 */

import React, { useRef } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "../hooks/useCleanup.js";
import { useColors } from "../hooks/useColors.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export type PlaceholderShape = "rectangle" | "text" | "circle" | "card";

export interface PlaceholderProps {
  width?: number;
  height?: number;
  label?: string;
  color?: string | number;
  /** When true, animates the dot pattern with a shimmer effect. */
  loading?: boolean;
  /** Shape of the placeholder skeleton. Default "rectangle". */
  shape?: PlaceholderShape;
}

/** Shimmer brightness levels — cycles through these ANSI gray shades. */
const SHIMMER_LEVELS = [240, 245, 250, 255, 250, 245] as const;
const SHIMMER_INTERVAL_MS = 200;

/** Line width percentages for card skeleton. */
const CARD_LINE_WIDTHS = [0.8, 1.0, 0.6, 0.4] as const;

export const Placeholder = React.memo(function Placeholder(rawProps: PlaceholderProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Placeholder", rawProps as unknown as Record<string, unknown>) as unknown as PlaceholderProps;
  const {
    width = 20,
    height = 3,
    label,
    color = colors.text.dim,
    loading = false,
    shape = "rectangle",
  } = props;

  const { requestRender } = useTui();

  // Shimmer animation frame index
  const frameRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (loading && timerRef.current == null) {
    timerRef.current = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % SHIMMER_LEVELS.length;
      requestRender();
    }, SHIMMER_INTERVAL_MS);
  } else if (!loading && timerRef.current != null) {
    clearInterval(timerRef.current);
    timerRef.current = null;
    frameRef.current = 0;
  }

  useCleanup(() => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  });

  // ── Text shape: single line ──────────────────────────────────────
  if (shape === "text") {
    const shimmerColor = loading
      ? SHIMMER_LEVELS[frameRef.current % SHIMMER_LEVELS.length]
      : undefined;
    const lineText = label
      ? label.slice(0, width).padEnd(width, "\u00B7")
      : "\u2588".repeat(Math.floor(width * 0.7)) + "\u00B7".repeat(width - Math.floor(width * 0.7));

    return React.createElement(
      "tui-box",
      { width, height: 1 },
      React.createElement(
        "tui-text",
        { color: loading ? shimmerColor : color, dim: !loading },
        lineText,
      ),
    );
  }

  // ── Circle shape: square with rounded visual ─────────────────────
  if (shape === "circle") {
    const size = Math.min(width, height);
    const lines: React.ReactElement[] = [];
    const radius = size / 2;

    for (let row = 0; row < size; row++) {
      let line = "";
      for (let col = 0; col < size; col++) {
        // Distance from center
        const dx = col - radius + 0.5;
        const dy = (row - radius + 0.5) * 2; // scale Y because terminal chars are taller
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius) {
          line += "\u2588";
        } else {
          line += " ";
        }
      }

      const shimmerColor = loading
        ? SHIMMER_LEVELS[(frameRef.current + row) % SHIMMER_LEVELS.length]
        : undefined;

      lines.push(
        React.createElement(
          "tui-text",
          { color: loading ? shimmerColor : color, dim: !loading, key: `row-${row}` },
          line,
        ),
      );
    }

    return React.createElement(
      "tui-box",
      { flexDirection: "column", width: size, height: size },
      ...lines,
    );
  }

  // ── Card shape: rectangle with internal placeholder lines ────────
  if (shape === "card") {
    const innerWidth = Math.max(4, width - 4); // Account for padding
    const lines: React.ReactElement[] = [];

    // Top border
    lines.push(
      React.createElement(
        "tui-text",
        { color, dim: true, key: "top-border" },
        "\u250C" + "\u2500".repeat(width - 2) + "\u2510",
      ),
    );

    // Content lines
    const contentHeight = Math.max(1, height - 2);
    for (let row = 0; row < contentHeight; row++) {
      const shimmerColor = loading
        ? SHIMMER_LEVELS[(frameRef.current + row) % SHIMMER_LEVELS.length]
        : undefined;

      let innerContent: string;
      if (row === 0 && label) {
        // First row: label
        innerContent = (" " + label.slice(0, innerWidth)).padEnd(width - 2, " ");
      } else {
        // Placeholder lines with varying widths
        const lineIdx = label ? row - 1 : row;
        const widthFraction = CARD_LINE_WIDTHS[lineIdx % CARD_LINE_WIDTHS.length]!;
        const lineWidth = Math.floor(innerWidth * widthFraction);
        const filledPart = "\u2588".repeat(lineWidth);
        innerContent = (" " + filledPart).padEnd(width - 2, " ");
      }

      lines.push(
        React.createElement(
          "tui-text",
          { color: loading ? shimmerColor : color, dim: !loading, key: `row-${row}` },
          "\u2502" + innerContent + "\u2502",
        ),
      );
    }

    // Bottom border
    lines.push(
      React.createElement(
        "tui-text",
        { color, dim: true, key: "bottom-border" },
        "\u2514" + "\u2500".repeat(width - 2) + "\u2518",
      ),
    );

    return React.createElement(
      "tui-box",
      { flexDirection: "column", width, height },
      ...lines,
    );
  }

  // ── Rectangle shape (default) ────────────────────────────────────
  const lines: React.ReactElement[] = [];

  for (let row = 0; row < height; row++) {
    const isMiddle = row === Math.floor(height / 2);

    let lineText: string;
    if (isMiddle && label) {
      const text = label.slice(0, width);
      const padTotal = width - text.length;
      const padLeft = Math.floor(padTotal / 2);
      const padRight = padTotal - padLeft;
      lineText = "\u00B7".repeat(padLeft) + text + "\u00B7".repeat(padRight);
    } else {
      lineText = "\u00B7".repeat(width);
    }

    // Per-row shimmer offset for wave effect
    const shimmerColor = loading
      ? SHIMMER_LEVELS[(frameRef.current + row) % SHIMMER_LEVELS.length]
      : undefined;

    lines.push(
      React.createElement(
        "tui-text",
        {
          color: loading ? shimmerColor : color,
          dim: !loading && (!isMiddle || !label),
          key: `row-${row}`,
        },
        lineText,
      ),
    );
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "column", width, height },
    ...lines,
  );
});
