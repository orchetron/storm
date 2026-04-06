#!/usr/bin/env npx tsx
import React, { useState } from "react";
import { render, Box, Text, ScrollView, useInput, useTui, useTerminal } from "../../src/index.js";

function App() {
  const { width, height } = useTerminal();
  const { exit } = useTui();
  const [count, setCount] = useState(20);

  useInput((e) => {
    if (e.key === "q" || (e.key === "c" && e.ctrl)) exit();
    if (e.key === "a") setCount(c => c + 5);
    if (e.key === "d") setCount(c => Math.max(1, c - 5));
  });

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold color="#82AAFF">Scroll Clamp Test — {count} items</Text>
      <Text dim>a = add 5 items | d = remove 5 items | scroll with arrows | q = exit</Text>
      <Text color="#565F89">{"─".repeat(width)}</Text>
      <ScrollView height={height - 4} scrollSpeed={1}>
        {Array.from({ length: count }, (_, i) =>
          <Text key={i} color={i % 2 ? "#50C878" : "#82AAFF"}>
            {"  Item " + i + " — " + "content ".repeat(3)}
          </Text>
        )}
      </ScrollView>
      <Text color="#565F89">{"─".repeat(width)}</Text>
    </Box>
  );
}

render(<App />);
