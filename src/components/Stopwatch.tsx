/**
 * Stopwatch — count-up timer with configurable format.
 *
 * Uses setInterval with eager registration (not useEffect) and
 * requestRender() for updates. Tracks elapsed time in a ref.
 */

import React, { useRef } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "../hooks/useCleanup.js";
import { useColors } from "../hooks/useColors.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface StopwatchProps {
  /** Whether the stopwatch is running (default: true) */
  running?: boolean;
  /** Called on each tick with elapsed milliseconds */
  onTick?: (elapsedMs: number) => void;
  /** Display format (default: "mm:ss") */
  format?: "mm:ss" | "hh:mm:ss" | "ss.ms";
  color?: string | number;
}

function formatElapsed(ms: number, format: string): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);

  switch (format) {
    case "hh:mm:ss":
      return (
        String(hours).padStart(2, "0") +
        ":" +
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0")
      );
    case "ss.ms":
      return (
        String(totalSeconds).padStart(2, "0") +
        "." +
        String(centiseconds).padStart(2, "0")
      );
    case "mm:ss":
    default:
      return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0")
      );
  }
}

export const Stopwatch = React.memo(function Stopwatch(rawProps: StopwatchProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Stopwatch", rawProps as unknown as Record<string, unknown>) as unknown as StopwatchProps;
  const {
    running = true,
    onTick,
    format = "mm:ss",
    color = colors.text.primary,
  } = props;

  const elapsedRef = useRef(0);
  const lastTickRef = useRef(Date.now());
  const { requestRender } = useTui();

  // Store latest values in refs for the eager interval
  const runningRef = useRef(running);
  runningRef.current = running;
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;
  const requestRenderRef = useRef(requestRender);
  requestRenderRef.current = requestRender;

  // Start interval eagerly with useRef guard
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  if (!timerRef.current) {
    lastTickRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (!runningRef.current) {
        lastTickRef.current = Date.now();
        return;
      }
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      elapsedRef.current += delta;
      onTickRef.current?.(elapsedRef.current);
      requestRenderRef.current();
    }, 100);
  }

  // Clean up interval on unmount
  useCleanup(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  });

  const displayText = formatElapsed(elapsedRef.current, format);

  return React.createElement(
    "tui-box",
    { flexDirection: "row" },
    React.createElement("tui-text", { color }, displayText),
  );
});
