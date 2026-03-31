/**
 * GlowText — text with glow effect.
 *
 * Renders text with a "glow" effect by adding dim-colored characters
 * around the text. Three intensity levels control the visual weight.
 *
 * - "low": bold text in the glow color
 * - "medium": bold text surrounded by dim version of same color
 * - "high": bright bold text with a dim "shadow" line below
 *
 * When `animate` is true, the glow pulses by cycling through
 * intensity levels: low -> medium -> high -> medium -> low.
 */

import React, { useRef } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "../hooks/useCleanup.js";
import type { StormTextStyleProps } from "../styles/styleProps.js";
import { usePluginProps } from "../hooks/usePluginProps.js";
import { useColors } from "../hooks/useColors.js";

export interface GlowTextProps extends StormTextStyleProps {
  children: string;
  /** Glow intensity (default "medium") */
  intensity?: "low" | "medium" | "high";
  /** When true, the glow pulses between intensity levels at a configurable interval. */
  animate?: boolean;
  /** Pulse animation interval in ms (default 400). */
  animateInterval?: number;
}

/** Intensity cycle for pulse animation: low -> medium -> high -> medium -> low */
const INTENSITY_CYCLE: Array<"low" | "medium" | "high"> = [
  "low", "medium", "high", "medium", "low",
];

export const GlowText = React.memo(function GlowText(rawProps: GlowTextProps): React.ReactElement {
  const themeColors = useColors();
  const props = usePluginProps("GlowText", rawProps as unknown as Record<string, unknown>) as unknown as GlowTextProps;
  const {
    children: text,
    color = themeColors.brand.primary,
    bold: boldProp,
    dim: dimProp,
    intensity = "medium",
    animate = false,
    animateInterval = 400,
  } = props;

  const { requestRender } = useTui();
  const frameRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestRenderRef = useRef(requestRender);
  requestRenderRef.current = requestRender;
  const animateIntervalRef = useRef(animateInterval);

  // Start/stop animation timer
  if (animate && timerRef.current == null) {
    timerRef.current = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % INTENSITY_CYCLE.length;
      requestRenderRef.current();
    }, animateIntervalRef.current);
  } else if (!animate && timerRef.current != null) {
    clearInterval(timerRef.current);
    timerRef.current = null;
    frameRef.current = 0;
  }

  // Restart timer if interval changes
  if (animate && animateIntervalRef.current !== animateInterval && timerRef.current != null) {
    animateIntervalRef.current = animateInterval;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % INTENSITY_CYCLE.length;
      requestRenderRef.current();
    }, animateInterval);
  }

  useCleanup(() => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  });

  // Determine current intensity
  const currentIntensity = animate
    ? INTENSITY_CYCLE[frameRef.current % INTENSITY_CYCLE.length]!
    : intensity;

  const resolvedBold = boldProp !== undefined ? boldProp : true;
  const resolvedDim = dimProp !== undefined ? dimProp : true;

  if (currentIntensity === "low") {
    return React.createElement(
      "tui-text",
      { color, bold: resolvedBold, ...(dimProp !== undefined ? { dim: dimProp } : {}) },
      text,
    );
  }

  if (currentIntensity === "medium") {
    // Dim flanking characters + bold center text
    const dimLeft = React.createElement(
      "tui-text",
      { key: "glow-l", color, dim: resolvedDim },
      " ",
    );
    const center = React.createElement(
      "tui-text",
      { key: "glow-c", color, bold: resolvedBold, ...(dimProp !== undefined ? { dim: dimProp } : {}) },
      text,
    );
    const dimRight = React.createElement(
      "tui-text",
      { key: "glow-r", color, dim: resolvedDim },
      " ",
    );

    return React.createElement(
      "tui-box",
      { flexDirection: "row" },
      dimLeft,
      center,
      dimRight,
    );
  }

  // currentIntensity === "high"
  // Bold bright text on top row, dim shadow line below
  const topRow = React.createElement(
    "tui-box",
    { key: "top", flexDirection: "row" },
    React.createElement(
      "tui-text",
      { key: "glow-l", color, dim: resolvedDim },
      " ",
    ),
    React.createElement(
      "tui-text",
      { key: "glow-c", color, bold: resolvedBold, ...(dimProp !== undefined ? { dim: dimProp } : {}) },
      text,
    ),
    React.createElement(
      "tui-text",
      { key: "glow-r", color, dim: resolvedDim },
      " ",
    ),
  );

  // Shadow line: dim underline characters the width of the text
  const shadowLine = React.createElement(
    "tui-box",
    { key: "shadow", flexDirection: "row" },
    React.createElement(
      "tui-text",
      { key: "shadow-pad", color, dim: resolvedDim },
      " ",
    ),
    React.createElement(
      "tui-text",
      { key: "shadow-text", color, dim: resolvedDim },
      "\u2581".repeat(text.length),
    ),
  );

  return React.createElement(
    "tui-box",
    { flexDirection: "column" },
    topRow,
    shadowLine,
  );
});
