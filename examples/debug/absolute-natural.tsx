#!/usr/bin/env npx tsx
import React from "react";
import { render, Box, Text, useInput, useTui, useTerminal } from "../../src/index.js";

function App() {
  const { width, height } = useTerminal();
  const { exit } = useTui();
  useInput((e) => { if (e.key === "q" || (e.key === "c" && e.ctrl)) exit(); });

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold color="#82AAFF">Absolute Natural Size Test</Text>
      <Text color="#565F89">{"─".repeat(width)}</Text>

      <Box width={width} height={height - 3} position="relative">
        {/* Background dots */}
        {Array.from({ length: height - 3 }, (_, i) =>
          <Text key={i} color="#333">{"·".repeat(width)}</Text>
        )}

        {/* Top-left: no explicit size */}
        <Box position="absolute" top={0} left={0}>
          <Text color="#FF4444" bold>TL</Text>
        </Box>

        {/* Top-right: no explicit width */}
        <Box position="absolute" top={0} right={0}>
          <Text color="#50C878" bold>TR</Text>
        </Box>

        {/* Bottom-left: no explicit height */}
        <Box position="absolute" bottom={0} left={0}>
          <Text color="#FFCC00" bold>BL</Text>
        </Box>

        {/* Bottom-right: no explicit size */}
        <Box position="absolute" bottom={0} right={0}>
          <Text color="#82AAFF" bold>BR</Text>
        </Box>

        {/* Center-ish */}
        <Box position="absolute" top={Math.floor((height - 3) / 2)} left={Math.floor(width / 2) - 5}>
          <Text color="#FF88FF" bold>CENTER</Text>
        </Box>
      </Box>

      <Text dim>TL=top-left TR=top-right BL=bottom-left BR=bottom-right. q to exit.</Text>
    </Box>
  );
}

render(<App />);
