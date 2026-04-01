import React, { useRef } from "react";
import { render, Box, Text, useTui, useInput, useTick } from "../src/index.js";

function Counter() {
  const { exit } = useTui();
  const countRef = useRef(0);

  useTick(1000, () => {
    countRef.current++;
  });

  useInput((e) => {
    if (e.key === "c" && e.ctrl) exit();
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="#82AAFF">Storm Counter</Text>
      <Text>
        Seconds elapsed: <Text bold color="#9ECE6A">{countRef.current}</Text>
      </Text>
      <Text dim>Press Ctrl+C to exit</Text>
    </Box>
  );
}

render(<Counter />).waitUntilExit();
