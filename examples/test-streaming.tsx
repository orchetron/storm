import React, { useRef } from "react";
import { render, Box, Text, useTui, useInput, useCleanup } from "../src/index.js";

const fullText = "Imperative text that grows character by character to find the double cursor bug.";

/**
 * Three tests stacked — which one glitches?
 */
function App() {
  const { exit, requestRender } = useTui();
  const ref1 = useRef<any>(null);
  const ref2 = useRef<any>(null);
  const ref3 = useRef<any>(null);
  const revRef = useRef(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (!timerRef.current) {
    timerRef.current = setInterval(() => {
      revRef.current = Math.min(revRef.current + 1, fullText.length);
      const t = fullText.slice(0, revRef.current);
      if (ref1.current) ref1.current.text = t;
      if (ref2.current) ref2.current.text = t;
      if (ref3.current) ref3.current.text = t;
      requestRender();
    }, 80);
  }

  useCleanup(() => { if (timerRef.current) clearInterval(timerRef.current); });
  useInput((e) => { if (e.key === "c" && e.ctrl) exit(); });

  return (
    <Box flexDirection="column" padding={1} gap={1}>
      <Text bold color="#82AAFF">Test A — flat (no nesting):</Text>
      {React.createElement("tui-text", { color: "#C0CAF5", _textNodeRef: ref1 }, fullText.slice(0, 1))}
      <Text color="#444444">────────────────────────</Text>

      <Text bold color="#82AAFF">Test B — inside Box(row) with sibling:</Text>
      <Box flexDirection="row" gap={1}>
        <Text bold color="#82AAFF">◆</Text>
        {React.createElement("tui-text", { color: "#C0CAF5", _textNodeRef: ref2 }, fullText.slice(0, 1))}
      </Box>
      <Text color="#444444">────────────────────────</Text>

      <Text bold color="#82AAFF">Test C — inside Box(row) + Box(flexShrink):</Text>
      <Box flexDirection="row" gap={1}>
        <Text bold color="#82AAFF">◆</Text>
        <Box flexShrink={1}>
          {React.createElement("tui-text", { color: "#C0CAF5", _textNodeRef: ref3 }, fullText.slice(0, 1))}
        </Box>
      </Box>
      <Text color="#444444">────────────────────────</Text>

      <Text color="#9ECE6A">--- All done. Check which test has the glitch ---</Text>
    </Box>
  );
}

const app = render(<App />);
await app.waitUntilExit();
