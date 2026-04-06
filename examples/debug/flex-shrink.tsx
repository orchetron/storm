#!/usr/bin/env npx tsx
import React from "react";
import { render, Box, Text, useTerminal, useInput, useTui } from "../../src/index.js";

function App() {
  const { width, height } = useTerminal();
  const { exit } = useTui();
  useInput((e) => { if (e.key === "q" || (e.key === "c" && e.ctrl)) exit(); });

  const testWidths = [20, 30, 50, width];

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold color="#82AAFF">flexShrink Prefix Test (terminal w={width})</Text>
      <Text color="#565F89">{"─".repeat(width)}</Text>
      {testWidths.map((w, i) =>
        <Box key={i} flexDirection="column">
          <Text dim>w={w}: prefix "AB" should stay 2 cols, X fills rest</Text>
          <Box flexDirection="row" width={w}>
            <Text color="#FF4444">AB</Text>
            <Box flexShrink={1}>
              <Text color="#50C878">{"X".repeat(200)}</Text>
            </Box>
          </Box>
        </Box>
      )}
      <Text color="#565F89">{"─".repeat(width)}</Text>
      <Text dim>Bug: AB shrinks to A (1 col), X gets extra col. q to exit.</Text>
    </Box>
  );
}

render(<App />);
