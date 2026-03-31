/**
 * Storm Code CLI -- App root.
 *
 * On launch: two-line welcome (NO box, NO border, NO ASCII art):
 *   ✻ Welcome to Storm Code! Type your message to get started.
 *     Working directory: /path/to/cwd
 *
 * After 1 second, transitions to chat.
 */

import React, { useState, useCallback, useRef } from "react";
import {
  Box,
  Text,
  useTerminal,
  useTui,
  useCleanup,
} from "../../src/index.js";

import { ChatScreen } from "./ChatScreen.js";

// -- Colors -------------------------------------------------------------------

const CC = {
  accent: "#d97757",       // terra cotta orange
  text: "#ffffff",
  textDim: "#808080",
};

// -- Config -------------------------------------------------------------------

const MODEL = "qwen-2.5-coder-32b";
const WORKING_DIR = process.cwd();

// -- Welcome Screen -----------------------------------------------------------

// -- ASCII Banner (block-letter "STORM CODE") --

const BANNER_LINES = [
  " \u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2557   \u2588\u2588\u2588\u2557",
  "\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2551",
  "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557   \u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2554\u2588\u2588\u2588\u2588\u2554\u2588\u2588\u2551",
  "\u255A\u2550\u2550\u2550\u2550\u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551\u255A\u2588\u2588\u2554\u255D\u2588\u2588\u2551",
  "\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D   \u2588\u2588\u2551   \u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551 \u255A\u2550\u255D \u2588\u2588\u2551",
  "\u255A\u2550\u2550\u2550\u2550\u2550\u255D    \u255A\u2550\u255D    \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u255D     \u255A\u2550\u255D",
  " \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557",
  "\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D",
  "\u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557",
  "\u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255D",
  "\u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557",
  " \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D",
];

function WelcomeScreen({ onDismiss }: { onDismiss: () => void }) {
  const { width, height } = useTerminal();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (timerRef.current === null) {
    timerRef.current = setTimeout(() => {
      onDismiss();
    }, 3000);
  }

  useCleanup(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  });

  // Center the banner
  const bannerWidth = 49; // approximate width of the block letters
  const padLeft = Math.max(0, Math.floor((width - bannerWidth) / 2));
  const pad = " ".repeat(padLeft);

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box flex={1} />
      {/* ASCII banner */}
      <Box flexDirection="column">
        {BANNER_LINES.map((line, i) => (
          <Box key={i} height={1}>
            <Text color={CC.accent}>{pad}{line}</Text>
          </Box>
        ))}
      </Box>
      {/* Welcome info below banner */}
      <Box flexDirection="column" paddingTop={1}>
        <Box justifyContent="center">
          <Text color={CC.text}>
            {"\u273B "}Welcome to Storm Code!
          </Text>
        </Box>
        <Box justifyContent="center">
          <Text dim>/help for help, /status for your current setup</Text>
        </Box>
        <Box height={1} />
        <Box justifyContent="center">
          <Text dim>Model: {MODEL}  \u00B7  Context: 128K tokens</Text>
        </Box>
        <Box justifyContent="center">
          <Text dim>{WORKING_DIR}</Text>
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

  const handleWelcomeDismiss = useCallback(() => {
    flushSync(() => setScreen("chat"));
  }, [flushSync]);

  const handleExit = useCallback(() => {
    exit();
  }, [exit]);

  if (screen === "welcome") {
    return <WelcomeScreen onDismiss={handleWelcomeDismiss} />;
  }

  return (
    <ChatScreen
      model={MODEL}
      workingDirectory={WORKING_DIR}
      onExit={handleExit}
    />
  );
}
