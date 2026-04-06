/**
 * StormLogo — mini rotating 3D diamond for inline use.
 *
 * 3 lines tall, 7 chars wide. Same block-density rotation as the
 * welcome screen logo but compact enough for headers and indicators.
 */

import React, { useRef } from "react";
import { Box, useTick } from "../../../src/index.js";
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
  const textNodeRef = useRef<any>(null);

  // Logo rotation (imperative — no React re-render needed)
  useTick(interval, (tick) => {
    if (textNodeRef.current) {
      textNodeRef.current.text = MINI_FRAMES[tick % MINI_FRAMES.length]!;
    }
  }, { reactive: false });

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
