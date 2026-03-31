#!/usr/bin/env npx tsx
/**
 * Storm TUI — Launch Demo
 *
 * Clean. Sparse. Cinematic. Visual peaks. 17+ Storm components.
 * Auto-plays ~42s. Press 't' to toggle dark/light mode.
 *
 * Run: npx tsx examples/demo-launch.tsx
 * q or Ctrl+C to exit.
 */

import React, { useState, useRef, useCallback } from "react";
import {
  render,
  Box,
  Text,
  ScrollView,
  Spinner,
  Badge,
  DiffView,
  Gradient,
  LineChart,
  Separator,
  GradientProgress,
  Sparkline,
  useInput,
  useTerminal,
  useTui,
  useCleanup,
  OperationTree,
  StreamingText,
  SyntaxHighlight,
  MessageBubble,
  ContextWindow,
  CostTracker,
  AnimatedLogo,
} from "../src/index.js";

import type { OpNode } from "../src/index.js";
import { ThemeProvider } from "../src/theme/provider.js";
import type { StormColors } from "../src/theme/colors.js";

// ── Color themes ────────────────────────────────────────────────────

interface Theme {
  teal: string;
  glow: string;
  green: string;
  dim: string;
  text: string;
  white: string;
  amber: string;
  red: string;
}

const DARK: Theme = {
  teal:  "#82AAFF",
  glow:  "#6DFFC1",
  green: "#9ECE6A",
  dim:   "#565F89",
  text:  "#C0CAF5",
  white: "#E0E0E0",
  amber: "#E0AF68",
  red:   "#F7768E",
};

const LIGHT: Theme = {
  teal:  "#1D4ED8",
  glow:  "#047857",
  green: "#15803D",
  dim:   "#4B5563",
  text:  "#111827",
  white: "#030712",
  amber: "#B45309",
  red:   "#B91C1C",
};

// Full StormColors for light mode — controls ALL widget internals
const LIGHT_STORM: StormColors = {
  brand:   { primary: "#1D4ED8", light: "#3B82F6", glow: "#047857" },
  text:    { primary: "#111827", secondary: "#374151", dim: "#6B7280", disabled: "#9CA3AF" },
  surface: { base: "#E2E8F0", raised: "#CBD5E1", overlay: "#F1F5F9", highlight: "#DBEAFE" },
  divider: "#94A3B8",
  success: "#15803D",
  warning: "#B45309",
  error:   "#B91C1C",
  info:    "#1D4ED8",
  system:    { text: "#6B7280" },
  user:      { symbol: "#1D4ED8" },
  assistant: { symbol: "#15803D" },
  thinking:  { symbol: "#B45309", shimmer: "#1D4ED8" },
  tool:      { pending: "#6B7280", running: "#1D4ED8", completed: "#15803D", failed: "#B91C1C", cancelled: "#9CA3AF" },
  approval:  { border: "#94A3B8", header: "#111827", approve: "#15803D", deny: "#B91C1C", always: "#B45309" },
  input:     { border: "#94A3B8", borderActive: "#1D4ED8", prompt: "#1D4ED8" },
  diff:      { added: "#15803D", removed: "#B91C1C", addedBg: "#DCFCE7", removedBg: "#FEE2E2" },
  syntax:    { keyword: "#1D4ED8", string: "#15803D", number: "#B45309", comment: "#6B7280", type: "#7C3AED", operator: "#B91C1C", function: "#111827" },
};

// ── Phases ──────────────────────────────────────────────────────────

type Phase =
  | "splash"
  | "boot"
  | "init1" | "init2"
  | "ready"
  | "pulling"
  | "anomaly"
  | "scanning"
  | "analyzing"
  | "findings"
  | "streaming"
  | "code"
  | "diff"
  | "applied"
  | "tests"
  | "deploying"
  | "postmetrics"
  | "chart"
  | "done";

// Pacing: FAST boot, PAUSE at anomaly (let chart sink in), MEDIUM agent work,
// PAUSE at code/diff, FAST deploy, SLOW recovery (chart payoff).
const TIMELINE: Array<{ at: number; phase: Phase }> = [
  { at: 0,     phase: "splash" },
  { at: 2800,  phase: "boot" },
  { at: 3400,  phase: "init1" },      // FAST boot
  { at: 3900,  phase: "init2" },      // FAST boot
  { at: 4800,  phase: "ready" },
  { at: 6000,  phase: "pulling" },
  { at: 8500,  phase: "anomaly" },    // PAUSE — chart + sparklines appear
  { at: 13000, phase: "scanning" },   // 4.5s pause to absorb visuals
  { at: 15000, phase: "analyzing" },  // MEDIUM
  { at: 17500, phase: "findings" },
  { at: 19500, phase: "streaming" },
  { at: 25000, phase: "code" },       // PAUSE — let code be read
  { at: 27500, phase: "diff" },       // PAUSE — let diff be read
  { at: 30000, phase: "applied" },
  { at: 31000, phase: "tests" },      // FAST
  { at: 33000, phase: "deploying" },  // FAST
  { at: 34500, phase: "postmetrics" },
  { at: 36000, phase: "chart" },      // SLOW recovery payoff
  { at: 42500, phase: "done" },
];

function phaseAt(ms: number): Phase {
  let p: Phase = "splash";
  for (const t of TIMELINE) {
    if (ms >= t.at) p = t.phase;
  }
  return p;
}

function past(current: Phase, target: Phase): boolean {
  const phases = TIMELINE.map((t) => t.phase);
  return phases.indexOf(current) >= phases.indexOf(target);
}

// ── Content ─────────────────────────────────────────────────────────

const RESPONSE_TEXT =
  "Anomaly confirmed. Root cause identified across 3 files in the auth module. Primary issue: session.ts leaks ~2.1KB per navigation \u2014 store.subscribe() return value discarded, subscriptions accumulate indefinitely. Secondary: rateLimit.ts trusts X-Forwarded-For header directly (spoofable). Third: tokenRefresh.ts has no error path for network timeout. Generating surgical 3-file patch and deploying automatically.";

const CODE_FIX = `// session.ts \u2014 fix: capture unsubscribe handle
useEffect(() => {
  const unsub = store.subscribe(key, cb);
  return () => unsub();
}, [key]);

// reconnect invalidation
useEffect(() => {
  const cleanup = store.onReconnect(() =>
    store.invalidate(key)
  );
  return () => cleanup();
}, [key, store]);`;

const DIFF_CONTENT = `diff --git a/src/auth/session.ts b/src/auth/session.ts
--- a/src/auth/session.ts
+++ b/src/auth/session.ts
@@ -14,7 +14,12 @@
 export function useSession(key, store) {
   useEffect(() => {
-    store.subscribe(key, cb);
+    const unsub = store.subscribe(key, cb);
+    return () => unsub();
   }, [key]);
+  useEffect(() => {
+    const cleanup = store.onReconnect(() =>
+      store.invalidate(key));
+    return () => cleanup();
+  }, [key, store]);
 }`;

// ── Operations ──────────────────────────────────────────────────────

function opsFor(phase: Phase): OpNode[] {
  if (phase === "pulling") return [
    { id: "1", label: "Pulling production metrics", status: "running" },
  ];
  if (phase === "anomaly") return [
    { id: "1", label: "Pulling production metrics", status: "completed", durationMs: 2400 },
    { id: "2", label: "Analyzing telemetry data", status: "running" },
  ];
  if (phase === "scanning") return [
    { id: "1", label: "Pulling production metrics", status: "completed", durationMs: 2400 },
    { id: "2", label: "Analyzing telemetry data", status: "completed", durationMs: 1800 },
    { id: "3", label: "Scanning codebase (847 files)", status: "running" },
  ];
  if (phase === "analyzing") return [
    { id: "2", label: "Analyzing telemetry data", status: "completed", durationMs: 1800 },
    { id: "3", label: "Scanning codebase (847 files)", status: "completed", durationMs: 1240 },
    { id: "4", label: "Static analysis", status: "completed", durationMs: 2100 },
    { id: "5", label: "Analyzing auth module", status: "running" },
  ];
  if (past(phase, "findings") && !past(phase, "applied")) return [
    { id: "3", label: "Scanning codebase", status: "completed", durationMs: 1240 },
    { id: "4", label: "Static analysis", status: "completed", durationMs: 2100 },
    { id: "5", label: "Analyzing auth module", status: "completed", durationMs: 3400 },
    { id: "6", label: "Generating patch", status: past(phase, "code") ? "completed" as const : "running" as const, ...(past(phase, "code") ? { durationMs: 1200 } : {}) },
  ];
  if (phase === "applied" || phase === "tests") return [
    { id: "7", label: "Writing session.ts", status: "completed", durationMs: 120 },
    { id: "8", label: "Writing rateLimit.ts", status: "completed", durationMs: 180 },
    { id: "9", label: "Writing tokenRefresh.ts", status: "completed", durationMs: 150 },
  ];
  if (phase === "deploying") return [
    { id: "9", label: "Writing tokenRefresh.ts", status: "completed", durationMs: 150 },
    { id: "10", label: "Running test suite (30 tests)", status: "completed", durationMs: 2700 },
    { id: "11", label: "Deploying to production", status: "running" },
  ];
  if (phase === "postmetrics") return [
    { id: "10", label: "Running test suite (30 tests)", status: "completed", durationMs: 2700 },
    { id: "11", label: "Deploying to production", status: "completed", durationMs: 1800 },
    { id: "12", label: "Pulling post-deploy metrics", status: "running" },
  ];
  if (past(phase, "chart")) return [
    { id: "11", label: "Deploying to production", status: "completed", durationMs: 1800 },
    { id: "12", label: "Pulling post-deploy metrics", status: "completed", durationMs: 3200 },
  ];
  return [];
}

// ── System health data (for LineChart) — matches healthPct ──────────

/** Generate system health data (0-100%) that evolves with elapsed time.
 *  Before "applied": health drops. After "applied": health recovers. */
function generateHealthData(elapsed: number, maxPoints: number): number[] {
  const anomalyStart = TIMELINE.find((t) => t.phase === "anomaly")!.at;
  const appliedAt = TIMELINE.find((t) => t.phase === "applied")!.at;

  const points: number[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const t = i / Math.max(maxPoints, 1);
    const pointTime = anomalyStart + (elapsed - anomalyStart) * t;

    let val: number;
    if (pointTime < anomalyStart) {
      val = 97 + Math.sin(i * 0.3) * 1;
    } else if (pointTime < appliedAt) {
      // Degrading — health drops from 97% toward 42%
      const drop = (pointTime - anomalyStart) / (appliedAt - anomalyStart);
      val = 97 - drop * 55 + Math.sin(i * 0.4) * 2;
    } else {
      // Recovery — health climbs back toward 98%
      const recoveryDuration = elapsed - appliedAt;
      const pointRecovery = (pointTime - appliedAt) / Math.max(recoveryDuration, 1);
      const trough = 42;
      const target = 98;
      val = trough + (target - trough) * (1 - Math.exp(-pointRecovery * 3)) + Math.sin(i * 0.5) * 1;
    }
    points.push(Math.max(0, Math.min(100, val)));
  }
  return points;
}

// ── App ─────────────────────────────────────────────────────────────

function App({ isDarkProp, toggleTheme }: { isDarkProp: boolean; toggleTheme: () => void }): React.ReactElement {
  const { width, height } = useTerminal();
  const { flushSync, requestRender, exit } = useTui();

  // Refs for data that doesn't drive widget props (imperative pattern)
  const elapsedRef = useRef(0);
  const inputTokensRef = useRef(0);
  const outputTokensRef = useRef(0);

  // Refs for live metrics bar — imperative mutation + requestRender()
  const cpuRef = useRef(45);
  const cpuHistoryRef = useRef([42, 44, 45, 43, 46, 44, 45, 43]);
  const errPctRef = useRef(0.3);
  const errHistoryRef = useRef([0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3]);
  const memPctRef = useRef(62);
  const rpsRef = useRef(1.2);

  // State for values that ARE passed as widget props (React needs to re-render)
  const [phase, setPhase] = useState<Phase>("splash");
  const [errorData, setErrorData] = useState<number[]>([]);
  const [chartPoints, setChartPoints] = useState(0);

  const isDark = isDarkProp;
  const C: Theme = isDark ? DARK : LIGHT;

  useInput(useCallback((e) => {
    if ((e.ctrl && e.key === "c") || e.char === "q") exit();
    if (e.char === "t") toggleTheme();
  }, [exit, toggleTheme]));

  // ── Phase transitions via setTimeout chains (demo-storm pattern) ────
  // NO polling. NO useInterval. Each setTimeout fires ONCE.
  // Only streaming and chart get short-lived intervals.
  const cleanupRef = useRef<(() => void) | null>(null);

  const startedRef = useRef(false);
  if (!startedRef.current) {
    startedRef.current = true;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];

    // Schedule each phase transition as a single setTimeout
    for (const entry of TIMELINE) {
      if (entry.phase === "splash") continue; // already in splash
      const t = setTimeout(() => {
        // Update token refs silently
        if (entry.phase === "pulling") inputTokensRef.current = 1200;
        if (entry.phase === "anomaly") inputTokensRef.current = 4000;
        if (entry.phase === "streaming") inputTokensRef.current = 8000;
        if (entry.phase === "code") { inputTokensRef.current = 12000; outputTokensRef.current = 2400; }
        if (entry.phase === "applied") { inputTokensRef.current = 12000; outputTokensRef.current = 2400; }

        flushSync(() => {
          setPhase(entry.phase);
        });
      }, entry.at);
      timeouts.push(t);
    }

    // ── Live error chart: starts at anomaly, updates every 500ms ──
    const anomalyAt = TIMELINE.find((t) => t.phase === "anomaly")!.at;
    const doneAt = TIMELINE.find((t) => t.phase === "done")!.at;
    const chartStartTimer = setTimeout(() => {
      let pts = 5; // start with a few points
      const iv = setInterval(() => {
        pts = Math.min(pts + 1, 50);
        const now = Date.now();
        // Approximate elapsed since demo start
        const approxElapsed = anomalyAt + (pts - 5) * 500;
        const data = generateHealthData(approxElapsed, pts);
        flushSync(() => {
          setErrorData(data);
          setChartPoints(pts);
        });
      }, 500);
      intervals.push(iv);
      // Stop chart updates after done
      const stopTimer = setTimeout(() => clearInterval(iv), doneAt - anomalyAt + 2000);
      timeouts.push(stopTimer);
    }, anomalyAt);
    timeouts.push(chartStartTimer);

    // ── Live metrics bar: dedicated setInterval, imperative only ──
    const metricsIv = setInterval(() => {
      // CPU jitter
      cpuRef.current = Math.max(20, Math.min(85, cpuRef.current + (Math.random() - 0.5) * 8));
      const hist = cpuHistoryRef.current;
      hist.push(cpuRef.current);
      if (hist.length > 8) hist.shift();

      // MEM — rises during incident, falls after fix
      // (read phase from DOM to avoid coupling)
      if (memPctRef.current < 94 && errPctRef.current > 2) {
        memPctRef.current = Math.min(96, memPctRef.current + Math.random() * 2);
      } else if (errPctRef.current < 1) {
        memPctRef.current = Math.max(55, memPctRef.current - Math.random() * 3);
      }

      // ERR — follows the incident arc
      if (errPctRef.current < 4.3 && memPctRef.current > 80) {
        errPctRef.current = Math.min(4.5, errPctRef.current + Math.random() * 0.3);
      }
      const errHist = errHistoryRef.current;
      errHist.push(errPctRef.current);
      if (errHist.length > 8) errHist.shift();

      // RPS jitter
      rpsRef.current = Math.max(0.8, Math.min(2.0, rpsRef.current + (Math.random() - 0.5) * 0.2));

      requestRender();
    }, 400);
    intervals.push(metricsIv);

    // Trigger ERR recovery after "applied" phase
    const appliedAt = TIMELINE.find((t) => t.phase === "applied")!.at;
    const recoveryTimer = setTimeout(() => {
      // Start dropping error rate
      const recIv = setInterval(() => {
        errPctRef.current = Math.max(0.3, errPctRef.current * 0.88);
        if (errPctRef.current <= 0.35) {
          errPctRef.current = 0.3;
          clearInterval(recIv);
        }
      }, 400);
      intervals.push(recIv);
    }, appliedAt);
    timeouts.push(recoveryTimer);

    cleanupRef.current = () => {
      for (const t of timeouts) clearTimeout(t);
      for (const iv of intervals) clearInterval(iv);
    };
  }

  useCleanup(() => {
    cleanupRef.current?.();
  });

  const padL = 3;
  const inputTokens = inputTokensRef.current;
  const outputTokens = outputTokensRef.current;
  const ops = opsFor(phase);
  const totalCost = ((inputTokens / 1_000_000) * 15) + ((outputTokens / 1_000_000) * 75);
  const chartW = Math.min(65, width - 10);

  // Health changes only at phase transitions — no continuous polling
  const healthPct =
    phase === "done" ? 98 :
    past(phase, "chart") ? 94 :
    past(phase, "postmetrics") ? 78 :
    past(phase, "deploying") ? 72 :
    past(phase, "applied") ? 65 :
    past(phase, "findings") ? 42 :
    past(phase, "anomaly") ? 48 :
    past(phase, "pulling") ? 62 :
    97;
  const healthColor = healthPct > 80 ? C.green : healthPct > 50 ? C.amber : C.red;
  const healthW = Math.min(40, width - 12);

  // Read live metrics refs (these update via requestRender, not setState)
  const cpuVal = Math.round(cpuRef.current);
  const memVal = Math.round(memPctRef.current);
  const errVal = errPctRef.current;
  const rpsVal = rpsRef.current;
  const cpuHist = cpuHistoryRef.current;
  const errHist = errHistoryRef.current;

  // MEM bar — filled blocks
  const memBarW = 10;
  const memFilled = Math.round((memVal / 100) * memBarW);
  const memEmpty = memBarW - memFilled;
  const memBarStr = "\u2588".repeat(memFilled) + "\u2591".repeat(memEmpty);
  const memColor = memVal > 85 ? C.red : memVal > 70 ? C.amber : C.green;

  // ── Splash — 3D rotating diamond logo (AnimatedLogo widget) ────
  if (phase === "splash") {
    return (
      <Box flexDirection="column" width={width} height={height} >
        <Box flex={1} flexDirection="column" justifyContent="center" alignItems="center">
          <Box width={7} height={5}>
            <AnimatedLogo animate color={C.teal} />
          </Box>
          <Box marginTop={1}>
            <Gradient colors={[C.teal, C.glow, C.teal]}>{"S  T  O  R  M"}</Gradient>
          </Box>
          <Box marginTop={1}>
            <Gradient colors={[C.dim, C.teal, C.dim]}>{"92 components \u00B7 19 AI widgets \u00B7 cell-diff rendering"}</Gradient>
          </Box>
          <Box marginTop={2}>
            <Text color={C.dim}>{"t: "}{isDark ? "light" : "dark"}{" mode  \u00B7  q: quit"}</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={width} height={height} >

      {/* ── Live metrics bar — constant visual motion ── */}
      <Box height={1} flexShrink={0} flexDirection="row" paddingLeft={padL} paddingRight={padL} >
        <Text color={C.dim}>{"CPU "}</Text>
        <Text color={cpuVal > 70 ? C.amber : C.teal} bold>{String(cpuVal).padStart(2)}{"% "}</Text>
        <Sparkline data={cpuHist} width={8} height={1} color={cpuVal > 70 ? C.amber : C.teal} />
        <Text color={C.dim}>{" \u2502 "}</Text>
        <Text color={C.dim}>{"MEM "}</Text>
        <Text color={memColor} bold>{String(memVal).padStart(2)}{"% "}</Text>
        <Text color={memColor}>{memBarStr}</Text>
        <Text color={C.dim}>{" \u2502 "}</Text>
        <Text color={C.dim}>{"ERR "}</Text>
        <Text color={errVal > 2 ? C.red : C.green} bold>{errVal.toFixed(1)}{"% "}</Text>
        <Sparkline data={errHist} width={8} height={1} color={errVal > 2 ? C.red : C.green} />
        <Text color={C.dim}>{" \u2502 "}</Text>
        <Text color={C.dim}>{"RPS "}</Text>
        <Text color={C.teal} bold>{rpsVal.toFixed(1)}{"K"}</Text>
      </Box>

      {/* ── Conversation scroll area ── */}
      <ScrollView height={height - 2} stickToBottom >
        <Box flexDirection="column" paddingLeft={padL} paddingRight={padL} paddingTop={1}>

          {/* Title bar */}
          <Box height={1} flexDirection="row">
            <Gradient colors={[C.teal, C.glow]}>{"\u26A1 STORM"}</Gradient>
            <Box flex={1} />
            <Text color={C.dim}>{"AGENT_SESSION \u00B7 "}{isDark ? "dark" : "light"}</Text>
          </Box>

          <Box height={1} />

          {/* Prompt */}
          <Box height={1} flexDirection="row">
            <Text color={C.dim}>{"user@storm:~$ "}</Text>
            <Text color={C.teal} bold>{"storm agent --model orc-1 --verbose"}</Text>
          </Box>

          <Box height={1} />

          {/* Init lines — FAST */}
          {past(phase, "init1") ? (
            <Box height={1} flexDirection="row" paddingLeft={padL}>
              <Text color={C.dim}>{"[00:00:03]   "}</Text>
              <Text color={C.white} bold>{"92 COMPONENTS \u00B7 19 WIDGETS \u00B7 74 HOOKS"}</Text>
              <Text>{"   "}</Text>
              <Badge label="LOADED" variant="info" />
            </Box>
          ) : null}
          {past(phase, "init2") ? (
            <Box height={1} flexDirection="row" paddingLeft={padL}>
              <Text color={C.dim}>{"[00:00:04]   "}</Text>
              <Text color={C.white} bold>{"CELL-DIFF RENDERER"}</Text>
              <Text>{"   "}</Text>
              <Spinner type="dots" color={C.green} />
              <Text>{" "}</Text>
              <Badge label="ACTIVE" variant="success" />
            </Box>
          ) : null}

          {past(phase, "init2") ? <Box height={1} /> : null}

          {/* Health bar — plain text block chars */}
          {past(phase, "ready") ? (
            <Box paddingLeft={padL} flexDirection="column">
              <Box height={1} flexDirection="row">
                <Text color={C.dim} bold>{"SYSTEM HEALTH   "}</Text>
                <Text color={healthColor} bold>{healthPct}%</Text>
              </Box>
              <GradientProgress value={healthPct} width={healthW} colors={[healthColor, healthColor]} />
            </Box>
          ) : null}

          {past(phase, "ready") ? <Box height={1} /> : null}

          {/* Divider — plain text, demo-storm pattern */}
          {past(phase, "ready") ? (
            <Box height={1}>
              <Separator style="line" color={C.dim} />
            </Box>
          ) : null}

          {past(phase, "ready") ? <Box height={1} /> : null}

          {/* Agent proactively pulls metrics */}
          {past(phase, "pulling") ? (
            <Box height={1} flexDirection="row" paddingLeft={padL}>
              <Text color={C.dim}>{"[00:00:06]   "}</Text>
              <Text color={C.white} bold>{"PULLING PRODUCTION METRICS"}</Text>
              <Text>{"   "}</Text>
              {phase === "pulling" ? (
                <Spinner type="dots" color={C.teal} />
              ) : (
                <Badge label="DONE" variant="info" />
              )}
            </Box>
          ) : null}

          {/* Anomaly detected — with visual sparklines showing the spike */}
          {past(phase, "anomaly") ? (
            <>
              <Box height={1} flexDirection="row" paddingLeft={padL}>
                <Text color={C.dim}>{"[00:00:08]   "}</Text>
                <Text color={C.red} bold>{"ANOMALY DETECTED"}</Text>
                <Text>{"   "}</Text>
                <Badge label="ALERT" variant="error" />
              </Box>
              <Box height={1} />
              {/* Error rate sparkline — bigger for visual impact */}
              <Box paddingLeft={padL + 2} flexDirection="row" height={3}>
                <Text color={C.dim}>{"err  "}</Text>
                <Sparkline
                  data={[0.5, 0.6, 0.7, 0.8, 0.9, 1.1, 1.3, 1.5, 1.8, 2.1, 2.4, 2.8, 3.2, 3.6, 4.0, 4.3, 4.3, 4.4, 4.3, 4.2]}
                  width={52}
                  height={3}
                  color={C.red}
                />
                <Text color={C.red} bold>{"  4.3%"}</Text>
              </Box>
              <Box paddingLeft={padL + 2} flexDirection="row" height={3}>
                <Text color={C.dim}>{"mem  "}</Text>
                <Sparkline
                  data={[62, 64, 66, 68, 70, 72, 74, 77, 80, 83, 85, 87, 89, 91, 93, 94, 94, 95, 94, 94]}
                  width={52}
                  height={3}
                  color={C.amber}
                />
                <Text color={C.amber} bold>{"  94%"}</Text>
              </Box>
              <Box height={1} />
              <Box paddingLeft={padL}>
                <MessageBubble role="assistant">
                  {"Error rate climbing: 2.1% \u2192 4.3% over last 15 minutes. Memory usage anomaly in auth service \u2014 94% and growing. Initiating investigation."}
                </MessageBubble>
              </Box>
              <Box height={1} />

              {/* ── LIVE error rate chart — the visual centerpiece ── */}
              {chartPoints > 2 ? (
                <Box flexDirection="column" paddingLeft={padL}>
                  <Box height={1} flexDirection="row">
                    <Text color={past(phase, "applied") ? C.green : C.red} bold>{"SYSTEM HEALTH \u00B7 LIVE"}</Text>
                    <Text>{"  "}</Text>
                    {past(phase, "applied") ? (
                      <Badge label="RECOVERING" variant="success" />
                    ) : (
                      <Badge label="CRITICAL" variant="error" />
                    )}
                  </Box>
                  <Box height={1} />
                  <LineChart
                    series={[{ data: errorData, name: "health %", color: past(phase, "applied") ? C.green : C.red }]}
                    width={chartW}
                    height={10}
                    yMin={0}
                    yMax={100}
                    showAxes
                    showLegend={false}
                  />
                  <Box height={1} />
                  <Box flexDirection="row" paddingLeft={2}>
                    <Box width={16} flexDirection="column">
                      <Text color={C.dim}>{"PEAK"}</Text>
                      <Text color={C.red} bold>{"4.3%"}</Text>
                    </Box>
                    <Box width={16} flexDirection="column">
                      <Text color={C.dim}>{"CURRENT"}</Text>
                      <Text color={errVal > 1 ? C.red : C.green} bold>{errVal.toFixed(1)}{"%"}</Text>
                    </Box>
                    <Box width={16} flexDirection="column">
                      <Text color={C.dim}>{"STATUS"}</Text>
                      <Text color={past(phase, "applied") ? C.green : C.red} bold>
                        {past(phase, "done") ? "NOMINAL" : past(phase, "applied") ? "RECOVERING" : "CRITICAL"}
                      </Text>
                    </Box>
                  </Box>
                  <Box height={1} />
                </Box>
              ) : null}
            </>
          ) : null}

          {/* Agent starts scanning */}
          {phase === "scanning" ? (
            <Box flexDirection="row" paddingLeft={padL + 2}>
              <Spinner type="flywheel" color={C.dim} />
              <Text color={C.dim} italic>{" Scanning codebase for root cause..."}</Text>
            </Box>
          ) : null}

          {/* OperationTree */}
          {ops.length > 0 ? (
            <Box paddingLeft={padL + 2} overflow="hidden">
              <OperationTree nodes={ops} showDuration />
            </Box>
          ) : null}

          {ops.length > 0 ? <Box height={1} /> : null}

          {/* Findings */}
          {past(phase, "findings") ? (
            <Box flexDirection="column" paddingLeft={padL + 2}>
              <Box height={1} flexDirection="row">
                <Text color={C.white} bold>{"MEMORY LEAK IN SESSION.TS"}</Text>
                <Text>{"   "}</Text>
                <Badge label="CRITICAL" variant="error" />
              </Box>
              <Box height={1} flexDirection="row">
                <Text color={C.white} bold>{"IP SPOOFING IN RATELIMIT.TS"}</Text>
                <Text>{"   "}</Text>
                <Badge label="HIGH" variant="warning" />
              </Box>
              <Box height={1} flexDirection="row">
                <Text color={C.white} bold>{"MISSING HANDLER IN TOKENREFRESH.TS"}</Text>
                <Text>{"   "}</Text>
                <Badge label="MEDIUM" variant="warning" />
              </Box>
            </Box>
          ) : null}

          {past(phase, "findings") ? <Box height={1} /> : null}

          {/* Streaming response */}
          {past(phase, "streaming") ? (
            <Box paddingLeft={padL}>
              <MessageBubble role="assistant">
                {phase === "streaming" ? (
                  <StreamingText text={RESPONSE_TEXT} animate speed={4} streaming color={C.text} />
                ) : (
                  <Text color={C.text} wrap="wrap">{RESPONSE_TEXT}</Text>
                )}
              </MessageBubble>
            </Box>
          ) : null}

          {past(phase, "code") ? <Box height={1} /> : null}

          {/* Code fix */}
          {past(phase, "code") ? (
            <Box paddingLeft={padL + 4} paddingRight={4} overflow="hidden">
              <SyntaxHighlight code={CODE_FIX} language="typescript" />
            </Box>
          ) : null}

          {past(phase, "code") ? <Box height={1} /> : null}

          {/* Diff */}
          {past(phase, "diff") ? (
            <Box paddingLeft={padL + 4} paddingRight={4} overflow="hidden">
              <DiffView diff={DIFF_CONTENT} showLineNumbers />
            </Box>
          ) : null}

          {past(phase, "diff") ? <Box height={1} /> : null}

          {/* Applied */}
          {past(phase, "applied") ? (
            <Box paddingLeft={padL}>
              <MessageBubble role="assistant">
                <Text color={C.green} bold>{"\u2713 3 files patched \u00B7 +18 -6"}</Text>
              </MessageBubble>
            </Box>
          ) : null}

          {past(phase, "applied") ? <Box height={1} /> : null}

          {/* Tests */}
          {past(phase, "tests") ? (
            <Box flexDirection="column" paddingLeft={padL + 2}>
              <Box height={1} flexDirection="row">
                <Text color={C.white}>{"session.test.ts"}</Text>
                <Text>{"          "}</Text>
                <Badge label="12 PASS" variant="success" />
              </Box>
              <Box height={1} flexDirection="row">
                <Text color={C.white}>{"rateLimit.test.ts"}</Text>
                <Text>{"        "}</Text>
                <Badge label="8 PASS" variant="success" />
              </Box>
              <Box height={1} flexDirection="row">
                <Text color={C.white}>{"tokenRefresh.test.ts"}</Text>
                <Text>{"     "}</Text>
                <Badge label="6 PASS" variant="success" />
              </Box>
              <Box height={1} flexDirection="row">
                <Text color={C.white}>{"integration.test.ts"}</Text>
                <Text>{"      "}</Text>
                <Badge label="4 PASS" variant="success" />
              </Box>
              <Box height={1}>
                <Text color={C.green} bold>{"30/30 PASS \u00B7 0 FAIL \u00B7 2.7s"}</Text>
              </Box>
            </Box>
          ) : null}

          {past(phase, "tests") ? <Box height={1} /> : null}

          {/* Deploying — FAST */}
          {past(phase, "deploying") ? (
            <Box height={1} flexDirection="row" paddingLeft={padL}>
              <Text color={C.dim}>{"[00:00:33]   "}</Text>
              <Text color={C.white} bold>{"DEPLOYING TO PRODUCTION"}</Text>
              <Text>{"   "}</Text>
              {phase === "deploying" ? (
                <Spinner type="dots" color={C.amber} />
              ) : (
                <Badge label="DONE" variant="info" />
              )}
            </Box>
          ) : null}

          {/* Post-deploy metrics */}
          {past(phase, "postmetrics") ? (
            <Box height={1} flexDirection="row" paddingLeft={padL}>
              <Text color={C.dim}>{"[00:00:35]   "}</Text>
              <Text color={C.white} bold>{"PULLING POST-DEPLOY METRICS"}</Text>
              <Text>{"   "}</Text>
              {phase === "postmetrics" ? (
                <Spinner type="dots" color={C.teal} />
              ) : (
                <Badge label="DONE" variant="info" />
              )}
            </Box>
          ) : null}

          {past(phase, "postmetrics") ? <Box height={1} /> : null}

          {/* Done — victory */}
          {phase === "done" ? (
            <Box paddingLeft={padL} flexDirection="column">
              <Box height={1}>
                <Separator style="line" color={C.dim} />
              </Box>
              <Box height={1} />
              <Box height={1} flexDirection="row">
                <Text color={C.dim} bold>{"SYSTEM HEALTH   "}</Text>
                <Text color={C.green} bold>{"98%"}</Text>
              </Box>
              <GradientProgress value={98} width={healthW} colors={[C.green, C.glow]} />
              <Box height={1} />
              <Box paddingLeft={padL}>
                <MessageBubble role="assistant">
                  <Text color={C.green} bold>{"\u2713 INCIDENT RESOLVED"}</Text>
                </MessageBubble>
              </Box>
              <Box height={1} />
              {/* Recovery sparklines — bigger, visual proof the fix worked */}
              <Box paddingLeft={padL + 2} flexDirection="row" height={3}>
                <Text color={C.dim}>{"err  "}</Text>
                <Sparkline
                  data={[4.3, 4.1, 3.8, 3.2, 2.5, 1.8, 1.2, 0.8, 0.5, 0.4, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3]}
                  width={52}
                  height={3}
                  color={C.green}
                />
                <Text color={C.green} bold>{"  0.3%"}</Text>
              </Box>
              <Box paddingLeft={padL + 2} flexDirection="row" height={3}>
                <Text color={C.dim}>{"mem  "}</Text>
                <Sparkline
                  data={[94, 92, 88, 82, 76, 70, 65, 62, 60, 58, 57, 56, 55, 55, 55, 55, 55, 55, 55, 55]}
                  width={52}
                  height={3}
                  color={C.green}
                />
                <Text color={C.green} bold>{"  55%"}</Text>
              </Box>
              <Box height={1} />
              <Box paddingLeft={padL + 2} flexDirection="column">
                <Box height={1} flexDirection="row">
                  <Text color={C.white} bold>{"3 files patched"}</Text>
                  <Text>{"   "}</Text>
                  <Text color={C.white} bold>{"30/30 tests"}</Text>
                  <Text>{"   "}</Text>
                  <Text color={C.white} bold>{"error rate -93%"}</Text>
                  <Text>{"   "}</Text>
                  <Text color={C.green} bold>{"SYSTEM NOMINAL"}</Text>
                </Box>
                <Box height={1} />
                <Text color={C.dim}>{"Autonomous detection \u2192 root cause \u2192 patch \u2192 deploy \u2192 verify. Zero human intervention."}</Text>
              </Box>
            </Box>
          ) : null}

          {/* Context + Cost — shown once we have token data */}
          {past(phase, "findings") ? (
            <>
              <Box height={1} />
              <Box paddingLeft={padL + 2} flexDirection="column">
                <ContextWindow used={inputTokens + outputTokens} limit={1000000} compact barWidth={20} />
                <CostTracker inputTokens={inputTokens} outputTokens={outputTokens} compact />
              </Box>
            </>
          ) : null}

        </Box>
      </ScrollView>

      {/* ── Bottom bar ── */}
      <Box height={1} flexShrink={0} flexDirection="row" paddingX={1} >
        <Text color={C.teal} bold>{"\u26A1 storm"}</Text>
        <Text color={C.dim}>{" orc-1"}</Text>
        <Box flex={1} />
        <Text color={C.dim}>{`${((inputTokens + outputTokens) / 1000).toFixed(1)}K tok`}</Text>
        <Text color={C.dim}>{`  $${totalCost.toFixed(2)}`}</Text>
        <Text color={healthColor}>{`  ${healthPct}%`}</Text>
      </Box>
    </Box>
  );
}

// ── Entry ────────────────────────────────────────────────────────────

// Root owns theme state — single source of truth for both ThemeProvider and App
// Uses setTerminalBg() to change the terminal's ACTUAL default background via OSC 11.
// This is how real terminal themes work — no backgroundColor on Boxes needed.
let screenRef: { setTerminalBg: (hex: string | null) => void } | null = null;

function Root(): React.ReactElement {
  const [dark, setDark] = useState(false);
  const toggle = useCallback(() => {
    setDark((d) => {
      const next = !d;
      // Change the terminal's actual default background
      screenRef?.setTerminalBg(next ? null : "#E2E8F0");
      return next;
    });
  }, []);
  return (
    <ThemeProvider {...(!dark ? { theme: LIGHT_STORM } : {})}>
      <App isDarkProp={dark} toggleTheme={toggle} />
    </ThemeProvider>
  );
}

const app = render(<Root />);
screenRef = app.screen;

// Set light bg on startup (default is light mode)
app.screen.setTerminalBg("#E2E8F0");

await app.waitUntilExit();
