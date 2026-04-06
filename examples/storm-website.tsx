#!/usr/bin/env npx tsx
/**
 * Storm TUI — Website in Terminal
 *
 * Cinematic demo inspired by the Storm website and DevTools page.
 * Each phase has its own color accent and visual centerpiece.
 *
 * Phase 1 (0-4s):   Hero — STORM title, tagline, code
 * Phase 2 (4-10s):  Renderer — animated cell grid showing the diff
 * Phase 3 (10-16s): Dashboard — dense live metrics, everything alive
 * Phase 4 (16-21s): Agent — AI fixing a bug
 * Phase 5 (21-24s): End
 *
 * Usage: npx tsx examples/storm-website.tsx
 */

import React, { useRef } from "react";
import {
  render, Box, Text, Spinner, ProgressBar, Sparkline, Badge, Table,
  OperationTree, StreamingText,
  useTerminal, useTui, useInput, useTick,
  type OpNode, type TableColumn,
} from "../src/index.js";

// ── Colors from DevTools page ────────────────────────────────────
const C = {
  blue: "#82AAFF",    // primary
  cyan: "#50C8FF",    // time-travel
  green: "#50C878",   // accessibility
  amber: "#FFCC00",   // warm
  orange: "#FF8800",  // heatmap warm
  red: "#FF4444",     // heatmap hot
  pink: "#F7768E",    // error
  text: "#C0CAF5",
  dim: "#565F89",
  white: "#E5E2E1",
};

// ── Storm Diamond Logo ───────────────────────────────────────────
const DIAMOND = [
  "    ██    ",
  "  ██  ██  ",
  "██  ◆◆  ██",
  "  ██  ██  ",
  "    ██    ",
];

// ── STORM Text ───────────────────────────────────────────────────
const LOGO = [
  "███████╗████████╗ ██████╗ ██████╗ ███╗   ███╗",
  "██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗████╗ ████║",
  "███████╗   ██║   ██║   ██║██████╔╝██╔████╔██║",
  "╚════██║   ██║   ██║   ██║██╔══██╗██║╚██╔╝██║",
  "███████║   ██║   ╚██████╔╝██║  ██║██║ ╚═╝ ██║",
  "╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝",
];

const STAGES = ["React Tree", "Layout", "Cell Buffer", "Diff Engine", "Terminal"];

const TABLE_COLS: TableColumn[] = [
  { key: "name", header: "Process", width: 12 },
  { key: "cpu", header: "CPU", width: 8 },
  { key: "mem", header: "MEM", width: 8 },
];
const TABLE_DATA = [
  { name: "node", cpu: "12.4%", mem: "284M" },
  { name: "docker", cpu: "3.8%", mem: "420M" },
  { name: "postgres", cpu: "2.1%", mem: "156M" },
  { name: "redis", cpu: "0.8%", mem: "64M" },
];

const AGENT_TEXT = "Found the bug. The token refresh in auth.ts doesn't handle clock skew. Adding a 30s safety buffer and wrapping refresh in retry logic with exponential backoff.";

// ── Helpers ──────────────────────────────────────────────────────
function Footer({ accent }: { accent: string }) {
  return (
    <Box height={1} flexShrink={0} paddingX={2} flexDirection="row">
      <Text bold color={accent}>{"█◆◆█ storm"}</Text>
      <Box flex={1} />
      <Text color={C.dim}>{"q to exit"}</Text>
    </Box>
  );
}

function Header({ title, accent, right }: { title: string; accent: string; right?: string }) {
  return (
    <Box height={1} flexShrink={0} paddingX={2} flexDirection="row">
      <Text bold color={accent}>{title}</Text>
      <Box flex={1} />
      {right && <Text color={C.dim}>{right}</Text>}
    </Box>
  );
}

function Line({ w, color }: { w: number; color: string }) {
  return <Box height={1} paddingX={2}><Text color={color}>{"─".repeat(Math.max(0, w - 4))}</Text></Box>;
}

// ── Main ─────────────────────────────────────────────────────────
function App() {
  const { width, height } = useTerminal();
  const { exit } = useTui();
  const startRef = useRef(Date.now());

  // Mutable state
  const sparkRef = useRef<number[]>(Array.from({ length: 20 }, () => 30 + Math.random() * 40));
  const metricRef = useRef({ skip: 0, frame: 0, comp: 0, pipe: -1 });
  const dashRef = useRef({ progress: 0, cpu: 45, mem: 62, tokIn: 0 });

  useTick(100, (tick) => {
    const t = Date.now() - startRef.current;

    if (t >= 4000 && t < 10000) {
      const f = Math.min(1, (t - 4000) / 3000);
      const ease = 1 - Math.pow(1 - f, 3);
      metricRef.current.skip = Math.floor(97 * ease);
      metricRef.current.frame = +(0.5 * ease).toFixed(1);
      metricRef.current.comp = Math.floor(92 * ease);
      metricRef.current.pipe = Math.min(4, Math.floor((t - 4000) / 1000));
    }

    if (t >= 10000 && t < 16000) {
      const base = 40 + Math.sin(tick * 0.25) * 20;
      sparkRef.current = [...sparkRef.current.slice(-19), Math.floor(base + Math.random() * 15)];
      dashRef.current.progress = Math.min(100, Math.floor(((t - 10000) / 5000) * 100));
      dashRef.current.cpu = Math.round(45 + Math.sin(tick * 0.15) * 12);
      dashRef.current.mem = Math.round(62 + Math.sin(tick * 0.1) * 8);
      dashRef.current.tokIn = Math.floor((t - 10000) * 1.5);
    }

    if (t >= 24000) exit();
  });

  useInput((e) => { if ((e.key === "c" && e.ctrl) || e.key === "q") exit(); });

  const t = Date.now() - startRef.current;

  // ── PHASE 1: Hero (0-4s) ─────────────────────────────────────
  if (t < 4000) {
    return (
      <Box flexDirection="column" width={width} height={height}>
        <Box flex={1} />
        <Box flexDirection="column" alignItems="center" width={width}>
          {DIAMOND.map((line, i) => (
            <Text key={`d${i}`} bold color={C.blue}>{line}</Text>
          ))}
        </Box>
        <Box height={1} />
        <Box flexDirection="column" alignItems="center" width={width}>
          {LOGO.map((line, i) => (
            <Text key={i} bold color={C.blue}>{line}</Text>
          ))}
        </Box>
        <Box height={2} />
        <Box flexDirection="row" justifyContent="center" width={width}>
          <Text bold color={C.white}>Fast. Layered. Unstoppable.</Text>
        </Box>
        <Box height={1} />
        <Box flexDirection="row" justifyContent="center" width={width}>
          <Text color={C.dim}>The high-performance rendering engine for terminal UIs</Text>
        </Box>
        <Box height={2} />
        <Box flexDirection="row" justifyContent="center" width={width} gap={3}>
          <Text color={C.blue}>97 components</Text>
          <Text color={C.dim}>·</Text>
          <Text color={C.cyan}>15 AI widgets</Text>
          <Text color={C.dim}>·</Text>
          <Text color={C.green}>83 hooks</Text>
          <Text color={C.dim}>·</Text>
          <Text color={C.amber}>12 themes</Text>
        </Box>
        <Box flex={1} />
        <Footer accent={C.blue} />
      </Box>
    );
  }

  // ── PHASE 2: Renderer Showcase (4-10s) ───────────────────────
  if (t < 10000) {
    const { skip, frame, comp, pipe } = metricRef.current;
    const gridW = Math.min(40, width - 20);
    const gridH = 4;

    // Animated cell grid: mostly dim, a few cells "flash" as mutations
    const mutCells = new Set<string>();
    const mutCount = 2 + Math.floor(Math.sin(t / 300) * 2);
    for (let i = 0; i < Math.max(1, mutCount); i++) {
      const mx = Math.floor((Math.sin(t / 500 + i * 1.7) + 1) / 2 * gridW);
      const my = Math.floor((Math.cos(t / 700 + i * 2.3) + 1) / 2 * gridH);
      mutCells.add(`${mx},${my}`);
    }

    return (
      <Box flexDirection="column" width={width} height={height}>
        <Header title="CELL-LEVEL RENDERING" accent={C.orange} right={`${skip}% cells skipped`} />
        <Line w={width} color={C.orange + "40"} />

        {/* Visual centerpiece: animated cell grid */}
        <Box flex={1} flexDirection="column" justifyContent="center" alignItems="center" background={{ type: "grid", dim: true, spacing: 8, color: "#2A2F3A" }}>
          <Text color={C.dim} bold>{"10,000 cells per frame. Only mutations are written."}</Text>
          <Box height={1} />

          {/* The grid */}
          {Array.from({ length: gridH }, (_, y) => (
            <Box key={y} flexDirection="row" justifyContent="center">
              {Array.from({ length: gridW }, (_, x) => {
                const isMut = mutCells.has(`${x},${y}`);
                return (
                  <Text key={x} color={isMut ? C.red : C.dim} bold={isMut}>
                    {isMut ? "█" : "·"}
                  </Text>
                );
              })}
            </Box>
          ))}

          <Box height={1} />
          <Box flexDirection="row" gap={4}>
            <Text color={C.dim}>{"·"} = skipped (97%)</Text>
            <Text color={C.red}>{"█"} = written (3%)</Text>
          </Box>

          <Box height={2} />

          {/* Metrics row */}
          <Box flexDirection="row" gap={4}>
            <Box flexDirection="column" alignItems="center">
              <Text bold color={C.amber}>{`${skip}%`}</Text>
              <Text color={C.dim}>skip rate</Text>
            </Box>
            <Box flexDirection="column" alignItems="center">
              <Text bold color={C.cyan}>{`<${frame}ms`}</Text>
              <Text color={C.dim}>frame time</Text>
            </Box>
            <Box flexDirection="column" alignItems="center">
              <Text bold color={C.green}>{`${comp}+`}</Text>
              <Text color={C.dim}>components</Text>
            </Box>
          </Box>

          <Box height={2} />

          {/* Pipeline lighting up — boxes with color change */}
          <Box flexDirection="row" alignItems="center" justifyContent="center">
            {STAGES.map((s, i) => {
              const on = i <= pipe;
              return (
                <React.Fragment key={s}>
                  {i > 0 && <Text color={on ? C.cyan : C.dim}>{" → "}</Text>}
                  <Box borderStyle="round" borderColor={on ? C.cyan : C.dim} paddingX={1}>
                    <Text bold={on} color={on ? C.cyan : C.dim}>{s}</Text>
                  </Box>
                </React.Fragment>
              );
            })}
          </Box>
        </Box>

        <Line w={width} color={C.orange + "40"} />
        <Footer accent={C.orange} />
      </Box>
    );
  }

  // ── PHASE 3: Live Dashboard (10-16s) ─────────────────────────
  if (t < 16000) {
    const { progress, cpu, mem, tokIn } = dashRef.current;
    const sparkW = Math.max(10, Math.floor(width / 2) - 8);
    const cpuColor = cpu > 60 ? C.red : cpu > 40 ? C.amber : C.green;
    const memColor = mem > 75 ? C.amber : C.green;

    const ops: OpNode[] = [
      { id: "1", label: "Scan codebase (847 files)", status: "completed", durationMs: 1240 },
      { id: "2", label: "Static analysis", status: "completed", durationMs: 2100 },
      { id: "3", label: "Running test suite", status: t > 13000 ? "completed" as const : "running" as const, ...(t > 13000 ? { durationMs: 2700 } : {}) },
      { id: "4", label: "Deploy to staging", status: t > 14500 ? "completed" as const : t > 13000 ? "running" as const : "pending" as const, ...(t > 14500 ? { durationMs: 1800 } : {}) },
    ];

    return (
      <Box flexDirection="column" width={width} height={height}>
        <Box height={1} paddingX={2} flexDirection="row">
          <Text bold color={C.green}>STORM DASHBOARD</Text>
          <Text color={C.dim}>{" "}</Text>
          <Badge label="LIVE" variant="success" />
          <Text color={C.dim}>{" "}</Text>
          <Spinner type="dots" color={C.green} />
          <Box flex={1} />
          <Text color={C.dim}>CPU </Text>
          <Text bold color={cpuColor}>{`${cpu}%`}</Text>
          <Text color={C.dim}>{" │ MEM "}</Text>
          <Text bold color={memColor}>{`${mem}%`}</Text>
        </Box>
        <Line w={width} color={C.green + "30"} />

        <Box flex={1} flexDirection="row">
          {/* Left panel — with dot background */}
          <Box flex={1} flexDirection="column" paddingX={2} background="dots">
            <Text bold color={C.green}>{"PERFORMANCE"}</Text>
            <Box height={1} />
            <Sparkline data={sparkRef.current} width={sparkW} height={3} color={C.green} />
            <Box height={1} />
            <Box flexDirection="row" gap={2}>
              <Text color={C.dim}>{"FPS "}</Text>
              <Text bold color={C.green}>{"60"}</Text>
              <Text color={C.dim}>{" │ Cells "}</Text>
              <Text bold color={C.cyan}>{"10,000"}</Text>
              <Text color={C.dim}>{" │ Skip "}</Text>
              <Text bold color={C.amber}>{"97%"}</Text>
            </Box>
            <Box height={1} />
            <Text bold color={C.text}>{"PROCESSES"}</Text>
            <Table columns={TABLE_COLS} data={TABLE_DATA} />
          </Box>

          {/* Divider */}
          <Box width={1} flexDirection="column">
            <Text color={C.dim + "30"}>{"│".repeat(Math.max(1, height - 4))}</Text>
          </Box>

          {/* Right panel */}
          <Box flex={1} flexDirection="column" paddingX={2}>
            <Text bold color={C.green}>{"BUILD"}</Text>
            <Box height={1} />
            <ProgressBar value={progress} width={Math.max(10, Math.floor(width / 2) - 6)} showPercent />
            <Box height={1} />
            <OperationTree nodes={ops} showDuration />
            <Box height={1} />
            <Box flexDirection="row" gap={2}>
              <Badge label="SSH Active" variant="info" />
              <Badge label="12 themes" variant="default" />
            </Box>
            <Box height={1} />
            <Text bold color={C.text}>{"SYSTEM"}</Text>
            <Box height={1} />
            <Box flexDirection="row">
              <Text color={C.dim}>{"Renderer  "}</Text>
              <Text bold color={C.green}>{"ACTIVE"}</Text>
            </Box>
            <Box flexDirection="row">
              <Text color={C.dim}>{"Diff      "}</Text>
              <Text bold color={C.green}>{"97% skip"}</Text>
            </Box>
            <Box flexDirection="row">
              <Text color={C.dim}>{"Plugins   "}</Text>
              <Text bold color={C.cyan}>{"3 loaded"}</Text>
            </Box>
            <Box flexDirection="row">
              <Text color={C.dim}>{"SSH       "}</Text>
              <Text bold color={C.green}>{"2 sessions"}</Text>
            </Box>
            <Box height={1} />
            <Box flexDirection="row" gap={2}>
              <Badge label="Online" variant="success" />
              <Badge label="3 alerts" variant="warning" />
            </Box>
          </Box>
        </Box>

        <Line w={width} color={C.green + "30"} />
        <Box height={1} paddingX={2} flexDirection="row">
          <Text bold color={C.green}>{"█◆◆█ storm"}</Text>
          <Box flex={1} />
          <Text color={C.dim}>{`${(tokIn / 1000).toFixed(1)}K tok`}</Text>
          <Text color={C.dim}>{` · $${(tokIn * 0.000003).toFixed(3)}`}</Text>
        </Box>
      </Box>
    );
  }

  // ── PHASE 4: Agent Session (16-21s) ──────────────────────────
  if (t < 21000) {
    const agentT = t - 16000;

    const ops: OpNode[] = [
      { id: "1", label: "Reading src/auth.ts", status: "completed", durationMs: 340 },
      { id: "2", label: "Analyzing token logic", status: agentT > 2000 ? "completed" as const : "running" as const, ...(agentT > 2000 ? { durationMs: 1200 } : {}) },
      { id: "3", label: "Generating patch", status: agentT > 3500 ? "completed" as const : agentT > 2000 ? "running" as const : "pending" as const, ...(agentT > 3500 ? { durationMs: 800 } : {}) },
    ];

    return (
      <Box flexDirection="column" width={width} height={height}>
        <Box height={1} paddingX={2} flexDirection="row">
          <Text bold color={C.cyan}>AGENT SESSION</Text>
          <Text color={C.dim}>{" "}</Text>
          <Spinner type="dots" color={C.cyan} />
          <Box flex={1} />
          <Text color={C.dim}>orc-1</Text>
        </Box>
        <Line w={width} color={C.cyan + "30"} />

        <Box flex={1} flexDirection="column" paddingX={3} paddingY={1} background="dots">
          {/* User prompt */}
          <Box flexDirection="row">
            <Text color={C.dim}>{"› "}</Text>
            <Text bold color={C.text}>Fix the token refresh bug in auth.ts</Text>
          </Box>
          <Box height={1} />

          {/* Agent response */}
          <Box flexDirection="row">
            <Text bold color={C.cyan}>{"◆ "}</Text>
            <Box flex={1}>
              <StreamingText text={AGENT_TEXT} streaming={agentT < 4000} animate speed={6} color={C.text} />
            </Box>
          </Box>
          <Box height={1} />

          {/* Operations */}
          <OperationTree nodes={ops} showDuration />
          <Box height={1} />

          {/* Diff */}
          {agentT > 3000 && (
            <Box flexDirection="column" paddingLeft={2}>
              <Text color={C.dim}>{"src/auth.ts"}</Text>
              <Text color={C.red}>{"- if (Date.now() < token.expiresAt) {"}</Text>
              <Text color={C.red}>{"-   return token;"}</Text>
              <Text color={C.green}>{"+ const BUFFER = 30_000;"}</Text>
              <Text color={C.green}>{"+ if (Date.now() < token.expiresAt - BUFFER) {"}</Text>
              <Text color={C.green}>{"+   return token;"}</Text>
              <Text color={C.green}>{"+ }"}</Text>
              <Text color={C.green}>{"+ for (let i = 0; i < 3; i++) {"}</Text>
              <Text color={C.green}>{"+   try { return await refresh(); }"}</Text>
              <Text color={C.green}>{"+   catch { await sleep(1000 * (i+1)); }"}</Text>
            </Box>
          )}
        </Box>

        <Line w={width} color={C.cyan + "30"} />
        <Box height={1} paddingX={2} flexDirection="row">
          <Text bold color={C.cyan}>{"█◆◆█ storm agent"}</Text>
          <Box flex={1} />
          <Text color={C.dim}>{"8.4K tok · $0.12 · "}</Text>
          <Text color={C.cyan}>{"████████░░"}</Text>
          <Text color={C.dim}>{" 62%"}</Text>
        </Box>
      </Box>
    );
  }

  // ── PHASE 5: End Card (21-24s) ───────────────────────────────
  const endT = t - 21000;
  return (
    <Box flexDirection="column" width={width} height={height} background={{ type: "dots", animate: true, animateSpeed: 300, dim: true, color: "#565F89" }}>
      <Box flex={1} />
      <Box flexDirection="column" alignItems="center" width={width}>
        {DIAMOND.map((line, i) => (
          <Text key={`d${i}`} bold color={C.blue}>{line}</Text>
        ))}
      </Box>
      <Box height={1} />
      <Box flexDirection="column" alignItems="center" width={width}>
        {LOGO.map((line, i) => (
          <Text key={i} bold color={C.blue}>{line}</Text>
        ))}
      </Box>
      <Box height={2} />
      {endT > 500 && (
        <Box flexDirection="row" justifyContent="center" width={width}>
          <Text bold color={C.white}>Fast. Layered. Unstoppable.</Text>
        </Box>
      )}
      {endT > 1200 && (
        <>
          <Box height={1} />
          <Box flexDirection="row" justifyContent="center" width={width} gap={2}>
            <Text color={C.blue}>97 components</Text>
            <Text color={C.dim}>·</Text>
            <Text color={C.cyan}>15 AI widgets</Text>
            <Text color={C.dim}>·</Text>
            <Text color={C.green}>83 hooks</Text>
          </Box>
        </>
      )}
      <Box flex={1} />
      <Footer accent={C.blue} />
    </Box>
  );
}

render(<App />).waitUntilExit();
