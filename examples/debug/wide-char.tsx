#!/usr/bin/env npx tsx
import React from "react";
import { render, Box, Text, useTerminal, useInput, useTui } from "../../src/index.js";

function App() {
  const { width } = useTerminal();
  const { exit } = useTui();
  useInput((e) => { if (e.key === "q" || (e.key === "c" && e.ctrl)) exit(); });

  const w = Math.min(width, 40);
  return (
    <Box flexDirection="column" width={w}>
      <Text bold color="#82AAFF">Wide Char Edge Test (width={w})</Text>
      <Text color="#565F89">{"─".repeat(w)}</Text>
      <Text>{"A".repeat(w - 2) + "中"}</Text>
      <Text wrap="truncate">{"B".repeat(w - 1) + "中"}</Text>
      <Text>{"中".repeat(Math.floor(w / 2))}</Text>
      <Text>{"C" + "中".repeat(Math.floor((w - 1) / 2))}</Text>
      <Text color="#565F89">{"─".repeat(w)}</Text>
      <Text dim>Row 3: ASCII fills to w-2, then CJK at last 2 cols (should fit)</Text>
      <Text dim>Row 4: ASCII fills to w-1, then CJK at last col (should NOT fit)</Text>
      <Text dim>Row 5: All CJK, exactly fills width</Text>
      <Text dim>Row 6: 1 ASCII + CJK, last one may overflow</Text>
      <Text dim>Press q to exit</Text>
    </Box>
  );
}

render(<App />);
