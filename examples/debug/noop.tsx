#!/usr/bin/env npx tsx
import React, { useState } from "react";
import { render, Box, Text, useInput, useTui, useTerminal } from "../../src/index.js";

function App() {
  const { width } = useTerminal();
  const { exit } = useTui();
  const [count, setCount] = useState(0);

  useInput((e) => {
    if (e.key === "q" || (e.key === "c" && e.ctrl)) exit();
    if (e.key === "space") setCount(c => c + 1);
  });

  return (
    <Box flexDirection="column" width={Math.min(width, 40)}>
      <Text bold color="#82AAFF">No-op Commit Test</Text>
      <Text color="#565F89">{"─".repeat(40)}</Text>
      <Text>Rerender count: {count}</Text>
      <Text color="#565F89">{"─".repeat(40)}</Text>
      <Text color="#50C878">This text should NEVER change.</Text>
      <Text color="#50C878">Colors should stay green.</Text>
      <Text color="#50C878">No flicker on SPACE press.</Text>
      <Text color="#565F89">{"─".repeat(40)}</Text>
      <Text dim>SPACE forces rerender. Only the count changes.</Text>
      <Text dim>Bug: if clear() corrupts, green text breaks.</Text>
      <Text dim>q to exit</Text>
    </Box>
  );
}

render(<App />);
