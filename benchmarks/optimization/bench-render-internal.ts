/** render() internal breakdown — measures the real diff.render() function. */
import { performance } from "perf_hooks";
import { ScreenBuffer } from "../../src/core/buffer.js";
import { DiffRenderer } from "../../src/core/diff.js";
import { DEFAULT_COLOR, Attr } from "../../src/core/types.js";

const W = 300, H = 80, WARMUP = 300, ITERS = 5000;

function median(a: number[]): number {
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)]!;
}
function p5(a: number[]): number {
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor(s.length * 0.05)]!;
}
function fmt(us: number): string { return us.toFixed(2).padStart(7); }

function run(label: string, fn: () => void): { label: string; samples: number[] } {
  for (let i = 0; i < WARMUP; i++) fn();
  const samples: number[] = [];
  for (let i = 0; i < ITERS; i++) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  return { label, samples };
}

// ── Setup ───────────────────────────────────────────────────────────

const buf = new ScreenBuffer(W, H);
for (let y = 0; y < H; y++) buf.writeString(0, y, "A".repeat(W), 7, 0, Attr.NONE);
const diff = new DiffRenderer(W, H);

// Prime: 2 frames to stabilize prevBuffer + prevLines
diff.render(buf);
buf.resetPaintTracking();
for (let y = 0; y < H; y++) buf.writeString(0, y, "A".repeat(W), 7, 0, Attr.NONE);
diff.render(buf);

const cell1 = { char: "X", fg: 1, bg: 2, attrs: Attr.BOLD, ulColor: DEFAULT_COLOR };
const cellA = { char: "A", fg: 7, bg: 0, attrs: Attr.NONE, ulColor: DEFAULT_COLOR };

console.log(`\nrender() Breakdown — REAL diff.render() (${W}x${H})`);
console.log(`Iterations: ${ITERS}, Warmup: ${WARMUP}\n`);

// ── 1. REAL diff.render() — direct cell (1 cell change) ────────────

const r_direct = run("diff.render() — direct cell (1 cell)", () => {
  buf.resetPaintTracking();
  buf.setCell(150, 40, cell1);
  diff.render(buf);
  buf.resetPaintTracking();
  buf.setCell(150, 40, cellA);
  diff.render(buf);
});
r_direct.samples = r_direct.samples.map(s => s / 2);

// ── 2. REAL diff.render() — incremental (1 row repaint + 1 cell) ───

const r_incr = run("diff.render() — incremental (1 row + cell)", () => {
  buf.resetPaintTracking();
  buf.writeString(0, 0, "A".repeat(W), 7, 0, Attr.NONE);
  buf.setCell(150, 0, cell1);
  diff.render(buf);
  buf.resetPaintTracking();
  buf.writeString(0, 0, "A".repeat(W), 7, 0, Attr.NONE);
  buf.setCell(150, 0, cellA);
  diff.render(buf);
});
r_incr.samples = r_incr.samples.map(s => s / 2);

// ── 3. REAL diff.render() — full repaint (10 rows + 1 cell) ────────

const PAINTED = [0, 1, 5, 6, 7, 25, 26, 40, 41, 79];
const r_full = run("diff.render() — full repaint (10 rows + cell)", () => {
  buf.clearPaintedRows();
  for (const y of PAINTED) buf.writeString(0, y, "A".repeat(W), 7, 0, Attr.NONE);
  buf.setCell(150, 0, cell1);
  diff.render(buf);
  buf.clearPaintedRows();
  for (const y of PAINTED) buf.writeString(0, y, "A".repeat(W), 7, 0, Attr.NONE);
  buf.setCell(150, 0, cellA);
  diff.render(buf);
});
r_full.samples = r_full.samples.map(s => s / 2);

// ── 4. Sub-operation isolation (to explain the total) ───────────────

const prevBuf = buf.clone();
buf.resetPaintTracking();
buf.setCell(150, 40, cell1);

const r_rowScan = run("  rowScan: wasRowPainted×80 + rowEquals×1", () => {
  let changed = 0;
  for (let y = 0; y < H; y++) {
    if (!buf.wasRowPainted(y)) continue;
    if (!buf.rowEquals(prevBuf, y)) changed++;
  }
  if (changed < 0) throw 0;
});

const r_getRowDmg = run("  getRowDamage(40)", () => {
  const d = buf.getRowDamage(40);
  if (d === undefined) throw 0;
});

const nRow = buf.getRowRaw(40)!;
const pRow = prevBuf.getRowRaw(40)!;
const rowDmg = buf.getRowDamage(40);

const r_scanNarrow = run("  cell scan: per-row damage [150,151)", () => {
  const x1 = rowDmg ? rowDmg[0] : 0;
  const x2 = rowDmg ? rowDmg[1] : W;
  let runStart = -1, count = 0;
  for (let x = x1; x < x2; x++) {
    const ni = nRow.base + x, pi = pRow.base + x;
    const changed = nRow.codes[ni] !== pRow.codes[pi] || nRow.fgs[ni] !== pRow.fgs[pi] ||
      nRow.bgs[ni] !== pRow.bgs[pi] || nRow.attrs[ni] !== pRow.attrs[pi] || nRow.ulColors[ni] !== pRow.ulColors[pi];
    if (changed) { if (runStart < 0) runStart = x; }
    else { if (runStart >= 0) { count++; runStart = -1; } }
  }
  if (count < 0) throw 0;
});

const r_scanFull = run("  cell scan: full width [0,300)", () => {
  let runStart = -1, count = 0;
  for (let x = 0; x < W; x++) {
    const ni = nRow.base + x, pi = pRow.base + x;
    const changed = nRow.codes[ni] !== pRow.codes[pi] || nRow.fgs[ni] !== pRow.fgs[pi] ||
      nRow.bgs[ni] !== pRow.bgs[pi] || nRow.attrs[ni] !== pRow.attrs[pi] || nRow.ulColors[ni] !== pRow.ulColors[pi];
    if (changed) { if (runStart < 0) runStart = x; }
    else { if (runStart >= 0) { count++; runStart = -1; } }
  }
  if (count < 0) throw 0;
});

const r_copy = run("  copyRowsFrom (1 painted row)", () => {
  buf.resetPaintTracking();
  buf.setCell(150, 40, cell1);
  prevBuf.copyRowsFrom(buf);
});

// ── Print ───────────────────────────────────────────────────────────

const all = [r_direct, r_incr, r_full, r_rowScan, r_getRowDmg, r_scanNarrow, r_scanFull, r_copy];

const maxL = Math.max(...all.map(r => r.label.length));
console.log(`${"Operation".padEnd(maxL)}    ${"p5".padStart(7)}    ${"p50".padStart(7)}`);
console.log("─".repeat(maxL + 20));
for (const r of all) {
  console.log(`${r.label.padEnd(maxL)}  ${fmt(p5(r.samples) * 1000)}  ${fmt(median(r.samples) * 1000)}`);
}

console.log(`\n─── Per-row damage: narrow vs full scan ───`);
const narrow = median(r_scanNarrow.samples) * 1000;
const full = median(r_scanFull.samples) * 1000;
console.log(`  Full [0,300):    ${fmt(full)} us`);
console.log(`  Narrow [150,151): ${fmt(narrow)} us`);
console.log(`  Savings:          ${fmt(full - narrow)} us (${((1 - narrow / full) * 100).toFixed(0)}%)`);
console.log();
