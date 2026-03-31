/**
 * Storm Ops — Dashboard.
 *
 * Main layout with two-column panel grid, data simulation via useInterval,
 * and a status bar at the bottom.
 */

import React, { useCallback, useRef } from "react";
import {
  Box,
  Text,
  Spinner,
  useTerminal,
  useTui,
  useInterval,
  useInput,
  type OpNode,
  type LogEntry,
} from "../../src/index.js";

import { AgentPanel } from "./panels/AgentPanel.js";
import { ResourcePanel } from "./panels/ResourcePanel.js";
import { DiffPanel } from "./panels/DiffPanel.js";
import { EventLog } from "./panels/EventLog.js";
import { MetricsPanel } from "./panels/MetricsPanel.js";
import { CostPanel } from "./panels/CostPanel.js";
import { GovernancePanel } from "./panels/GovernancePanel.js";

// -- Colors ----------------------------------------------------------------------

export const S = {
  arc: "#82AAFF",
  text: "#C0CAF5",
  dim: "#565F89",
  success: "#9ECE6A",
  error: "#F7768E",
  warning: "#E0AF68",
  panelBorder: "#565F89",
};

// -- Agent operation phases ------------------------------------------------------

const AUTH_PHASES = ["scan", "read", "analyze", "edit", "test", "complete"];
const PERF_PHASES = ["profile", "identify", "rewrite", "benchmark"];
const DOCS_PHASES = ["scan", "generate", "format", "complete"];

function phaseToStatus(phase: string): "running" | "completed" {
  return phase === "complete" || phase === "benchmark" ? "completed" : "running";
}

function buildAgentOps(phases: string[], currentIdx: number): OpNode[] {
  return phases.map((phase, i) => ({
    id: phase,
    label: phase,
    status: i < currentIdx ? "completed" as const
      : i === currentIdx ? "running" as const
      : "pending" as const,
    ...(i < currentIdx ? { durationMs: 800 + Math.floor(Math.random() * 1200) } : {}),
  }));
}

// -- Diffs -----------------------------------------------------------------------

const DIFFS = [
  `--- a/src/auth/middleware.ts
+++ b/src/auth/middleware.ts
@@ -12,7 +12,9 @@
 export function authMiddleware(req: Request) {
-  const token = req.headers.authorization;
+  const token = req.headers.authorization?.replace("Bearer ", "");
+  if (!token) return unauthorized();
+  const claims = verifyJWT(token);
   return next(req);
 }`,
  `--- a/src/perf/query-optimizer.ts
+++ b/src/perf/query-optimizer.ts
@@ -5,6 +5,8 @@
 function executeQuery(sql: string) {
-  return db.raw(sql);
+  const plan = db.explain(sql);
+  if (plan.cost > 1000) logger.warn("slow query", { sql, cost: plan.cost });
+  return db.raw(sql, { timeout: 5000 });
 }`,
  `--- a/docs/api-reference.md
+++ b/docs/api-reference.md
@@ -1,4 +1,6 @@
 # API Reference
+
+> Auto-generated from source on ${new Date().toISOString().slice(0, 10)}

 ## Authentication
+All endpoints require a valid Bearer token.`,
  `--- a/src/perf/connection-pool.ts
+++ b/src/perf/connection-pool.ts
@@ -18,5 +18,9 @@
 export class ConnectionPool {
-  private maxConnections = 10;
+  private maxConnections = 20;
+  private idleTimeout = 30_000;
+
+  async acquire(): Promise<Connection> {
+    if (this.idle.length > 0) return this.idle.pop()!;
+    return this.createConnection();
+  }
 }`,
];

// -- System event templates (random fillers) ------------------------------------

const SYSTEM_EVENTS: Array<{ text: string; level: "info" | "warn" | "error" | "debug" }> = [
  { text: "Cache hit rate: 67%", level: "debug" },
  { text: "Connection pool: 8/20 active", level: "debug" },
  { text: "Evidence-plane compaction OK", level: "debug" },
  { text: "Rate limit: 62% of 100 req/min", level: "info" },
  { text: "Knowledge-plane cache refreshed", level: "debug" },
  { text: "Scheduler heartbeat OK", level: "debug" },
];

// -- Dashboard props -------------------------------------------------------------

export interface DashboardProps {
  model: string;
  onExit: () => void;
}

// -- Dashboard -------------------------------------------------------------------

export function Dashboard({ model, onExit }: DashboardProps): React.ReactElement {
  const { width, height } = useTerminal();
  const { requestRender, flushSync } = useTui();

  // -- Mutable state (imperative, not React state) --
  const tickRef = useRef(0);

  // Agent phase indices
  const authPhaseRef = useRef(0);
  const perfPhaseRef = useRef(0);
  const docsPhaseRef = useRef(0);

  // Track which agents have been marked complete (for one-time "completed all" event)
  const authDoneAnnouncedRef = useRef(false);
  const perfDoneAnnouncedRef = useRef(false);
  const docsDoneAnnouncedRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  // Diff index — only advances when an edit step completes
  const diffIdxRef = useRef(0);

  // Agent op trees
  const agentsRef = useRef<Array<{ name: string; status: string; ops: OpNode[] }>>([
    { name: "auth-refactor", status: "running", ops: buildAgentOps(AUTH_PHASES, 0) },
    { name: "perf-optimization", status: "running", ops: buildAgentOps(PERF_PHASES, 0) },
    { name: "docs-gen", status: "running", ops: buildAgentOps(DOCS_PHASES, 0) },
  ]);

  // Resources — smooth fluctuation
  const cpuRef = useRef(55);
  const memRef = useRef(3.8);
  const gpuRef = useRef(72);
  const cpuHistoryRef = useRef<number[]>([55, 60, 58, 62, 55, 70, 65, 58, 62, 67, 72, 68, 55, 60, 63]);
  const memHistoryRef = useRef<number[]>([3.8, 3.8, 3.9, 3.9, 3.9, 4.0, 4.0, 4.0, 4.1, 4.1, 4.1, 4.2, 4.2, 4.2, 4.3]);
  const gpuHistoryRef = useRef<number[]>([72, 68, 75, 80, 65, 70, 78, 82, 74, 69, 76, 80, 72, 68, 75]);

  // Events
  const eventsRef = useRef<LogEntry[]>([
    { text: "Storm Ops initialized", level: "info", timestamp: ts() },
    { text: "3 agents registered", level: "info", timestamp: ts() },
    { text: "Governance policies loaded (5 active)", level: "success", timestamp: ts() },
  ]);

  // Diff
  const currentDiffRef = useRef(DIFFS[0]!);

  // Costs
  const inputTokensRef = useRef(24500);
  const outputTokensRef = useRef(8200);
  const totalCostRef = useRef(4.80);

  // Metrics
  const p50HistoryRef = useRef<number[]>([120, 135, 128, 142, 118, 130, 125, 140, 132, 126, 138, 122, 145, 130, 128]);
  const p99HistoryRef = useRef<number[]>([320, 380, 345, 400, 310, 360, 340, 390, 350, 330, 370, 315, 410, 355, 340]);
  const latencyTrendRef = useRef<number[]>([130, 128, 135, 140, 125, 138, 132, 142, 128, 135, 130, 145, 138, 125, 132, 140, 128, 136, 130, 142]);

  // Governance — lifecycle tracking
  const pendingApprovalsRef = useRef(0);
  const approvedCountRef = useRef(3);
  const deniedCountRef = useRef(0);
  const policiesActiveRef = useRef(5);
  const policiesPassedRef = useRef(3);
  // Track pending approval age (ticks since added)
  const pendingAgeRef = useRef(0);

  // -- Keyboard input --
  useInput(useCallback((input: string) => {
    if (input === "q") {
      onExit();
    }
  }, [onExit]));

  // -- Helper: push event (capped at 50) --
  const pushEvent = (text: string, level: "info" | "warn" | "error" | "debug" | "success") => {
    const events = eventsRef.current;
    events.push({ text, level, timestamp: ts() });
    if (events.length > 50) events.splice(0, events.length - 50);
  };

  // -- Simulation tick (every 800ms for smooth live feel) --
  useInterval(() => {
    tickRef.current += 1;
    const t = tickRef.current;
    const elapsed = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);

    // ── 1. Advance agent phases probabilistically ──────────────────────
    // docs-gen: fast — ~60% chance each tick, completes in ~5 ticks
    const prevDocs = docsPhaseRef.current;
    if (docsPhaseRef.current < DOCS_PHASES.length - 1 && Math.random() < 0.60) {
      docsPhaseRef.current += 1;
      const completedStep = DOCS_PHASES[prevDocs]!;
      const nextStep = DOCS_PHASES[docsPhaseRef.current]!;
      pushEvent(`✓ Agent docs-gen completed ${completedStep}`, "success");
      if (docsPhaseRef.current < DOCS_PHASES.length - 1) {
        pushEvent(`⠋ Agent docs-gen starting ${nextStep}`, "info");
      }
    }

    // auth-refactor: moderate — ~35% chance each tick, completes in ~8 ticks
    const prevAuth = authPhaseRef.current;
    if (authPhaseRef.current < AUTH_PHASES.length - 1 && Math.random() < 0.35) {
      authPhaseRef.current += 1;
      const completedStep = AUTH_PHASES[prevAuth]!;
      const nextStep = AUTH_PHASES[authPhaseRef.current]!;
      pushEvent(`✓ Agent auth-refactor completed ${completedStep}`, "success");
      if (authPhaseRef.current < AUTH_PHASES.length - 1) {
        pushEvent(`⠋ Agent auth-refactor starting ${nextStep}`, "info");
      }
      // If auth just completed an "edit" step, show a new diff
      if (completedStep === "edit") {
        diffIdxRef.current = (diffIdxRef.current + 1) % DIFFS.length;
        currentDiffRef.current = DIFFS[diffIdxRef.current]!;
      }
    }

    // perf-optimization: slow — ~22% chance each tick
    const prevPerf = perfPhaseRef.current;
    if (perfPhaseRef.current < PERF_PHASES.length - 1 && Math.random() < 0.22) {
      perfPhaseRef.current += 1;
      const completedStep = PERF_PHASES[prevPerf]!;
      const nextStep = PERF_PHASES[perfPhaseRef.current]!;
      pushEvent(`✓ Agent perf-optimization completed ${completedStep}`, "success");
      if (perfPhaseRef.current < PERF_PHASES.length - 1) {
        pushEvent(`⠋ Agent perf-optimization starting ${nextStep}`, "info");
      }
      // If perf just completed "rewrite", show a new diff
      if (completedStep === "rewrite") {
        diffIdxRef.current = (diffIdxRef.current + 1) % DIFFS.length;
        currentDiffRef.current = DIFFS[diffIdxRef.current]!;
      }
    }

    // ── 2. Detect agent completion (one-time announcements) ────────────
    const authDone = authPhaseRef.current >= AUTH_PHASES.length - 1;
    const perfDone = perfPhaseRef.current >= PERF_PHASES.length - 1;
    const docsDone = docsPhaseRef.current >= DOCS_PHASES.length - 1;

    if (docsDone && !docsDoneAnnouncedRef.current) {
      docsDoneAnnouncedRef.current = true;
      pushEvent(`✓ Agent docs-gen completed all tasks (${elapsed}s)`, "success");
    }
    if (authDone && !authDoneAnnouncedRef.current) {
      authDoneAnnouncedRef.current = true;
      pushEvent(`✓ Agent auth-refactor completed all tasks (${elapsed}s)`, "success");
    }
    if (perfDone && !perfDoneAnnouncedRef.current) {
      perfDoneAnnouncedRef.current = true;
      pushEvent(`✓ Agent perf-optimization completed all tasks (${elapsed}s)`, "success");
    }

    // ── 3. Update agent op trees ───────────────────────────────────────
    agentsRef.current = [
      { name: "auth-refactor", status: authDone ? "complete" : "running", ops: buildAgentOps(AUTH_PHASES, authPhaseRef.current) },
      { name: "perf-optimization", status: perfDone ? "complete" : "running", ops: buildAgentOps(PERF_PHASES, perfPhaseRef.current) },
      { name: "docs-gen", status: docsDone ? "complete" : "running", ops: buildAgentOps(DOCS_PHASES, docsPhaseRef.current) },
    ];

    // ── 4. Smooth resource fluctuation ─────────────────────────────────
    // CPU: ±5% each tick, clamped 15–95
    const cpuDelta = (Math.random() - 0.5) * 10; // ±5
    cpuRef.current = Math.max(15, Math.min(95, Math.round(cpuRef.current + cpuDelta)));
    // Memory: slowly grows, tiny fluctuation
    memRef.current = Math.min(7.8, memRef.current + 0.01 + Math.random() * 0.02);
    // GPU: ±8% each tick
    const gpuDelta = (Math.random() - 0.5) * 16;
    gpuRef.current = Math.max(20, Math.min(98, Math.round(gpuRef.current + gpuDelta)));

    cpuHistoryRef.current = [...cpuHistoryRef.current.slice(-14), cpuRef.current];
    memHistoryRef.current = [...memHistoryRef.current.slice(-14), memRef.current];
    gpuHistoryRef.current = [...gpuHistoryRef.current.slice(-14), gpuRef.current];

    // Occasional CPU/GPU spike system events
    if (cpuRef.current > 80) {
      pushEvent(`CPU spike: ${cpuRef.current}%`, "warn");
    } else if (gpuRef.current > 90) {
      pushEvent(`GPU utilization spike: ${gpuRef.current}%`, "warn");
    } else if (t % 4 === 0) {
      // Random system event every ~4 ticks
      const sysEvt = SYSTEM_EVENTS[Math.floor(Math.random() * SYSTEM_EVENTS.length)]!;
      pushEvent(sysEvt.text, sysEvt.level);
    }

    // ── 5. Cost increments (proportional to running agents) ────────────
    const runningCount = agentsRef.current.filter(a => a.status === "running").length;
    const tokenMultiplier = Math.max(0.2, runningCount / 3);
    inputTokensRef.current += Math.floor((800 + Math.random() * 600) * tokenMultiplier);
    outputTokensRef.current += Math.floor((250 + Math.random() * 200) * tokenMultiplier);
    totalCostRef.current += (0.08 + Math.random() * 0.06) * tokenMultiplier;

    // ── 6. Metrics ─────────────────────────────────────────────────────
    const newP50 = 115 + Math.floor(Math.random() * 35);
    const newP99 = 300 + Math.floor(Math.random() * 120);
    p50HistoryRef.current = [...p50HistoryRef.current.slice(-14), newP50];
    p99HistoryRef.current = [...p99HistoryRef.current.slice(-14), newP99];
    latencyTrendRef.current = [...latencyTrendRef.current.slice(-19), newP50];

    // ── 7. Governance approval lifecycle ───────────────────────────────
    // When an agent hits an "edit" or "rewrite" step, add a pending approval
    if (prevAuth !== authPhaseRef.current && AUTH_PHASES[authPhaseRef.current] === "edit") {
      pendingApprovalsRef.current += 1;
      pendingAgeRef.current = 0;
      pushEvent("Governance: filesystem.write pending approval (auth-refactor)", "warn");
    }
    if (prevPerf !== perfPhaseRef.current && PERF_PHASES[perfPhaseRef.current] === "rewrite") {
      pendingApprovalsRef.current += 1;
      pendingAgeRef.current = 0;
      pushEvent("Governance: filesystem.write pending approval (perf-optimization)", "warn");
    }

    // Auto-approve after 2 ticks
    if (pendingApprovalsRef.current > 0) {
      pendingAgeRef.current += 1;
      if (pendingAgeRef.current >= 2) {
        const approving = pendingApprovalsRef.current;
        pendingApprovalsRef.current = 0;
        pendingAgeRef.current = 0;
        approvedCountRef.current += approving;
        pushEvent(`Governance: ${approving} approval(s) auto-approved`, "success");
      }
    }

    // Policies passed slowly converges
    if (t % 6 === 0 && policiesPassedRef.current < policiesActiveRef.current) {
      policiesPassedRef.current += 1;
    }

    requestRender();
  }, 800);

  // -- Layout --
  const activeAgents = agentsRef.current.filter(a => a.status === "running").length;
  const costStr = "$" + totalCostRef.current.toFixed(2);
  const borderLine = "\u2500".repeat(Math.max(0, width - 2));

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* Header — same pattern as Storm Code */}
      <Box height={1} flexDirection="row" paddingLeft={1} overflow="hidden">
        <Spinner type="storm-logo" color={S.arc} interval={120} />
        <Text color={S.text} bold>{" storm ops"}</Text>
        <Text color={S.dim}>{" · "}{activeAgents}{"/3 agents"}</Text>
        <Text color={S.dim}>{" · "}{model}</Text>
        <Box flex={1} />
        <Text color={S.success}>{"● live"}</Text>
        <Text>{" "}</Text>
      </Box>
      <Box height={1} overflow="hidden">
        <Text color={S.dim}>{"\u2500".repeat(width)}</Text>
      </Box>

      {/* Main content — two columns */}
      <Box flex={1} flexDirection="row">
        {/* Left column */}
        <Box flex={3} flexDirection="column" overflow="hidden">
          <AgentPanel agents={agentsRef.current} flex={2} />
          <DiffPanel diff={currentDiffRef.current} flex={1} />
          <EventLog events={eventsRef.current} flex={1} />
          <MetricsPanel
            p50History={p50HistoryRef.current}
            p99History={p99HistoryRef.current}
            latencyTrend={latencyTrendRef.current}
            flex={1}
          />
        </Box>

        {/* Right column */}
        <Box flex={2} flexDirection="column" overflow="hidden">
          <ResourcePanel
            cpu={cpuRef.current}
            memory={memRef.current}
            gpu={gpuRef.current}
            cpuHistory={cpuHistoryRef.current}
            memHistory={memHistoryRef.current.map(v => v / 8 * 100)}
            gpuHistory={gpuHistoryRef.current}
            flex={1}
          />
          <CostPanel
            inputTokens={inputTokensRef.current}
            outputTokens={outputTokensRef.current}
            totalCost={totalCostRef.current}
            flex={1}
          />
          <GovernancePanel
            pendingApprovals={pendingApprovalsRef.current}
            policiesActive={policiesActiveRef.current}
            policiesPassed={policiesPassedRef.current}
            flex={1}
          />
          <MetricsSidebar
            p50={p50HistoryRef.current[p50HistoryRef.current.length - 1]!}
            p99={p99HistoryRef.current[p99HistoryRef.current.length - 1]!}
            p50History={p50HistoryRef.current}
            p99History={p99HistoryRef.current}
            flex={1}
          />
        </Box>
      </Box>

      {/* Status bar */}
      <Box height={1} width={width} paddingX={1}>
        <Text color={S.arc} bold>{"\u25C6 "}</Text>
        <Text color={S.success}>{costStr}</Text>
        <Text color={S.dim}>{" \u00B7 "}</Text>
        <Text color={cpuRef.current > 75 ? S.warning : S.text}>{cpuRef.current + "% cpu"}</Text>
        <Text color={S.dim}>{" \u00B7 "}</Text>
        <Text color={S.text}>{memRef.current.toFixed(1) + "GB mem"}</Text>
        <Text color={S.dim}>{" \u00B7 "}</Text>
        <Text color={S.dim}>{approvedCountRef.current + " approved"}</Text>
        <Text color={S.dim}>{" \u00B7 "}</Text>
        <Text color={S.dim}>{"q:quit"}</Text>
      </Box>
    </Box>
  );
}

// -- Model perf sparklines sidebar panel -----------------------------------------

function MetricsSidebar({ p50, p99, p50History, p99History, flex }: {
  p50: number;
  p99: number;
  p50History: number[];
  p99History: number[];
  flex?: number;
}): React.ReactElement {
  // Inline sparkline using braille chars
  const spark = (data: number[]): string => {
    const chars = ["\u2581", "\u2582", "\u2583", "\u2584", "\u2585", "\u2586", "\u2587", "\u2588"];
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    return data.map(v => {
      const idx = Math.min(chars.length - 1, Math.floor(((v - min) / range) * (chars.length - 1)));
      return chars[idx]!;
    }).join("");
  };

  return (
    <Box
      flexDirection="column"
      flex={flex}
      borderStyle="round"
      borderColor={S.panelBorder}
      overflow="hidden"
    >
      <Box height={1} paddingX={1}>
        <Text color={S.arc} bold>{"Model Performance"}</Text>
      </Box>
      <Box flex={1} overflow="hidden" paddingX={1}>
        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Text color={S.dim}>{"p50:"}</Text>
            <Text color={S.success}>{p50 + "ms"}</Text>
          </Box>
          <Text color={S.success}>{spark(p50History)}</Text>
          <Box height={1} />
          <Box flexDirection="row" gap={1}>
            <Text color={S.dim}>{"p99:"}</Text>
            <Text color={S.warning}>{p99 + "ms"}</Text>
          </Box>
          <Text color={S.warning}>{spark(p99History)}</Text>
        </Box>
      </Box>
    </Box>
  );
}

// -- Helpers ---------------------------------------------------------------------

function ts(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}
