#!/usr/bin/env npx tsx
/**
 * storm dashboard — btop++-inspired operations dashboard.
 *
 * Every cell does work. Color gradients convey data. Braille sparklines.
 * Rounded borders. Headers inside borders. Numbers right-aligned.
 * Full-terminal, zero dead space, live-updating.
 */

import React, { useState, useCallback } from "react";

import {
  render,
  Box,
  Text,
  Card,
  Sparkline,
  Gauge,
  Separator,
  useTerminal,
  useTui,
  useInterval,
  useInput,
} from "../src/index.js";

import { colors } from "../src/theme/colors.js";

// ── Constants ───────────────────────────────────────────────────────────

const NUM_CORES = 8;
const PROCESS_COUNT = 10;
const NET_HISTORY_LEN = 60;

const BLOCK_FULL = "\u2588"; // █
const BLOCK_EMPTY = "\u2591"; // ░

// ── Color helpers ───────────────────────────────────────────────────────

function cpuColor(pct: number): string {
  if (pct >= 80) return colors.error;
  if (pct >= 50) return colors.warning;
  return colors.success;
}

function memColor(pct: number): string {
  if (pct >= 85) return colors.error;
  if (pct >= 60) return colors.warning;
  return colors.success;
}

function netColor(val: number, max: number): string {
  const ratio = val / Math.max(max, 1);
  if (ratio >= 0.7) return colors.error;
  if (ratio >= 0.4) return colors.warning;
  return colors.success;
}

// ── Random helpers ──────────────────────────────────────────────────────

function jitter(base: number, range: number): number {
  return Math.max(0, base + (Math.random() - 0.5) * range);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ── CPU data ────────────────────────────────────────────────────────────

interface CoreInfo {
  usage: number;  // 0-100
  freq: number;   // GHz
  base: number;   // base usage for jitter
}

function initialCores(): CoreInfo[] {
  const bases = [62, 34, 81, 22, 71, 58, 95, 48];
  const freqs = [1.8, 2.1, 2.4, 1.2, 2.0, 1.9, 2.8, 1.6];
  return bases.map((b, i) => ({ usage: b, freq: freqs[i]!, base: b }));
}

function tickCores(prev: CoreInfo[]): CoreInfo[] {
  return prev.map((c) => {
    const usage = clamp(Math.round(jitter(c.base, 20)), 0, 100);
    const freq = clamp(Number(jitter(c.freq, 0.6).toFixed(1)), 0.8, 3.5);
    // slowly drift the base
    const base = clamp(c.base + (Math.random() - 0.5) * 4, 10, 98);
    return { usage, freq, base };
  });
}

// ── Memory data ─────────────────────────────────────────────────────────

interface MemInfo {
  ramPct: number;
  swapPct: number;
  usedGb: number;
  totalGb: number;
  cacheGb: number;
  availGb: number;
  diskRoot: number;
  diskHome: number;
}

function initialMem(): MemInfo {
  return {
    ramPct: 78, swapPct: 12,
    usedGb: 12.4, totalGb: 16.0,
    cacheGb: 4.2, availGb: 3.6,
    diskRoot: 84, diskHome: 42,
  };
}

function tickMem(prev: MemInfo): MemInfo {
  const ramPct = clamp(Math.round(jitter(prev.ramPct, 6)), 20, 98);
  const usedGb = Number((prev.totalGb * ramPct / 100).toFixed(1));
  const availGb = Number((prev.totalGb - usedGb).toFixed(1));
  const cacheGb = Number(clamp(jitter(prev.cacheGb, 0.8), 1.0, 6.0).toFixed(1));
  const swapPct = clamp(Math.round(jitter(prev.swapPct, 4)), 0, 60);
  const diskRoot = clamp(Math.round(jitter(prev.diskRoot, 2)), 50, 98);
  const diskHome = clamp(Math.round(jitter(prev.diskHome, 3)), 10, 90);
  return { ...prev, ramPct, swapPct, usedGb, cacheGb, availGb, diskRoot, diskHome };
}

// ── Network data ────────────────────────────────────────────────────────

interface NetInfo {
  uploadHistory: number[];   // MB/s
  downloadHistory: number[]; // MB/s
  uploadTotal: number;       // GB
  downloadTotal: number;     // GB
}

function initialNet(): NetInfo {
  const up: number[] = [];
  const down: number[] = [];
  for (let i = 0; i < NET_HISTORY_LEN; i++) {
    up.push(Number((Math.random() * 5).toFixed(1)));
    down.push(Number((Math.random() * 20).toFixed(1)));
  }
  return { uploadHistory: up, downloadHistory: down, uploadTotal: 1.2, downloadTotal: 8.4 };
}

function tickNet(prev: NetInfo): NetInfo {
  const lastUp = prev.uploadHistory[prev.uploadHistory.length - 1] ?? 2;
  const lastDown = prev.downloadHistory[prev.downloadHistory.length - 1] ?? 10;
  const newUp = clamp(Number(jitter(lastUp, 3).toFixed(1)), 0, 15);
  const newDown = clamp(Number(jitter(lastDown, 8).toFixed(1)), 0, 50);
  const uploadHistory = [...prev.uploadHistory.slice(1), newUp];
  const downloadHistory = [...prev.downloadHistory.slice(1), newDown];
  return {
    uploadHistory,
    downloadHistory,
    uploadTotal: Number((prev.uploadTotal + newUp / 1000).toFixed(1)),
    downloadTotal: Number((prev.downloadTotal + newDown / 1000).toFixed(1)),
  };
}

// ── Process data ────────────────────────────────────────────────────────

interface ProcInfo {
  pid: number;
  user: string;
  cpu: number;
  mem: number;
  cmd: string;
}

const PROC_TEMPLATES: Array<{ pid: number; user: string; cmd: string; baseCpu: number; baseMem: number }> = [
  { pid: 1234, user: "root", cmd: "node", baseCpu: 12.4, baseMem: 3.2 },
  { pid: 5678, user: "user", cmd: "chrome", baseCpu: 8.1, baseMem: 2.1 },
  { pid: 9012, user: "user", cmd: "code", baseCpu: 6.7, baseMem: 1.8 },
  { pid: 3456, user: "root", cmd: "postgres", baseCpu: 4.2, baseMem: 0.9 },
  { pid: 7890, user: "user", cmd: "docker", baseCpu: 3.1, baseMem: 4.5 },
  { pid: 2345, user: "root", cmd: "nginx", baseCpu: 2.8, baseMem: 0.4 },
  { pid: 4567, user: "user", cmd: "webpack", baseCpu: 2.3, baseMem: 1.6 },
  { pid: 6789, user: "root", cmd: "redis", baseCpu: 1.9, baseMem: 0.3 },
  { pid: 8901, user: "user", cmd: "python", baseCpu: 1.5, baseMem: 2.4 },
  { pid: 1357, user: "root", cmd: "systemd", baseCpu: 0.8, baseMem: 0.2 },
];

function initialProcs(): ProcInfo[] {
  return PROC_TEMPLATES.map((t) => ({
    pid: t.pid,
    user: t.user,
    cpu: t.baseCpu,
    mem: t.baseMem,
    cmd: t.cmd,
  }));
}

function tickProcs(prev: ProcInfo[]): ProcInfo[] {
  return prev.map((p, i) => {
    const t = PROC_TEMPLATES[i]!;
    return {
      ...p,
      cpu: clamp(Number(jitter(t.baseCpu, t.baseCpu * 0.5).toFixed(1)), 0, 99.9),
      mem: clamp(Number(jitter(t.baseMem, t.baseMem * 0.3).toFixed(1)), 0.1, 30),
    };
  }).sort((a, b) => b.cpu - a.cpu);
}

// ── Bar renderer ────────────────────────────────────────────────────────

function CpuBar({ usage, barWidth }: { usage: number; barWidth: number }) {
  const filled = Math.round((usage / 100) * barWidth);
  const empty = barWidth - filled;
  const col = cpuColor(usage);
  return (
    <Box flexDirection="row">
      <Text color={col}>{BLOCK_FULL.repeat(filled)}</Text>
      <Text color={colors.text.disabled}>{BLOCK_EMPTY.repeat(Math.max(0, empty))}</Text>
    </Box>
  );
}

function MemBar({ pct, barWidth, label }: { pct: number; barWidth: number; label: string }) {
  const filled = Math.round((pct / 100) * barWidth);
  const empty = barWidth - filled;
  const col = memColor(pct);
  const pctStr = `${Math.round(pct)}%`.padStart(4);
  return (
    <Box flexDirection="row">
      <Text color={colors.text.secondary}>{label.padEnd(5)}</Text>
      <Text color={col}>{BLOCK_FULL.repeat(filled)}</Text>
      <Text color={colors.text.disabled}>{BLOCK_EMPTY.repeat(Math.max(0, empty))}</Text>
      <Text color={col}>{" " + pctStr}</Text>
    </Box>
  );
}

// ── CPU Panel ───────────────────────────────────────────────────────────

function CpuPanel({ cores, width, height }: { cores: CoreInfo[]; width: number; height: number }) {
  // Card border = 2 rows (top+bottom), title = 1 row
  const innerW = Math.max(10, width - 6);
  // "coreN " = 6 chars, " XXX%  X.X GHz" = 14 chars
  const labelW = 6;
  const suffixW = 15;
  const barWidth = Math.max(5, innerW - labelW - suffixW);

  const totalUsage = Math.round(cores.reduce((s, c) => s + c.usage, 0) / cores.length);
  const load1 = (totalUsage * 0.08).toFixed(1);
  const load5 = (totalUsage * 0.07).toFixed(1);
  const load15 = (totalUsage * 0.06).toFixed(1);

  // Available content rows = panel height - 2 (border) - 1 (title)
  const contentRows = Math.max(2, height - 3);
  // Reserve 1 row for totals line; remaining rows for cores
  const maxCores = Math.max(1, contentRows - 1);
  const visibleCores = cores.slice(0, maxCores);

  return (
    <Card title="CPU" variant="storm" paddingLeft={1} paddingRight={1} paddingTop={0} paddingBottom={0}>
      <Box flexDirection="column" height={Math.max(1, contentRows)}>
        {visibleCores.map((c, i) => {
          const pctStr = `${c.usage}%`.padStart(4);
          const freqStr = `${c.freq.toFixed(1)} GHz`.padStart(9);
          return (
            <Box key={i} flexDirection="row">
              <Text color={colors.text.dim}>{`core${i} `.padEnd(labelW)}</Text>
              <CpuBar usage={c.usage} barWidth={barWidth} />
              <Text color={cpuColor(c.usage)}>{pctStr}</Text>
              <Text color={colors.text.dim}>{freqStr}</Text>
            </Box>
          );
        })}
        <Box flexDirection="row">
          <Text bold color={cpuColor(totalUsage)}>{"Total: " + totalUsage + "%"}</Text>
          <Text color={colors.text.dim}>{"  Load: " + load1 + " " + load5 + " " + load15}</Text>
        </Box>
      </Box>
    </Card>
  );
}

// ── Memory Panel ────────────────────────────────────────────────────────

function MemPanel({ mem, width, height }: { mem: MemInfo; width: number; height: number }) {
  const innerW = Math.max(10, width - 6);
  const barWidth = Math.max(5, innerW - 10); // 5 label + 5 pct

  // Available content rows = panel height - 2 (border) - 1 (title)
  const contentRows = Math.max(2, height - 3);
  // Base rows: RAM bar + Swap bar + blank + Used + Cache + Avail = 6
  // Disk section: blank + "Disks" header + 2 bars = 4
  const showDisks = contentRows >= 10;
  const showDiskSpacer = contentRows >= 11;

  return (
    <Card title="Memory" variant="storm" paddingLeft={1} paddingRight={1} paddingTop={0} paddingBottom={0}>
      <Box flexDirection="column" height={Math.max(1, contentRows)}>
        <MemBar pct={mem.ramPct} barWidth={barWidth} label="RAM" />
        <MemBar pct={mem.swapPct} barWidth={barWidth} label="Swap" />
        <Text>{""}</Text>
        <Text color={colors.text.secondary}>{"Used:  " + mem.usedGb.toFixed(1) + " / " + mem.totalGb.toFixed(1) + " GB"}</Text>
        <Text color={colors.text.secondary}>{"Cache: " + mem.cacheGb.toFixed(1) + " GB"}</Text>
        <Text color={colors.text.secondary}>{"Avail: " + mem.availGb.toFixed(1) + " GB"}</Text>
        {showDiskSpacer && <Text>{""}</Text>}
        {showDisks && (
          <>
            <Text bold color={colors.text.primary}>{"Disks"}</Text>
            <MemBar pct={mem.diskRoot} barWidth={Math.max(5, barWidth - 1)} label="/" />
            <MemBar pct={mem.diskHome} barWidth={Math.max(5, barWidth - 1)} label="/home" />
          </>
        )}
      </Box>
    </Card>
  );
}

// ── Network Panel ───────────────────────────────────────────────────────

function NetworkPanel({ net, width, height }: { net: NetInfo; width: number; height: number }) {
  const innerW = Math.max(10, width - 6);
  const sparkW = Math.max(10, innerW - 2);

  // Available content rows = panel height - 2 (border) - 1 (title)
  const contentRows = Math.max(2, height - 3);
  // Fixed rows: upload label(1) + download label(1) + upload summary(1) + download summary(1) = 4
  const fixedRows = 4;
  const availForSparklines = Math.max(2, contentRows - fixedRows);
  const sparkH = Math.max(1, Math.min(3, Math.floor(availForSparklines / 2)));
  const showSpacer = contentRows > fixedRows + sparkH * 2;

  const curUp = net.uploadHistory[net.uploadHistory.length - 1] ?? 0;
  const curDown = net.downloadHistory[net.downloadHistory.length - 1] ?? 0;
  const maxUp = Math.max(...net.uploadHistory, 1);
  const maxDown = Math.max(...net.downloadHistory, 1);

  return (
    <Card title="Network" variant="storm" paddingLeft={1} paddingRight={1} paddingTop={0} paddingBottom={0}>
      <Box flexDirection="column" height={Math.max(1, contentRows)}>
        <Text color={colors.success} bold>{"\u25B2 Upload"}</Text>
        <Sparkline
          data={net.uploadHistory}
          width={sparkW}
          height={sparkH}
          color={colors.success}
          colorFn={(v) => netColor(v, maxUp)}
        />
        <Text color={colors.brand.primary} bold>{"\u25BC Download"}</Text>
        <Sparkline
          data={net.downloadHistory}
          width={sparkW}
          height={sparkH}
          color={colors.brand.primary}
          colorFn={(v) => netColor(v, maxDown)}
        />
        {showSpacer && <Text>{""}</Text>}
        <Box flexDirection="row" gap={1}>
          <Text color={colors.success}>{"\u25B2 " + curUp.toFixed(1) + " MB/s"}</Text>
          <Text color={colors.text.dim}>{"Tot: " + net.uploadTotal.toFixed(1) + "GB"}</Text>
        </Box>
        <Box flexDirection="row" gap={1}>
          <Text color={colors.brand.primary}>{"\u25BC " + curDown.toFixed(1) + " MB/s"}</Text>
          <Text color={colors.text.dim}>{"Tot: " + net.downloadTotal.toFixed(1) + "GB"}</Text>
        </Box>
      </Box>
    </Card>
  );
}

// ── Process Panel ───────────────────────────────────────────────────────

function ProcessPanel({ procs, width, height }: { procs: ProcInfo[]; width: number; height: number }) {
  const innerH = Math.max(1, height - 3); // card chrome
  const visibleCount = Math.min(procs.length, Math.max(1, innerH - 1)); // 1 row for header
  const visible = procs.slice(0, visibleCount);

  // Column widths
  const pidW = 7;
  const userW = 8;
  const cpuW = 7;
  const memW = 7;

  function fmtRow(pid: string, user: string, cpu: string, mem: string, cmd: string): string {
    return pid.padEnd(pidW) + user.padEnd(userW) + cpu.padStart(cpuW) + mem.padStart(memW) + "  " + cmd;
  }

  return (
    <Card title="Processes" variant="storm" paddingLeft={1} paddingRight={1} paddingTop={0} paddingBottom={0}>
      <Box flexDirection="column" height={innerH}>
        {/* Header row */}
        <Text bold color={colors.text.dim}>
          {fmtRow("PID", "USER", "CPU%", "MEM%", "CMD")}
        </Text>
        {/* Process rows */}
        {visible.map((p, i) => {
          const isTop = i === 0;
          const rowColor = isTop ? colors.brand.light : colors.text.primary;
          const cpuCol = p.cpu > 10 ? colors.error : p.cpu > 5 ? colors.warning : colors.success;
          return (
            <Box key={p.pid} flexDirection="row">
              <Text color={isTop ? colors.brand.light : colors.text.dim}>
                {String(p.pid).padEnd(pidW)}
              </Text>
              <Text color={isTop ? colors.brand.light : colors.text.secondary}>
                {p.user.padEnd(userW)}
              </Text>
              <Text color={cpuCol}>
                {p.cpu.toFixed(1).padStart(cpuW)}
              </Text>
              <Text color={isTop ? colors.brand.light : colors.text.secondary}>
                {p.mem.toFixed(1).padStart(memW)}
              </Text>
              <Text color={rowColor}>
                {"  " + p.cmd}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Card>
  );
}

// ── Status Bar ──────────────────────────────────────────────────────────

function StatusBar({
  cores,
  mem,
  net,
  width,
}: {
  cores: CoreInfo[];
  mem: MemInfo;
  net: NetInfo;
  width: number;
}) {
  const totalCpu = Math.round(cores.reduce((s, c) => s + c.usage, 0) / cores.length);
  const curUp = net.uploadHistory[net.uploadHistory.length - 1] ?? 0;
  const curDown = net.downloadHistory[net.downloadHistory.length - 1] ?? 0;

  const segments = [
    ` CPU: ${totalCpu}%`,
    `MEM: ${mem.ramPct}%`,
    `SWAP: ${mem.swapPct}%`,
    `DISK: ${mem.diskRoot}%`,
    `NET: \u25B2${curUp.toFixed(1)} \u25BC${curDown.toFixed(1)} MB/s`,
  ];
  const left = segments.join("  ");
  const right = "q quit ";
  const padLen = Math.max(0, width - left.length - right.length);

  return (
    <Box height={1} width={width}>
      <Text inverse backgroundColor={colors.surface.raised} color={colors.text.primary}>
        {left + " ".repeat(padLen) + right}
      </Text>
    </Box>
  );
}

// ── Main App ────────────────────────────────────────────────────────────

function App() {
  const { width, height, exit } = useTerminal();
  const { flushSync } = useTui();

  // ── State ──────────────────────────────────────────────────────────
  const [cores, setCores] = useState<CoreInfo[]>(initialCores);
  const [mem, setMem] = useState<MemInfo>(initialMem);
  const [net, setNet] = useState<NetInfo>(initialNet);
  const [procs, setProcs] = useState<ProcInfo[]>(initialProcs);

  // ── Live updates — CPU + procs (1s) ────────────────────────────────
  useInterval(() => {
    flushSync(() => {
      setCores(tickCores);
      setProcs(tickProcs);
    });
  }, 1000);

  // ── Memory updates (2s) ────────────────────────────────────────────
  useInterval(() => {
    flushSync(() => {
      setMem(tickMem);
    });
  }, 2000);

  // ── Network updates (800ms) ────────────────────────────────────────
  useInterval(() => {
    flushSync(() => {
      setNet(tickNet);
    });
  }, 800);

  // ── Keyboard ───────────────────────────────────────────────────────
  useInput(
    useCallback(
      (e) => {
        if (e.key === "q" || (e.key === "c" && e.ctrl)) exit();
      },
      [exit],
    ),
  );

  // ── Layout calculations ────────────────────────────────────────────
  // Use flex proportions instead of pixel heights to avoid empty gaps.
  // Status bar = 1 fixed row. Top/bottom sections use flex.
  // We still compute approximate heights for panels that need row counts.
  const statusH = 1;
  const contentH = Math.max(8, height - statusH);
  const topH = Math.max(6, Math.floor(contentH * 3 / 5));
  const bottomH = Math.max(4, contentH - topH);

  // Width proportions: use flex, but panels still need width for bar calcs
  const cpuW = Math.max(30, Math.floor(width * 3 / 5));
  const memW = Math.max(20, width - cpuW);
  const netW = Math.max(25, Math.floor(width * 2 / 5));
  const procW = Math.max(30, width - netW);

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* ── Top row: CPU + Memory ─────────────────────────────────── */}
      <Box flex={3} flexDirection="row">
        <Box flex={3} overflow="hidden">
          <CpuPanel cores={cores} width={cpuW} height={topH} />
        </Box>
        <Box flex={2} overflow="hidden">
          <MemPanel mem={mem} width={memW} height={topH} />
        </Box>
      </Box>

      {/* ── Bottom row: Network + Processes ───────────────────────── */}
      <Box flex={2} flexDirection="row">
        <Box flex={2} overflow="hidden">
          <NetworkPanel net={net} width={netW} height={bottomH} />
        </Box>
        <Box flex={3} overflow="hidden">
          <ProcessPanel procs={procs} width={procW} height={bottomH} />
        </Box>
      </Box>

      {/* ── Status bar ────────────────────────────────────────────── */}
      <StatusBar cores={cores} mem={mem} net={net} width={width} />
    </Box>
  );
}

// ── Entry ───────────────────────────────────────────────────────────────

const app = render(<App />);
await app.waitUntilExit();
