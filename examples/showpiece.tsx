#!/usr/bin/env npx tsx
/**
 * Storm TUI — Showpiece Demo
 *
 * ONE screen that evolves from empty to a full living operations center.
 * Not slides. Not phases. One continuous build-up.
 *
 * 0s:  Empty. Just the header.
 * 1s:  User types a request.
 * 3s:  AI starts reasoning, then streaming a response.
 * 6s:  Operations appear one by one, completing as they go.
 * 9s:  Right panel opens — diff view showing code changes.
 * 13s: Bottom panel opens — live metrics, tests running, events.
 * 18s: Everything completes. All green. Full dashboard alive.
 * 22s: Brief hold on the final state.
 * 24s: End card — logo + install.
 *
 * Usage: npx tsx examples/showpiece.tsx
 */

import React, { useState, useRef } from "react";
import {
  render,
  Box,
  Text,
  Spinner,
  ScrollView,
  ProgressBar,
  Sparkline,
  DiffView,
  SyntaxHighlight,
  MessageBubble,
  OperationTree,
  BlinkDot,
  StreamingText,
  ModelBadge,
  useTerminal,
  useTui,
  useCleanup,
  useInput,
  type OpNode,
} from "../src/index.js";

// ── Brand ─────────────────────────────────────────────────────────

const C = {
  arc: "#82AAFF",
  text: "#C0CAF5",
  dim: "#565F89",
  success: "#9ECE6A",
  error: "#F7768E",
  warning: "#E0AF68",
};

// ── Data ──────────────────────────────────────────────────────────

const AI_RESPONSE = "I'll fix the token refresh bug. The issue is in `src/auth.ts` — the refresh timer doesn't account for clock skew. I'll add a 30-second buffer and retry logic for failed refreshes.";

const DIFF = `--- a/src/auth.ts
+++ b/src/auth.ts
@@ -42,8 +42,12 @@
 async function refreshToken(token: AuthToken) {
-  if (Date.now() < token.expiresAt) {
-    return token;
+  const CLOCK_SKEW_BUFFER = 30_000;
+  const expiresAt = token.expiresAt - CLOCK_SKEW_BUFFER;
+  if (Date.now() < expiresAt) {
+    return token; // still valid
   }
-  const fresh = await authApi.refresh(token.refreshToken);
-  return fresh;
+  for (let attempt = 0; attempt < 3; attempt++) {
+    try {
+      return await authApi.refresh(token.refreshToken);
+    } catch { await sleep(1000 * (attempt + 1)); }
+  }
+  throw new AuthError("TOKEN_REFRESH_FAILED");
 }`;

// ── Diamond Logo ──────────────────────────────────────────────────

const DIAMOND = [
  "    ██    \n  ██  ██  \n██  ◆◆  ██\n  ██  ██  \n    ██    ",
  "    █▓    \n  █▓  ▓█  \n█▓  ◆◆  ▓█\n  █▓  ▓█  \n    █▓    ",
  "    ▓▒    \n  ▓▒  ▒█  \n▓▒  ◆◆  ▒█\n  ▓▒  ▒█  \n    ▓▒    ",
  "    ▒░    \n    ▒░    \n    ▒░    \n    ▒░    \n    ▒░    ",
  "    ▒▓    \n  █▒  ▒▓  \n█▒  ◆◆  ▒▓\n  █▒  ▒▓  \n    ▒▓    ",
  "    ▓█    \n  ▓█  █▓  \n▓█  ◆◆  █▓\n  ▓█  █▓  \n    ▓█    ",
  "    █▓    \n  █▓  ▓█  \n█▓  ◆◆  ▓█\n  █▓  ▓█  \n    █▓    ",
  "    ██    \n  ██  █▓  \n██  ◆◆  █▓\n  ██  █▓  \n    ██    ",
];

// ── The Showpiece ─────────────────────────────────────────────────

function Showpiece() {
  const { width, height } = useTerminal();
  const { exit, flushSync, requestRender } = useTui();
  const [, setTick] = useState(0);
  const startRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logoFrameRef = useRef(0);
  const logoTextRef = useRef<any>(null);

  // Master timer — 10fps, drives everything from one elapsed value
  if (!timerRef.current) {
    timerRef.current = setInterval(() => {
      flushSync(() => setTick(t => t + 1));
    }, 100);
  }

  // Logo rotation — independent fast timer
  const logoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  if (!logoTimerRef.current) {
    logoTimerRef.current = setInterval(() => {
      logoFrameRef.current = (logoFrameRef.current + 1) % DIAMOND.length;
      if (logoTextRef.current) {
        logoTextRef.current.text = DIAMOND[logoFrameRef.current]!;
        requestRender();
      }
    }, 150);
  }

  useCleanup(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (logoTimerRef.current) clearInterval(logoTimerRef.current);
  });

  useInput((e) => { if (e.key === "c" && e.ctrl || e.key === "q") exit(); });

  const t = Date.now() - startRef.current;
  const END_CARD_AT = 24000;
  const EXIT_AT = 28000;

  if (t >= EXIT_AT) { exit(); return <Box />; }

  // ── End Card ──────────────────────────────────────────────────
  if (t >= END_CARD_AT) {
    const cardT = t - END_CARD_AT;
    return (
      <Box flexDirection="column" width={width} height={height} justifyContent="center" alignItems="center">
        {React.createElement("tui-text", { color: C.arc, bold: true, _textNodeRef: logoTextRef }, DIAMOND[0])}
        {cardT > 400 && <Box height={1} />}
        {cardT > 400 && <Text bold color={C.text}>storm</Text>}
        {cardT > 600 && <Text color={C.dim}>compositor-based terminal UI framework</Text>}
        {cardT > 1200 && <Box height={1} />}
        {cardT > 1200 && <Text color={C.arc} bold>npm install @orchetron/storm-tui</Text>}
        {cardT > 2000 && <Box height={1} />}
        {cardT > 2000 && <Text dim color={C.dim}>92 components · 19 AI widgets · 74 hooks · zero native deps</Text>}
      </Box>
    );
  }

  // ── Computed state from elapsed time ──────────────────────────

  // Operations — appear one by one, complete staggered
  const ops: OpNode[] = [];
  if (t > 6000)  ops.push({ id: "1", label: "Reading src/auth.ts", status: t > 7500 ? "completed" : "running", ...(t > 7500 ? { durationMs: 340 } : {}) });
  if (t > 7500)  ops.push({ id: "2", label: "Analyzing token logic", status: t > 10000 ? "completed" : "running", ...(t > 10000 ? { durationMs: 1200 } : {}) });
  if (t > 10000) ops.push({ id: "3", label: "Editing refreshToken()", status: t > 12500 ? "completed" : "running", ...(t > 12500 ? { durationMs: 2100 } : {}) });
  if (t > 12500) ops.push({ id: "4", label: "Running test suite", status: t > 18000 ? "completed" : "running", ...(t > 18000 ? { durationMs: 4200 } : {}) });

  // Metrics — live updating
  const showDiff = t > 9000;
  const showMetrics = t > 13000;
  const tokens = showMetrics ? Math.round((t - 13000) * 1.5) : 0;
  const tokPerSec = 30 + Math.round(Math.sin(t / 500) * 15);
  const testsRun = showMetrics ? Math.min(42, Math.floor((t - 13000) / 100)) : 0;
  const testsPassed = Math.min(testsRun, Math.max(0, testsRun - 1));
  const allDone = t > 18000;
  const cost = (tokens * 0.000003).toFixed(4);

  // Sparkline
  const sparkData: number[] = [];
  if (showMetrics) {
    const sparkLen = Math.min(20, Math.floor((t - 13000) / 300) + 2);
    for (let i = 0; i < sparkLen; i++) {
      sparkData.push(25 + Math.round(Math.sin((t / 400) + i * 0.7) * 18 + Math.random() * 8));
    }
  }

  // Events
  const events: string[] = [];
  if (t > 7500) events.push("◆ Reading src/auth.ts completed (340ms)");
  if (t > 10000) events.push("◆ Token logic analysis complete");
  if (t > 12500) events.push("◆ refreshToken() patched successfully");
  if (t > 14000) events.push("◆ Test suite started — 42 tests");
  if (t > 16000) events.push(`◆ ${Math.min(42, testsRun)} tests passed`);
  if (t > 18000) events.push("◆ All 42 tests passed — pipeline complete");
  if (t > 20000) events.push(`◆ Total: ${tokens.toLocaleString()} tokens · $${cost}`);

  // Layout zones
  const hasRightPanel = showDiff;
  const hasBottomPanel = showMetrics;
  const mainWidth = hasRightPanel ? Math.floor((width - 1) / 2) : width;
  const rightWidth = hasRightPanel ? width - mainWidth - 1 : 0;
  const topHeight = hasBottomPanel ? Math.max(10, height - 10) : height;
  const bottomHeight = hasBottomPanel ? Math.min(10, height - topHeight) : 0;

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* ── HEADER ────────────────────────────────── */}
      <Box height={1} paddingLeft={1} overflow="hidden">
        <Spinner type="storm-logo" color={C.arc} interval={120} />
        <Text bold color={C.text}>{" storm"}</Text>
        <Text color={C.dim}>{" · qwen-2.5-coder-32b"}</Text>
        <Box flex={1} />
        {t > 6000 && <BlinkDot state={allDone ? "completed" : "running"} />}
        {t > 6000 && <Text color={allDone ? C.success : C.arc}>{allDone ? " done" : " working"}</Text>}
      </Box>
      <Box height={1} overflow="hidden">
        <Text color={C.dim}>{"─".repeat(Math.max(0, width - 2))}</Text>
      </Box>

      {/* ── MAIN AREA (top) ──────────────────────── */}
      <Box flex={1} flexDirection="row">
        {/* LEFT: Chat + Operations */}
        <Box flexDirection="column" width={mainWidth} overflow="hidden">
          <ScrollView flex={1} stickToBottom>
            <Box flexDirection="column" paddingX={1} paddingY={1} gap={1}>
              {/* User message — appears at 1s */}
              {t > 1000 && (
                <MessageBubble role="user" symbol="›">
                  Fix the token refresh bug in auth.ts — tokens expire during long sessions
                </MessageBubble>
              )}

              {/* Thinking — appears at 3s */}
              {t > 3000 && t < 4000 && (
                <Box flexDirection="row" gap={1}>
                  <Text dim color={C.dim}>⟡ Reasoning...</Text>
                </Box>
              )}

              {/* AI Response — streams from 4s */}
              {t > 4000 && (
                <Box flexDirection="row" gap={1}>
                  <Text bold color={C.arc}>◆</Text>
                  <Box flexShrink={1}>
                    <StreamingText
                      text={AI_RESPONSE}
                      streaming={t < 8000}
                      animate
                      speed={2}
                      color={C.text}
                    />
                  </Box>
                </Box>
              )}

              {/* Operations — staggered from 6s */}
              {ops.length > 0 && (
                <OperationTree nodes={ops} showDuration />
              )}
            </Box>
          </ScrollView>
        </Box>

        {/* RIGHT: Diff panel — slides in at 9s */}
        {hasRightPanel && (
          <Box flexDirection="column" width={rightWidth} borderStyle="single" borderColor={C.dim} overflow="hidden">
            <Box paddingX={1}>
              <Text bold color={C.arc}>Changes · src/auth.ts</Text>
            </Box>
            <ScrollView flex={1}>
              <Box paddingX={1}>
                <DiffView diff={DIFF} showLineNumbers={false} />
              </Box>
            </ScrollView>
          </Box>
        )}
      </Box>

      {/* ── BOTTOM PANEL — metrics, slides in at 13s ── */}
      {hasBottomPanel && (
        <Box height={bottomHeight} borderStyle="single" borderColor={C.dim} flexDirection="row" overflow="hidden">
          {/* Metrics */}
          <Box flex={1} flexDirection="column" paddingX={1} overflow="hidden">
            <Box flexDirection="row" gap={2}>
              <Text bold color={C.arc}>Performance</Text>
              <Text color={C.dim}>{tokPerSec} tok/s</Text>
              <Text color={C.warning}>${cost}</Text>
            </Box>
            <Box flexDirection="row" gap={1}>
              <Sparkline data={sparkData} width={Math.max(8, Math.floor(width / 4))} height={2} color={C.arc} />
              <Box flex={1}>
                <ProgressBar value={allDone ? 100 : Math.min(95, Math.round((t - 13000) / 60))} showPercent />
              </Box>
            </Box>
            <Box flexDirection="row" gap={2}>
              <Text color={allDone ? C.success : C.text}>{allDone ? "✓" : "⠋"} {allDone ? "42/42" : `${testsRun}/42`} tests</Text>
              <ModelBadge model="qwen-2.5-coder-32b" provider="community" />
            </Box>
          </Box>

          {/* Events */}
          <Box flex={1} flexDirection="column" paddingX={1} overflow="hidden">
            <Text bold color={C.arc}>Events</Text>
            {events.slice(-4).map((ev, i) => (
              <Text key={i} dim color={C.dim}>{ev}</Text>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ── Run ───────────────────────────────────────────────────────────

const app = render(<Showpiece />);
await app.waitUntilExit();
