/**
 * Storm Code CLI — App root.
 *
 * Diamond shockwave welcome screen then chat.
 *
 * The diamond EXPANDS from a point, reaches full size with a bright flash,
 * then CONTRACTS back — like a radar ping or shockwave. Real motion: the
 * shape changes every frame, not just color. Two-column layout: animated
 * diamond left, info right. After 3 seconds, transitions to ChatScreen.
 */

import React, { useState, useCallback, useRef } from "react";
import {
  Box,
  Text,
  useInput,
  useTerminal,
  useTui,
  useCleanup,
} from "../../src/index.js";

import { ChatScreen } from "./screens/ChatScreen.js";
import { S, toggleTheme } from "./data/theme.js";

const MODEL = "qwen-2.5-coder-32b";

// -- 3D Rotating Diamond (8 frames) ----------------------------------------------
// A diamond shape that rotates using block density (█▓▒░) for 3D depth.
// Approaching edges = full blocks, receding edges = shades.

const LOGO_FRAMES: string[][] = [
  // Frame 0: Front face
  [
    "    ██    ",
    "  ██  ██  ",
    "██  ◆◆  ██",
    "  ██  ██  ",
    "    ██    ",
  ],
  // Frame 1: Slight right turn
  [
    "    █▓    ",
    "  █▓  ▓█  ",
    "█▓  ◆◆  ▓█",
    "  █▓  ▓█  ",
    "    █▓    ",
  ],
  // Frame 2: More right
  [
    "    ▓▒    ",
    "  ▓▒  ▒█  ",
    "▓▒  ◆◆  ▒█",
    "  ▓▒  ▒█  ",
    "    ▓▒    ",
  ],
  // Frame 3: Edge (thin)
  [
    "    ▒░    ",
    "    ▒░    ",
    "    ▒░    ",
    "    ▒░    ",
    "    ▒░    ",
  ],
  // Frame 4: Coming back from left
  [
    "    ▒▓    ",
    "  █▒  ▒▓  ",
    "█▒  ◆◆  ▒▓",
    "  █▒  ▒▓  ",
    "    ▒▓    ",
  ],
  // Frame 5: Back face
  [
    "    ▓█    ",
    "  ▓█  █▓  ",
    "▓█  ◆◆  █▓",
    "  ▓█  █▓  ",
    "    ▓█    ",
  ],
  // Frame 6: Returning right
  [
    "    █▓    ",
    "  █▓  ▓█  ",
    "█▓  ◆◆  ▓█",
    "  █▓  ▓█  ",
    "    █▓    ",
  ],
  // Frame 7: Almost front
  [
    "    ██    ",
    "  ██  █▓  ",
    "██  ◆◆  █▓",
    "  ██  █▓  ",
    "    ██    ",
  ],
];

// Per-frame durations in ms
const FRAME_DURATIONS = [200, 120, 120, 200, 120, 200, 120, 120];

// -- Welcome Screen --------------------------------------------------------------

function WelcomeScreen({ onDismiss }: { onDismiss: () => void }) {
  const { width, height } = useTerminal();
  const { requestRender } = useTui();
  const frameRef = useRef(0);
  const textNodeRef = useRef<any>(null);
  const countdownRef = useRef(3);
  const countdownTextRef = useRef<any>(null);

  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Logo rotation — simple setInterval for frame cycling
  if (animTimerRef.current === null) {
    animTimerRef.current = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % LOGO_FRAMES.length;
      if (textNodeRef.current) {
        textNodeRef.current.text = LOGO_FRAMES[frameRef.current]!.join("\n");
        requestRender();
      }
    }, 150);
  }

  // Countdown timer (3 → 2 → 1 → dismiss)
  if (countdownTimerRef.current === null) {
    countdownTimerRef.current = setInterval(() => {
      countdownRef.current -= 1;
      if (countdownRef.current <= 0) {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        onDismiss();
      } else {
        if (countdownTextRef.current) {
          countdownTextRef.current.text = `Starting in ${countdownRef.current}...`;
          requestRender();
        }
      }
    }, 1000);
  }

  useCleanup(() => {
    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  });

  const padTop = Math.max(0, Math.floor((height - 8) / 2));
  // Start with front face
  const logoText = LOGO_FRAMES[0]!.join("\n");

  return (
    <Box flexDirection="column" width={width} height={height} {...(S.bg ? { backgroundColor: S.bg } : {})}>
      {/* Vertical centering */}
      <Box flexDirection="column" height={padTop} />

      {/* Two-column layout: animated diamond left, info right */}
      <Box flexDirection="row" justifyContent="center">
        {/* LEFT: Diamond shockwave — wider to fit all frames */}
        <Box flexDirection="column" width={16} marginRight={2}>
          {React.createElement(
            "tui-text",
            { color: S.arc, _textNodeRef: textNodeRef },
            logoText,
          )}
        </Box>

        {/* RIGHT: Info rows */}
        <Box flexDirection="column" justifyContent="center">
          {/* Row 1: Name */}
          <Text color={S.text} bold>storm</Text>
          {/* Row 2: Model + auth */}
          <Text color={S.dim}>
            {MODEL} · API key auth
          </Text>
          {/* Row 3: Working directory */}
          <Text color={S.dim}>
            {process.cwd()}
          </Text>
          {/* Row 4: Countdown */}
          {React.createElement(
            "tui-text",
            { color: S.dim, _textNodeRef: countdownTextRef },
            `Starting in ${countdownRef.current}...`,
          )}
        </Box>
      </Box>

      <Box flex={1} />
    </Box>
  );
}

// -- App -------------------------------------------------------------------------

export function App(): React.ReactElement {
  const { exit, flushSync, requestRender } = useTui();
  const [screen, setScreen] = useState<"welcome" | "chat">("welcome");

  useInput(
    useCallback(
      (e) => {
        if (e.key === "t" && e.ctrl && !e.meta) {
          toggleTheme();
          requestRender();
        }
      },
      [requestRender],
    ),
  );

  const handleWelcomeDismiss = useCallback(() => {
    flushSync(() => setScreen("chat"));
  }, [flushSync]);

  const handleExit = useCallback(() => {
    exit();
  }, [exit]);

  if (screen === "welcome") {
    return <WelcomeScreen onDismiss={handleWelcomeDismiss} />;
  }

  return <ChatScreen model={MODEL} onExit={handleExit} />;
}
