/**
 * AnimatedLogo — Storm's 3D rotating shield with lightning bolt.
 *
 * 8-frame rotation using block-density shading (██ ▓▓ ▒▒ ░░)
 * to simulate 3D depth with Storm's angular shield shape.
 */

import React, { useRef } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "../hooks/useCleanup.js";
import { usePersonality } from "../core/personality.js";
import { usePluginProps } from "../hooks/usePluginProps.js";
import { useColors } from "../hooks/useColors.js";

export interface AnimatedLogoProps {
  animate?: boolean;
  interval?: number;
  color?: string;
  /** Custom render for each animation frame */
  renderFrame?: (frame: string, index: number) => React.ReactNode;
}

// 8 frames of a shield rotating. 7 wide × 5 tall.
// Uses block density for depth: ██=front, ▓▓=angled, ▒▒=edge, ░░=far
const FRAMES: string[] = [
  // Frame 0: Front face
  "  ███  \n" +
  " █ ⚡ █ \n" +
  " █   █ \n" +
  "  █ █  \n" +
  "   █   ",

  // Frame 1: Slight right turn
  "  ▓██  \n" +
  " ▓ ⚡ █ \n" +
  " ▓   █ \n" +
  "  ▓ █  \n" +
  "   ▓   ",

  // Frame 2: More right
  "  ▒▓█  \n" +
  " ▒  ▓█ \n" +
  " ▒  ▓█ \n" +
  "  ▒▓█  \n" +
  "   ▒   ",

  // Frame 3: Edge view
  "   ▒▓  \n" +
  "   ▒▓  \n" +
  "   ▒▓  \n" +
  "   ▒▓  \n" +
  "   ▒   ",

  // Frame 4: Back coming around
  "  █▓▒  \n" +
  " █▓  ▒ \n" +
  " █▓  ▒ \n" +
  "  █▓▒  \n" +
  "   ▒   ",

  // Frame 5: Back face
  "  █▓   \n" +
  " █ ⚡ ▓ \n" +
  " █   ▓ \n" +
  "  █ ▓  \n" +
  "   █   ",

  // Frame 6: Coming back left
  "  ██▓  \n" +
  " █ ⚡ ▓ \n" +
  " █   ▓ \n" +
  "  █ ▓  \n" +
  "   █   ",

  // Frame 7: Almost front
  "  ██▓  \n" +
  " █ ⚡ ▓ \n" +
  " █   ▓ \n" +
  "  █ ▓  \n" +
  "   █   ",
];

const STATIC = FRAMES[0]!;

export const AnimatedLogo = React.memo(function AnimatedLogo(rawProps: AnimatedLogoProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("AnimatedLogo", rawProps as unknown as Record<string, unknown>) as unknown as AnimatedLogoProps;
  const personality = usePersonality();
  const { animate = true, interval = personality.animation.durationFast, color, renderFrame } = props;
  const { requestRender } = useTui();
  const frameRef = useRef(0);
  const textNodeRef = useRef<any>(null);

  const logoColor = color ?? colors.brand.primary;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intervalRef = useRef(interval);

  // Restart timer when interval prop changes or animate toggles
  if (animate && (timerRef.current === null || intervalRef.current !== interval)) {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    intervalRef.current = interval;
    timerRef.current = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % FRAMES.length;
      if (textNodeRef.current) {
        textNodeRef.current.text = FRAMES[frameRef.current]!;
      }
      requestRender();
    }, interval);
  } else if (!animate && timerRef.current) {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }

  // Register cleanup so the timer is cleared on app unmount
  useCleanup(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  });

  const text = animate ? (FRAMES[frameRef.current] ?? STATIC) : STATIC;

  if (renderFrame) {
    return React.createElement(React.Fragment, null, renderFrame(text, frameRef.current));
  }

  return React.createElement(
    "tui-text",
    { color: logoColor, _textNodeRef: textNodeRef },
    text,
  );
});
