#!/usr/bin/env npx tsx
/**
 * storm agent — multi-pane AI agent dashboard.
 *
 * Bloomberg terminal meets Linear — multi-pane agent UI.
 * Cell-based diff rendering, zero flicker, real terminal cursor.
 */

import React, { useState, useCallback } from "react";

import {
  render,
  Box,
  Text,
  ScrollView,
  TextInput,
  Sparkline,
  Spinner,
  Card,
  Separator,
  Collapsible,
  Canvas,
  LineChart,
  BarChart,
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

// ── Simulated data ─────────────────────────────────────────────────────

const ASSISTANT_RESPONSES: { text: string; codeBlock?: { language: string; code: string }; thinking?: string; canvas?: CanvasData }[] = [
  {
    text: "Here's the fix for the race condition in the event loop:",
    thinking: "The user's processQueue function calls itself recursively without draining. Each recursive call stacks on the microtask queue. If events arrive faster than processing, the queue grows unbounded. Fix: use queueMicrotask for tail-call optimization, batch drain with configurable MAX_BATCH, and add a circuit breaker.",
    codeBlock: {
      language: "typescript",
      code: `async function processQueue(queue: EventQueue) {
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
    thinking: "Mapping the full microservices topology across 4 infrastructure layers. Tracing request flow: Client \u2192 CDN \u2192 WAF \u2192 LB \u2192 API Gateway (auth + rate limit + routing) \u2192 Services (each with own DB connections) \u2192 Event Bus for async. Monitoring sidecar on every service. 2 services showing degraded health.",
    canvas: {
      nodes: [
        {
          id: "infra", type: "container", label: "Production Infrastructure", icon: "\u26A1",
          direction: "vertical", color: colors.brand.primary,
          children: [
            // Edge layer
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
            // Gateway layer with nested auth
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
            // Services layer
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
            // Async layer
            { id: "kafka", type: "divider", label: "Event Bus (Kafka) \u2014 Topics: user.created, order.placed, search.index" },
            // Data layer
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
      code: `useEffect(() => {
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
      code: `// BEFORE (vulnerable):
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

// ── Animated storm logo ────────────────────────────────────────────────

const STORM_LOGO = [
  "        ⣠⣾⣿⣿⣿⣷⣄        ",
  "      ⣴⣿⣿⡿⠛⠛⢿⣿⣿⣦      ",
  "    ⣰⣿⣿⠟⠁    ⠈⠻⣿⣿⣆    ",
  "   ⣼⣿⡿⠁  ⚡ storm  ⠈⢿⣿⣧   ",
  "  ⣾⣿⡟        ⠉⠉    ⢻⣿⣷  ",
  "  ⣿⣿⡇   cell-diff ·   ⢸⣿⣿  ",
  "  ⣿⣿⡇   zero-flicker   ⢸⣿⣿  ",
  "  ⢻⣿⣷⡀    18K FPS    ⣀⣾⣿⡟  ",
  "   ⢻⣿⣿⣦⡀        ⢀⣴⣿⣿⡟   ",
  "    ⠙⣿⣿⣿⣶⣤⣀⣀⣤⣶⣿⣿⣿⠋    ",
  "      ⠙⢿⣿⣿⣿⣿⣿⣿⡿⠋      ",
  "        ⠈⠛⠿⠿⠿⠛⠁        ",
];

// Shimmer colors cycle through teal shades
const SHIMMER_COLORS = ["#033D47", "#055E6D", "#078093", "#06B6D4", "#22D3EE", "#06B6D4", "#078093", "#055E6D"];

function Banner({ width, frame }: { width: number; frame: number }) {
  const padLeft = Math.max(0, Math.floor((width - 34) / 2));
  const pad = " ".repeat(padLeft);
  const colorIdx = frame % SHIMMER_COLORS.length;

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      {STORM_LOGO.map((line, i) => {
        // Each line gets a slightly offset color for wave effect
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

function Header({ width }: { width: number }) {
  return (
    <Box flexDirection="column" width={width} borderStyle="single" borderColor={colors.brand.primary} borderTop={false} borderLeft={false} borderRight={false}>
      <Box height={1} flexDirection="row" paddingX={1}>
        <Text bold color={colors.brand.primary}>{"⣿ "}</Text>
        <Text bold color={colors.brand.primary}>storm</Text>
        <Text color={colors.text.secondary}>{" agent"}</Text>
        <Box flex={1} />
        <Text color={colors.brand.primary}>{"● "}</Text>
        <Text color={colors.text.secondary}>connected</Text>
      </Box>
    </Box>
  );
}

function SystemMessage({ content }: { content: string }) {
  return (
    <Box justifyContent="center">
      <Text italic color={colors.text.secondary}>{"    "}{content}</Text>
    </Box>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <Box flexDirection="row" paddingLeft={2}>
      <Text color={colors.text.secondary} bold>{"❯ "}</Text>
      <Text color={colors.text.primary}>{content}</Text>
    </Box>
  );
}

function AssistantMessage({ message }: { message: Message }) {
  const isThinkingPhase = message.streaming && message.thinking !== undefined && !message.content;

  return (
    <Box flexDirection="column" paddingLeft={2} paddingRight={1} gap={1}>
      {/* Live thinking — streams in using Collapsible expanded, dim italic */}
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

      {/* Main message — only shows when content exists */}
      {message.content ? (
        <Box flexDirection="row" gap={1}>
          {message.streaming ? (
            <Spinner type="flywheel" color={colors.brand.primary} />
          ) : (
            <Text color={colors.brand.primary} bold>{"◆"}</Text>
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
        >
          <Text color={colors.text.secondary}>{message.codeBlock.language}</Text>
          <SyntaxHighlight code={message.codeBlock.code.split("\n").slice(0, 10).join("\n")} language={message.codeBlock.language} />
        </Box>
      ) : null}

      {/* Canvas — LLM-generated visualization */}
      {message.canvas ? (
        <Box marginLeft={3} marginRight={1}>
          <Canvas
            nodes={message.canvas.nodes}
            edges={message.canvas.edges}
            title={message.canvas.title}
          />
        </Box>
      ) : null}

      {/* LineChart — agent-generated data visualization */}
      {message.chart ? (
        <Box marginLeft={3} marginRight={1} flexDirection="column">
          <LineChart
            series={[
              { name: "UserService", color: colors.success, data: [42,45,43,48,44,46,45,50,47,44,43,45,48,46,44,43,45,47,44,42,45,43,46,48] },
              { name: "OrderService", color: colors.warning, data: [80,85,82,90,95,105,120,140,160,180,195,210,220,225,230,228,225,220,215,210,200,195,190,185] },
              { name: "SearchService", color: colors.error, data: [95,100,98,102,105,100,98,105,110,108,450,850,1100,1200,1150,980,750,500,350,250,180,150,130,115] },
            ]}
            width={50}
            height={10}
            showAxes={true}
            showLegend={true}
            showGrid={true}
            showPoints={true}
            xLabels={["00:00", "06:00", "12:00", "18:00", "24:00"]}
            title="p99 Latency (ms) — 24h"
          />
        </Box>
      ) : null}

      {/* Heatmap — error rate by service and hour */}
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

function MessageView({ message }: { message: Message }) {
  if (message.role === "system") return <SystemMessage content={message.content} />;
  if (message.role === "user") return <UserMessage content={message.content} />;
  return <AssistantMessage message={message} />;
}

function MetricsCard({ tokens, cost, latency }: { tokens: number; cost: number; latency: number }) {
  const tokenStr = tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}K` : `${tokens}`;
  return (
    <Card title="Metrics" icon="◈" variant="default">
      <Box flexDirection="row" gap={2}>
        <Box flexDirection="column">
          <Text color={colors.text.secondary}>Tokens</Text>
          <Text bold color={colors.text.primary}>{tokenStr}</Text>
        </Box>
        <Box flexDirection="column">
          <Text color={colors.text.secondary}>Cost</Text>
          <Text bold color={colors.text.primary}>${cost.toFixed(3)}</Text>
        </Box>
        <Box flexDirection="column">
          <Text color={colors.text.secondary}>Latency</Text>
          <Text bold color={colors.text.primary}>{latency}ms</Text>
        </Box>
      </Box>
    </Card>
  );
}

function ActivityPanel({ ops }: { ops: OpNode[] }) {
  return (
    <Card title="Activity" variant="default">
      <OperationTree nodes={ops} showDuration={true} />
    </Card>
  );
}

function ThroughputChart({ data }: { data: readonly number[] }) {
  const min = Math.round(Math.min(...data));
  const max = Math.round(Math.max(...data));
  const cur = Math.round(data[data.length - 1] ?? 0);
  return (
    <Card title="Throughput" variant="default">
      <Sparkline
        data={data}
        height={2}
        color={colors.brand.primary}
        colorFn={(v) => v > 80 ? colors.success : v < 30 ? colors.error : undefined}
        showMinMax={true}
        label="tok/s"
      />
      <Box flexDirection="row" justifyContent="space-between">
        <Text color={colors.text.secondary} dim>lo:{min}</Text>
        <Text color={colors.text.primary} bold>{cur} tok/s</Text>
        <Text color={colors.text.secondary} dim>hi:{max}</Text>
      </Box>
    </Card>
  );
}

function ContextGauge({ tokens }: { tokens: number }) {
  const maxCtx = 200000;
  const pct = Math.min(100, Math.round((tokens / maxCtx) * 100));
  const tokenStr = tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}K` : `${tokens}`;
  return (
    <Box flex={1} flexDirection="column">
      <Text color={colors.text.secondary}>Context</Text>
      <Gauge
        value={pct}
        width={10}
        showValue={true}
        thresholds={[
          { value: 60, color: colors.warning },
          { value: 80, color: colors.error },
        ]}
        color={colors.brand.primary}
      />
      <Text dim color={colors.text.secondary}>{tokenStr}/200K</Text>
    </Box>
  );
}

function CostBreakdown({ cost }: { cost: number }) {
  // Scale to millicents so bars are visible (cost is in dollars, typically 0.001-0.05)
  const input = Math.round(cost * 400);
  const output = Math.round(cost * 450);
  const tools = Math.round(cost * 150);
  return (
    <Box flex={1} flexDirection="column">
      <Text color={colors.text.secondary}>Cost ${cost.toFixed(3)}</Text>
      <BarChart
        bars={[
          { label: "In", value: input, color: colors.brand.primary },
          { label: "Out", value: output, color: colors.success },
          { label: "Tl", value: tools, color: colors.warning },
        ]}
        orientation="horizontal"
        width={10}
        showValues={false}
        showAxes={false}
      />
    </Box>
  );
}

function RightPane({
  tokens,
  cost,
  latency,
  ops,
  sparkData,
}: {
  tokens: number;
  cost: number;
  latency: number;
  ops: OpNode[];
  sparkData: readonly number[];
}) {
  return (
    <Box flexDirection="column" paddingX={1} paddingTop={1} gap={1}>
      <MetricsCard tokens={tokens} cost={cost} latency={latency} />
      <Box flexDirection="row" gap={1}>
        <ContextGauge tokens={tokens} />
        <CostBreakdown cost={cost} />
      </Box>
      <ActivityPanel ops={ops} />
      <ThroughputChart data={sparkData} />
    </Box>
  );
}

function InputBar({
  input,
  setInput,
  onSubmit,
  history,
  isStreaming,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (v: string) => void;
  history: string[];
  isStreaming: boolean;
}) {
  return (
    <Box
      height={3}
      borderStyle="round"
      borderColor={colors.brand.glow}
      flexDirection="row"
      paddingX={1}
    >
      <Text color={colors.brand.primary} bold>{"❯ "}</Text>
      <TextInput
        value={input}
        onChange={setInput}
        onSubmit={onSubmit}
        placeholder={isStreaming ? "Waiting for response..." : "Type a message..."}
        placeholderColor={colors.text.dim}
        color={colors.text.primary}
        history={history}
        flex={1}
      />
      <Box>
        <Text color={colors.text.secondary}> [Tab]</Text>
      </Box>
    </Box>
  );
}

function StatusBar({ width, msgCount, model }: { width: number; msgCount: number; model: string }) {
  return (
    <Box height={1} flexDirection="row" paddingX={1} width={width}>
      <Text color={colors.text.secondary}>
        {model} │ msgs:{msgCount} │ scroll:mouse │ Ctrl+L clear │ Ctrl+C exit
      </Text>
    </Box>
  );
}

// ── Main App ───────────────────────────────────────────────────────────

function App() {
  const { width, height, exit } = useTerminal();
  const { flushSync } = useTui();

  // ── State ──────────────────────────────────────────────────────────
  const [bannerFrame, setBannerFrame] = useState(0);
  const [showBanner, setShowBanner] = useState(true);

  // Animate banner shimmer
  useInterval(() => {
    if (showBanner) flushSync(() => setBannerFrame((f) => f + 1));
  }, 150);

  // Auto-dismiss banner after 4 seconds
  useInterval(() => {
    if (showBanner && bannerFrame > 26) flushSync(() => setShowBanner(false));
  }, 100);

  const [messages, setMessages] = useState<Message[]>([
    { role: "system", content: "Session started. Model: qwen-2.5-72b (128K context)" },
    {
      role: "assistant",
      content: "Hello. I'm connected to your codebase and ready to help. What would you like to work on?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [tokens, setTokens] = useState(2480);
  const [cost, setCost] = useState(0.004);
  const [latency, setLatency] = useState(145);
  const [opPhase, setOpPhase] = useState(0);
  const [sparkData, setSparkData] = useState<number[]>([
    12, 18, 25, 32, 28, 45, 52, 48, 61, 55, 42, 38, 65, 72, 58, 44,
    35, 50, 68, 75, 62, 48, 55, 70, 82, 78, 65, 58, 72, 85,
  ]);

  // ── Live sparkline updates ─────────────────────────────────────────
  useInterval(() => {
    flushSync(() => {
      setSparkData((prev) => {
        const next = [...prev.slice(1)];
        const last = prev[prev.length - 1] ?? 50;
        const delta = (Math.random() - 0.45) * 30;
        next.push(Math.max(5, Math.min(100, last + delta)));
        return next;
      });
    });
  }, 800);

  // ── Cycle operations to show animation ─────────────────────────────
  useInterval(() => {
    flushSync(() => setOpPhase((p) => p + 1));
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
      },
      [exit, flushSync],
    ),
  );

  // ── Streaming simulation — two phases: thinking then response ──────
  const simulateResponse = useCallback(() => {
    const response = nextResponse();
    const thinkingWords = response.thinking ? response.thinking.split(" ") : [];
    const responseWords = response.text.split(" ");
    let phase: "thinking" | "responding" = thinkingWords.length > 0 ? "thinking" : "responding";
    let wordIndex = 0;

    // Start with thinking phase (or skip to responding if no thinking)
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
    });

    const streamInterval = setInterval(() => {
      wordIndex++;

      if (phase === "thinking") {
        // Stream thinking words
        if (wordIndex >= thinkingWords.length) {
          // Thinking done — transition to response phase
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
        // Update thinking text
        flushSync(() => {
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
        // Stream response words
        if (wordIndex >= responseWords.length) {
          clearInterval(streamInterval);
          flushSync(() => {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1]!;
              updated[updated.length - 1] = {
                ...last,
                content: responseWords.join(" "),
                streaming: false,
                ...(response.codeBlock ? { codeBlock: response.codeBlock } : {}),
                ...(response.image ? { image: response.image } : {}),
                ...(response.canvas ? { canvas: response.canvas } : {}),
                ...(response.chart ? { chart: response.chart } : {}),
                ...(response.heatmap ? { heatmap: response.heatmap } : {}),
              };
              return updated;
            });
            setIsStreaming(false);
            setTokens((t) => t + 380 + Math.floor(Math.random() * 600));
            setCost((c) => c + 0.002 + Math.random() * 0.005);
            setLatency(120 + Math.floor(Math.random() * 200));
          });
          return;
        }
        flushSync(() => {
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
      });
      setTimeout(simulateResponse, 300 + Math.random() * 400);
    },
    [flushSync, isStreaming, simulateResponse],
  );

  // ── Layout calculations ────────────────────────────────────────────
  const rightPaneWidth = Math.max(34, Math.min(44, Math.floor(width * 0.35)));
  const ops = makeOperations(opPhase);

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* Header bar */}
      <Header width={width} />

      {/* Main content: left chat + right metrics */}
      <Box flex={1} flexDirection="row">
        {/* Left: scrollable chat — explicit width prevents text overflow */}
        <Box width={width - rightPaneWidth} flexDirection="column">
          <ScrollView flex={1} scrollSpeed={3} stickToBottom={true}>
            <Box flexDirection="column" gap={1} paddingY={1} width={width - rightPaneWidth - 2}>
              {showBanner ? <Banner width={width - rightPaneWidth - 2} frame={bannerFrame} /> : null}
              {messages.map((msg, i) => (
                <MessageView key={i} message={msg} />
              ))}
            </Box>
          </ScrollView>
        </Box>

        {/* Right: metrics panel */}
        <Box width={rightPaneWidth} flexDirection="column">
          <ScrollView flex={1} scrollSpeed={2}>
            <RightPane
              tokens={tokens}
              cost={cost}
              latency={latency}
              ops={ops}
              sparkData={sparkData}
            />
          </ScrollView>
        </Box>
      </Box>

      {/* Separator above input */}
      <Separator style="line" color={colors.divider} width={width} />

      {/* Input bar */}
      <InputBar
        input={input}
        setInput={setInput}
        onSubmit={handleSubmit}
        history={history}
        isStreaming={isStreaming}
      />

      {/* Status bar */}
      <StatusBar width={width} msgCount={messages.length} model="qwen-2.5-72b" />
    </Box>
  );
}

// ── Entry ──────────────────────────────────────────────────────────────

const app = render(<App />);
await app.waitUntilExit();
