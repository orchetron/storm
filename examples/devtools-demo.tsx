#!/usr/bin/env npx tsx
/**
 * Storm TUI DevTools Demo
 *
 * Press 1/2/3/4 to toggle each DevTools feature.
 * The app keeps running underneath — all overlays are non-blocking.
 *
 *   1 — Render Diff Heatmap
 *   2 — WCAG Accessibility Audit
 *   3 — Time-Travel (←→ scrub, 3/Esc exit)
 *   4 — DevTools Overlay ([] panels, jk navigate, space toggle)
 *
 *   Ctrl+C to exit
 */
import React, { useState } from "react";
import {
  render,
  Box,
  Text,
  Spinner,
  useInput,
  useTui,
  enableDevTools,
  useTick,
} from "../src/index.js";

// ── Sample components ───────────────────────────────────────────────

function Clock() {
  const { requestRender } = useTui();
  const textRef = React.useRef<any>(null);

  useTick(
    1000,
    () => {
      const t = new Date().toLocaleTimeString();
      if (textRef.current && textRef.current.text !== t) {
        textRef.current.text = t;
        requestRender();
      }
    },
    { reactive: false }
  );

  return React.createElement(
    "tui-text",
    { color: "#82AAFF", bold: true, _textNodeRef: textRef },
    new Date().toLocaleTimeString()
  );
}

function Counter() {
  const [count, setCount] = useState(0);

  useTick(2000, () => {
    setCount((c) => c + 1);
  });

  return (
    <Box flexDirection="row" gap={1}>
      <Text dim>Counter:</Text>
      <Text color="#FFB800" bold>
        {String(count)}
      </Text>
    </Box>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="#333333"
      paddingX={1}
    >
      <Text bold color="#82AAFF">
        {title}
      </Text>
      {children}
    </Box>
  );
}

function App() {
  const { exit } = useTui();

  useInput((e) => {
    if (e.key === "c" && e.ctrl) exit();
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="#82AAFF">
        {"  Storm TUI DevTools Demo"}
      </Text>
      <Text dim>
        {"  Press 1-4 to toggle features. App keeps running underneath.\n"}
      </Text>

      <Box flexDirection="row" gap={1}>
        <Panel title="Live Clock">
          <Clock />
        </Panel>

        <Panel title="Spinner">
          <Box flexDirection="row" gap={1}>
            <Spinner type="dots" />
            <Text>Processing...</Text>
          </Box>
        </Panel>

        <Panel title="Counter">
          <Counter />
        </Panel>
      </Box>

      <Box marginTop={1}>
        <Panel title="Static Content (stays cool on heatmap)">
          <Text>This text never changes. On the heatmap it fades to blue.</Text>
          <Text>Only spinner, clock, and counter should glow hot.</Text>
        </Panel>
      </Box>

      <Box marginTop={1}>
        <Panel title="Contrast Test">
          <Text color="#333333">
            Dark gray on black — should FAIL a11y audit
          </Text>
          <Text color="#FFFFFF">White on black — should PASS</Text>
          <Text color="#82AAFF" bold>
            Brand blue on black — check the ratio
          </Text>
        </Panel>
      </Box>

      <Box marginTop={1} paddingX={1}>
        <Text dim color="#555555">
          {
            "1:Heatmap  2:A11y  3:Time-Travel(←→)  4:DevTools([]:panels jk:nav space:toggle)  Ctrl+C:exit"
          }
        </Text>
      </Box>
    </Box>
  );
}

// ── Two lines: render + enable DevTools ──────────────────────────────

const app = render(<App />);
enableDevTools(app);

await app.waitUntilExit();