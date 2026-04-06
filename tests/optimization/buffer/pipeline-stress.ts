/** Full pipeline stress: 100+ frames of realistic UI scenarios compared frame-by-frame. */
import { ScreenBuffer as OrigBuffer } from "/Users/hardy30894/Documents/storm-pre/storm/src/core/buffer.js";
import { DiffRenderer as OrigDiff } from "/Users/hardy30894/Documents/storm-pre/storm/src/core/diff.js";
import { ScreenBuffer as OptBuffer } from "../../../src/core/buffer.js";
import { DiffRenderer as OptDiff } from "../../../src/core/diff.js";

const W = 120, H = 30;
let pass = 0, fail = 0, total = 0, byteDiffs = 0;

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, "").replace(/\x1b[78]/g, "").replace(/\0/g, "");

function check(name: string, origOut: string, optOut: string) {
  total++;
  const origVis = strip(origOut);
  const optVis = strip(optOut);
  if (origVis === optVis) {
    pass++;
    if (origOut !== optOut) byteDiffs++;
  } else {
    fail++;
    console.log(`FAIL [frame ${total}]: ${name}`);
    for (let i = 0; i < Math.max(origVis.length, optVis.length); i++) {
      if (origVis[i] !== optVis[i]) {
        console.log(`  visual diff at char ${i}: orig=${JSON.stringify(origVis.slice(i, i+20))} opt=${JSON.stringify(optVis.slice(i, i+20))}`);
        break;
      }
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function paintUI(buf: any, frame: number) {
  // Simulates a real UI: header, content area, status bar
  // Header (row 0)
  for (let x = 0; x < W; x++) buf.setCell(x, 0, { char: x < 6 ? "STORM "[x]! : "─", fg: 0x82AAFF, bg: 0x0A0A0A, attrs: x < 6 ? 1 : 0, ulColor: -1 });

  // Spinner on row 0 (changes every frame)
  const spinners = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
  buf.setCell(W - 2, 0, { char: spinners[frame % 10]!, fg: 0x82AAFF, bg: 0x0A0A0A, attrs: 0, ulColor: -1 });

  // Content area (rows 2-25) — static text
  for (let y = 2; y < 25; y++) {
    const text = `Line ${y}: ${"content ".repeat(10)}`;
    for (let x = 0; x < Math.min(text.length, W); x++) {
      buf.setCell(x, y, { char: text[x]!, fg: 0xC0CAF5, bg: 0x0A0A0A, attrs: 0, ulColor: -1 });
    }
  }

  // Status bar (row 28)
  const status = `Frame ${frame} | Tokens: ${frame * 42} | ${new Date().toISOString().slice(11, 19)}`;
  for (let x = 0; x < Math.min(status.length, W); x++) {
    buf.setCell(x, 28, { char: status[x]!, fg: 0x565F89, bg: 0x0A0A0A, attrs: 0, ulColor: -1 });
  }
}

function paintUIWithMessage(buf: any, frame: number, msgRow: number) {
  paintUI(buf, frame);
  // Add a new message at msgRow
  const msg = `[${frame}] New message appeared at row ${msgRow}`;
  for (let x = 0; x < Math.min(msg.length, W); x++) {
    buf.setCell(x + 2, msgRow, { char: msg[x]!, fg: 0x9ECE6A, bg: 0x1E2030, attrs: 1, ulColor: -1 });
  }
}

// ── Test 1: 100 spinner frames (1 cell changes per frame) ────────

console.log("  Test 1: 100 spinner frames...");
{
  const ob = new OrigBuffer(W, H); const od = new OrigDiff(W, H);
  const pb = new OptBuffer(W, H); const pd = new OptDiff(W, H);
  // Prime
  paintUI(ob, 0); paintUI(pb, 0);
  od.render(ob); pd.render(pb);

  for (let f = 1; f <= 100; f++) {
    ob.clear(); pb.clearPaintedRows();
    paintUI(ob, f); paintUI(pb, f);
    const o = od.render(ob); const p = pd.render(pb);
    check(`spinner frame ${f}`, o.output, p.output);
  }
}

// ── Test 2: Messages appearing (rows added progressively) ────────

console.log("  Test 2: 30 messages appearing...");
{
  const ob = new OrigBuffer(W, H); const od = new OrigDiff(W, H);
  const pb = new OptBuffer(W, H); const pd = new OptDiff(W, H);
  paintUI(ob, 0); paintUI(pb, 0);
  od.render(ob); pd.render(pb);

  for (let f = 1; f <= 30; f++) {
    ob.clear(); pb.clearPaintedRows();
    // Each frame adds a message at a different row
    paintUIWithMessage(ob, f, 2 + (f % 23));
    paintUIWithMessage(pb, f, 2 + (f % 23));
    const o = od.render(ob); const p = pd.render(pb);
    check(`message frame ${f}`, o.output, p.output);
  }
}

// ── Test 3: Content shrinking (fewer rows painted) ───────────────

console.log("  Test 3: Content shrinking...");
{
  const ob = new OrigBuffer(W, H); const od = new OrigDiff(W, H);
  const pb = new OptBuffer(W, H); const pd = new OptDiff(W, H);

  // Frame 1: paint all 30 rows
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    { ob.setCell(x, y, { char: "#", fg: 1, bg: 0, attrs: 0, ulColor: -1 }); pb.setCell(x, y, { char: "#", fg: 1, bg: 0, attrs: 0, ulColor: -1 }); }
  od.render(ob); pd.render(pb);

  // Frame 2-11: progressively fewer rows
  for (let f = 0; f < 10; f++) {
    ob.clear(); pb.clearPaintedRows();
    const rowCount = H - f * 3;
    for (let y = 0; y < Math.max(1, rowCount); y++) for (let x = 0; x < W; x++)
      { ob.setCell(x, y, { char: ".", fg: 2, bg: 0, attrs: 0, ulColor: -1 }); pb.setCell(x, y, { char: ".", fg: 2, bg: 0, attrs: 0, ulColor: -1 }); }
    const o = od.render(ob); const p = pd.render(pb);
    check(`shrink to ${Math.max(1, rowCount)} rows`, o.output, p.output);
  }
}

// ── Test 4: Rapid alternation (simulates scroll/animation jank) ──

console.log("  Test 4: 50 rapid alternating frames...");
{
  const ob = new OrigBuffer(W, H); const od = new OrigDiff(W, H);
  const pb = new OptBuffer(W, H); const pd = new OptDiff(W, H);
  paintUI(ob, 0); paintUI(pb, 0);
  od.render(ob); pd.render(pb);

  for (let f = 1; f <= 50; f++) {
    ob.clear(); pb.clearPaintedRows();
    if (f % 2 === 0) {
      paintUI(ob, f); paintUI(pb, f);
    } else {
      // Odd frames: paint different rows (simulates scroll)
      for (let y = 10; y < 20; y++) for (let x = 0; x < W; x++) {
        const c = String.fromCharCode(65 + ((x + y + f) % 26));
        ob.setCell(x, y, { char: c, fg: 0xFFFF00, bg: 0x000080, attrs: 0, ulColor: -1 });
        pb.setCell(x, y, { char: c, fg: 0xFFFF00, bg: 0x000080, attrs: 0, ulColor: -1 });
      }
    }
    const o = od.render(ob); const p = pd.render(pb);
    check(`alternating frame ${f}`, o.output, p.output);
  }
}

// ── Test 5: Empty frames (nothing painted) ───────────────────────

console.log("  Test 5: Empty frames after content...");
{
  const ob = new OrigBuffer(W, H); const od = new OrigDiff(W, H);
  const pb = new OptBuffer(W, H); const pd = new OptDiff(W, H);
  // Full content
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    { ob.setCell(x, y, { char: "X", fg: 5, bg: 6, attrs: 0, ulColor: -1 }); pb.setCell(x, y, { char: "X", fg: 5, bg: 6, attrs: 0, ulColor: -1 }); }
  od.render(ob); pd.render(pb);

  // 5 empty frames
  for (let f = 0; f < 5; f++) {
    ob.clear(); pb.clearPaintedRows();
    const o = od.render(ob); const p = pd.render(pb);
    check(`empty frame ${f}`, o.output, p.output);
  }
  // Then content again
  ob.clear(); pb.clearPaintedRows();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    { ob.setCell(x, y, { char: "Y", fg: 7, bg: 8, attrs: 0, ulColor: -1 }); pb.setCell(x, y, { char: "Y", fg: 7, bg: 8, attrs: 0, ulColor: -1 }); }
  const o = od.render(ob); const p = pd.render(pb);
  check("content after empty", o.output, p.output);
}

// ── Test 6: writeString + fill + blit ────────────────────────────

console.log("  Test 6: Mixed operations...");
{
  const ob = new OrigBuffer(W, H); const od = new OrigDiff(W, H);
  const pb = new OptBuffer(W, H); const pd = new OptDiff(W, H);

  for (let f = 0; f < 20; f++) {
    ob.clear(); pb.clearPaintedRows();
    // writeString
    ob.writeString(5, 3, `Frame ${f}: Hello World`, 0xFFFFFF, 0, 0);
    pb.writeString(5, 3, `Frame ${f}: Hello World`, 0xFFFFFF, 0, 0);
    // fill a region
    ob.fill(10, 10, 30, 5, "█", 0x82AAFF, 0x0A0A0A);
    pb.fill(10, 10, 30, 5, "█", 0x82AAFF, 0x0A0A0A);
    // setCell scattered
    for (let i = 0; i < 10; i++) {
      const x = (f * 7 + i * 13) % W;
      const y = (f * 3 + i * 5) % H;
      ob.setCell(x, y, { char: "*", fg: 0xFF0000, bg: 0, attrs: 1, ulColor: -1 });
      pb.setCell(x, y, { char: "*", fg: 0xFF0000, bg: 0, attrs: 1, ulColor: -1 });
    }
    const o = od.render(ob); const p = pd.render(pb);
    check(`mixed ops frame ${f}`, o.output, p.output);
  }
}

// ── Results ──────────────────────────────────────────────────────

console.log(`\n  Pipeline stress: ${pass}/${total} passed, ${fail} failed`);
if (byteDiffs > 0) console.log(`  (${byteDiffs} had shorter SGR encoding but identical visual output)`);
console.log();
if (fail > 0) process.exit(1);
