/**
 * SystemDashboard -- Grafana/Datadog-style monitoring terminal.
 *
 * Cyan/Blue theme with live CPU, memory, RPS, error rate, sparklines,
 * service health grid, and alert log. 15+ components.
 */

import React, { useState, useRef } from "react";
import { useTui } from "../../context/TuiContext.js";
import { useInput } from "../../hooks/useInput.js";
import { useCleanup } from "../../hooks/useCleanup.js";
import { useTerminal } from "../../hooks/useTerminal.js";
import { Gradient } from "../../components/Gradient.js";
import { useColors } from "../../hooks/useColors.js";

import { Card } from "../../components/Card.js";
import { DataGrid } from "../../components/DataGrid.js";
import type { DataGridColumn } from "../../components/DataGrid.js";
import { Sparkline } from "../../components/Sparkline.js";
import { GradientProgress } from "../../components/GradientProgress.js";
import { RichLog } from "../../components/RichLog.js";
import type { LogEntry } from "../../components/RichLog.js";
import { KeyboardHelp } from "../../components/KeyboardHelp.js";
import { Badge } from "../../components/Badge.js";
import { Gauge } from "../../components/Gauge.js";
import { Separator } from "../../components/Separator.js";
import { Spinner } from "../../components/Spinner.js";
import { Divider } from "../../components/Divider.js";
import { ScrollView } from "../../components/ScrollView.js";

export interface SystemDashboardProps {
  title?: string;
}

// Color aliases are set inside the component via useColors()

const SVC_NAMES = ["api-gateway", "auth-svc", "user-svc", "payment-svc", "notif-svc", "search-svc", "cache-redis", "db-primary"];
const SVC_UPTIMES = ["99.99%", "99.97%", "99.95%", "99.91%", "99.88%", "99.93%", "99.99%", "99.98%"];

const SVC_COLS: DataGridColumn[] = [
  { key: "name", label: "Service", width: 14 },
  { key: "status", label: "Status", width: 10 },
  { key: "uptime", label: "Uptime", width: 8, align: "right" },
  { key: "latency", label: "Lat(ms)", width: 8, align: "right" },
  { key: "errors", label: "Errors", width: 7, align: "right" },
];

const p2 = (v: number) => String(v).padStart(2, "0");
const now = (): string => { const d = new Date(); return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; };
const randBetween = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);
const fmtUptime = (s: number): string => `${Math.floor(s / 3600)}h ${p2(Math.floor((s % 3600) / 60))}m ${p2(s % 60)}s`;
export function SystemDashboard(_props: SystemDashboardProps): React.ReactElement {
  const colors = useColors();
  const PRIMARY = colors.brand.primary;
  const ACCENT = colors.brand.glow;
  const HEALTHY = colors.success;
  const WARNING = colors.warning;
  const CRITICAL = colors.error;
  const DIM = colors.text.dim;
  const ALERT_POOL: Array<{ text: string; color: string; bold?: boolean }> = [
    { text: "CPU spike on api-gateway (92%)", color: CRITICAL, bold: true },
    { text: "Memory warning on user-svc (78%)", color: WARNING },
    { text: "Latency P99 > 500ms on payment-svc", color: CRITICAL, bold: true },
    { text: "Cache hit rate recovered to 94%", color: HEALTHY },
    { text: "Disk usage at 71% on db-primary", color: WARNING },
    { text: "All health checks passing", color: HEALTHY },
    { text: "Connection pool exhaustion on db-primary", color: CRITICAL, bold: true },
    { text: "Auto-scaling: +2 api-gateway pods", color: PRIMARY },
  ];
  const statusColor = (s: string): string => s === "healthy" ? HEALTHY : s === "degraded" ? WARNING : CRITICAL;
  const { flushSync, exit } = useTui();
  const { width, height } = useTerminal();

  const [cpu, setCpu] = useState(42);
  const [mem, setMem] = useState(6.4);
  const [rps, setRps] = useState(1247);
  const [errorRate, setErrorRate] = useState(0.12);
  const [latencyHist, setLatencyHist] = useState<number[]>(() => Array.from({ length: 30 }, () => randBetween(20, 120)));
  const [throughputHist, setThroughputHist] = useState<number[]>(() => Array.from({ length: 30 }, () => randBetween(800, 1500)));
  const [svcStatuses, setSvcStatuses] = useState<string[]>(() => SVC_NAMES.map(() => "healthy"));
  const [svcLatencies, setSvcLatencies] = useState<number[]>(() => SVC_NAMES.map(() => Math.round(randBetween(12, 80))));
  const [svcErrors, setSvcErrors] = useState<number[]>(() => SVC_NAMES.map(() => Math.round(randBetween(0, 5))));
  const [alerts, setAlerts] = useState<LogEntry[]>(() => [{ text: "System monitor initialized.", color: HEALTHY, timestamp: now(), bold: true }]);
  const [uptime, setUptime] = useState(0);
  const [selectedSvc, setSelectedSvc] = useState(0);
  const [focusPane, setFocusPane] = useState(0); // 0=services, 1=alerts

  const metricsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alertTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const svcTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const initRef = useRef(false);
  if (!initRef.current) {
    initRef.current = true;

    metricsTimerRef.current = setInterval(() => {
      flushSync(() => {
        setCpu((prev) => Math.max(5, Math.min(99, prev + (Math.random() - 0.48) * 12)));
        setMem((prev) => Math.max(2, Math.min(15.8, prev + (Math.random() - 0.5) * 0.4)));
        setRps((prev) => Math.max(200, Math.min(3000, prev + Math.round((Math.random() - 0.48) * 150))));
        setErrorRate((prev) => Math.max(0, Math.min(5, prev + (Math.random() - 0.5) * 0.3)));
        setLatencyHist((prev) => [...prev.slice(1), randBetween(20, 120)]);
        setThroughputHist((prev) => [...prev.slice(1), randBetween(800, 1500)]);
        setUptime((prev) => prev + 1);
        setSvcLatencies((prev) => prev.map((l) => Math.max(5, Math.min(500, l + Math.round((Math.random() - 0.5) * 20)))));
        setSvcErrors((prev) => prev.map((e) => Math.max(0, e + (Math.random() > 0.7 ? 1 : 0))));
      });
    }, 1000);

    alertTimerRef.current = setInterval(() => {
      flushSync(() => {
        const alert = ALERT_POOL[Math.floor(Math.random() * ALERT_POOL.length)]!;
        setAlerts((prev) => [...prev.slice(-24), { ...alert, timestamp: now() }]);
      });
    }, 3000);

    svcTimerRef.current = setInterval(() => {
      flushSync(() => {
        setSvcStatuses((prev) => prev.map((s) => {
          const roll = Math.random();
          if (roll > 0.92) return "critical";
          if (roll > 0.82) return "degraded";
          return "healthy";
        }));
      });
    }, 5000);
  }

  useCleanup(() => {
    if (metricsTimerRef.current) clearInterval(metricsTimerRef.current);
    if (alertTimerRef.current) clearInterval(alertTimerRef.current);
    if (svcTimerRef.current) clearInterval(svcTimerRef.current);
  });

  useInput((event) => {
    if (event.key === "q" || event.char === "q") exit();
    if (event.key === "tab") flushSync(() => setFocusPane((p) => (p + 1) % 2));
    if (event.key === "up" && focusPane === 0) {
      flushSync(() => setSelectedSvc((r) => Math.max(0, r - 1)));
    }
    if (event.key === "down" && focusPane === 0) {
      flushSync(() => setSelectedSvc((r) => Math.min(SVC_NAMES.length - 1, r + 1)));
    }
  });

  // -- Computed --
  const cpuColor = cpu > 80 ? CRITICAL : (cpu > 60 ? WARNING : HEALTHY);
  const memColor = mem > 12 ? CRITICAL : (mem > 8 ? WARNING : HEALTHY);
  const rpsColor = rps < 500 ? CRITICAL : (rps < 800 ? WARNING : HEALTHY);
  const errColor = errorRate > 2 ? CRITICAL : (errorRate > 0.5 ? WARNING : HEALTHY);

  // -- Header --
  const header = React.createElement("tui-box", {
    flexDirection: "row", width: width - 2, justifyContent: "space-between",
  },
    React.createElement("tui-box", { flexDirection: "row", gap: 2 },
      React.createElement(Gradient, { colors: [PRIMARY, ACCENT], children: "SYSTEM MONITOR" }),
      React.createElement(Spinner, { type: "dots", color: PRIMARY }),
    ),
    React.createElement("tui-box", { flexDirection: "row", gap: 2 },
      React.createElement("tui-text", { color: DIM }, `host: storm-prod-01`),
      React.createElement("tui-text", { color: PRIMARY }, `up ${fmtUptime(uptime)}`),
    ),
  );

  // -- Stat cards --
  function statCard(title: string, value: string, color: string, pct: number, gradColors: [string, string]): React.ReactElement {
    return React.createElement("tui-box", { width: Math.floor((width - 8) / 4) },
      React.createElement(Card, {
        title, icon: "\u25CF", variant: "default",
        children: React.createElement("tui-box", { flexDirection: "column", overflow: "hidden" },
          React.createElement("tui-text", { bold: true, color }, value),
          React.createElement(GradientProgress, { value: pct, width: 10, colors: gradColors }),
        ),
      }),
    );
  }

  const topRow = React.createElement("tui-box", {
    flexDirection: "row", gap: 1, width: width - 2,
  },
    statCard("CPU", `${Math.round(cpu)}`, cpuColor, cpu, [HEALTHY, cpuColor]),
    statCard("MEM", mem.toFixed(1), memColor, (mem / 16) * 100, [HEALTHY, memColor]),
    statCard("RPS", String(Math.round(rps)), rpsColor, Math.min(100, (rps / 3000) * 100), [ACCENT, rpsColor]),
    statCard("ERR", errorRate.toFixed(2), errColor, Math.min(100, errorRate * 20), [HEALTHY, errColor]),
  );

  // -- Sparkline charts --
  const sparkRow = React.createElement("tui-box", {
    flexDirection: "row", gap: 3, width: width - 2,
  },
    React.createElement("tui-box", { flexDirection: "column", flexGrow: 1 },
      React.createElement("tui-text", { color: PRIMARY, bold: true }, "Request Latency (ms)"),
      React.createElement(Sparkline, { data: latencyHist, color: WARNING, height: 2 }),
    ),
    React.createElement("tui-box", { flexDirection: "column", flexGrow: 1 },
      React.createElement("tui-text", { color: PRIMARY, bold: true }, "Throughput (req/s)"),
      React.createElement(Sparkline, { data: throughputHist, color: HEALTHY, height: 2 }),
    ),
  );

  // -- Services DataGrid --
  const svcRows = SVC_NAMES.map((name, i) => ({
    name,
    status: svcStatuses[i]!,
    uptime: SVC_UPTIMES[i]!,
    latency: String(svcLatencies[i]),
    errors: String(svcErrors[i]),
  }));

  const svcGrid = React.createElement("tui-box", { flexDirection: "column", flexGrow: 1 },
    React.createElement("tui-box", { flexDirection: "row", gap: 1 },
      React.createElement("tui-text", { color: PRIMARY, bold: true }, "Services"),
      React.createElement(Badge, {
        label: `${svcStatuses.filter((s) => s === "healthy").length}/${SVC_NAMES.length} OK`,
        color: svcStatuses.every((s) => s === "healthy") ? HEALTHY : WARNING,
      }),
    ),
    React.createElement(DataGrid, {
      columns: SVC_COLS,
      rows: svcRows,
      selectedRow: selectedSvc,
      isFocused: focusPane === 0,
      headerColor: PRIMARY,
      selectedColor: ACCENT,
      onSelect: (i: number) => flushSync(() => setSelectedSvc(i)),
    }),
  );

  // -- Alert log --
  const alertSection = React.createElement("tui-box", {
    flexDirection: "column", flex: 1, overflow: "hidden",
  },
    React.createElement("tui-box", { flexDirection: "row", gap: 1 },
      React.createElement("tui-text", { color: PRIMARY, bold: true }, "Alerts"),
      React.createElement(Badge, { label: String(alerts.length), color: CRITICAL }),
    ),
    React.createElement(RichLog, {
      entries: alerts, maxVisible: 8, showTimestamp: true,
      timestampColor: DIM, isFocused: focusPane === 1, autoScroll: true,
    }),
  );

  // -- Bottom row: services + alerts --
  const bottomRow = React.createElement("tui-box", {
    flexDirection: "row", gap: 2, width: width - 2,
  }, svcGrid, alertSection);

  const selSvc = SVC_NAMES[selectedSvc]!, selStatus = svcStatuses[selectedSvc]!;
  const detailBar = React.createElement("tui-box", { flexDirection: "row", gap: 2 },
    React.createElement("tui-text", { color: DIM }, "Selected:"),
    React.createElement("tui-text", { color: PRIMARY, bold: true }, selSvc),
    React.createElement(Badge, { label: selStatus, color: statusColor(selStatus) }),
    React.createElement(Gauge, { value: 100 - (svcLatencies[selectedSvc]! / 5), label: "Health", color: statusColor(selStatus), width: 12 }),
  );

  // -- Footer --
  const help = React.createElement(KeyboardHelp, {
    bindings: [
      { key: "Tab", label: "Switch pane" },
      { key: "\u2191\u2193", label: "Navigate" },
      { key: "q", label: "Quit" },
    ],
    keyColor: PRIMARY,
    color: DIM,
  });

  return React.createElement("tui-box", { width, height },
    React.createElement(ScrollView, { flex: 1, stickToBottom: false },
    React.createElement("tui-box", {
      flexDirection: "column", width: width - 2, paddingX: 1, gap: 1,
    },
      header,
      React.createElement(Separator, { style: "storm", color: ACCENT, width: width - 4 }),
      topRow,
      sparkRow,
      bottomRow,
      React.createElement(Divider, { color: ACCENT, width: width - 4 }),
      detailBar,
      help,
    ),
  ),
  );
}
