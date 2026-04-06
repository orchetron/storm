#!/usr/bin/env npx tsx
import React, { useState } from "react";
import { render, Box, Text, ScrollView, useInput, useTui, useTerminal } from "../../src/index.js";

function App() {
  const { width, height } = useTerminal();
  const { exit } = useTui();
  const [count, setCount] = useState(30);

  useInput((e) => {
    if (e.key === "q" || (e.key === "c" && e.ctrl)) exit();
    if (e.key === "a") setCount(c => c + 10);
    if (e.key === "d") setCount(c => Math.max(1, c - 10));
  });

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold color="#82AAFF">Overflow Clip Test — {count} items</Text>
      <Text dim>a = add 10 | d = remove 10 | scroll with arrows | q = exit</Text>
      <Text color="#FF4444">THIS MUST STAY VISIBLE (above scroll)</Text>
      <ScrollView height={height - 5} scrollSpeed={1}>
        {Array.from({ length: count }, (_, i) =>
          <Text key={i} color={i % 2 ? "#50C878" : "#82AAFF"}>
            {"  Item " + i + " — " + "content ".repeat(2)}
          </Text>
        )}
      </ScrollView>
      <Text color="#FF4444">THIS MUST STAY VISIBLE (below scroll)</Text>
    </Box>
  );
}

render(<App />);
