#!/usr/bin/env npx tsx
/** Performance benchmarks across all layers. Usage: npx tsx examples/benchmarks.ts */
import React from "react";
import { performance } from "perf_hooks";
import { ScreenBuffer } from "../src/core/buffer.js";
import { charWidth } from "../src/core/unicode.js";
import { DiffRenderer } from "../src/core/diff.js";
import { computeLayout, type LayoutNode, type LayoutResult } from "../src/layout/engine.js";
import { renderToString } from "../src/reconciler/render-to-string.js";
import { Box, Text, ScrollView, Markdown } from "../src/components/index.js";
import { SyntaxHighlight } from "../src/widgets/index.js";

// ── Helpers ────────────────────────────────────────────────────────────

interface BenchResult { min: number; max: number; avg: number; ops: number }

function bench(name: string, iterations: number, fn: () => void): BenchResult {
  // warmup
  for (let i = 0; i < Math.min(10, iterations); i++) fn();
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  const sorted = times.sort((a, b) => a - b);
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  const avg = times.reduce((s, v) => s + v, 0) / times.length;
  const ops = 1000 / avg;
  return { min, max, avg, ops };
}

function fmtMs(ms: number): string {
  return ms < 0.01 ? `${(ms * 1000).toFixed(1)}us` : `${ms.toFixed(2)}ms`;
}

function fmtOps(ops: number): string {
  if (ops >= 1_000_000) return `${(ops / 1_000_000).toFixed(1)}M ops/sec`;
  if (ops >= 1_000) return `${(ops / 1_000).toFixed(1)}K ops/sec`;
  return `${ops.toFixed(0)} ops/sec`;
}

function fmtMem(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function printResult(label: string, r: BenchResult, extra?: string): void {
  const pad = label.padEnd(26);
  const info = extra ?? fmtOps(r.ops);
  console.log(`  ${pad}${fmtMs(r.avg)} avg (${info})`);
}

function section(title: string): void {
  console.log(`\n${title}`);
}

function emptyLayout(): LayoutResult {
  return { x: 0, y: 0, width: 0, height: 0, innerX: 0, innerY: 0, innerWidth: 0, innerHeight: 0, contentHeight: 0, contentWidth: 0 };
}

function makeNode(props: LayoutNode["props"], children: LayoutNode[] = []): LayoutNode {
  return { props, children, layout: emptyLayout() };
}

// ── Benchmarks ─────────────────────────────────────────────────────────

console.log("\u26A1 Storm TUI Performance Benchmark Suite");
console.log("\u2550".repeat(50));

// 1. Buffer Operations
section("Buffer Operations");
{
  const r1 = bench("create", 500, () => { new ScreenBuffer(200, 50); });
  printResult("create 200x50", r1);

  const buf = new ScreenBuffer(200, 50);
  const r2 = bench("write 10K chars", 200, () => {
    for (let i = 0; i < 200; i++) {
      buf.writeString(0, i % 50, "Hello, Storm TUI Benchmark! Testing write performance across the entire buffer row. 0123456789");
    }
  });
  printResult("write 10K chars", r2);

  const r3 = bench("clear", 500, () => { buf.clear(); });
  printResult("clear", r3);

  const src = new ScreenBuffer(200, 50);
  src.writeString(0, 0, "Clone test data with some content for benchmarking.");
  const r4 = bench("clone", 500, () => { src.clone(); });
  printResult("clone", r4);
}

// 2. charWidth Lookup
section("charWidth Lookup");
{
  const ascii = "A".codePointAt(0)!;
  const cjk = "\u4E16".codePointAt(0)!; // CJK
  const emoji = 0x1F600; // grinning face
  const codes = [ascii, cjk, emoji, ascii, ascii, cjk, ascii, emoji, ascii, ascii];
  const N = 100_000;
  const r = bench("100K mixed chars", 50, () => {
    for (let i = 0; i < N; i++) {
      charWidth(codes[i % codes.length]!);
    }
  });
  const charsPerSec = N / (r.avg / 1000);
  const label = charsPerSec >= 1_000_000
    ? `${(charsPerSec / 1_000_000).toFixed(0)}M chars/sec`
    : `${(charsPerSec / 1_000).toFixed(0)}K chars/sec`;
  printResult("100K mixed chars", r, label);
}

// 3. Diff Renderer
section("Diff Renderer (200x50)");
{
  const W = 200, H = 50;

  // Identical buffers
  const diff1 = new DiffRenderer(W, H);
  const bufA = new ScreenBuffer(W, H);
  bufA.writeString(0, 0, "Hello world");
  diff1.render(bufA); // prime
  const r1 = bench("identical buffers", 300, () => { diff1.render(bufA); });
  printResult("identical buffers", r1);

  // 5 changed rows
  const diff2 = new DiffRenderer(W, H);
  const bufB = new ScreenBuffer(W, H);
  for (let y = 0; y < H; y++) bufB.writeString(0, y, `Row ${y}: static content that fills the row with data`);
  diff2.render(bufB); // prime
  const r2 = bench("5 changed rows", 300, () => {
    for (let i = 0; i < 5; i++) bufB.writeString(0, i * 10, `Row ${i * 10}: changed ${performance.now()}`);
    diff2.render(bufB);
  });
  printResult("5 changed rows", r2);

  // Full change
  const diff3 = new DiffRenderer(W, H);
  let toggle = false;
  const r3 = bench("full change", 200, () => {
    const buf = new ScreenBuffer(W, H);
    const ch = toggle ? "X" : "O";
    for (let y = 0; y < H; y++) buf.writeString(0, y, ch.repeat(W));
    diff3.render(buf);
    toggle = !toggle;
  });
  printResult("full change", r3);
}

// 4. Layout Engine
section("Layout Engine");
{
  // Invalidate cache on entire tree so each iteration does real work
  function dirtyAll(node: LayoutNode): void {
    node.dirty = true;
    node._prevProps = undefined;
    node._prevWidth = undefined;
    for (const child of node.children) dirtyAll(child);
  }

  function layoutBench(label: string, nodeCount: number, buildTree: (n: number) => LayoutNode): void {
    const tree = buildTree(nodeCount);
    const r = bench(label, 200, () => {
      dirtyAll(tree); // defeat incremental cache — measure real layout work
      computeLayout(tree, 0, 0, 200, 50);
    });
    printResult(label, r);
  }

  // Also benchmark cached (incremental) to show the difference
  function layoutBenchCached(label: string, nodeCount: number, buildTree: (n: number) => LayoutNode): void {
    const tree = buildTree(nodeCount);
    computeLayout(tree, 0, 0, 200, 50); // prime cache
    const r = bench(label, 200, () => { computeLayout(tree, 0, 0, 200, 50); });
    printResult(label, r, `${fmtOps(r.ops)} (cached)`);
  }

  // Flat column children
  const flatColumn = (n: number) => makeNode(
    { flexDirection: "column", width: 200, height: 50 },
    Array.from({ length: n }, () => makeNode({ height: 1 })),
  );
  layoutBench("10 children", 10, flatColumn);
  layoutBench("100 children", 100, flatColumn);
  layoutBench("1000 children", 1000, flatColumn);
  layoutBenchCached("1000 children (cached)", 1000, flatColumn);

  // Nested 10x10x10
  layoutBench("nested 10x10x10", 1000, () =>
    makeNode({ flexDirection: "column", width: 200, height: 50 },
      Array.from({ length: 10 }, () =>
        makeNode({ flexDirection: "row", flex: 1 },
          Array.from({ length: 10 }, () =>
            makeNode({ flexDirection: "column", flex: 1 },
              Array.from({ length: 10 }, () => makeNode({ flex: 1 })),
            ),
          ),
        ),
      ),
    ),
  );

  // Grid 10x10
  layoutBench("grid 10x10", 100, () =>
    makeNode(
      { display: "grid", gridTemplateColumns: "repeat(10, 1fr)", width: 200, height: 50 },
      Array.from({ length: 100 }, () => makeNode({})),
    ),
  );
}

// 5. SyntaxHighlight via renderToString
section("SyntaxHighlight (renderToString)");
{
  const codeLine = "const x: number = Math.random() * 100; // comment\n";
  for (const lines of [10, 100, 1000]) {
    const code = codeLine.repeat(lines);
    const iters = lines >= 1000 ? 5 : 20; // fewer iters for large inputs to avoid OOM
    const r = bench(`${lines} lines TS`, iters, () => {
      const result = renderToString(
        React.createElement(SyntaxHighlight, { code, language: "typescript", width: 80 }),
        { width: 80, height: Math.min(lines + 2, 200) },
      );
      result.unmount();
    });
    printResult(`${lines} lines TS`, r);
  }
}

// 6. Markdown via renderToString
section("Markdown (renderToString)");
{
  const mdLine = "## Heading\n\nSome **bold** and *italic* text with `inline code`.\n\n- List item one\n- List item two\n\n";
  for (const lines of [10, 100, 1000]) {
    const md = mdLine.repeat(Math.ceil(lines / 6));
    const iters = lines >= 1000 ? 5 : 20;
    const r = bench(`~${lines} lines md`, iters, () => {
      const result = renderToString(
        React.createElement(Markdown, { content: md, width: 80 }),
        { width: 80, height: Math.min(lines + 2, 200) },
      );
      result.unmount();
    });
    printResult(`~${lines} lines md`, r);
  }
}

// 7. ScrollView Virtualization
section("ScrollView Virtualization");
{
  for (const count of [100, 1_000, 10_000]) {
    const children = Array.from({ length: count }, (_, i) =>
      React.createElement(Text, { key: i }, `Item ${i}`),
    );
    const el = React.createElement(
      Box, { flexDirection: "column", width: 80, height: 24 },
      React.createElement(ScrollView, { flex: 1 }, ...children),
    );
    const iters = count >= 10_000 ? 3 : 10;
    const r = bench(`${count.toLocaleString()} children`, iters, () => {
      const result = renderToString(el, { width: 80, height: 24 });
      result.unmount();
    });
    printResult(`${count.toLocaleString()} children`, r);
  }
}

// 8. Memory Profile
section("Memory Profile");
{
  const gc = (globalThis as any).gc as (() => void) | undefined;
  const hasGC = typeof gc === "function";

  function heapUsed(): number {
    if (hasGC) gc!();
    return process.memoryUsage().heapUsed;
  }

  if (!hasGC) {
    console.log("  \x1b[2mNote: run with --expose-gc for accurate memory (node --expose-gc)\x1b[0m");
  }

  const baseline = heapUsed();
  console.log(`  baseline                ${fmtMem(baseline)}`);

  // Track references to prevent GC during measurement
  const refs: unknown[] = [];

  for (const count of [100, 1000]) {
    const before = heapUsed();
    const children = Array.from({ length: count }, (_, i) =>
      React.createElement(Text, { key: i }, `Component ${i}`),
    );
    const el = React.createElement(Box, { flexDirection: "column", width: 80, height: 24 }, ...children);
    const result = renderToString(el, { width: 80, height: Math.min(count + 2, 200) });
    refs.push(result); // prevent GC
    const after = heapUsed();
    const delta = after - before;
    console.log(`  ${count} components        ${delta > 0 ? "+" : ""}${fmtMem(delta)}`);
    result.unmount();
  }

  refs.length = 0; // release
  const retained = heapUsed();
  console.log(`  after cleanup           ${fmtMem(retained)} (retained)`);
}

// 9. Full Frame Benchmark
section("Full Frame (complex UI)");
{
  // Build a moderately complex UI tree
  const complexUI = React.createElement(
    Box, { flexDirection: "column", width: 120, height: 40 },
    React.createElement(Box, { height: 1, width: 120 },
      React.createElement(Text, { bold: true, color: "#D4A053" }, " Storm TUI "),
      React.createElement(Text, { dim: true }, " | Status: running"),
    ),
    React.createElement(Box, { flexDirection: "row", flex: 1 },
      React.createElement(Box, { flexDirection: "column", width: 30 },
        ...Array.from({ length: 15 }, (_, i) =>
          React.createElement(Text, { key: i, color: i % 2 ? "#6DBF8B" : "#D4D4D8" }, `  Nav item ${i + 1}`),
        ),
      ),
      React.createElement(Box, { flexDirection: "column", flex: 1 },
        React.createElement(SyntaxHighlight, {
          code: "const greet = (name: string) => {\n  console.log(`Hello, ${name}!`);\n};\ngreet('Storm');",
          language: "typescript",
          width: 88,
        }),
        ...Array.from({ length: 10 }, (_, i) =>
          React.createElement(Text, { key: `msg-${i}` }, `Message line ${i + 1}: Lorem ipsum dolor sit amet.`),
        ),
      ),
    ),
    React.createElement(Box, { height: 1 },
      React.createElement(Text, { dim: true }, " Ctrl+C to quit | Scroll to navigate"),
    ),
  );

  // Measure paint (renderToString does layout + paint)
  const paintR = bench("paint + layout", 50, () => {
    const result = renderToString(complexUI, { width: 120, height: 40 });
    result.unmount();
  });
  printResult("paint + layout", paintR);

  // Measure diff with ACTUAL changes (realistic scroll scenario)
  const diffR = new DiffRenderer(120, 40);
  const buf1 = new ScreenBuffer(120, 40);
  for (let y = 0; y < 40; y++) buf1.writeString(0, y, `Line ${y}: content that fills the row with realistic data ${"─".repeat(60)}`);
  diffR.render(buf1); // prime with initial content
  let diffTick = 0;
  const diffBench = bench("diff (3 rows changed)", 200, () => {
    diffTick++;
    buf1.writeString(0, 0, `Line 0: updated ${diffTick} ${"─".repeat(80)}`);
    buf1.writeString(0, 20, `Line 20: cursor ${diffTick} ${"─".repeat(80)}`);
    buf1.writeString(0, 39, `Status: frame ${diffTick} ${"─".repeat(80)}`);
    diffR.render(buf1);
  });
  printResult("diff (3 rows changed)", diffBench);

  // Also measure diff with NO changes (best case — cell-level skip)
  const diffNoop = bench("diff (no changes)", 200, () => { diffR.render(buf1); });
  printResult("diff (no changes)", diffNoop);

  // Full pipeline: reconcile + layout + paint in a single pass via renderToString
  // This is the real React frame cost — the dominant factor in total frame time
  const fullFrameR = bench("full frame (reconcile+layout+paint)", 50, () => {
    const result = renderToString(complexUI, { width: 120, height: 40 });
    result.unmount();
  });
  printResult("full frame (reconcile+layout+paint)", fullFrameR);

  // Realistic total: full render + diff with changes
  const totalMs = fullFrameR.avg + diffBench.avg;
  const fps = 1000 / totalMs;
  const check = fps >= 60 ? "\u2713" : "\u2717";
  console.log(`  render + diff total     ${fmtMs(totalMs)} avg → ${fps.toFixed(0)} internal fps ${check}`);
  console.log(`  \x1b[2mNote: excludes stdout write + terminal processing\x1b[0m`);
}

// ── Summary ────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(50)}`);
console.log("  All benchmarks complete.");
console.log("");
