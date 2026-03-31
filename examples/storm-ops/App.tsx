/**
 * Storm Ops — App root.
 *
 * Splash screen (1.5s) then Dashboard.
 */

import React, { useState, useCallback, useRef } from "react";
import {
  Box,
  Text,
  useTerminal,
  useTui,
  useCleanup,
} from "../../src/index.js";

import { Dashboard } from "./Dashboard.js";

// -- Storm Colors ----------------------------------------------------------------

const S = {
  arc: "#82AAFF",
  text: "#C0CAF5",
  dim: "#565F89",
};

const MODEL = "qwen-2.5-coder-32b";

// -- Splash Screen ---------------------------------------------------------------

function SplashScreen({ onDismiss }: { onDismiss: () => void }) {
  const { width, height } = useTerminal();
  const { requestRender } = useTui();
  const countdownTextRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (timerRef.current === null) {
    timerRef.current = setTimeout(() => {
      onDismiss();
    }, 1500);
  }

  useCleanup(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  });

  const padTop = Math.max(0, Math.floor((height - 6) / 2));

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box flexDirection="column" height={padTop} />

      <Box flexDirection="column" alignItems="center">
        <Text color={S.arc} bold>{"◆ storm ops"}</Text>
        <Text color={S.text}>{"  AI Operations Center"}</Text>
        <Text color={S.dim}>{"  3 agents · " + MODEL}</Text>
      </Box>

      <Box flex={1} />
    </Box>
  );
}

// -- App -------------------------------------------------------------------------

export function App(): React.ReactElement {
  const { exit, flushSync } = useTui();
  const [screen, setScreen] = useState<"splash" | "dashboard">("splash");

  const handleSplashDismiss = useCallback(() => {
    flushSync(() => setScreen("dashboard"));
  }, [flushSync]);

  const handleExit = useCallback(() => {
    exit();
  }, [exit]);

  if (screen === "splash") {
    return <SplashScreen onDismiss={handleSplashDismiss} />;
  }

  return <Dashboard model={MODEL} onExit={handleExit} />;
}
