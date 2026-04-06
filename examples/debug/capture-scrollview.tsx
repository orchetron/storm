#!/usr/bin/env npx tsx
/**
 * Captures raw ANSI output to /tmp/storm-capture.txt for debugging.
 * Run this, wait for it to render, press q to exit, then inspect the file.
 */
import React from "react";
import { render, Box, Text, ScrollView, Markdown, useTerminal, useInput, useTui } from "../../src/index.js";
import { writeFileSync, appendFileSync } from "fs";

// Intercept stdout to capture raw ANSI
const origWrite = process.stdout.write.bind(process.stdout);
writeFileSync("/tmp/storm-capture.txt", "");
process.stdout.write = (chunk: any, ...args: any[]) => {
  appendFileSync("/tmp/storm-capture.txt", typeof chunk === "string" ? chunk : chunk.toString());
  return (origWrite as any)(chunk, ...args);
};

const content = "Hello! I am your Agent with persistent memory. I remember our previous conversations and can learn new things about you over time. How can I help you today?";

function App() {
  const { width, height } = useTerminal();
  const { exit } = useTui();
  useInput((e) => { if (e.key === "q" || (e.key === "c" && e.ctrl)) exit(); });

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold>Capture test w={width}</Text>
      <ScrollView height={height - 2}>
        <Text>Filler 1</Text>
        <Text>Filler 2</Text>
        <Text>Filler 3</Text>
        <Text>Filler 4</Text>
        <Text>Filler 5</Text>
        <Text>Filler 6</Text>
        <Text>Filler 7</Text>
        <Text>Filler 8</Text>
        <Text>Filler 9</Text>
        <Text>Filler 10</Text>
        <Text>Filler 11</Text>
        <Text>Filler 12</Text>
        <Text>Filler 13</Text>
        <Text>Filler 14</Text>
        <Text>Filler 15</Text>
        <Box flexDirection="row">
          <Text>● </Text>
          <Box flexShrink={1}>
            <Markdown content={content} />
          </Box>
        </Box>
      </ScrollView>
      <Text dim>Press q. Then: cat /tmp/storm-capture.txt | cat -v</Text>
    </Box>
  );
}

render(<App />);
