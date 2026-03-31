#!/usr/bin/env npx tsx
/**
 * Storm TUI EXTREME Performance Benchmark Suite
 *
 * Honest, comprehensive benchmarks with real pipeline measurements.
 * Usage: npx tsx examples/benchmarks-extreme.ts
 */

import React from "react";
import { Writable } from "stream";
import { performance } from "perf_hooks";
import { ScreenBuffer } from "../src/core/buffer.js";
import { charWidth, stringWidth } from "../src/core/unicode.js";
import { DiffRenderer } from "../src/core/diff.js";
import { computeLayout, type LayoutNode, type LayoutResult } from "../src/layout/engine.js";
import { renderToString } from "../src/reconciler/render-to-string.js";
import { Box } from "../src/components/Box.js";
import { Text } from "../src/components/Text.js";
import { ScrollView } from "../src/components/ScrollView.js";
import { SyntaxHighlight } from "../src/widgets/SyntaxHighlight.js";

// ── Types & Helpers ─────────────────────────────────────────────────

interface BenchResult { min: number; max: number; avg: number; p50: number; p99: number; ops: number }

function bench(label: string, iterations: number, fn: () => void): BenchResult {
  for (let i = 0; i < Math.min(5, iterations); i++) fn(); // warmup
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  const sorted = [...times].sort((a, b) => a - b);
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  const avg = times.reduce((s, v) => s + v, 0) / times.length;
  const p50 = sorted[Math.floor(sorted.length * 0.5)]!;
  const p99 = sorted[Math.floor(sorted.length * 0.99)]!;
  return { min, max, avg, p50, p99, ops: 1000 / avg };
}

function fmtMs(ms: number): string {
  if (ms < 0.01) return `${(ms * 1000).toFixed(1)}us`;
  if (ms < 1) return `${ms.toFixed(2)}ms`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function fmtOps(ops: number): string {
  if (ops >= 1e6) return `${(ops / 1e6).toFixed(1)}M ops/s`;
  if (ops >= 1e3) return `${(ops / 1e3).toFixed(1)}K ops/s`;
  return `${ops.toFixed(0)} ops/s`;
}

function fmtMem(bytes: number): string {
  if (Math.abs(bytes) >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (Math.abs(bytes) >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function printResult(label: string, r: BenchResult, extra?: string): void {
  const pad = label.padEnd(36);
  const info = extra ?? fmtOps(r.ops);
  console.log(`  ${pad}avg ${fmtMs(r.avg).padEnd(9)} p50 ${fmtMs(r.p50).padEnd(9)} p99 ${fmtMs(r.p99).padEnd(9)} (${info})`);
  const gcSpike = r.max / r.p50;
  if (gcSpike > 3) {
    console.log(`  \x1b[33m\u26a0 GC spike: worst iteration ${fmtMs(r.max)} (${gcSpike.toFixed(1)}x median)\x1b[0m`);
  }
}

function section(title: string): void {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

function emptyLayout(): LayoutResult {
  return { x: 0, y: 0, width: 0, height: 0, innerX: 0, innerY: 0, innerWidth: 0, innerHeight: 0, contentHeight: 0, contentWidth: 0 };
}

function makeNode(props: LayoutNode["props"], children: LayoutNode[] = []): LayoutNode {
  return { props, children, layout: emptyLayout() };
}

// ── Output Header ───────────────────────────────────────────────────

console.log("\n\x1b[1;35m\u26a1 Storm TUI EXTREME Benchmark Suite\x1b[0m");
console.log("\x1b[35m" + "\u2501".repeat(60) + "\x1b[0m");
console.log(`
\x1b[2mLegend:
  B = billion       K = thousand      ops/s = operations per second
  M = million       us = microsecond  p50 = median latency
  GB = gigabyte     ms = millisecond  p99 = 99th percentile latency
  MB = megabyte     s = second        avg = arithmetic mean
  KB = kilobyte     FPS = frames/sec  GC = garbage collection\x1b[0m`);

// Check WASM status
try {
  const { isWasmAccelerated } = await import("../src/core/diff.js");
  console.log(`\n  \x1b[${isWasmAccelerated() ? "1;32" : "33"}mWASM acceleration: ${isWasmAccelerated() ? "ACTIVE (Rust renderLine)" : "OFF (pure TypeScript)"}\x1b[0m`);
} catch {
  console.log("\n  \x1b[33mWASM acceleration: OFF (pure TypeScript)\x1b[0m");
}

// ── 1. Buffer: 4K terminal ──────────────────────────────────────────
section("Buffer \u2014 4K Terminal (300x80 = 24,000 cells)");
{
  const W = 300, H = 80;
  printResult("create 300x80", bench("create", 200, () => { new ScreenBuffer(W, H); }));

  const buf = new ScreenBuffer(W, H);
  const longLine = "X".repeat(300);
  printResult("fill all 24K cells", bench("fill", 200, () => {
    for (let y = 0; y < H; y++) buf.writeString(0, y, longLine, 0xFFFFFF, 0x000000, 0);
  }));
  printResult("clear 24K cells", bench("clear", 500, () => { buf.clear(); }));
  printResult("clone 24K cells", bench("clone", 200, () => { buf.clone(); }));
}

// ── 1b. Buffer: Mega (500x200 = 100K cells) ────────────────────────
section("Buffer \u2014 Mega (500x200 = 100,000 cells)");
{
  const W = 500, H = 200;
  printResult("create 500x200", bench("create", 100, () => { new ScreenBuffer(W, H); }));

  const buf = new ScreenBuffer(W, H);
  const longLine = "X".repeat(500);
  printResult("fill all 100K cells", bench("fill", 100, () => {
    for (let y = 0; y < H; y++) buf.writeString(0, y, longLine, 0xFFFFFF, 0x000000, 0);
  }));
  printResult("clear 100K cells", bench("clear", 300, () => { buf.clear(); }));
  printResult("clone 100K cells", bench("clone", 100, () => { buf.clone(); }));
}

// ── 2. charWidth: 1 million characters ──────────────────────────────
section("charWidth \u2014 1 Million Characters");
{
  const codes = [65, 0x4E16, 0x1F600, 0x0300, 65, 65, 0x4E16, 65, 0x1F600, 65];
  const N = 1_000_000;
  const r = bench("1M mixed", 20, () => {
    for (let i = 0; i < N; i++) charWidth(codes[i % codes.length]!);
  });
  printResult("1M mixed chars", r, `${(N / (r.avg / 1000) / 1e9).toFixed(2)}B chars/sec`);

  const r2 = bench("1M ASCII", 20, () => {
    for (let i = 0; i < N; i++) charWidth(65 + (i % 26));
  });
  printResult("1M ASCII only", r2, `${(N / (r2.avg / 1000) / 1e9).toFixed(2)}B chars/sec`);

  const longStr = "Hello\u4e16\u754c\ud83c\udf0d".repeat(1000);
  printResult("stringWidth 10K chars", bench("sw", 50, () => { stringWidth(longStr); }));
}

// ── 3. Diff: extreme scenarios ──────────────────────────────────────
section("Diff \u2014 Extreme Scenarios (300x80)");
{
  const W = 300, H = 80;

  const diff1 = new DiffRenderer(W, H);
  let frame = 0;
  printResult("all 24K cells change", bench("worst", 100, () => {
    const buf = new ScreenBuffer(W, H);
    frame++;
    for (let y = 0; y < H; y++) {
      buf.writeString(0, y, `F${frame}R${y}${"=".repeat(W - 20)}`, frame * 31337, frame * 7919, 0);
    }
    diff1.render(buf);
  }));

  const diff2 = new DiffRenderer(W, H);
  const staticBuf = new ScreenBuffer(W, H);
  for (let y = 0; y < H; y++) staticBuf.writeString(0, y, `Static row ${y} ${"\u00b7".repeat(W - 20)}`);
  diff2.render(staticBuf);
  printResult("zero cells change", bench("noop", 500, () => { diff2.render(staticBuf); }));

  const diff3 = new DiffRenderer(W, H);
  const scrollBuf = new ScreenBuffer(W, H);
  for (let y = 0; y < H; y++) scrollBuf.writeString(0, y, `Line ${y}: content ${"\u2500".repeat(W - 25)}`);
  diff3.render(scrollBuf);
  let tick = 0;
  printResult("3 rows change (scroll)", bench("scroll", 300, () => {
    tick++;
    scrollBuf.writeString(0, 0, `Line 0: updated ${tick} ${"\u2500".repeat(W - 30)}`);
    scrollBuf.writeString(0, 39, `Line 39: cursor ${tick} ${"\u2500".repeat(W - 30)}`);
    scrollBuf.writeString(0, 79, `Status: frame ${tick} ${"\u2500".repeat(W - 30)}`);
    diff3.render(scrollBuf);
  }));
}

// ── 4. Layout: extreme tree sizes ───────────────────────────────────
section("Layout \u2014 Extreme Tree Sizes");
{
  for (const count of [5_000, 10_000, 50_000]) {
    const flat = makeNode(
      { flexDirection: "column", width: 300, height: 80 },
      Array.from({ length: count }, () => makeNode({ height: 1 })),
    );
    const iters = Math.max(3, Math.floor(50000 / count));
    printResult(`${(count / 1000).toFixed(0)}K flat children`, bench(`flat${count}`, iters, () => {
      computeLayout(flat, 0, 0, 300, 80);
    }));
  }

  let deep: LayoutNode = makeNode({ flex: 1 });
  for (let i = 0; i < 50; i++) {
    deep = makeNode({ flexDirection: i % 2 === 0 ? "column" : "row", flex: 1 }, [deep]);
  }
  printResult("50-level deep nesting", bench("deep", 200, () => { computeLayout(deep, 0, 0, 300, 80); }));

  const grid400 = makeNode(
    { display: "grid", gridTemplateColumns: Array(20).fill("1fr").join(" "), width: 300, height: 80 },
    Array.from({ length: 400 }, () => makeNode({})),
  );
  printResult("grid 20x20 (400 cells)", bench("grid", 100, () => { computeLayout(grid400, 0, 0, 300, 80); }));
}

// ── 5. SyntaxHighlight: cold vs cached ──────────────────────────────
section("SyntaxHighlight \u2014 Cold vs Cached");
{
  const codeLine = "const value: number = Math.floor(Math.random() * 1000); // benchmark\n";
  for (const lines of [100, 1000, 10_000, 50_000]) {
    const code = codeLine.repeat(lines);
    const label = lines >= 1000 ? `${(lines / 1000).toFixed(0)}K` : `${lines}`;

    // Cold: fresh render each time (no cache reuse)
    const coldR = bench(`${label} cold`, Math.max(2, Math.floor(5000 / lines)), () => {
      const result = renderToString(
        React.createElement(SyntaxHighlight, { code, language: "typescript", width: 120 }),
        { width: 120, height: 50 },
      );
      result.unmount();
    });
    printResult(`${label} lines TS (cold)`, coldR);

    // Cached: rerender same content in persistent tree
    const persistent = renderToString(
      React.createElement(SyntaxHighlight, { code, language: "typescript", width: 120 }),
      { width: 120, height: 50 },
    );
    const el = React.createElement(SyntaxHighlight, { code, language: "typescript", width: 120 });
    const cachedR = bench(`${label} cached`, Math.max(3, Math.floor(10000 / lines)), () => {
      persistent.rerender(el);
    });
    printResult(`${label} lines TS (cached)`, cachedR);
    persistent.unmount();
  }
}

// ── 6. ScrollView: extreme virtualization ───────────────────────────
section("ScrollView \u2014 Extreme Virtualization");
{
  for (const count of [1_000, 10_000, 100_000, 500_000]) {
    const children = Array.from({ length: count }, (_, i) =>
      React.createElement(Text, { key: i }, `Item ${i}: data row with content`),
    );
    const el = React.createElement(
      Box, { flexDirection: "column", width: 120, height: 40 },
      React.createElement(ScrollView, { flex: 1 }, children),
    );
    const iters = Math.max(3, Math.floor(100000 / count));
    const r = bench(`${(count / 1000).toFixed(0)}K`, iters, () => {
      const result = renderToString(el, { width: 120, height: 40 });
      result.unmount();
    });
    printResult(`${count.toLocaleString()} children`, r);
  }
}

// ── 7. Real FPS: full render pipeline ───────────────────────────────
section("Real FPS \u2014 Full Render Pipeline (Buffer \u2192 Diff \u2192 ANSI \u2192 Write)");
{
  const W = 120, H = 40;
  let totalBytes = 0;
  const nullStream = new Writable({ write(_chunk, _enc, cb) { totalBytes += (_chunk as Buffer).length; cb(); } });

  // Scenario 1: 3 rows change per frame (typical scroll)
  const diff1 = new DiffRenderer(W, H);
  const buf1 = new ScreenBuffer(W, H);
  for (let y = 0; y < H; y++) buf1.writeString(0, y, `Line ${y}: ${"\u2500".repeat(W - 15)}`);
  diff1.render(buf1); // prime
  totalBytes = 0;
  let t1 = 0;
  const r1 = bench("3 rows/frame", 1000, () => {
    t1++;
    buf1.writeString(0, 0, `Line 0: scroll ${t1} ${"\u2500".repeat(W - 25)}`);
    buf1.writeString(0, 19, `Line 19: cursor ${t1} ${"\u2500".repeat(W - 25)}`);
    buf1.writeString(0, 39, `Status: frame ${t1} ${"\u2500".repeat(W - 25)}`);
    const result = diff1.render(buf1);
    nullStream.write(result.output);
  });
  const scrollBytes = totalBytes;
  printResult("3 rows/frame (scroll)", r1, `${Math.floor(r1.ops)} actual FPS`);
  console.log(`  \x1b[2m  ${(scrollBytes / 1000 / 1000).toFixed(1)} KB avg/frame, ${(scrollBytes / 1024).toFixed(0)} KB total\x1b[0m`);

  // Scenario 2: full buffer change every frame
  const diff2 = new DiffRenderer(W, H);
  totalBytes = 0;
  let t2 = 0;
  const r2 = bench("full change/frame", 1000, () => {
    const buf = new ScreenBuffer(W, H);
    t2++;
    for (let y = 0; y < H; y++) {
      buf.writeString(0, y, `F${t2}R${y}: ${"#".repeat(W - 15)}`, t2 * 31337, t2 * 7919, 0);
    }
    const result = diff2.render(buf);
    nullStream.write(result.output);
  });
  const fullBytes = totalBytes;
  printResult("full change/frame", r2, `${Math.floor(r2.ops)} actual FPS`);
  console.log(`  \x1b[2m  ${(fullBytes / 1000 / 1000).toFixed(1)} KB avg/frame, ${(fullBytes / 1024).toFixed(0)} KB total\x1b[0m`);

  const lowFps = Math.floor(r2.ops);
  const highFps = Math.floor(r1.ops);
  console.log(`\n  \x1b[1;32m\u26a1 Storm delivers ${lowFps}\u2013${highFps} real FPS (${Math.floor(lowFps / 60)}\u2013${Math.floor(highFps / 60)}x above 60fps target)\x1b[0m`);
}

// ── 8. DECSTBM Scroll Region Benchmark ──────────────────────────────
section(`DECSTBM Scroll Regions \u2014 Theoretical Byte Comparison
  Compares bytes that WOULD be written for equivalent scroll operations.
  "Without DECSTBM" = actual DiffRenderer output for shifted buffer.
  "With DECSTBM" = theoretical DECSTBM sequence for same scroll.
  Note: DECSTBM activates only for full-width, single ScrollView, delta \u2264 5.`);
{
  const W = 120, H = 40;

  // Simulate what happens WITHOUT scroll regions:
  // Every scroll frame rewrites the full viewport
  const diffNormal = new DiffRenderer(W, H);
  const buf1 = new ScreenBuffer(W, H);
  for (let y = 0; y < H; y++) buf1.writeString(0, y, `Line ${y}: ${"content here ".repeat(8)}`.slice(0, W));
  diffNormal.render(buf1); // prime

  // Measure: shift all content up by 1 (simulates scroll without DECSTBM)
  let normalTotalBytes = 0;
  const normalFrames = 100;
  const normalTimes: number[] = [];
  for (let f = 0; f < normalFrames; f++) {
    // Shift all rows up by 1 (like scroll repaint)
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W; x++) {
        buf1.setCell(x, y, { char: buf1.getChar(x, y + 1), fg: buf1.getFg(x, y + 1), bg: buf1.getBg(x, y + 1), attrs: buf1.getAttrs(x, y + 1) });
      }
    }
    buf1.writeString(0, H - 1, `New line ${f + 100}: ${"fresh content ".repeat(7)}`.slice(0, W));
    const t0 = performance.now();
    const result = diffNormal.render(buf1);
    normalTimes.push(performance.now() - t0);
    normalTotalBytes += result.output.length;
  }
  const normalAvgBytes = normalTotalBytes / normalFrames;
  const normalAvgMs = normalTimes.reduce((s, v) => s + v, 0) / normalTimes.length;

  // Simulate what happens WITH scroll regions:
  // Terminal shifts pixels, we only write the new row + scroll commands
  // Build the DECSTBM output manually to measure bytes
  let decstbmTotalBytes = 0;
  const decstbmFrames = 100;
  const decstbmTimes: number[] = [];
  for (let f = 0; f < decstbmFrames; f++) {
    const t0 = performance.now();
    // The actual DECSTBM sequence Storm would emit:
    let output = "";
    output += `\x1b[1;${H}r`;              // Set scroll region (full viewport)
    output += `\x1b[1S`;                    // Scroll up 1 line
    output += `\x1b[r`;                     // Reset scroll region
    output += `\x1b[${H};1H`;              // Move cursor to last row
    // Write only the new row content with ANSI colors
    const newRow = `New line ${f + 100}: ${"fresh content ".repeat(7)}`.slice(0, W);
    output += `\x1b[38;2;212;160;83m`;     // fg color
    output += newRow;
    output += `\x1b[0m`;                   // reset
    decstbmTimes.push(performance.now() - t0);
    decstbmTotalBytes += output.length;
  }
  const decstbmAvgBytes = decstbmTotalBytes / decstbmFrames;
  const decstbmAvgMs = decstbmTimes.reduce((s, v) => s + v, 0) / decstbmTimes.length;

  // Report comparison
  console.log(`  \x1b[2m${W}x${H} viewport, 1-line scroll, ${normalFrames} frames each\x1b[0m\n`);

  console.log(`  Without DECSTBM (normal diff):`);
  console.log(`    avg ${fmtMs(normalAvgMs)}/frame   ${normalAvgBytes.toFixed(0)} bytes/frame   ${(normalTotalBytes / 1024).toFixed(0)} KB total`);

  console.log(`  With DECSTBM (scroll regions):`);
  console.log(`    avg ${fmtMs(decstbmAvgMs)}/frame   ${decstbmAvgBytes.toFixed(0)} bytes/frame   ${(decstbmTotalBytes / 1024).toFixed(0)} KB total`);

  const bytesRatio = normalAvgBytes / decstbmAvgBytes;
  const throughputSaved = ((1 - decstbmAvgBytes / normalAvgBytes) * 100).toFixed(0);

  console.log(`\n  \x1b[1;32mDECSTBM would save ${throughputSaved}% of stdout bytes (${bytesRatio.toFixed(0)}x less data)\x1b[0m`);
  console.log(`  \x1b[2m  ${normalAvgBytes.toFixed(0)} bytes (diff) vs ${decstbmAvgBytes.toFixed(0)} bytes (theoretical DECSTBM) per scroll frame\x1b[0m`);
  console.log(`  \x1b[2m  Note: actual savings depend on terminal DECSTBM support and scroll pattern\x1b[0m`);
}

// ── 9. Memory stress test ───────────────────────────────────────────
section("Memory \u2014 Stress Test");
{
  const gc = (globalThis as any).gc as (() => void) | undefined;
  if (typeof gc !== "function") console.log("  \x1b[2mNote: run with --expose-gc for accurate memory numbers\x1b[0m");
  gc?.();
  const baseline = process.memoryUsage().heapUsed;
  console.log(`  baseline                              ${fmtMem(baseline)}`);

  const bufs: ScreenBuffer[] = [];
  for (let i = 0; i < 100; i++) bufs.push(new ScreenBuffer(300, 80));
  const after100Bufs = process.memoryUsage().heapUsed;
  console.log(`  100 \u00d7 300x80 buffers                  +${fmtMem(after100Bufs - baseline)}`);
  bufs.length = 0;

  const nodes: LayoutNode[] = [];
  for (let i = 0; i < 10000; i++) nodes.push(makeNode({ flex: 1 }));
  const after10KNodes = process.memoryUsage().heapUsed;
  console.log(`  10,000 layout nodes                   +${fmtMem(after10KNodes - after100Bufs)}`);
  nodes.length = 0;

  gc?.();
  const afterGC = process.memoryUsage().heapUsed;
  console.log(`  after GC                              ${fmtMem(afterGC)} (retained)`);
}

// ── Summary ─────────────────────────────────────────────────────────
console.log("\n\x1b[35m" + "\u2501".repeat(60) + "\x1b[0m");
console.log("\x1b[1;35m  All extreme benchmarks complete. Storm is battle-tested.\x1b[0m\n");
