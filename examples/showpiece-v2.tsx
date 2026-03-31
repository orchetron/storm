#!/usr/bin/env npx tsx
/**
 * Storm TUI — Showpiece v2 (Cinematic)
 *
 * ONE screen that evolves. Dramatic opening. Staggered reveals.
 * Dense peak with everything alive. Satisfying resolution.
 *
 * 0s:   Diamond splash — centered, rotating, nothing else. The hook.
 * 3s:   Transition — header appears, diamond moves to corner.
 * 4s:   User message appears alone. Breathing room.
 * 6s:   "Reasoning..." flickers, then response SLOWLY streams.
 * 9s:   Operations appear one by one. Spinners start.
 * 12s:  Right panel — divider draws first, then diff fills in.
 * 16s:  Bottom panel — divider first, then metrics fill in.
 * 20s:  PEAK — everything alive. Sparklines, spinners, counters, events.
 * 23s:  Resolution — everything completes. All green. Hold.
 * 26s:  End card builds piece by piece.
 * 30s:  Exit.
 *
 * Usage: npx tsx examples/showpiece-v2.tsx
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
  MessageBubble,
  OperationTree,
  BlinkDot,
  StreamingText,
  ModelBadge,
  useTerminal,
  useTui,
  useCleanup,
  useInput,
  ThemeProvider,
  colors,
  createTheme,
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

// Light theme for all framework components (OperationTree, DiffView, etc.)
const LIGHT_THEME = createTheme({
  brand: { primary: "#2563EB", light: "#3B82F6", glow: "#1D4ED8" },
  text: { primary: "#000000", secondary: "#484F58", dim: "#6E7781", disabled: "#8C959F" },
  surface: { base: "#FFFFFF", raised: "#F6F8FA", overlay: "#FFFFFF", highlight: "#EBF2FF" },
  divider: "#D1D9E0",
  success: "#1A7F37",
  warning: "#9A6700",
  error: "#CF222E",
  info: "#2563EB",
  tool: { pending: "#8C959F", running: "#2563EB", completed: "#1A7F37", failed: "#CF222E", cancelled: "#8C959F" },
  diff: { added: "#1A7F37", removed: "#CF222E", addedBg: "#DAFBE1", removedBg: "#FFEBE9" },
});

// ── Data ──────────────────────────────────────────────────────────

const AI_RESPONSE = "I found the bug. The token refresh timer in `src/auth.ts` doesn't account for clock skew between client and server — when the server clock is ahead by even a few seconds, the token appears valid locally but gets rejected server-side. I'll add a 30-second safety buffer to the expiry check and wrap the refresh call in retry logic with exponential backoff. This way, even if the first refresh attempt fails due to a network hiccup, the second or third attempt will succeed before the session drops.";

const DIFF = `--- a/src/auth.ts
+++ b/src/auth.ts
@@ -42,8 +42,16 @@
 async function refreshToken(token: AuthToken) {
-  if (Date.now() < token.expiresAt) {
-    return token;
+  const CLOCK_SKEW_BUFFER = 30_000;
+  const expiresAt = token.expiresAt - CLOCK_SKEW_BUFFER;
+
+  if (Date.now() < expiresAt) {
+    return token; // still valid with buffer
   }
-  const fresh = await authApi.refresh(token.refreshToken);
-  return fresh;
+
+  for (let attempt = 0; attempt < 3; attempt++) {
+    try {
+      const fresh = await authApi.refresh(token.refreshToken);
+      return { ...fresh, issuedAt: Date.now() };
+    } catch (err) {
+      if (attempt < 2) await sleep(1000 * (attempt + 1));
+    }
+  }
+
+  throw new AuthError("TOKEN_REFRESH_FAILED", {
+    lastAttempt: Date.now(),
+    tokenAge: Date.now() - token.issuedAt,
+  });
 }`;

// ── Diamond ───────────────────────────────────────────────────────

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

// ── Showpiece ─────────────────────────────────────────────────────

function Showpiece() {
  const { width, height } = useTerminal();
  const { exit, flushSync, requestRender } = useTui();
  const [, setTick] = useState(0);
  const startRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logoFrameRef = useRef(0);
  const logoTextRef = useRef<any>(null);

  // Master timer — 10fps
  if (!timerRef.current) {
    timerRef.current = setInterval(() => {
      flushSync(() => setTick(t => t + 1));
    }, 100);
  }

  // Logo rotation
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

  const lightRef = useRef(false);
  useInput((e) => {
    if ((e.key === "c" && e.ctrl) || e.key === "q") exit();
    if (e.key === "t") {
      lightRef.current = !lightRef.current;
      flushSync(() => setTick(tk => tk + 1));
    }
  });

  const t = Date.now() - startRef.current;
  const light = lightRef.current;
  const L = light
    ? { arc: "#2563EB", text: "#000000", dim: "#484F58", success: "#1A7F37", error: "#CF222E", warning: "#9A6700", bg: "#FFFFFF", gridDim: "#F0F1F3" }
    : { arc: C.arc, text: C.text, dim: C.dim, success: C.success, error: C.error, warning: C.warning, bg: "", gridDim: "#2A2F3A" };
  const activeTheme = light ? LIGHT_THEME : colors;

  // ── PHASE 0: Cell Matrix (0-4s) ─────────────────────────────
  // Bordered cells pop up randomly across the screen like a matrix.
  // Each cell: ┌──┐ │A1│ └──┘. Some highlight in blue with ◆◆.
  if (t < 4000) {
    const cw = 6;  // cell box width
    const ch = 3;  // cell box height
    const gapX = 1;
    const pitchX = cw + gapX;
    const pitchY = ch;
    const gridCols = Math.floor((width - 2) / pitchX);
    const gridRows = Math.floor((height - 1) / pitchY);
    const totalCells = gridCols * gridRows;
    const padX = Math.floor((width - gridCols * pitchX) / 2);
    const padY = Math.floor((height - gridRows * pitchY) / 2);

    // Deterministic random pop order
    const popOrder: Array<[number, number]> = [];
    const used = new Set<string>();
    let seed = 9173;
    for (let i = 0; i < totalCells && popOrder.length < totalCells; i++) {
      seed = (seed * 48271 + 11) & 0x7fffffff;
      const r = seed % gridRows;
      seed = (seed * 48271 + 11) & 0x7fffffff;
      const c = seed % gridCols;
      const k = `${r},${c}`;
      if (!used.has(k)) { used.add(k); popOrder.push([r, c]); }
    }
    // Fill any remaining
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const k = `${r},${c}`;
        if (!used.has(k)) { used.add(k); popOrder.push([r, c]); }
      }
    }

    // Cells visible — ease in then out, cap at ~50 cells
    const progress = Math.min(1, t / 3000);
    const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    const maxCells = Math.min(totalCells, Math.max(40, Math.floor(totalCells * 0.4)));
    const visibleCount = Math.floor(eased * maxCells);

    const visible = new Set<string>();
    for (let i = 0; i < visibleCount && i < popOrder.length; i++) {
      visible.add(`${popOrder[i]![0]},${popOrder[i]![1]}`);
    }

    // Highlighted cells (pop up late, shown with ◆◆ and brighter)
    const hlIndices = [8, 22, 38];
    const hlSet = new Set<string>();
    for (const idx of hlIndices) {
      if (idx < popOrder.length && t > 1500 + idx * 30) {
        hlSet.add(`${popOrder[idx]![0]},${popOrder[idx]![1]}`);
      }
    }

    // Track when each cell appeared (for brightness ripple)
    const popTime = new Map<string, number>();
    for (let i = 0; i < visibleCount && i < popOrder.length; i++) {
      const k = `${popOrder[i]![0]},${popOrder[i]![1]}`;
      // Approximate time this cell popped
      const cellProgress = i / maxCells;
      // Invert easing to get approximate time
      const cellTime = cellProgress < 0.5
        ? Math.sqrt(cellProgress / 2) * 3000
        : (1 - Math.sqrt((1 - cellProgress) * 2)) * 3000 + 1500;
      popTime.set(k, cellTime);
    }

    // Build screen buffer — two layers: dim (grid/dots) and bright (cells/highlights)
    // We'll use two string arrays per row — dim chars and bright chars
    // Then render as two overlapping tui-text elements per row
    const scrDim: string[][] = [];
    const scrBright: string[][] = [];
    for (let y = 0; y < height; y++) {
      scrDim.push(new Array(width).fill(" "));
      scrBright.push(new Array(width).fill(" "));
    }

    // Layer 1: Background grid with dots at intersections
    if (t > 150) {
      for (let gr = 0; gr <= gridRows; gr++) {
        for (let gc = 0; gc <= gridCols; gc++) {
          // Dot at each grid intersection (top-left corner of each cell)
          const dx = padX + gc * pitchX;
          const dy = padY + gr * pitchY;
          if (dy < height && dx < width) scrDim[dy]![dx] = "·";
        }
      }
    }

    // Draw visible cells
    for (const key of visible) {
      const [gr, gc] = key.split(",").map(Number) as [number, number];
      const x0 = padX + gc * pitchX;
      const y0 = padY + gr * pitchY;
      const hl = hlSet.has(key);

      if (y0 >= height || x0 + cw > width) continue;

      // Is this cell "fresh"? (appeared within last 300ms)
      const age = t - (popTime.get(key) ?? 0);
      const isFresh = age < 300;
      const target = (hl || isFresh) ? scrBright : scrDim;

      // Top: ┌────┐
      target[y0]![x0] = "┌";
      for (let i = 1; i < cw - 1; i++) target[y0]![x0 + i] = "─";
      target[y0]![x0 + cw - 1] = "┐";

      // Middle: │ A1 │
      if (y0 + 1 < height) {
        target[y0 + 1]![x0] = "│";
        target[y0 + 1]![x0 + cw - 1] = "│";
        for (let i = 1; i < cw - 1; i++) target[y0 + 1]![x0 + i] = " ";
        const label = hl ? "◆◆" : `${String.fromCharCode(65 + (gr % 26))}${gc}`;
        const start = x0 + 1 + Math.floor((cw - 2 - label.length) / 2);
        for (let i = 0; i < label.length && start + i < width; i++) {
          target[y0 + 1]![start + i] = label[i]!;
        }
      }

      // Bottom: └────┘
      if (y0 + 2 < height) {
        target[y0 + 2]![x0] = "└";
        for (let i = 1; i < cw - 1; i++) target[y0 + 2]![x0 + i] = "─";
        target[y0 + 2]![x0 + cw - 1] = "┘";
      }

      // Clear the dot at this position (cell replaces it)
      scrDim[y0]![x0] = " ";
    }

    // Fill a few cells solid (like active/selected cells in the grid)
    const fillIndices = [5, 14, 27, 33, 45];
    for (const idx of fillIndices) {
      if (idx < popOrder.length && visible.has(`${popOrder[idx]![0]},${popOrder[idx]![1]}`)) {
        const [fr, fc] = popOrder[idx]!;
        const fx = padX + fc * pitchX;
        const fy = padY + fr * pitchY;
        if (fy + 1 < height && fx + cw <= width) {
          // Fill the inside of the cell
          for (let i = 1; i < cw - 1; i++) scrBright[fy + 1]![fx + i] = "█";
        }
      }
    }

    // Boot sequence text at bottom — appears after cells are mostly placed
    if (t > 2200) {
      const bootLines = [
        { text: "◆ initializing renderer", time: 2200 },
        { text: "◆ loading 92 components", time: 2500 },
        { text: "◆ mounting agent interface", time: 2800 },
        { text: "◆ storm ready", time: 3100 },
      ];
      const bootY = height - bootLines.length - 1;
      for (let i = 0; i < bootLines.length; i++) {
        const bl = bootLines[i]!;
        if (t > bl.time && bootY + i < height) {
          const bx = 2;
          for (let j = 0; j < bl.text.length && bx + j < width; j++) {
            scrBright[bootY + i]![bx + j] = bl.text[j]!;
          }
        }
      }
    }

    // Transition
    if (t > 3500) {
      return <Box flexDirection="column" width={width} height={height} {...(L.bg ? { backgroundColor: L.bg } : {})} />;
    }

    // Render: dim layer (grid/old cells) + bright layer (fresh cells/highlights)
    const rowEls: React.ReactElement[] = [];
    for (let y = 0; y < height; y++) {
      const dimLine = scrDim[y]!.join("");
      const brightLine = scrBright[y]!.join("");
      const hasBright = brightLine.trim().length > 0;

      if (hasBright) {
        // Render bright line (blue, for highlights/fresh/filled/boot)
        rowEls.push(
          React.createElement("tui-text", { key: `${y}b`, color: L.arc }, brightLine),
        );
      } else {
        // Render dim line — very subtle grid and settled cells
        rowEls.push(
          React.createElement("tui-text", { key: y, color: L.gridDim, dim: true }, dimLine),
        );
      }
    }

    return (
      <Box flexDirection="column" width={width} height={height} {...(L.bg ? { backgroundColor: L.bg } : {})}>
        {rowEls}
      </Box>
    );
  }

  // ── END CARD (26-30s) ───────────────────────────────────────
  if (t >= 26000) {
    const ct = t - 26000;
    return (
      <Box flexDirection="column" width={width} height={height} justifyContent="center" alignItems="center" {...(L.bg ? { backgroundColor: L.bg } : {})}>
        {React.createElement("tui-text", { color: L.arc, bold: true, _textNodeRef: logoTextRef }, DIAMOND[0])}
        {ct > 500 && <Box height={1} />}
        {ct > 500 && <Text bold color={L.text}>storm</Text>}
        {ct > 1200 && <Box height={1} />}
        {ct > 1000 && <Text color={L.dim}>The high-performance rendering engine for terminal user interfaces.</Text>}
        {ct > 2000 && <Box height={1} />}
        {ct > 2000 && <Text bold color={L.arc}>Fast. Layered. Unstoppable.</Text>}
      </Box>
    );
  }

  if (t >= 30000) { exit(); return <Box />; }

  // ── MAIN EVOLVING SCREEN (3-26s) ────────────────────────────

  // Operations — staggered appearance and completion
  const ops: OpNode[] = [];
  if (t > 10000)  ops.push({ id: "1", label: "Reading src/auth.ts", status: t > 12000 ? "completed" : "running", ...(t > 12000 ? { durationMs: 340 } : {}) });
  if (t > 12000) ops.push({ id: "2", label: "Analyzing token logic", status: t > 15000 ? "completed" : "running", ...(t > 15000 ? { durationMs: 1200 } : {}) });
  if (t > 15000) ops.push({ id: "3", label: "Patching refreshToken()", status: t > 18000 ? "completed" : "running", ...(t > 18000 ? { durationMs: 2100 } : {}) });
  if (t > 18000) ops.push({ id: "4", label: "Running 42 tests", status: t > 23000 ? "completed" : "running", ...(t > 23000 ? { durationMs: 4200 } : {}) });

  // Panel reveals
  const showDiff = t > 13000;
  const showDiffContent = t > 13500;
  const showMetrics = t > 17000;
  const showMetricsContent = t > 17500;
  const allDone = t > 23000;

  // Live metrics
  const tokens = showMetricsContent ? Math.round((t - 17500) * 1.8) : 0;
  const tokPerSec = 28 + Math.round(Math.sin(t / 400) * 18);
  const testsTotal = 42;
  const testsRun = showMetricsContent ? Math.min(testsTotal, Math.floor((t - 17500) / 120)) : 0;
  const cost = (tokens * 0.000003).toFixed(4);
  const progress = allDone ? 100 : (showMetricsContent ? Math.min(96, Math.round((t - 17500) / 60)) : 0);

  // Growing sparkline
  const sparkData: number[] = [];
  if (showMetricsContent) {
    const len = Math.min(24, Math.floor((t - 17500) / 220) + 2);
    for (let i = 0; i < len; i++) {
      sparkData.push(20 + Math.round(Math.sin((t / 350) + i * 0.6) * 20 + Math.random() * 6));
    }
  }

  // Live events
  const events: string[] = [];
  if (t > 12000) events.push("✓ src/auth.ts read (340ms)");
  if (t > 15000) events.push("✓ Token logic analyzed");
  if (t > 18000) events.push("✓ refreshToken() patched");
  if (t > 19000) events.push("⠋ Test suite started");
  if (t > 21000) events.push(`⠋ ${Math.min(testsTotal, testsRun)} / ${testsTotal} tests passed`);
  if (t > 23000) events.push("✓ All 42 tests passed");
  if (t > 23500) events.push("✓ Pipeline complete");
  if (t > 24000) events.push(`✓ ${tokens.toLocaleString()} tokens · $${cost}`);

  // Layout
  const mainW = showDiff ? Math.floor((width - 1) / 2) : width;
  const rightW = showDiff ? width - mainW - 1 : 0;
  const btmH = showMetrics ? Math.min(8, Math.max(6, Math.floor(height * 0.25))) : 0;

  return (
    <ThemeProvider theme={activeTheme}>
    <Box flexDirection="column" width={width} height={height} {...(L.bg ? { backgroundColor: L.bg } : {})}>
      {/* ── HEADER ── */}
      <Box height={1} paddingLeft={1} overflow="hidden" flexDirection="row">
        <Box width={4}><Spinner type="storm-logo" color={L.arc} interval={120} /></Box>
        <Text bold color={L.arc}>storm</Text>
        <Text color={L.dim}> · qwen-2.5-coder-32b</Text>
        <Box flex={1} />
        {t > 10000 && <BlinkDot state={allDone ? "completed" : "running"} />}
        {t > 10000 && <Text color={allDone ? L.success : L.arc}>{allDone ? " done" : " working"}</Text>}
      </Box>
      <Box height={1} overflow="hidden">
        <Text color={L.dim}>{"─".repeat(Math.max(0, width - 2))}</Text>
      </Box>

      {/* ── MAIN CONTENT ── */}
      <Box flex={1} flexDirection="row" overflow="hidden">
        {/* LEFT — Chat + Operations */}
        <Box flexDirection="column" width={mainW} overflow="hidden">
          <ScrollView flex={1} stickToBottom>
            <Box flexDirection="column" paddingLeft={1} paddingRight={3} paddingY={1} gap={1}>

              {/* User message — 5s */}
              {t > 5000 && (
                <Box flexDirection="row" paddingX={1}>
                  <Text bold color={L.dim}>› </Text>
                  <Text bold color={L.text}>Fix the token refresh bug in auth.ts — tokens expire during long sessions</Text>
                </Box>
              )}

              {/* Thinking — 6.5s, visible for 1.5 seconds */}
              {t > 6500 && t < 8000 && (
                <Box flexDirection="row" paddingX={1}>
                  <Text dim color={L.dim}>⟡ </Text>
                  <Text dim color={L.dim}>Reasoning...</Text>
                </Box>
              )}

              {/* AI response — 8s, streams */}
              {t > 8000 && (
                <Box flexDirection="row" paddingX={1}>
                  <Text bold color={L.arc}>◆ </Text>
                  <Box flex={1}>
                    <StreamingText
                      text={AI_RESPONSE}
                      streaming={!allDone}
                      animate
                      speed={6}
                      color={L.text}
                    />
                  </Box>
                </Box>
              )}

              {/* Operations — 9s, one by one */}
              {ops.length > 0 && <OperationTree nodes={ops} showDuration />}
            </Box>
          </ScrollView>
        </Box>

        {/* RIGHT — Diff panel, slides in at 12s */}
        {showDiff && (
          <Box flexDirection="column" width={rightW} borderStyle="single" borderColor={L.dim} overflow="hidden">
            {showDiffContent ? (
              <>
                <Box paddingX={1}>
                  <Text bold color={L.arc}>Changes</Text>
                  <Text color={L.dim}>{" · src/auth.ts"}</Text>
                </Box>
                <ScrollView flex={1}>
                  <Box paddingX={1}>
                    <DiffView diff={DIFF} showLineNumbers={false} />
                  </Box>
                </ScrollView>
              </>
            ) : (
              <Box flex={1} justifyContent="center" alignItems="center">
                <Spinner type="dots" color={L.dim} />
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* ── BOTTOM — Metrics panel, slides in at 16s ── */}
      {showMetrics && (
        <Box height={btmH} borderStyle="single" borderColor={L.dim} overflow="hidden">
          {showMetricsContent ? (
            <Box flexDirection="row" flex={1}>
              {/* Left: Performance */}
              <Box flex={1} flexDirection="column" paddingX={1} overflow="hidden">
                <Box flexDirection="row" gap={2}>
                  <Text bold color={L.arc}>Performance</Text>
                  <Text bold color={L.text}>{tokPerSec}</Text>
                  <Text color={L.dim}>tok/s</Text>
                  <Text color={L.warning}>${cost}</Text>
                </Box>
                <Sparkline data={sparkData} width={Math.max(8, Math.floor(width / 3))} height={2} color={L.arc} />
                <Box flexDirection="row" gap={1}>
                  <ProgressBar value={progress} showPercent />
                </Box>
              </Box>

              {/* Center: Status */}
              <Box flex={1} flexDirection="column" paddingX={1} overflow="hidden">
                <Text bold color={L.arc}>Status</Text>
                <Box flexDirection="row" gap={1}>
                  <BlinkDot state={allDone ? "completed" : "running"} />
                  <Text color={allDone ? L.success : L.text}>
                    {allDone ? `✓ ${testsTotal}/${testsTotal} passed` : `${testsRun}/${testsTotal} running`}
                  </Text>
                </Box>
                <ModelBadge model="qwen-2.5-coder-32b" provider="community" />
              </Box>

              {/* Right: Events */}
              <Box flex={1} flexDirection="column" paddingX={1} overflow="hidden">
                <Text bold color={L.arc}>Events</Text>
                {events.slice(-4).map((ev, i) => (
                  <Text key={i} color={L.dim}>{ev}</Text>
                ))}
              </Box>
            </Box>
          ) : (
            <Box flex={1} justifyContent="center" alignItems="center">
              <Spinner type="dots" color={L.dim} />
            </Box>
          )}
        </Box>
      )}
    </Box>
    </ThemeProvider>
  );
}

// ── Run ───────────────────────────────────────────────────────────

const app = render(<Showpiece />);
await app.waitUntilExit();
