#!/usr/bin/env npx tsx
import React, { useState } from "react";
import { render, Box, Text, useInput, useTui, useTerminal } from "../../src/index.js";

function App() {
  const { width } = useTerminal();
  const { exit } = useTui();
  const [order, setOrder] = useState<"ABC" | "CAB" | "BCA">("ABC");

  useInput((e) => {
    if (e.key === "q" || (e.key === "c" && e.ctrl)) exit();
    if (e.key === "space") {
      setOrder(o => o === "ABC" ? "CAB" : o === "CAB" ? "BCA" : "ABC");
    }
  });

  const items: Record<string, React.ReactElement> = {
    A: <Text key="a" color="#FF6666">AAAA - Red Item</Text>,
    B: <Text key="b" color="#66FF66">BBBB - Green Item</Text>,
    C: <Text key="c" color="#6666FF">CCCC - Blue Item</Text>,
  };

  const ordered = order.split("").map(k => items[k]!);

  return (
    <Box flexDirection="column" width={Math.min(width, 40)}>
      <Text bold color="#82AAFF">Element Reorder Test</Text>
      <Text color="#565F89">{"─".repeat(30)}</Text>
      <Text dim>Order: {order} (press SPACE to cycle)</Text>
      <Text color="#565F89">{"─".repeat(30)}</Text>
      <Box flexDirection="column">
        {ordered}
      </Box>
      <Text color="#565F89">{"─".repeat(30)}</Text>
      <Text dim>Expected: items should swap positions</Text>
      <Text dim>Bug: items stay at original positions</Text>
      <Text dim>Press SPACE to reorder, q to exit</Text>
    </Box>
  );
}

render(<App />);
