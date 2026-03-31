/**
 * StormLogo — mini rotating 3D diamond for inline use.
 *
 * 3 lines tall, 7 chars wide. Same block-density rotation as the
 * welcome screen logo but compact enough for headers and indicators.
 */

import React, { useRef } from "react";
import { Box, useTui, useCleanup } from "../../../src/index.js";
import { S } from "../data/theme.js";

const MINI_FRAMES: string[] = [
  // Front
  "  ██  \n██◆◆██\n  ██  ",
  // Slight right
  "  █▓  \n█▓◆◆▓█\n  █▓  ",
  // More right
  "  ▓▒  \n▓▒◆◆▒█\n  ▓▒  ",
  // Edge
  "  ▒░  \n  ▒░  \n  ▒░  ",
  // Coming back
  "  ▒▓  \n█▒◆◆▒▓\n  ▒▓  ",
  // Back face
  "  ▓█  \n▓█◆◆█▓\n  ▓█  ",
  // Returning
  "  █▓  \n█▓◆◆▓█\n  █▓  ",
  // Almost front
  "  ██  \n██◆◆█▓\n  ██  ",
];

interface StormLogoProps {
  color?: string;
  interval?: number;
}

export function StormLogo({ color = S.arc, interval = 150 }: StormLogoProps): React.ReactElement {
  const { requestRender } = useTui();
  const textNodeRef = useRef<any>(null);
  const frameRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (timerRef.current === null) {
    timerRef.current = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % MINI_FRAMES.length;
      if (textNodeRef.current) {
        textNodeRef.current.text = MINI_FRAMES[frameRef.current]!;
        requestRender();
      }
    }, interval);
  }

  useCleanup(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  });

  return (
    <Box width={6} height={3}>
      {React.createElement(
        "tui-text",
        { color, _textNodeRef: textNodeRef },
        MINI_FRAMES[0]!,
      )}
    </Box>
  );
}
