#!/usr/bin/env npx tsx
import React from "react";
import { render, Box, Text, useTerminal, useInput, useTui } from "../../src/index.js";

function App() {
  const { width, height } = useTerminal();
  const { exit } = useTui();
  useInput((e) => { if (e.key === "q" || (e.key === "c" && e.ctrl)) exit(); });

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold color="#82AAFF">Resize Test — drag terminal edges</Text>
      <Text color="#565F89">{"─".repeat(width)}</Text>
      <Text>Terminal: {width}×{height}</Text>
      <Text>{"X".repeat(width)}</Text>
      <Box flex={1} flexDirection="column">
        {Array.from({ length: Math.max(0, height - 6) }, (_, i) =>
          <Text key={i} color={i % 2 ? "#50C878" : "#82AAFF"}>
            {"Row " + i + " " + "·".repeat(Math.max(0, width - 8))}
          </Text>
        )}
      </Box>
      <Text color="#565F89">{"─".repeat(width)}</Text>
      <Text dim>Resize terminal to test. q to exit.</Text>
    </Box>
  );
}

render(<App />);
