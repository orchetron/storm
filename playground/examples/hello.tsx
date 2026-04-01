import React from "react";
import { render, Box, Text } from "../src/index.js";

function App() {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="#82AAFF">Hello from Storm!</Text>
      <Text dim>Press Ctrl+C to exit</Text>
    </Box>
  );
}

render(<App />).waitUntilExit();
