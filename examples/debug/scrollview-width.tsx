#!/usr/bin/env npx tsx
// Set env to help debugging
import React from "react";
import { render, Box, Text, ScrollView, useTerminal, useInput, useTui } from "../../src/index.js";

function App() {
  const { width, height } = useTerminal();
  const { exit } = useTui();
  useInput((e) => { if (e.key === "q" || (e.key === "c" && e.ctrl)) exit(); });

  // Each line is exactly width-2 chars (leave room for scrollbar + 1 space)
  // Using unique chars per line so corruption is obvious
  const lineWidth = width - 2;
  const lines = Array.from({ length: 30 }, (_, i) => {
    const num = String(i).padStart(2, "0");
    const prefix = `Line ${num}: `;
    const ch = String.fromCharCode(65 + (i % 26)); // A-Z cycling
    return prefix + ch.repeat(Math.max(0, lineWidth - prefix.length));
  });

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold color="#82AAFF">ScrollView Width Test (w={width} h={height})</Text>
      <ScrollView height={height - 2} scrollSpeed={1}>
        {lines.map((line, i) =>
          <Text key={i}>{line}</Text>
        )}
      </ScrollView>
      <Text dim>Scroll with arrows. Any mixed chars in a line = bug. q to exit.</Text>
    </Box>
  );
}

render(<App />);
