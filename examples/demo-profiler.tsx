#!/usr/bin/env npx tsx
/**
 * Profiler demo — shows all observability tools in action.
 *
 * Press 1-4: standard DevTools (heatmap, a11y, time-travel, inspector)
 * Press 5: profiler overlay (memory/CPU/GC breakdown)
 * Press 6: export profiler data to JSON file
 * Press q: quit
 */

import React, { useState, useRef } from "react";
import {
  render, Box, Text, Spinner, Badge, Sparkline, ScrollView,
  useInput, useTerminal, useTui, enableDevTools,
} from "../src/index.js";
import { useTick } from "../src/hooks/useTick.js";

function App() {
  const { width, height } = useTerminal();
  const { exit } = useTui();
  const [messages, setMessages] = useState<string[]>([]);
  const cpuRef = useRef(35);
  const memRef = useRef(55);
  const cpuHistRef = useRef<number[]>(Array.from({ length: 20 }, () => 30 + Math.random() * 20));
  const memHistRef = useRef<number[]>(Array.from({ length: 20 }, () => 50 + Math.random() * 15));

  useInput((e) => {
    if (e.char === "q") exit();
  });

  // Simulate live metrics via useTick (the safe pattern)
  useTick(500, (tick) => {
    cpuRef.current = Math.max(10, Math.min(90, cpuRef.current + (Math.random() - 0.5) * 15));
    memRef.current = Math.max(40, Math.min(85, memRef.current + (Math.random() - 0.45) * 5));
    cpuHistRef.current = [...cpuHistRef.current.slice(-19), cpuRef.current];
    memHistRef.current = [...memHistRef.current.slice(-19), memRef.current];
  });

  // Simulate log messages appearing
  useTick(2000, (tick) => {
    const msgs = [
      "Agent scanning codebase...",
      "Found 3 files matching query",
      "Analyzing auth module",
      "Memory leak detected in session.ts",
      "Generating patch",
      "Running test suite",
      "All 30 tests passed",
      "Deploying to production",
    ];
    setMessages((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msgs[tick % msgs.length]}`]);
  });

  const cpu = Math.round(cpuRef.current);
  const mem = Math.round(memRef.current);

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box height={1} paddingX={1}>
        <Text bold color="#82AAFF">Storm Profiler Demo</Text>
        <Box flex={1} />
        <Text dim>1-6: DevTools  q: quit</Text>
      </Box>

      <Box height={3} paddingX={1} flexDirection="row" gap={4}>
        <Box flexDirection="column">
          <Text dim>CPU</Text>
          <Box flexDirection="row" gap={1}>
            <Sparkline data={cpuHistRef.current} width={20} height={1} color={cpu > 70 ? "#F87171" : "#34D399"} />
            <Text bold color={cpu > 70 ? "#F87171" : "#34D399"}>{cpu}%</Text>
          </Box>
        </Box>
        <Box flexDirection="column">
          <Text dim>Memory</Text>
          <Box flexDirection="row" gap={1}>
            <Sparkline data={memHistRef.current} width={20} height={1} color={mem > 75 ? "#FBBF24" : "#82AAFF"} />
            <Text bold color={mem > 75 ? "#FBBF24" : "#82AAFF"}>{mem}%</Text>
          </Box>
        </Box>
        <Box flexDirection="column">
          <Text dim>Status</Text>
          <Box flexDirection="row" gap={1}>
            <Spinner type="dots" color="#82AAFF" />
            <Badge label="ACTIVE" variant="success" />
          </Box>
        </Box>
      </Box>

      <ScrollView flex={1} stickToBottom>
        <Box flexDirection="column" paddingX={1}>
          {messages.length === 0 ? (
            <Text dim>Waiting for activity...</Text>
          ) : (
            messages.map((msg, i) => (
              <Text key={i} color="#C0CAF5">{msg}</Text>
            ))
          )}
        </Box>
      </ScrollView>

      <Box height={1} paddingX={1}>
        <Text bold color="#82AAFF">storm</Text>
        <Text dim>  {messages.length} events  CPU:{cpu}%  MEM:{mem}%</Text>
      </Box>
    </Box>
  );
}

const app = render(<App />);
enableDevTools(app);
await app.waitUntilExit();
