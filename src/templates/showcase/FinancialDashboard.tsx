import React, { useState, useRef } from "react";
import { useTui } from "../../context/TuiContext.js";
import { useInput } from "../../hooks/useInput.js";
import { useCleanup } from "../../hooks/useCleanup.js";
import { useTerminal } from "../../hooks/useTerminal.js";
import { Gradient } from "../../components/effects/Gradient.js";
import { Card } from "../../components/extras/Card.js";
import { DataGrid } from "../../components/data/DataGrid.js";
import type { DataGridColumn } from "../../components/data/DataGrid.js";
import { Gauge } from "../../components/data/Gauge.js";
import { Sparkline } from "../../components/data/Sparkline.js";
import { GradientProgress } from "../../components/effects/GradientProgress.js";
import { RichLog } from "../../components/data/RichLog.js";
import type { LogEntry } from "../../components/data/RichLog.js";
import { KeyboardHelp } from "../../components/extras/KeyboardHelp.js";
import { Badge } from "../../components/extras/Badge.js";
import { Divider } from "../../components/core/Divider.js";
import { Divider as Separator } from "../../components/core/Divider.js";
import { Spinner } from "../../components/core/Spinner.js";
import { Header } from "../../components/extras/Header.js";
import { ScrollView } from "../../components/core/ScrollView.js";
import { LineChart } from "../../components/data/LineChart.js";
import { useColors } from "../../hooks/useColors.js";

export interface FinancialDashboardProps {
  title?: string;
}

// Color aliases are set inside the component via useColors()

const TICKERS = ["AAPL", "GOOGL", "MSFT", "TSLA", "AMZN", "NVDA"];
const BASE_PRICES = [178.5, 141.2, 378.9, 248.6, 185.3, 875.4];
const QTYS = [150, 80, 200, 50, 120, 60];

const GRID_COLS: DataGridColumn[] = [
  { key: "ticker", label: "Ticker", width: 8 },
  { key: "qty", label: "Qty", width: 6, align: "right" },
  { key: "price", label: "Price", width: 10, align: "right" },
  { key: "change", label: "Chg %", width: 8, align: "right" },
  { key: "pnl", label: "P&L", width: 10, align: "right" },
];

const NEWS_POOL = [
  "Fed signals rate pause in Q2 outlook", "NVDA beats earnings by 12%, guidance raised",
  "Oil prices surge on OPEC supply cut", "Treasury yields hit 4.8%, bond rout deepens",
  "Tech sector leads rally, Nasdaq +1.2%", "TSLA Cybertruck deliveries exceed estimates",
  "Gold breaks $2,400 on geopolitical risk", "AAPL Vision Pro sales top 500K units",
  "Crypto rally: BTC above $72K, ETH up 5%", "MSFT Azure revenue grows 29% YoY",
];

function randDelta(): number {
  return (Math.random() - 0.48) * 3.5;
}

function fmtMoney(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n >= 0 ? `+$${abs}` : `-$${abs}`;
}
function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}
const fmtPrice = (n: number): string => n.toFixed(2);

function now(): string {
  const d = new Date();
  const p = (v: number) => String(v).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function FinancialDashboard(_props: FinancialDashboardProps): React.ReactElement {
  const colors = useColors();
  const GOLD = colors.warning;
  const ACCENT = colors.brand.primary;
  const GAIN = colors.success;
  const LOSS = colors.error;
  const DIM = colors.text.dim;
  const { flushSync, exit } = useTui();
  const { width, height } = useTerminal();

  const [prices, setPrices] = useState<number[]>(() => [...BASE_PRICES]);
  const [sparkData, setSparkData] = useState<number[]>(() =>
    Array.from({ length: 30 }, () => 170 + Math.random() * 20),
  );
  const [sentiment, setSentiment] = useState(72);
  const [news, setNews] = useState<LogEntry[]>(() => [
    { text: "Markets open. All systems nominal.", color: GAIN, timestamp: now(), bold: true },
  ]);
  const [selectedRow, setSelectedRow] = useState(0);
  const [timestamp, setTimestamp] = useState(now);
  const [focusPane, setFocusPane] = useState(0); // 0=grid, 1=news

  const priceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const newsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sentimentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -- Timers (register once via ref guard) --
  const initRef = useRef(false);
  if (!initRef.current) {
    initRef.current = true;

    priceTimerRef.current = setInterval(() => {
      flushSync(() => {
        setPrices((prev) => prev.map((p) => Math.max(10, p + randDelta())));
        setSparkData((prev) => [...prev.slice(1), 170 + Math.random() * 20]);
        setPriceData1((prev) => [...prev.slice(1), prev[prev.length - 1]! + (Math.random() - 0.48) * 4]);
        setPriceData2((prev) => [...prev.slice(1), prev[prev.length - 1]! + (Math.random() - 0.48) * 3]);
        setTimestamp(now());
      });
    }, 1000);

    newsTimerRef.current = setInterval(() => {
      flushSync(() => {
        const msg = NEWS_POOL[Math.floor(Math.random() * NEWS_POOL.length)]!;
        const color = Math.random() > 0.3 ? ACCENT : (Math.random() > 0.5 ? GAIN : LOSS);
        setNews((prev) => [...prev.slice(-19), { text: msg, color, timestamp: now() }]);
      });
    }, 3000);

    sentimentTimerRef.current = setInterval(() => {
      flushSync(() => {
        setSentiment((prev) => Math.max(10, Math.min(95, prev + Math.round((Math.random() - 0.5) * 8))));
      });
    }, 2000);
  }

  useCleanup(() => {
    if (priceTimerRef.current) clearInterval(priceTimerRef.current);
    if (newsTimerRef.current) clearInterval(newsTimerRef.current);
    if (sentimentTimerRef.current) clearInterval(sentimentTimerRef.current);
  });

  useInput((event) => {
    if (event.key === "q" || event.char === "q") exit();
    if (event.key === "tab") flushSync(() => setFocusPane((p) => (p + 1) % 2));
    if (event.key === "up" && focusPane === 0) {
      flushSync(() => setSelectedRow((r) => Math.max(0, r - 1)));
    }
    if (event.key === "down" && focusPane === 0) {
      flushSync(() => setSelectedRow((r) => Math.min(TICKERS.length - 1, r + 1)));
    }
  });

  // -- Computed data --
  const changes = prices.map((p, i) => ((p - BASE_PRICES[i]!) / BASE_PRICES[i]!) * 100);
  const pnls = prices.map((p, i) => (p - BASE_PRICES[i]!) * QTYS[i]!);
  const portfolioTotal = prices.reduce((s, p, i) => s + p * QTYS[i]!, 0);
  const dailyPnl = pnls.reduce((s, v) => s + v, 0);

  const rows = TICKERS.map((t, i) => ({
    ticker: t,
    qty: String(QTYS[i]),
    price: fmtPrice(prices[i]!),
    change: `${changes[i]! >= 0 ? "+" : ""}${changes[i]!.toFixed(2)}%`,
    pnl: fmtMoney(pnls[i]!),
  }));

  // -- Header --
  const header = React.createElement("tui-box", {
    flexDirection: "row", width: width - 2, justifyContent: "space-between",
  },
    React.createElement("tui-box", { flexDirection: "row", gap: 2 },
      React.createElement(Gradient, { colors: [GOLD, ACCENT], children: "STORM TERMINAL" }),
      React.createElement(Spinner, { type: "dots", color: GOLD }),
    ),
    React.createElement("tui-text", { color: DIM }, timestamp),
  );

  // -- Portfolio + P&L cards --
  const portfolioCard = React.createElement("tui-box", { flex: 1 },
    React.createElement(Card, {
      title: "Portfolio Value", icon: "$", variant: "storm",
      children: React.createElement("tui-text", { bold: true, color: GOLD }, fmtCompact(portfolioTotal)),
    }),
  );

  const pnlCard = React.createElement("tui-box", { flex: 1 },
    React.createElement(Card, {
      title: "Daily P&L", icon: "\u25B2", variant: dailyPnl >= 0 ? "success" : "error",
      children: React.createElement("tui-text", { bold: true, color: dailyPnl >= 0 ? GAIN : LOSS }, `${dailyPnl >= 0 ? "+" : ""}${fmtCompact(dailyPnl)}`),
    }),
  );

  const topRow = React.createElement("tui-box", {
    flexDirection: "row", gap: 2, width: width - 2,
  }, portfolioCard, pnlCard);

  // -- Price History LineChart (live — shifts left, appends new point each tick) --
  const [priceData1, setPriceData1] = useState(() => Array.from({ length: 60 }, (_, i) =>
    150 + Math.sin(i * 0.15) * 20 + Math.random() * 5
  ));
  const [priceData2, setPriceData2] = useState(() => Array.from({ length: 60 }, (_, i) =>
    120 + Math.cos(i * 0.12) * 15 + Math.random() * 3
  ));

  const priceChart = React.createElement("tui-box", { flexDirection: "column", width: width - 2 },
    React.createElement(LineChart, {
      series: [
        { data: priceData1, name: "AAPL", color: colors.brand.primary },
        { data: priceData2, name: "GOOG", color: colors.success },
      ],
      width: Math.min(70, width - 4),
      height: 12,
      title: "Price History (24h)",
      showAxes: true,
      showLegend: true,
    }),
  );

  // -- Positions DataGrid --
  const grid = React.createElement(DataGrid, {
    columns: GRID_COLS,
    rows,
    selectedRow,
    isFocused: focusPane === 0,
    headerColor: GOLD,
    selectedColor: ACCENT,
    onSelect: (i: number) => flushSync(() => setSelectedRow(i)),
  });

  // -- Right sidebar: Gauge, Sparkline, Allocations --
  const gaugeEl = React.createElement("tui-box", { flexDirection: "column" },
    React.createElement("tui-text", { color: ACCENT, bold: true }, "Market Sentiment"),
    React.createElement(Gauge, { value: sentiment, color: sentiment > 60 ? GAIN : (sentiment > 40 ? GOLD : LOSS), width: 20, label: "Sentiment" }),
  );

  const sparkEl = React.createElement("tui-box", { flexDirection: "column" },
    React.createElement("tui-text", { color: ACCENT, bold: true }, "AAPL Price (30m)"),
    React.createElement(Sparkline, { data: sparkData, color: GAIN, width: 30, height: 2 }),
  );

  const allocations = React.createElement("tui-box", { flexDirection: "column", gap: 0 },
    React.createElement("tui-text", { color: ACCENT, bold: true }, "Allocation"),
    React.createElement("tui-box", { flexDirection: "row", gap: 1 },
      React.createElement("tui-text", { color: DIM }, "Tech   "),
      React.createElement(GradientProgress, { value: 45, width: 12, colors: [GOLD, GAIN], showPercentage: true }),
    ),
    React.createElement("tui-box", { flexDirection: "row", gap: 1 },
      React.createElement("tui-text", { color: DIM }, "Finance"),
      React.createElement(GradientProgress, { value: 25, width: 12, colors: [ACCENT, GOLD], showPercentage: true }),
    ),
    React.createElement("tui-box", { flexDirection: "row", gap: 1 },
      React.createElement("tui-text", { color: DIM }, "Energy "),
      React.createElement(GradientProgress, { value: 20, width: 12, colors: [colors.warning, GOLD], showPercentage: true }),
    ),
    React.createElement("tui-box", { flexDirection: "row", gap: 1 },
      React.createElement("tui-text", { color: DIM }, "Bonds  "),
      React.createElement(GradientProgress, { value: 10, width: 12, colors: [colors.info, ACCENT], showPercentage: true }),
    ),
  );

  const sidebar = React.createElement("tui-box", {
    flexDirection: "column", gap: 1, width: Math.min(35, Math.floor(width * 0.4)), overflow: "hidden",
  }, gaugeEl, sparkEl, allocations);

  // -- Middle row: grid + sidebar --
  const middleRow = React.createElement("tui-box", {
    flexDirection: "row", gap: 2, width: width - 2,
  },
    React.createElement("tui-box", { flexGrow: 1, flexDirection: "column" },
      React.createElement("tui-text", { color: GOLD, bold: true }, "Positions"),
      grid,
    ),
    sidebar,
  );

  // -- News feed --
  const newsSection = React.createElement("tui-box", { flexDirection: "column", width: width - 2 },
    React.createElement("tui-box", { flexDirection: "row", gap: 2 },
      React.createElement("tui-text", { color: GOLD, bold: true }, "News Feed"),
      React.createElement(Badge, { label: `${news.length}`, color: ACCENT }),
    ),
    React.createElement(RichLog, {
      entries: news, maxVisible: 5, showTimestamp: true,
      timestampColor: DIM, isFocused: focusPane === 1, autoScroll: true,
    }),
  );

  // -- Footer --
  const divider = React.createElement(Divider, { color: ACCENT, width: width - 4 });
  const help = React.createElement(KeyboardHelp, {
    bindings: [
      { key: "Tab", label: "Switch pane" },
      { key: "\u2191\u2193", label: "Navigate" },
      { key: "q", label: "Quit" },
    ],
    keyColor: GOLD,
    color: DIM,
  });

  return React.createElement("tui-box", { flexDirection: "column", width, height },
    React.createElement(ScrollView, { flexGrow: 1, flexShrink: 1, flexBasis: 0, stickToBottom: false },
      React.createElement("tui-box", {
        flexDirection: "column", width: width - 2, paddingX: 1, gap: 1,
      },
      header,
      React.createElement(Separator, { style: "storm", color: ACCENT, width: width - 4 }),
      topRow,
      priceChart,
      middleRow,
      newsSection,
      divider,
      help,
      ),
    ),
  );
}
