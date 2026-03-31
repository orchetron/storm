/**
 * Timer — live elapsed time / countdown display.
 *
 * Uses useAnimation for periodic ticks. Formats time as mm:ss or
 * h:mm:ss depending on magnitude. Supports elapsed, countdown,
 * and manual value modes.
 */

import React from "react";
import { useAnimation } from "../hooks/useAnimation.js";
import { useColors } from "../hooks/useColors.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface TimerProps {
  /** Start time (Date.now() or ms timestamp). If set, shows elapsed. */
  startTime?: number;
  /** Target duration in ms. If set with startTime, shows countdown. */
  duration?: number;
  /** Manual value override (formatted string like "01:23") */
  value?: string;
  /** Update interval in ms (default: 1000) */
  interval?: number;
  color?: string | number;
  /** Show when running (default: true) */
  running?: boolean;
  prefix?: string;
}

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export const Timer = React.memo(function Timer(rawProps: TimerProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Timer", rawProps as unknown as Record<string, unknown>) as unknown as TimerProps;
  const {
    startTime,
    duration,
    value,
    interval = 1000,
    color = colors.text.primary,
    running = true,
    prefix,
  } = props;

  // Tick the animation to force re-renders at the given interval
  useAnimation({ interval, active: running && value === undefined });

  let displayText: string;

  if (value !== undefined) {
    // Manual value override
    displayText = value;
  } else if (startTime !== undefined && duration !== undefined) {
    // Countdown mode
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, duration - elapsed);
    displayText = `${formatMs(remaining)} remaining`;
  } else if (startTime !== undefined) {
    // Elapsed mode
    const elapsed = Date.now() - startTime;
    displayText = formatMs(elapsed);
  } else {
    // No startTime, no value — show zeroes
    displayText = "00:00";
  }

  const children: React.ReactElement[] = [];

  if (prefix !== undefined) {
    children.push(
      React.createElement("tui-text", { key: "prefix", color }, prefix),
    );
  }

  children.push(
    React.createElement("tui-text", { key: "time", color }, displayText),
  );

  return React.createElement(
    "tui-box",
    { flexDirection: "row" },
    ...children,
  );
});
