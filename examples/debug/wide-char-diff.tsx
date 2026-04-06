#!/usr/bin/env npx tsx
/** Wide-char placeholder diff bug repro. */
import React, { useState } from "react";
import { render, Box, Text, useInput, useTui, useTerminal } from "../../src/index.js";

function App() {
  const { width } = useTerminal();
  const { exit } = useTui();
  const [highlight, setHighlight] = useState(false);

  useInput((e) => {
    if (e.key === "q" || (e.key === "c" && e.ctrl)) exit();
    if (e.key === "space") setHighlight(h => !h);
  });

  const borderColor = highlight ? "#FF4444" : "#565F89";

  return (
    <Box flexDirection="column" width={Math.min(width, 50)}>
      <Text bold color="#82AAFF">Wide Char Border Bug</Text>
      <Text dim>SPACE to toggle border color (gray ↔ red)</Text>
      <Text color="#565F89">{"─".repeat(40)}</Text>

      {/* CJK text inside a bordered box — the border char at the edge
          of a wide char overwrites the placeholder cell */}
      <Box borderStyle="single" borderColor={borderColor} width={12} height={3}>
        <Text color="#50C878">{"中文测试中"}</Text>
      </Box>

      <Box borderStyle="single" borderColor={borderColor} width={11} height={3}>
        <Text color="#50C878">{"中文测试"}</Text>
      </Box>

      <Text color="#565F89">{"─".repeat(40)}</Text>
      <Text dim>Watch: does the border color change on ALL edges?</Text>
      <Text dim>Bug: border next to CJK placeholder may not update.</Text>
    </Box>
  );
}

render(<App />);
