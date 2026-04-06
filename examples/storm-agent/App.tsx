/**
 * Storm Agent CLI -- App root.
 *
 * Welcome screen (two-column: rotating logo + info) then chat.
 * Storm Agent visual design.
 */

import React, { useCallback, useRef, useState } from "react";
import {
  Box,
  Text,
  useTerminal,
  useTui,
  useTick,
} from "../../src/index.js";

import { AGENTS } from "./data/mock-agents.js";
import { ChatScreen } from "./screens/ChatScreen.js";

// -- Theme Colors -------------------------------------------------------------

const THEME = {
  accent: "#82AAFF",
  accentLight: "#BEBEEE",
  text: "#DEE1E4",
  textSecondary: "#A5A8AB",
  textDisabled: "#46484A",
};

// -- 3D Rotating Logo (block/shade chars) -------------------------------------

const LOGO_FRAMES: string[][] = [
  [
    "    ██    ",
    "  ██  ██  ",
    "██  ◆◆  ██",
    "  ██  ██  ",
    "    ██    ",
  ],
  [
    "    ▓█    ",
    "  ▓█  █▓  ",
    "▓█  ◆◆  █▓",
    "  ▓█  █▓  ",
    "    ▓█    ",
  ],
  [
    "    ▒▓    ",
    "  ▒▓  ▓▒  ",
    "▒▓  ◆◆  ▓▒",
    "  ▒▓  ▓▒  ",
    "    ▒▓    ",
  ],
  [
    "    ▒▒    ",
    "   ▒▒▒▒   ",
    "  ▒▒◆◆▒▒  ",
    "   ▒▒▒▒   ",
    "    ▒▒    ",
  ],
  [
    "    ▓▒    ",
    "  ▓▒  ▒▓  ",
    "▓▒  ◆◆  ▒▓",
    "  ▓▒  ▒▓  ",
    "    ▓▒    ",
  ],
  [
    "    █▓    ",
    "  █▓  ▓█  ",
    "█▓  ◆◆  ▓█",
    "  █▓  ▓█  ",
    "    █▓    ",
  ],
  [
    "    █▓    ",
    "  ██  ▓█  ",
    "██  ◆◆  ▓█",
    "  ██  ▓█  ",
    "    █▓    ",
  ],
  [
    "    ██    ",
    "  ██  █▓  ",
    "██  ◆◆  █▓",
    "  ██  █▓  ",
    "    ██    ",
  ],
];

// -- Welcome Screen -----------------------------------------------------------

function WelcomeScreen({ onDismiss }: { onDismiss: () => void }) {
  const { width, height } = useTerminal();
  const frameRef = useRef(0);
  const textNodeRef = useRef<any>(null);
  const countdownRef = useRef(3);
  const countdownTextRef = useRef<any>(null);

  // Logo rotation animation (imperative — no React re-render needed)
  useTick(150, (tick) => {
    frameRef.current = tick % LOGO_FRAMES.length;
    if (textNodeRef.current) {
      textNodeRef.current.text = LOGO_FRAMES[frameRef.current]!.join("\n");
    }
  }, { reactive: false });

  // Countdown timer (reactive — updates countdown text)
  useTick(1000, (tick) => {
    const remaining = 3 - tick;
    countdownRef.current = remaining;
    if (remaining <= 0) {
      onDismiss();
    } else if (countdownTextRef.current) {
      countdownTextRef.current.text = `Starting in ${remaining}...`;
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
    setScreen("chat");
  }, []);

  const handleExit = useCallback(() => {
    exit();
  }, [exit]);

  if (screen === "welcome") {
    return <WelcomeScreen onDismiss={handleWelcomeDismiss} />;
  }

  return <ChatScreen agent={defaultAgent} onExit={handleExit} />;
}
