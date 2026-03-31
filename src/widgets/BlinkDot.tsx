/**
 * BlinkDot — a colored dot that blinks based on state.
 *
 * Uses imperative mutation + requestRender() for blink animation.
 * No React setState involved — same pattern as Spinner.
 */

import React, { useRef } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "../hooks/useCleanup.js";
import { usePersonality } from "../core/personality.js";
import { usePluginProps } from "../hooks/usePluginProps.js";
import { useColors } from "../hooks/useColors.js";

export type DotState = "pending" | "running" | "streaming" | "completed" | "failed" | "cancelled";

export interface BlinkDotProps {
  state: DotState;
  interval?: number;
  /** Character to display when the dot is visible (default "●") */
  dotCharacter?: string;
  /** Character to display when the dot is hidden during blink (default " ") */
  offCharacter?: string;
  /** Custom render for the dot */
  renderDot?: (char: string, state: DotState) => React.ReactNode;
}

const DOT = "\u25CF"; // ●

export const BlinkDot = React.memo(function BlinkDot(rawProps: BlinkDotProps): React.ReactElement {
  const colors = useColors();
  const STATE_COLORS: Record<DotState, string> = {
    pending: colors.tool.pending,
    running: colors.tool.running,
    streaming: colors.tool.pending,
    completed: colors.tool.completed,
    failed: colors.tool.failed,
    cancelled: colors.tool.cancelled,
  };
  const props = usePluginProps("BlinkDot", rawProps as unknown as Record<string, unknown>) as unknown as BlinkDotProps;
  const personality = usePersonality();
  const { state, interval = personality.animation.durationSlow, dotCharacter = DOT, offCharacter = " ", renderDot } = props;

  const visibleRef = useRef(true);
  const dotTextRef = useRef<any>(null);
  const { requestRender } = useTui();

  // Keep latest values in refs for the interval callback
  const stateRef = useRef(state);
  stateRef.current = state;
  const requestRenderRef = useRef(requestRender);
  requestRenderRef.current = requestRender;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // For terminal states (completed, failed), stop the timer to avoid wasting CPU
  const isTerminal = state === "completed" || state === "failed" || state === "cancelled";
  if (isTerminal && timerRef.current) {
    clearInterval(timerRef.current);
    timerRef.current = null;
    // Ensure dot is visible for terminal states
    if (!visibleRef.current) {
      visibleRef.current = true;
      if (dotTextRef.current) {
        dotTextRef.current.text = dotCharacter;
        requestRenderRef.current();
      }
    }
  }

  if (!isTerminal && !timerRef.current) {
    timerRef.current = setInterval(() => {
      if (stateRef.current === "running") {
        visibleRef.current = !visibleRef.current;
        if (dotTextRef.current) {
          dotTextRef.current.text = visibleRef.current ? dotCharacter : offCharacter;
          requestRenderRef.current();
        }
      } else {
        // Non-blinking states: ensure dot is visible
        if (!visibleRef.current) {
          visibleRef.current = true;
          if (dotTextRef.current) {
            dotTextRef.current.text = dotCharacter;
            requestRenderRef.current();
          }
        }
      }
    }, interval);
  }

  // Register cleanup so the timer is cleared on app unmount
  useCleanup(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  });

  const color = STATE_COLORS[state];

  if (renderDot) {
    return React.createElement(React.Fragment, null, renderDot(dotCharacter, state));
  }

  return React.createElement(
    "tui-text",
    { color, _textNodeRef: dotTextRef },
    dotCharacter,
  );
});
