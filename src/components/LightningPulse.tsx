/**
 * LightningPulse — Storm's signature gesture.
 *
 * A horizontal line of amber that flashes briefly (200ms) then fades
 * to dim. Renders as a full-width row of "━" characters.
 *
 * Uses useRef + requestRender() + setTimeout for the flash-then-fade.
 * No React state involved.
 */

import React, { useRef } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "../hooks/useCleanup.js";
import { usePersonality } from "../core/personality.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface LightningPulseProps {
  /** When true, triggers a flash-then-fade cycle. */
  active: boolean;
  /** Override the pulse color (default: personality brand.primary / amber). */
  color?: string;
  /** Width in columns. If omitted, defaults to screen width. */
  width?: number;
}

type PulsePhase = "idle" | "flash" | "fade";

export const LightningPulse = React.memo(function LightningPulse(rawProps: LightningPulseProps): React.ReactElement {
  const props = usePluginProps("LightningPulse", rawProps as unknown as Record<string, unknown>) as unknown as LightningPulseProps;
  const { active, color: colorProp, width: widthProp } = props;
  const { requestRender, screen } = useTui();
  const personality = usePersonality();

  const pulseColor = colorProp ?? personality.colors.brand.primary;
  const pulseWidth = widthProp ?? screen.width;
  const lineChar = "\u2501"; // ━

  const phaseRef = useRef<PulsePhase>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevActiveRef = useRef(false);
  const requestRenderRef = useRef(requestRender);
  requestRenderRef.current = requestRender;

  // Detect rising edge of active — start a flash cycle
  if (active && !prevActiveRef.current) {
    prevActiveRef.current = true;

    // Clear any pending timer from a previous cycle
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    phaseRef.current = "flash";

    // After 200ms, transition to fade
    timerRef.current = setTimeout(() => {
      phaseRef.current = "fade";
      requestRenderRef.current();

      // After another 200ms, go idle
      timerRef.current = setTimeout(() => {
        phaseRef.current = "idle";
        timerRef.current = null;
        requestRenderRef.current();
      }, 200);
    }, 200);
  }

  // Detect falling edge — reset tracking for next activation
  if (!active && prevActiveRef.current) {
    prevActiveRef.current = false;
  }

  // Clean up timers on unmount
  useCleanup(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  });

  // Render based on current phase
  const phase = phaseRef.current;
  const line = lineChar.repeat(Math.max(0, pulseWidth));

  if (phase === "idle") {
    // Nothing visible
    return React.createElement("tui-box", { height: 1 });
  }

  if (phase === "flash") {
    // Full brightness amber line
    return React.createElement(
      "tui-box",
      { height: 1, flexDirection: "row" },
      React.createElement(
        "tui-text",
        { color: pulseColor, bold: true },
        line,
      ),
    );
  }

  // phase === "fade" — dim amber line
  return React.createElement(
    "tui-box",
    { height: 1, flexDirection: "row" },
    React.createElement(
      "tui-text",
      { color: pulseColor, dim: true },
      line,
    ),
  );
});
