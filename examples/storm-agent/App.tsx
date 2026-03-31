/**
 * Storm Agent CLI -- App root.
 *
 * Welcome screen (two-column: rotating logo + info) then chat.
 * Storm Agent visual design.
 */

import React, { useState, useCallback, useRef } from "react";
import {
  Box,
  Text,
  useTerminal,
  useTui,
  useCleanup,
} from "../../src/index.js";

import { AGENTS } from "./data/mock-agents.js";
import { ChatScreen } from "./screens/ChatScreen.js";

// -- Theme Colors -------------------------------------------------------------

const THEME = {
  accent: "#8C8CF9",
  accentLight: "#BEBEEE",
  text: "#DEE1E4",
  textSecondary: "#A5A8AB",
  textDisabled: "#46484A",
};

// -- 3D Rotating Logo (block/shade chars) -------------------------------------

const LOGO_FRAMES: string[][] = [
  // Frame 0: Front
  [
    "  ████████  ",
    " ██      ██ ",
    " ██  ██  ██ ",
    " ██      ██ ",
    "  ████████  ",
  ],
  // Frame 1: Slight right
  [
    "  ▓██████▓  ",
    " ▓█      █▓ ",
    " ▓█  ██  █▓ ",
    " ▓█      █▓ ",
    "  ▓██████▓  ",
  ],
  // Frame 2: More right
  [
    "   ▒▓████   ",
    "  ▒▓    █▓  ",
    "  ▒▓ ██ █▓  ",
    "  ▒▓    █▓  ",
    "   ▒▓████   ",
  ],
  // Frame 3: Edge
  [
    "    ▒▓▓▒    ",
    "    ▒▓▓▒    ",
    "    ▒▓▓▒    ",
    "    ▒▓▓▒    ",
    "    ▒▓▓▒    ",
  ],
  // Frame 4: Coming back
  [
    "   ████▓▒   ",
    "  ▓█    ▓▒  ",
    "  ▓█ ██ ▓▒  ",
    "  ▓█    ▓▒  ",
    "   ████▓▒   ",
  ],
  // Frame 5: Back face
  [
    "  ▓██████▓  ",
    " ▓█      █▓ ",
    " ▓█  ██  █▓ ",
    " ▓█      █▓ ",
    "  ▓██████▓  ",
  ],
  // Frame 6: Almost front
  [
    "  █▓████▓█  ",
    " █▓      ▓█ ",
    " █▓  ██  ▓█ ",
    " █▓      ▓█ ",
    "  █▓████▓█  ",
  ],
  // Frame 7: Nearly front
  [
    "  ██████▓█  ",
    " ██      ▓█ ",
    " ██  ██  ▓█ ",
    " ██      ▓█ ",
    "  ██████▓█  ",
  ],
];

// -- Welcome Screen -----------------------------------------------------------

function WelcomeScreen({ onDismiss }: { onDismiss: () => void }) {
  const { width, height } = useTerminal();
  const { requestRender } = useTui();
  const frameRef = useRef(0);
  const textNodeRef = useRef<any>(null);
  const countdownRef = useRef(3);
  const countdownTextRef = useRef<any>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Logo rotation animation
  if (timerRef.current === null) {
    timerRef.current = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % LOGO_FRAMES.length;
      if (textNodeRef.current) {
        textNodeRef.current.text = LOGO_FRAMES[frameRef.current]!.join("\n");
        requestRender();
      }
    }, 150);
  }

  // Countdown timer
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
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  });

  const agent = AGENTS[0]!;
  const padTop = Math.max(0, Math.floor((height - 10) / 2));
  const logoText = LOGO_FRAMES[0]!.join("\n");

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* Vertical centering */}
      <Box flexDirection="column" height={padTop} />

      {/* Two-column layout: logo left, info right */}
      <Box flexDirection="row" justifyContent="center">
        {/* LEFT: Rotating 3D ASCII logo */}
        <Box flexDirection="column" width={16} marginRight={2}>
          {React.createElement(
            "tui-text",
            { color: THEME.accent, _textNodeRef: textNodeRef },
            logoText,
          )}
        </Box>

        {/* RIGHT: Info rows */}
        <Box flexDirection="column" justifyContent="center">
          {/* Row 1: Name + version */}
          <Box flexDirection="row">
            <Text color={THEME.text} bold>Storm Agent</Text>
            <Text color={THEME.textSecondary}>{" v0.8.2"}</Text>
          </Box>
          {/* Row 2: Model + auth */}
          <Text color={THEME.textSecondary}>
            {agent.model} | API key auth
          </Text>
          {/* Row 3: Working directory */}
          <Text color={THEME.textSecondary}>
            {process.cwd()}
          </Text>
          {/* Row 4: Loading status */}
          {React.createElement(
            "tui-text",
            { color: THEME.textDisabled, _textNodeRef: countdownTextRef },
            `Starting in ${countdownRef.current}...`,
          )}
        </Box>
      </Box>

      <Box flex={1} />
    </Box>
  );
}

// -- App ----------------------------------------------------------------------

export function App(): React.ReactElement {
  const { exit, flushSync } = useTui();
  const [screen, setScreen] = useState<"welcome" | "chat">("welcome");

  const defaultAgent = AGENTS[0]!;

  const handleWelcomeDismiss = useCallback(() => {
    flushSync(() => setScreen("chat"));
  }, [flushSync]);

  const handleExit = useCallback(() => {
    exit();
  }, [exit]);

  if (screen === "welcome") {
    return <WelcomeScreen onDismiss={handleWelcomeDismiss} />;
  }

  return <ChatScreen agent={defaultAgent} onExit={handleExit} />;
}
