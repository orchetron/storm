#!/usr/bin/env npx tsx
import React, { useState } from "react";
import { render, Box, Text, useInput, useTui, useTerminal } from "../../src/index.js";

function App() {
  const { width, height } = useTerminal();
  const { exit } = useTui();
  const [pos, setPos] = useState({ top: 2, left: 5 });

  useInput((e) => {
    if (e.key === "q" || (e.key === "c" && e.ctrl)) exit();
    if (e.key === "up") setPos(p => ({ ...p, top: Math.max(0, p.top - 1) }));
    if (e.key === "down") setPos(p => ({ ...p, top: Math.min(height - 4, p.top + 1) }));
    if (e.key === "left") setPos(p => ({ ...p, left: Math.max(0, p.left - 1) }));
    if (e.key === "right") setPos(p => ({ ...p, left: Math.min(width - 15, p.left + 1) }));
  });

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold color="#82AAFF">Absolute Position Test</Text>
      <Text dim>Arrow keys to move box. q to exit.</Text>
      {Array.from({ length: height - 3 }, (_, i) =>
        <Text key={i} color="#333">{"·".repeat(width)}</Text>
      )}
      <Box position="absolute" top={pos.top} left={pos.left}
        borderStyle="single" borderColor="#FF4444" width={12} height={3}>
        <Text color="#FF4444">FLOATING</Text>
      </Box>
      <Text dim>pos: top={pos.top} left={pos.left}</Text>
    </Box>
  );
}

render(<App />);
