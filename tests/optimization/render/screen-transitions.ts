/** Catches garbled output when switching between screen layouts (splash -> content -> empty -> full). */
import { ScreenBuffer as OptBuffer } from "../../../src/core/buffer.js";
import { DiffRenderer as OptDiff } from "../../../src/core/diff.js";
import { ScreenBuffer as OrigBuffer } from "/Users/hardy30894/Documents/storm-pre/storm/src/core/buffer.js";
import { DiffRenderer as OrigDiff } from "/Users/hardy30894/Documents/storm-pre/storm/src/core/diff.js";

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, "").replace(/\x1b[78]/g, "").replace(/\0/g, "");

let pass = 0, fail = 0;
function check(name: string, origOut: string, optOut: string) {
  const ov = strip(origOut), pv = strip(optOut);
  if (ov === pv) { pass++; }
  else {
    fail++;
    for (let i = 0; i < Math.max(ov.length, pv.length); i++) {
      if (ov[i] !== pv[i]) {
        console.log(`  FAIL: ${name} — char ${i}: orig=${JSON.stringify(ov.slice(i,i+30))} opt=${JSON.stringify(pv.slice(i,i+30))}`);
        return;
      }
    }
    console.log(`  FAIL: ${name} — length orig=${ov.length} opt=${pv.length}`);
  }
}

const W = 80, H = 24;

console.log(`\n  Screen Transition Tests — ${W}×${H}\n`);

// ── 1. Full screen → partial screen (the exact bug) ─���──────────────
// Splash fills all 24 rows. Next screen only fills rows 0-10.
// Rows 11-23 should be cleared, not show old splash content.
console.log("  1. Full → Partial");
{
  const ob = new OrigBuffer(W, H), od = new OrigDiff(W, H);
  const pb = new OptBuffer(W, H), pd = new OptDiff(W, H);

  // Frame 1: full splash screen
  for (let y = 0; y < H; y++) {
    ob.writeString(0, y, `SPLASH LINE ${y} ${"█".repeat(W - 20)}`, 0x1FF8800, 0, 1);
    pb.writeString(0, y, `SPLASH LINE ${y} ${"█".repeat(W - 20)}`, 0x1FF8800, 0, 1);
  }
  od.render(ob); pd.render(pb);

  // Frame 2: partial screen (only rows 0-10)
  ob.clear(); pb.clear();
  for (let y = 0; y < 11; y++) {
    ob.writeString(0, y, `CONTENT ROW ${y} ${"─".repeat(W - 20)}`, 0x182AAFF, 0, 0);
    pb.writeString(0, y, `CONTENT ROW ${y} ${"─".repeat(W - 20)}`, 0x182AAFF, 0, 0);
  }
  check("full→partial", od.render(ob).output, pd.render(pb).output);
}

// ── 2. Partial → full �� partial ─────────────────────────────────────
console.log("  2. Partial → Full → Partial");
{
  const ob = new OrigBuffer(W, H), od = new OrigDiff(W, H);
  const pb = new OptBuffer(W, H), pd = new OptDiff(W, H);

  // Frame 1: partial (5 rows)
  for (let y = 0; y < 5; y++) {
    ob.writeString(0, y, `HEADER ${y}`, 7, 0, 0);
    pb.writeString(0, y, `HEADER ${y}`, 7, 0, 0);
  }
  od.render(ob); pd.render(pb);

  // Frame 2: full screen
  ob.clear(); pb.clear();
  for (let y = 0; y < H; y++) {
    ob.writeString(0, y, `FULL ${y} ${"#".repeat(W - 10)}`, 1, 0, 0);
    pb.writeString(0, y, `FULL ${y} ${"#".repeat(W - 10)}`, 1, 0, 0);
  }
  check("partial→full", od.render(ob).output, pd.render(pb).output);

  // Frame 3: back to partial (3 rows)
  ob.clear(); pb.clear();
  for (let y = 0; y < 3; y++) {
    ob.writeString(0, y, `SMALL ${y}`, 2, 0, 0);
    pb.writeString(0, y, `SMALL ${y}`, 2, 0, 0);
  }
  check("full→small partial", od.render(ob).output, pd.render(pb).output);
}

// ── 3. Content → empty → content ─��──────────────────────────────────
console.log("  3. Content → Empty → Content");
{
  const ob = new OrigBuffer(W, H), od = new OrigDiff(W, H);
  const pb = new OptBuffer(W, H), pd = new OptDiff(W, H);

  for (let y = 0; y < H; y++) {
    ob.writeString(0, y, `DATA ${y}`, 7, 0, 0);
    pb.writeString(0, y, `DATA ${y}`, 7, 0, 0);
  }
  od.render(ob); pd.render(pb);

  // Empty frame
  ob.clear(); pb.clear();
  check("content→empty", od.render(ob).output, pd.render(pb).output);

  // Content again
  ob.clear(); pb.clear();
  for (let y = 0; y < H; y++) {
    ob.writeString(0, y, `BACK ${y}`, 3, 0, 0);
    pb.writeString(0, y, `BACK ${y}`, 3, 0, 0);
  }
  check("empty→content", od.render(ob).output, pd.render(pb).output);
}

// ── 4. Different row counts each frame (storm-website pattern) ──────
console.log("  4. Varying row counts (10 frames)");
{
  const ob = new OrigBuffer(W, H), od = new OrigDiff(W, H);
  const pb = new OptBuffer(W, H), pd = new OptDiff(W, H);

  const rowCounts = [24, 10, 24, 5, 24, 1, 24, 15, 3, 24];
  // Prime
  for (let y = 0; y < H; y++) { ob.writeString(0, y, "INIT", 7, 0, 0); pb.writeString(0, y, "INIT", 7, 0, 0); }
  od.render(ob); pd.render(pb);

  for (let f = 0; f < rowCounts.length; f++) {
    ob.clear(); pb.clear();
    const rows = rowCounts[f]!;
    for (let y = 0; y < rows; y++) {
      const text = `F${f}R${y} ${"=".repeat(W - 10)}`.slice(0, W);
      const fg = 0x1000000 | ((f * 40) << 16) | ((y * 10) << 8) | 0xFF;
      ob.writeString(0, y, text, fg, 0, f % 8);
      pb.writeString(0, y, text, fg, 0, f % 8);
    }
    check(`frame ${f} (${rows} rows)`, od.render(ob).output, pd.render(pb).output);
  }
}

// ── 5. Style-only change on some rows, content change on others ─────
console.log("  5. Mixed style + content changes");
{
  const ob = new OrigBuffer(W, H), od = new OrigDiff(W, H);
  const pb = new OptBuffer(W, H), pd = new OptDiff(W, H);

  for (let y = 0; y < H; y++) {
    ob.writeString(0, y, `ROW ${y} CONTENT`, 7, 0, 0);
    pb.writeString(0, y, `ROW ${y} CONTENT`, 7, 0, 0);
  }
  od.render(ob); pd.render(pb);

  ob.clear(); pb.clear();
  for (let y = 0; y < H; y++) {
    if (y < 5) {
      // Same content, different color (style-only change)
      ob.writeString(0, y, `ROW ${y} CONTENT`, 1, 0, 0);
      pb.writeString(0, y, `ROW ${y} CONTENT`, 1, 0, 0);
    } else if (y < 15) {
      // Different content
      ob.writeString(0, y, `CHANGED ${y} NEW`, 3, 2, 1);
      pb.writeString(0, y, `CHANGED ${y} NEW`, 3, 2, 1);
    }
    // Rows 15-23: empty (cleared)
  }
  check("mixed changes", od.render(ob).output, pd.render(pb).output);
}

// ── 6. Rapid full→empty→full cycle (30 frames) ─────────────────────
console.log("  6. Rapid full↔empty cycle (30 frames)");
{
  const ob = new OrigBuffer(W, H), od = new OrigDiff(W, H);
  const pb = new OptBuffer(W, H), pd = new OptDiff(W, H);

  for (let y = 0; y < H; y++) { ob.writeString(0, y, "X".repeat(W), 7, 0, 0); pb.writeString(0, y, "X".repeat(W), 7, 0, 0); }
  od.render(ob); pd.render(pb);

  for (let f = 0; f < 30; f++) {
    ob.clear(); pb.clear();
    if (f % 2 === 0) {
      // Full screen with unique content
      for (let y = 0; y < H; y++) {
        ob.writeString(0, y, `F${f}${"#".repeat(W - 5)}`, (f + 1) % 8, 0, 0);
        pb.writeString(0, y, `F${f}${"#".repeat(W - 5)}`, (f + 1) % 8, 0, 0);
      }
    }
    // Odd frames: empty (just cleared)
    check(`cycle frame ${f}`, od.render(ob).output, pd.render(pb).output);
  }
}

// ── 7. clearPaintedRows path (incremental) ──────────────────────────
console.log("  7. clearPaintedRows transitions");
{
  const pb = new OptBuffer(W, H), pd = new OptDiff(W, H);
  const ob = new OrigBuffer(W, H), od = new OrigDiff(W, H);

  // Frame 1: paint 10 rows
  for (let y = 0; y < 10; y++) { ob.writeString(0, y, `ROW${y}${"─".repeat(W-6)}`, 7, 0, 0); pb.writeString(0, y, `ROW${y}${"─".repeat(W-6)}`, 7, 0, 0); }
  od.render(ob); pd.render(pb);

  // Frame 2: clearPaintedRows + paint only 3 rows (rows 0-9 should clear, 0-2 get new content)
  ob.clear(); pb.clearPaintedRows();
  for (let y = 0; y < 3; y++) { ob.writeString(0, y, `NEW${y}${"═".repeat(W-6)}`, 1, 0, 0); pb.writeString(0, y, `NEW${y}${"═".repeat(W-6)}`, 1, 0, 0); }
  check("clearPaintedRows shrink", od.render(ob).output, pd.render(pb).output);

  // Frame 3: clearPaintedRows + paint 20 rows (expand)
  ob.clear(); pb.clearPaintedRows();
  for (let y = 0; y < 20; y++) { ob.writeString(0, y, `BIG${y}${"━".repeat(W-6)}`, 2, 0, 0); pb.writeString(0, y, `BIG${y}${"━".repeat(W-6)}`, 2, 0, 0); }
  check("clearPaintedRows expand", od.render(ob).output, pd.render(pb).output);
}

// ── Results ��────────────────────────────────────────────────────────
console.log(`\n  Screen transitions: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
