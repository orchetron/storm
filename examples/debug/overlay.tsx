#!/usr/bin/env npx tsx
import React, { useState } from "react";
import { render, Box, Text, Overlay, useInput, useTui, useTerminal } from "../../src/index.js";

function App() {
  const { width, height } = useTerminal();
  const { exit } = useTui();
  const [showOverlay, setShowOverlay] = useState(false);

  useInput((e) => {
    if (e.key === "q" || (e.key === "c" && e.ctrl)) exit();
    if (e.key === "space") setShowOverlay(s => !s);
  });

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold color="#82AAFF">Overlay Test</Text>
      <Text dim>SPACE to toggle overlay | q to exit</Text>
      <Text color="#565F89">{"─".repeat(width)}</Text>
      {Array.from({ length: height - 5 }, (_, i) =>
        <Text key={i} color="#50C878">{"Background row " + i + " " + "·".repeat(Math.max(0, width - 20))}</Text>
      )}
      <Text color="#565F89">{"─".repeat(width)}</Text>
      <Overlay visible={showOverlay}>
        <Box borderStyle="single" borderColor="#FF4444" width={30} height={5}>
          <Box flexDirection="column">
            <Text bold color="#FF4444">MODAL OVERLAY</Text>
            <Text>This should cover background.</Text>
            <Text dim>SPACE to close.</Text>
          </Box>
        </Box>
      </Overlay>
    </Box>
  );
}

render(<App />);
