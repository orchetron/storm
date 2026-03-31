#!/usr/bin/env npx tsx
/**
 * storm agent — 3-panel AI chat demo.
 *
 * Sessions (left) | Chat (center) | File Preview/Diff (right)
 * Full-width input bar + status bar at bottom.
 *
 * Built with Storm TUI — cell-diff rendering at 18K FPS.
 */

import React, { useState, useCallback } from "react";

import {
  render,
  Box,
  Text,
  ScrollView,
  ChatInput,
  Sparkline,
  Spinner,
  Card,
  Separator,
  Collapsible,
  Canvas,
  LineChart,
  Heatmap,
  Gauge,
  GradientProgress,
  SyntaxHighlight,
  OperationTree,
  StreamingText,
  useInput,
  useTerminal,
  useTui,
  useInterval,
} from "../src/index.js";

import type { OpNode } from "../src/index.js";
import { colors } from "../src/theme/colors.js";

// ── Types ──────────────────────────────────────────────────────────────

interface CanvasData {
  nodes: import("../src/index.js").CanvasNode[];
  edges?: import("../src/index.js").CanvasEdge[];
  title?: string;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
  codeBlock?: { language: string; code: string };
  thinking?: string;
  canvas?: CanvasData;
  chart?: boolean;
  heatmap?: boolean;
}

interface Session {
  id: number;
  label: string;
  icon: string;
  active: boolean;
  unread: boolean;
}

interface DiffLine {
  type: "add" | "remove" | "context";
  num: number;
  text: string;
}

// ── Sessions ────────────────────────────────────────────────────────────

const SESSIONS: Session[] = [
  { id: 1, label: "Auth fixes", icon: "\u{1F512}", active: true, unread: false },
  { id: 2, label: "Perf tuning", icon: "\u26A1", active: false, unread: true },
  { id: 3, label: "API design", icon: "\u25C6", active: false, unread: false },
  { id: 4, label: "DB migration", icon: "\u2584", active: false, unread: false },
  { id: 5, label: "Deploy fix", icon: "\u25B2", active: false, unread: true },
];

// ── Default file preview ─────────────────────────────────────────────

const DEFAULT_PREVIEW_FILE = "src/auth/session.ts";

const DEFAULT_PREVIEW: DiffLine[] = [
  { type: "context", num: 14, text: "import { Store } from '../store';" },
  { type: "context", num: 15, text: "import { createSub } from './sub';" },
  { type: "context", num: 16, text: "" },
  { type: "context", num: 17, text: "export function useSession(" },
  { type: "context", num: 18, text: "  key: string," },
  { type: "context", num: 19, text: "  store: Store" },
  { type: "context", num: 20, text: ") {" },
  { type: "context", num: 21, text: "  useEffect(() => {" },
  { type: "remove", num: 22, text: "    store.subscribe(key, cb);" },
  { type: "add", num: 22, text: "    const unsub = store.subscribe(key, cb);" },
  { type: "add", num: 23, text: "    return () => unsub();" },
  { type: "context", num: 24, text: "  }, [key]);" },
  { type: "context", num: 25, text: "}" },
];

// ── Code response -> diff extraction ─────────────────────────────────

function extractDiff(codeBlock: { language: string; code: string }): { file: string; lines: DiffLine[] } {
  const codeLines = codeBlock.code.split("\n");
  // Extract filename from first comment line
  const fileMatch = codeLines[0]?.match(/\/\/\s*(.+\.\w+)/);
  const file = fileMatch ? fileMatch[1]! : "untitled." + codeBlock.language;
  const diffLines: DiffLine[] = [];
  let num = 1;

  for (const line of codeLines.slice(1)) {
    if (line.startsWith("// BEFORE") || line.startsWith("// AFTER")) {
      diffLines.push({ type: line.includes("BEFORE") ? "remove" : "add", num, text: line });
    } else if (line.startsWith("+") || line.trimStart().startsWith("return () =>")) {
      diffLines.push({ type: "add", num, text: line });
    } else if (line.startsWith("-")) {
      diffLines.push({ type: "remove", num, text: line });
    } else {
      diffLines.push({ type: "context", num, text: line });
    }
    num++;
  }
  return { file, lines: diffLines };
}

// ── Simulated data ─────────────────────────────────────────────────────

const ASSISTANT_RESPONSES: { text: string; codeBlock?: { language: string; code: string }; thinking?: string; canvas?: CanvasData; chart?: boolean; heatmap?: boolean }[] = [
  {
    text: "Here's the fix for the race condition in the event loop:",
    thinking: "The user's processQueue function calls itself recursively without draining. Each recursive call stacks on the microtask queue. If events arrive faster than processing, the queue grows unbounded. Fix: use queueMicrotask for tail-call optimization, batch drain with configurable MAX_BATCH, and add a circuit breaker.",
    codeBlock: {
      language: "typescript",
      code: `// src/queue/processor.ts
async function processQueue(queue: EventQueue) {
  const batch = queue.drain(MAX_BATCH);
  await Promise.allSettled(
    batch.map(evt => handler.process(evt))
  );
  if (!queue.isEmpty) queueMicrotask(() =>
    processQueue(queue)
  );
}`,
    },
  },
  {
    text: "Here's the full system architecture. I've mapped every service, its dependencies, and current health:",
    thinking: "Mapping the full microservices topology across 4 infrastructure layers. Tracing request flow: Client -> CDN -> WAF -> LB -> API Gateway (auth + rate limit + routing) -> Services (each with own DB connections) -> Event Bus for async. Monitoring sidecar on every service. 2 services showing degraded health.",
    canvas: {
      nodes: [
        {
          id: "infra", type: "container", label: "Production Infrastructure", icon: "\u26A1",
          direction: "vertical", color: colors.brand.primary,
          children: [
            {
              id: "edge", type: "container", label: "Edge", borderStyle: "single",
              direction: "horizontal", gap: 1,
              children: [
                { id: "client", type: "box", label: "Clients", sublabel: "Web + Mobile", icon: "\u25C6" },
                { id: "cdn", type: "box", label: "CDN", sublabel: "CloudFront", status: "success" },
                { id: "waf", type: "box", label: "WAF", sublabel: "Rate + DDoS", status: "success" },
                { id: "lb", type: "box", label: "ALB", sublabel: "3 AZs", status: "success" },
              ],
            },
            {
              id: "gw", type: "container", label: "API Gateway", icon: "\u25C6",
              direction: "vertical", color: colors.brand.primary,
              children: [
                {
                  id: "gw-mid", type: "container", borderStyle: "none",
                  direction: "horizontal", gap: 1,
                  children: [
                    { id: "jwt", type: "box", label: "JWT Auth", status: "success" },
                    { id: "rbac", type: "box", label: "RBAC", status: "success" },
                    { id: "rlimit", type: "box", label: "Rate Limit", sublabel: "10K/min", status: "warning" },
                    { id: "circuit", type: "box", label: "Circuit Breaker", status: "success" },
                  ],
                },
                {
                  id: "routes", type: "container", label: "Routes", borderStyle: "none",
                  direction: "vertical",
                  children: [
                    { id: "rt1", type: "text", label: "POST /api/v1/users    \u2192 UserService", dim: true },
                    { id: "rt2", type: "text", label: "GET  /api/v1/orders   \u2192 OrderService", dim: true },
                    { id: "rt3", type: "text", label: "WS   /realtime        \u2192 RealtimeService", dim: true },
                    { id: "rt4", type: "text", label: "GET  /api/v1/search   \u2192 SearchService", dim: true },
                  ],
                },
              ],
            },
            {
              id: "svc", type: "container", label: "Services", borderStyle: "single",
              direction: "horizontal", gap: 1,
              children: [
                {
                  id: "user-svc", type: "container", label: "User", direction: "vertical", borderStyle: "round",
                  status: "success",
                  children: [
                    { id: "u1", type: "text", label: "3 pods", dim: true },
                    { id: "u2", type: "text", label: "p99: 45ms", dim: true },
                  ],
                },
                {
                  id: "order-svc", type: "container", label: "Order", direction: "vertical", borderStyle: "round",
                  status: "warning",
                  children: [
                    { id: "o1", type: "text", label: "2 pods", dim: true },
                    { id: "o2", type: "text", label: "p99: 230ms \u26A0", dim: true },
                  ],
                },
                {
                  id: "rt-svc", type: "container", label: "Realtime", direction: "vertical", borderStyle: "round",
                  status: "success",
                  children: [
                    { id: "ws1", type: "text", label: "4 pods", dim: true },
                    { id: "ws2", type: "text", label: "12K conns", dim: true },
                  ],
                },
                {
                  id: "search-svc", type: "container", label: "Search", direction: "vertical", borderStyle: "round",
                  status: "error",
                  children: [
                    { id: "s1", type: "text", label: "1 pod \u2717", dim: true },
                    { id: "s2", type: "text", label: "restarting", dim: true },
                  ],
                },
              ],
            },
            { id: "kafka", type: "divider", label: "Event Bus (Kafka) \u2014 Topics: user.created, order.placed, search.index" },
            {
              id: "data", type: "container", label: "Data", borderStyle: "single",
              direction: "horizontal", gap: 1,
              children: [
                { id: "pg", type: "box", label: "PostgreSQL", sublabel: "Primary + 2 replicas", status: "success" },
                { id: "redis", type: "box", label: "Redis Cluster", sublabel: "Cache + Pub/Sub", status: "success" },
                { id: "elastic", type: "box", label: "Elasticsearch", sublabel: "3-node cluster", status: "error" },
                { id: "s3", type: "box", label: "S3", sublabel: "Media + Logs", status: "success" },
              ],
            },
          ],
        },
      ],
      edges: [
        { from: "client", to: "cdn" },
        { from: "cdn", to: "waf" },
        { from: "waf", to: "lb" },
        { from: "jwt", to: "rbac" },
        { from: "rbac", to: "rlimit" },
        { from: "rlimit", to: "circuit" },
        { from: "pg", to: "redis" },
        { from: "redis", to: "elastic" },
        { from: "elastic", to: "s3" },
      ],
    },
  },
  {
    text: "Found the memory leak \u2014 the subscription manager doesn't clean up on unmount. Here's the fix:",
    thinking: "Scanning 847 files... Found 23 useEffect hooks. 19 have proper cleanup. 4 are missing return statements. The store.subscribe in UserProvider.tsx line 42 is the worst offender \u2014 leaks ~2KB per navigation.",
    codeBlock: {
      language: "typescript",
      code: `// src/providers/UserProvider.tsx
useEffect(() => {
  const unsub = store.subscribe(key, cb);
  return () => unsub(); // was missing
}, [key]);`,
    },
  },
  {
    text: "I pulled the latency data from the last 24 hours. The spike at 14:00 correlates with the Elasticsearch node failure:",
    thinking: "Querying Prometheus for p99 latency across all services. Time range: 24h. Resolution: 15min buckets. UserService stable at 40-50ms. OrderService shows gradual increase from 80ms to 230ms (connection pool). SearchService has a clear spike at 14:00 from 100ms to 1200ms (ES node crash). RealtimeService flat at 5-8ms.",
    chart: true,
  },
  {
    text: "Found 3 critical security issues in the auth module. The rate limiter bypass is P0 \u2014 it allows unauthenticated requests to bypass the 10K/min limit by spoofing X-Forwarded-For:",
    thinking: "Reviewing auth/ directory (12 files, 2.4K lines). The JWT refresh logic at auth/refresh.ts:34 has no retry \u2014 a single network timeout kills the session. The cookie config at auth/session.ts:18 is missing SameSite=Strict. Most critically, the rate limiter at auth/rateLimit.ts:52 trusts X-Forwarded-For without validation.",
    codeBlock: {
      language: "typescript",
      code: `// src/auth/rateLimit.ts
// BEFORE (vulnerable):
const ip = req.headers["x-forwarded-for"];
rateLimiter.check(ip); // spoofable!

// AFTER (fixed):
const ip = req.socket.remoteAddress;
rateLimiter.check(ip); // real IP`,
    },
  },
  {
    text: "Here's the error rate heatmap across all services for the past 6 hours. The SearchService spike at 14:00 is clearly visible:",
    thinking: "Querying error rate metrics from Prometheus. Aggregating by service and hour. Normalizing to errors/minute. The heatmap shows a clear correlation between the Elasticsearch node failure and SearchService error spike. OrderService shows elevated errors during the same period due to cascading failures.",
    heatmap: true,
  },
];

let responseIndex = 0;
function nextResponse() {
  const resp = ASSISTANT_RESPONSES[responseIndex % ASSISTANT_RESPONSES.length]!;
  responseIndex++;
  return resp;
}

// ── Activity operations ────────────────────────────────────────────────

function makeOperations(phase: number): OpNode[] {
  const ops: OpNode[][] = [
    [
      { id: "scan", label: "Scanning codebase", status: "completed", durationMs: 1240 },
      { id: "index", label: "Building index", status: "completed", durationMs: 890 },
      { id: "analyze", label: "Static analysis", status: "completed", durationMs: 2100 },
      { id: "read", label: "Reading src/auth/session.ts", status: "running" },
      { id: "plan", label: "Planning changes", status: "pending" },
      { id: "apply", label: "Applying patches", status: "pending" },
    ],
    [
      { id: "scan", label: "Scanning codebase", status: "completed", durationMs: 1240 },
      { id: "index", label: "Building index", status: "completed", durationMs: 890 },
      { id: "analyze", label: "Static analysis", status: "completed", durationMs: 2100 },
      { id: "read", label: "Reading src/auth/session.ts", status: "completed", durationMs: 340 },
      { id: "plan", label: "Planning changes", status: "running" },
      { id: "apply", label: "Applying patches", status: "pending" },
    ],
    [
      { id: "scan", label: "Scanning codebase", status: "completed", durationMs: 1240 },
      { id: "index", label: "Building index", status: "completed", durationMs: 890 },
      { id: "analyze", label: "Static analysis", status: "completed", durationMs: 2100 },
      { id: "read", label: "Reading src/auth/session.ts", status: "completed", durationMs: 340 },
      { id: "plan", label: "Planning changes", status: "completed", durationMs: 560 },
      { id: "apply", label: "Applying patches", status: "running" },
    ],
    [
      { id: "scan", label: "Scanning codebase", status: "completed", durationMs: 1240 },
      { id: "index", label: "Building index", status: "completed", durationMs: 890 },
      { id: "analyze", label: "Static analysis", status: "completed", durationMs: 2100 },
      { id: "read", label: "Reading src/auth/session.ts", status: "completed", durationMs: 340 },
      { id: "plan", label: "Planning changes", status: "completed", durationMs: 560 },
      { id: "apply", label: "Applying patches", status: "completed", durationMs: 1830 },
    ],
  ];
  return ops[phase % ops.length]!;
}

// ── Components ─────────────────────────────────────────────────────────

// ── Sessions Panel ────────────────────────────────────────────────────

function SessionsPanel({
  sessions,
  activeSession,
  onSelect,
  height,
  focused,
}: {
  sessions: Session[];
  activeSession: number;
  onSelect: (id: number) => void;
  height: number;
  focused: boolean;
}) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={focused ? colors.brand.primary : colors.divider}
      height={height}
      overflow="hidden"
    >
      {/* Panel title */}
      <Box height={1} paddingX={1}>
        <Text bold color={focused ? colors.brand.primary : colors.text.secondary} wrap="truncate">Sessions</Text>
        <Box flex={1} />
        <Text color={colors.text.dim}>{sessions.length}</Text>
      </Box>
      <Separator style="line" color={colors.divider} />

      {/* Session list */}
      <Box flexDirection="column" paddingX={1} flex={1} overflow="hidden">
        {sessions.map((s) => {
          const isActive = s.id === activeSession;
          return (
            <Box key={s.id} height={1} flexDirection="row">
              <Text color={isActive ? colors.brand.primary : colors.text.dim}>
                {isActive ? "\u25CF " : "  "}
              </Text>
              <Text
                bold={isActive}
                color={isActive ? colors.text.primary : colors.text.secondary}
              >
                {"#"}{s.id}{" "}
              </Text>
              <Text color={isActive ? colors.text.dim : colors.text.disabled}>{s.icon} </Text>
              <Text
                color={isActive ? colors.text.primary : colors.text.dim}
                wrap="truncate"
              >
                {s.label}
              </Text>
              {s.unread && !isActive ? (
                <Text color={colors.brand.light}>{" \u2022"}</Text>
              ) : null}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ── Chat Header ───────────────────────────────────────────────────────

function ChatHeader({ width, isStreaming }: { width: number; isStreaming: boolean }) {
  return (
    <Box height={1} flexDirection="row" paddingX={1} width={width} backgroundColor={colors.surface.raised}>
      {isStreaming ? (
        <Spinner type="flywheel" color={colors.brand.primary} />
      ) : (
        <Text bold color={colors.brand.primary}>{"\u28FF"}</Text>
      )}
      <Text bold color={colors.brand.primary}>{" storm"}</Text>
      <Text bold color={colors.text.primary}>{" agent"}</Text>
      <Text color={colors.text.dim}>{" \u00B7 qwen-2.5-72b"}</Text>
      <Box flex={1} />
      <Text color={colors.success}>{"\u25CF "}</Text>
      <Text color={colors.text.secondary}>connected</Text>
    </Box>
  );
}

// ── Animated Storm Banner ─────────────────────────────────────────────

const STORM_LOGO = [
  "        \u28E0\u28FE\u28FF\u28FF\u28FF\u28F7\u2844        ",
  "      \u28F4\u28FF\u28FF\u287F\u2809\u2809\u28BF\u28FF\u28FF\u28E6      ",
  "    \u28F0\u28FF\u28FF\u280F\u2800    \u2808\u283B\u28FF\u28FF\u28C6    ",
  "   \u28FC\u28FF\u287F\u2800  \u26A1 storm  \u2808\u28BF\u28FF\u28A7   ",
  "  \u28FE\u28FF\u279F        \u2809\u2809    \u28BB\u28FF\u28F7  ",
  "  \u28FF\u28FF\u2847   cell-diff \u00B7   \u28F8\u28FF\u28FF  ",
  "  \u28FF\u28FF\u2847   zero-flicker   \u28F8\u28FF\u28FF  ",
  "  \u28BB\u28FF\u28F7\u28C0    18K FPS    \u28C0\u28FE\u28FF\u279F  ",
  "   \u28BB\u28FF\u28FF\u28E6\u28C0        \u28C0\u28F4\u28FF\u28FF\u279F   ",
  "    \u2819\u28FF\u28FF\u28FF\u28F6\u28E4\u28C0\u28C0\u28E4\u28F6\u28FF\u28FF\u28FF\u280B    ",
  "      \u2819\u28BF\u28FF\u28FF\u28FF\u28FF\u28FF\u28FF\u287F\u280B      ",
  "        \u2808\u2809\u2819\u283B\u283B\u2809\u2809\u2808        ",
];

const SHIMMER_COLORS = ["#033D47", "#055E6D", "#078093", "#06B6D4", "#22D3EE", "#06B6D4", "#078093", "#055E6D"];

function Banner({ width, frame }: { width: number; frame: number }) {
  const padLeft = Math.max(0, Math.floor((width - 34) / 2));
  const pad = " ".repeat(padLeft);
  const colorIdx = frame % SHIMMER_COLORS.length;

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      {STORM_LOGO.map((line, i) => {
        const c = SHIMMER_COLORS[(colorIdx + i) % SHIMMER_COLORS.length]!;
        return (
          <Box key={i} flexDirection="row">
            <Text color={c}>{pad}{line}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

// ── Message components ────────────────────────────────────────────────

function SystemMessage({ content }: { content: string }) {
  return (
    <Box justifyContent="center">
      <Text italic color={colors.text.dim}>{"    "}{content}</Text>
    </Box>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <Box flexDirection="row" paddingLeft={2}>
      <Text color={colors.brand.light} bold>{"\u276F "}</Text>
      <Text color={colors.text.primary}>{content}</Text>
    </Box>
  );
}

function AssistantMessage({ message, chatWidth }: { message: Message; chatWidth: number }) {
  const isThinkingPhase = message.streaming && message.thinking !== undefined && !message.content;

  return (
    <Box flexDirection="column" paddingLeft={2} paddingRight={1} gap={1}>
      {/* Thinking phase */}
      {isThinkingPhase ? (
        <Box marginLeft={3} marginRight={1}>
          <Collapsible title="Thinking..." expanded={true} color={colors.text.dim}>
            <Box flexDirection="row" gap={1}>
              <Spinner type="flywheel" color={colors.text.dim} />
              <Text dim italic color={colors.text.dim}>{message.thinking}</Text>
            </Box>
          </Collapsible>
        </Box>
      ) : null}


      {/* Main message */}
      {message.content ? (
        <Box flexDirection="row" gap={1}>
          {message.streaming ? (
            <Spinner type="flywheel" color={colors.brand.primary} />
          ) : (
            <Text color={colors.brand.primary} bold>{"\u25C6"}</Text>
          )}
          {message.streaming ? (
            <StreamingText text={message.content} streaming={true} color={colors.text.primary} />
          ) : (
            <Text color={colors.text.primary}>{message.content}</Text>
          )}
        </Box>
      ) : null}

      {/* Code block */}
      {message.codeBlock ? (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={colors.text.disabled}
          paddingX={1}
          marginLeft={3}
          marginRight={1}
          overflow="hidden"
        >
          <Text color={colors.text.secondary} wrap="truncate">{message.codeBlock.language}</Text>
          <SyntaxHighlight code={message.codeBlock.code.split("\n").slice(0, 10).join("\n")} language={message.codeBlock.language} />
        </Box>
      ) : null}

      {/* Canvas */}
      {message.canvas ? (
        <Box marginLeft={3} marginRight={1}>
          <Canvas
            nodes={message.canvas.nodes}
            edges={message.canvas.edges}
            title={message.canvas.title}
          />
        </Box>
      ) : null}

      {/* LineChart */}
      {message.chart ? (
        <Box marginLeft={3} marginRight={1} flexDirection="column">
          <LineChart
            series={[
              { name: "UserService", color: colors.success, data: [42,45,43,48,44,46,45,50,47,44,43,45,48,46,44,43,45,47,44,42,45,43,46,48] },
              { name: "OrderService", color: colors.warning, data: [80,85,82,90,95,105,120,140,160,180,195,210,220,225,230,228,225,220,215,210,200,195,190,185] },
              { name: "SearchService", color: colors.error, data: [95,100,98,102,105,100,98,105,110,108,450,850,1100,1200,1150,980,750,500,350,250,180,150,130,115] },
            ]}
            width={Math.max(30, chatWidth - 12)}
            height={10}
            showAxes={true}
            showLegend={true}
            showGrid={true}
            showPoints={true}
            xLabels={["00:00", "06:00", "12:00", "18:00", "24:00"]}
            title="p99 Latency (ms) \u2014 24h"
          />
        </Box>
      ) : null}

      {/* Heatmap */}
      {message.heatmap ? (
        <Box marginLeft={3} marginRight={1}>
          <Heatmap
            data={[
              [2, 1, 3, 1, 2, 1, 0, 1, 2, 1, 5, 8],
              [5, 3, 4, 6, 8, 12, 15, 22, 35, 28, 18, 10],
              [1, 2, 1, 0, 1, 2, 1, 3, 85, 120, 95, 45],
              [0, 1, 0, 0, 1, 0, 1, 0, 1, 2, 1, 0],
            ]}
            rowLabels={["User", "Order", "Search", "Realtime"]}
            colLabels={["09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"]}
            title="Errors/min by Service (6h)"
            cellWidth={4}
          />
        </Box>
      ) : null}
    </Box>
  );
}

function MessageView({ message, chatWidth }: { message: Message; chatWidth: number }) {
  if (message.role === "system") return <SystemMessage content={message.content} />;
  if (message.role === "user") return <UserMessage content={message.content} />;
  return <AssistantMessage message={message} chatWidth={chatWidth} />;
}

// ── Preview Panel (right) ─────────────────────────────────────────────

function PreviewPanel({
  file,
  lines,
  height,
  ops,
  tokens,
  cost,
}: {
  file: string;
  lines: DiffLine[];
  height: number;
  ops: OpNode[];
  tokens: number;
  cost: number;
}) {
  // Inner width for charts (panel border=2 + paddingX=2 = 4 consumed)
  const previewInnerWidth = Math.max(8, 20);
  // Truncate filename if needed
  const maxFileLen = 18;
  const displayFile = file.length > maxFileLen
    ? "\u2026" + file.slice(file.length - maxFileLen + 1)
    : file;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.divider}
      height={height}
      overflow="hidden"
    >
      {/* Panel title with filename */}
      <Box height={1} paddingX={1}>
        <Text bold color={colors.text.secondary}>Preview</Text>
        <Box flex={1} />
        <Text color={colors.text.dim} italic wrap="truncate">{displayFile}</Text>
      </Box>
      <Separator style="line" color={colors.divider} />

      {/* Diff/file lines */}
      <ScrollView flex={1} scrollSpeed={2}>
        <Box flexDirection="column" paddingX={1} overflow="hidden">
          {lines.map((line, i) => {
            const lineNum = String(line.num).padStart(3, " ");
            const marker = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
            const lineColor = line.type === "add"
              ? colors.diff.added
              : line.type === "remove"
                ? colors.diff.removed
                : colors.text.dim;
            const bgColor = line.type === "add"
              ? colors.diff.addedBg
              : line.type === "remove"
                ? colors.diff.removedBg
                : undefined;

            return (
              <Box key={i} height={1} flexDirection="row" {...(bgColor ? { backgroundColor: bgColor } : {})}>
                <Text color={colors.text.disabled}>{lineNum}</Text>
                <Text color={lineColor} bold={line.type !== "context"}>{marker}</Text>
                <Text color={line.type === "context" ? colors.text.dim : lineColor} wrap="truncate">{line.text}</Text>
              </Box>
            );
          })}
        </Box>
      </ScrollView>

      {/* Activity — takes some flex space */}
      <Separator style="line" color={colors.divider} />
      <Box paddingX={1} overflow="hidden" flexShrink={0}>
        <OperationTree nodes={ops} showDuration={false} />
      </Box>

      {/* Metrics — fixed at bottom */}
      <Separator style="line" color={colors.divider} />
      <Box paddingX={1} flexDirection="column" overflow="hidden">
        <Box flexDirection="row" justifyContent="space-between">
          <Text color={colors.text.secondary}>Tokens</Text>
          <Text bold color={colors.text.primary}>{tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}K` : tokens}</Text>
        </Box>
        <Box flexDirection="row" justifyContent="space-between">
          <Text color={colors.text.secondary}>Cost</Text>
          <Text bold color={colors.text.primary}>${cost.toFixed(3)}</Text>
        </Box>
        <Gauge
          value={Math.min(100, Math.round((tokens / 200000) * 100))}
          width={previewInnerWidth}
          color={colors.brand.primary}
          showValue={true}
          label="ctx"
        />
      </Box>
    </Box>
  );
}

// ── Input Bar ─────────────────────────────────────────────────────────

function InputBar({
  input,
  setInput,
  onSubmit,
  history,
  availableWidth,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (v: string) => void;
  history: string[];
  availableWidth: number;
}) {
  // border (2) + paddingX (2) + prompt "❯ " (2) = 6 chars consumed
  const wrapWidth = Math.max(10, availableWidth - 6);
  return (
    <Box borderStyle="round" borderColor={colors.brand.glow} flexDirection="row" paddingX={1}>
      <Text color={colors.brand.primary} bold>{"\u276F "}</Text>
      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={onSubmit}
        placeholder="Type a message..."
        placeholderColor={colors.text.dim}
        color={colors.text.primary}
        history={history}
        flex={1}
        maxRows={4}
        width={wrapWidth}
      />
    </Box>
  );
}

// ── Status / Key Bar ──────────────────────────────────────────────────

function StatusBar({ model, msgCount, tokens, cost }: { model: string; msgCount: number; tokens: number; cost: number }) {
  const tokenStr = tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}K` : `${tokens}`;
  return (
    <Box height={1} flexDirection="row" paddingX={1}>
      <Text color={colors.brand.primary} bold>{"\u28FF"}</Text>
      <Text color={colors.text.dim}>{" storm"}</Text>
      <Text color={colors.text.disabled}>{" \u00B7 "}</Text>
      <Text color={colors.text.dim} wrap="truncate">{model}</Text>
      <Text color={colors.text.disabled}>{" \u00B7 "}</Text>
      <Text color={colors.brand.glow}>{"cell-diff"}</Text>
      <Text color={colors.text.disabled}>{" \u00B7 "}</Text>
      <Text color={colors.text.dim}>{tokenStr} tok</Text>
      <Text color={colors.text.disabled}>{" \u00B7 "}</Text>
      <Text color={colors.text.dim}>{"$"}{cost.toFixed(3)}</Text>
      <Text color={colors.text.disabled}>{" \u00B7 "}</Text>
      <Text color={colors.text.dim} wrap="truncate">{msgCount} msgs</Text>
      <Box flex={1} />
      <Text color={colors.text.disabled}>Tab</Text>
      <Text color={colors.text.dim}>:focus</Text>
      <Text color={colors.text.disabled}>{" \u00B7 "}</Text>
      <Text color={colors.text.disabled}>[</Text>
      <Text color={colors.text.dim}>:sessions</Text>
      <Text color={colors.text.disabled}>{" \u00B7 "}</Text>
      <Text color={colors.text.disabled}>]</Text>
      <Text color={colors.text.dim}>:preview</Text>
      <Text color={colors.text.disabled}>{" \u00B7 "}</Text>
      <Text color={colors.text.disabled}>Enter</Text>
      <Text color={colors.text.dim}>:send</Text>
      <Text color={colors.text.disabled}>{" \u00B7 "}</Text>
      <Text color={colors.text.disabled}>C-c</Text>
      <Text color={colors.text.dim}>:exit</Text>
    </Box>
  );
}

// ── Main App ───────────────────────────────────────────────────────────

function App() {
  const { width, height, exit } = useTerminal();
  const { flushSync } = useTui();

  // ── State ──────────────────────────────────────────────────────────
  const [activeSession, setActiveSession] = useState(1);
  const [focusPanel, setFocusPanel] = useState<"sessions" | "chat">("chat");
  const [showSessions, setShowSessions] = useState(true);
  const [showPreview, setShowPreview] = useState(true);

  const [previewFile, setPreviewFile] = useState(DEFAULT_PREVIEW_FILE);
  const [previewLines, setPreviewLines] = useState<DiffLine[]>(DEFAULT_PREVIEW);

  const [messages, setMessages] = useState<Message[]>([
    { role: "system", content: "Session started \u00B7 qwen-2.5-72b \u00B7 128K context" },
    {
      role: "assistant",
      content: "Hello. I'm connected to your codebase and ready to help. What would you like to work on?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [bannerFrame, setBannerFrame] = useState(0);
  const [showBanner, setShowBanner] = useState(true);

  // Animate banner shimmer
  useInterval(() => {
    if (showBanner) flushSync(() => setBannerFrame((f) => f + 1));
  }, 200);

  // Auto-dismiss banner after ~6 seconds
  useInterval(() => {
    if (showBanner && bannerFrame > 30) flushSync(() => setShowBanner(false));
  }, 100);
  const [history, setHistory] = useState<string[]>([]);
  const [tokens, setTokens] = useState(2480);
  const [cost, setCost] = useState(0.004);
  const [opPhase, setOpPhase] = useState(0);
  const [showingVisualization, setShowingVisualization] = useState(false);
  const [streamWordCount, setStreamWordCount] = useState(0);
  const [streamTotalWords, setStreamTotalWords] = useState(0);

  // ── Cycle operations ─────────────────────────────────────────────
  useInterval(() => {
    if (isStreaming) {
      flushSync(() => setOpPhase((p) => p + 1));
    }
  }, 600);

  useInterval(() => {
    if (!isStreaming) {
      flushSync(() => setOpPhase((p) => p + 1));
    }
  }, 3000);

  // ── Global shortcuts ───────────────────────────────────────────────
  useInput(
    useCallback(
      (e) => {
        if (e.key === "c" && e.ctrl) exit();
        if (e.key === "l" && e.ctrl) {
          flushSync(() =>
            setMessages([{ role: "system", content: "Cleared." }]),
          );
        }
        // [ and ] toggle side panels
        if (e.char === "[") {
          flushSync(() => setShowSessions((p) => !p));
          return;
        }
        if (e.char === "]") {
          flushSync(() => setShowPreview((p) => !p));
          return;
        }
        // Tab cycles focus
        if (e.key === "tab") {
          flushSync(() =>
            setFocusPanel((prev) => prev === "sessions" ? "chat" : "sessions"),
          );
          return;
        }
        // Arrow up/down to change session when sessions panel focused
        if (focusPanel === "sessions") {
          if (e.key === "up") {
            flushSync(() =>
              setActiveSession((prev) => Math.max(1, prev - 1)),
            );
            return;
          }
          if (e.key === "down") {
            flushSync(() =>
              setActiveSession((prev) => Math.min(SESSIONS.length, prev + 1)),
            );
            return;
          }
        }
      },
      [exit, flushSync, focusPanel],
    ),
  );

  // ── Streaming simulation ──────────────────────────────────────────
  const simulateResponse = useCallback(() => {
    const response = nextResponse();
    const thinkingWords = response.thinking ? response.thinking.split(" ") : [];
    const responseWords = response.text.split(" ");
    let phase: "thinking" | "responding" = thinkingWords.length > 0 ? "thinking" : "responding";
    let wordIndex = 0;

    flushSync(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
          streaming: true,
          ...(phase === "thinking" ? { thinking: "" } : {}),
        },
      ]);
      setIsStreaming(true);
      setStreamWordCount(0);
      setStreamTotalWords(responseWords.length + thinkingWords.length);
    });

    const streamInterval = setInterval(() => {
      wordIndex++;

      if (phase === "thinking") {
        if (wordIndex >= thinkingWords.length) {
          phase = "responding";
          wordIndex = 0;
          flushSync(() => {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1]!;
              updated[updated.length - 1] = {
                ...last,
                thinking: thinkingWords.join(" "),
                content: "",
                streaming: true,
              };
              return updated;
            });
          });
          return;
        }
        flushSync(() => {
          setStreamWordCount(wordIndex);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1]!;
            updated[updated.length - 1] = {
              ...last,
              thinking: thinkingWords.slice(0, wordIndex).join(" "),
            };
            return updated;
          });
        });
      } else {
        if (wordIndex >= responseWords.length) {
          clearInterval(streamInterval);
          const hasViz = !!(response.canvas || response.chart || response.heatmap);
          flushSync(() => {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1]!;
              updated[updated.length - 1] = {
                ...last,
                content: responseWords.join(" "),
                streaming: false,
                ...(response.codeBlock ? { codeBlock: response.codeBlock } : {}),
                ...(response.canvas ? { canvas: response.canvas } : {}),
                ...(response.chart ? { chart: response.chart } : {}),
                ...(response.heatmap ? { heatmap: response.heatmap } : {}),
              };
              return updated;
            });
            setIsStreaming(false);
            setStreamWordCount(0);
            setStreamTotalWords(0);
            if (hasViz) setShowingVisualization(true);
            setTokens((t) => t + 380 + Math.floor(Math.random() * 600));
            setCost((c) => c + 0.002 + Math.random() * 0.005);

            // Update preview panel with diff if code response
            if (response.codeBlock) {
              const diff = extractDiff(response.codeBlock);
              setPreviewFile(diff.file);
              setPreviewLines(diff.lines);
            }
          });
          return;
        }
        flushSync(() => {
          setStreamWordCount(thinkingWords.length + wordIndex);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1]!;
            updated[updated.length - 1] = {
              ...last,
              content: responseWords.slice(0, wordIndex).join(" "),
            };
            return updated;
          });
        });
      }
    }, 30 + Math.random() * 40);
  }, [flushSync]);

  // ── Submit handler ─────────────────────────────────────────────────
  const handleSubmit = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) return;
      flushSync(() => {
        setMessages((prev) => [...prev, { role: "user", content: text }]);
        setHistory((prev) => [...prev, text]);
        setInput("");
        setTokens((t) => t + text.split(" ").length * 4);
        setShowingVisualization(false);
        // Switch focus to chat on submit
        setFocusPanel("chat");
      });
      setTimeout(simulateResponse, 300 + Math.random() * 400);
    },
    [flushSync, isStreaming, simulateResponse],
  );

  // ── Layout calculations ────────────────────────────────────────────
  const sessionsPanelWidth = Math.max(16, Math.floor(width * 0.14));
  const previewPanelWidth = Math.max(26, Math.floor(width * 0.25));
  const ops = makeOperations(opPhase);

  // In visualization mode, collapse the preview panel to give chat more room
  const vizMode = showingVisualization;
  const effectiveSessionsWidth = showSessions ? sessionsPanelWidth : 0;
  const effectivePreviewWidth = (showPreview && !vizMode) ? previewPanelWidth : 0;
  const chatWidth = width - effectiveSessionsWidth - effectivePreviewWidth;

  // Streaming progress
  const streamProgress = streamTotalWords > 0
    ? Math.min(100, Math.round((streamWordCount / streamTotalWords) * 100))
    : 0;

  // Height for the 3 main panels (total - header(2) - separator(1) - input(3) - status(1))
  const panelHeight = height - 6;

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* ── Top header bar ─────────────────────────────────────────── */}
      <ChatHeader width={width} isStreaming={isStreaming} />

      {/* ── 3-panel main content ───────────────────────────────────── */}
      <Box flex={1} flexDirection="row">
        {/* Left: Sessions panel (toggle with [) */}
        {showSessions ? (
          <Box width={sessionsPanelWidth} overflow="hidden">
            <SessionsPanel
              sessions={SESSIONS}
              activeSession={activeSession}
              onSelect={(id) => flushSync(() => setActiveSession(id))}
              height={panelHeight}
              focused={focusPanel === "sessions"}
            />
          </Box>
        ) : null}

        {/* Center: Chat */}
        <Box flex={1} flexDirection="column" overflow="hidden">
          <ScrollView flex={1} scrollSpeed={3} stickToBottom={true}>
            <Box flexDirection="column" gap={1} paddingY={1}>
              {showBanner ? <Banner width={chatWidth} frame={bannerFrame} /> : null}
              {messages.map((msg, i) => (
                <MessageView key={i} message={msg} chatWidth={chatWidth} />
              ))}
            </Box>
          </ScrollView>

        </Box>

        {/* Right: Preview/Diff panel (toggle with ]) */}
        {showPreview && !vizMode ? (
          <Box width={previewPanelWidth} overflow="hidden">
            <PreviewPanel
              file={previewFile}
              lines={previewLines}
              height={panelHeight}
              ops={ops}
              tokens={tokens}
              cost={cost}
            />
          </Box>
        ) : null}
      </Box>

      {/* ── Separator above input ──────────────────────────────────── */}
      <Separator style="line" color={colors.divider} width={width} />

      {/* ── Full-width input bar ───────────────────────────────────── */}
      <InputBar
        input={input}
        setInput={setInput}
        onSubmit={handleSubmit}
        history={history}
        availableWidth={width}
      />

      {/* ── Status / keybindings bar ───────────────────────────────── */}
      <StatusBar model="qwen-2.5-72b" msgCount={messages.length} tokens={tokens} cost={cost} />
    </Box>
  );
}

// ── Entry ──────────────────────────────────────────────────────────────

const app = render(<App />);
await app.waitUntilExit();
