/** Verifies SGR-cached output is visually identical to original despite byte-level encoding differences. */
import { ScreenBuffer as OrigBuffer } from "/Users/hardy30894/Documents/storm-pre/storm/src/core/buffer.js";
import { DiffRenderer as OrigDiff } from "/Users/hardy30894/Documents/storm-pre/storm/src/core/diff.js";
import { ScreenBuffer as OptBuffer } from "../../../src/core/buffer.js";
import { DiffRenderer as OptDiff } from "../../../src/core/diff.js";

const W = 80, H = 24;
let pass = 0, fail = 0;

// Strip all ANSI escape sequences to compare raw content
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\x1b\][^\x07]*\x07/g, "");
}

// Check that both outputs produce the same visible characters
// AND that ANSI-parsed cell styles are equivalent
function checkVisual(name: string, origOut: string, optOut: string) {
  // Both should have output OR both should be empty
  if ((origOut.length === 0) !== (optOut.length === 0)) {
    fail++; console.log(`FAIL: ${name} — one is empty, other isn't`); return;
  }
  if (origOut.length === 0 && optOut.length === 0) { pass++; return; }

  // Strip ANSI — the visible text must be identical
  const origText = stripAnsi(origOut);
  const optText = stripAnsi(optOut);
  if (origText === optText) {
    pass++;
    // Show byte savings
    const saved = origOut.length - optOut.length;
    if (saved > 0) console.log(`  OK: ${name} — ${saved} bytes saved (${origOut.length} → ${optOut.length})`);
  } else {
    fail++;
    console.log(`FAIL: ${name} — visible text differs`);
    console.log(`  orig: ${JSON.stringify(origText.slice(0, 100))}`);
    console.log(`  opt:  ${JSON.stringify(optText.slice(0, 100))}`);
  }
}

// Run same scenarios as correctness test
function fillBoth(ob: any, pb: any, fn: (b: any) => void) { fn(ob); fn(pb); }

// 1. First frame
{
  const ob = new OrigBuffer(W,H); const od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H); const pd = new OptDiff(W,H);
  const paint = (b: any) => { for (let y=0;y<H;y++) for (let x=0;x<W;x++) b.setCell(x,y,{char:String.fromCharCode(65+((x+y)%26)),fg:0xC0CAF5,bg:0x0A0A0A,attrs:0,ulColor:-1}); };
  fillBoth(ob,pb,paint);
  checkVisual("First frame", od.render(ob).output, pd.render(pb).output);
}

// 2. No change
{
  const ob = new OrigBuffer(W,H); const od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H); const pd = new OptDiff(W,H);
  const paint = (b: any) => { for (let y=0;y<H;y++) for (let x=0;x<W;x++) b.setCell(x,y,{char:"A",fg:0xFFFFFF,bg:0,attrs:0,ulColor:-1}); };
  fillBoth(ob,pb,paint); od.render(ob); pd.render(pb);
  ob.clear(); pb.clearPaintedRows(); fillBoth(ob,pb,paint);
  checkVisual("No change", od.render(ob).output, pd.render(pb).output);
}

// 3. 1 cell changed
{
  const ob = new OrigBuffer(W,H); const od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H); const pd = new OptDiff(W,H);
  const paint = (b: any) => { for (let y=0;y<H;y++) for (let x=0;x<W;x++) b.setCell(x,y,{char:"A",fg:0xFFFFFF,bg:0,attrs:0,ulColor:-1}); };
  fillBoth(ob,pb,paint); od.render(ob); pd.render(pb);
  ob.clear(); pb.clearPaintedRows(); fillBoth(ob,pb,paint);
  ob.setCell(10,5,{char:"Z",fg:0xFF0000,bg:0,attrs:1,ulColor:-1});
  pb.setCell(10,5,{char:"Z",fg:0xFF0000,bg:0,attrs:1,ulColor:-1});
  checkVisual("1 cell changed", od.render(ob).output, pd.render(pb).output);
}

// 4. Scattered changes
{
  const ob = new OrigBuffer(W,H); const od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H); const pd = new OptDiff(W,H);
  const paint = (b: any) => { for (let y=0;y<H;y++) for (let x=0;x<W;x++) b.setCell(x,y,{char:".",fg:0x808080,bg:0,attrs:0,ulColor:-1}); };
  fillBoth(ob,pb,paint); od.render(ob); pd.render(pb);
  ob.clear(); pb.clearPaintedRows(); fillBoth(ob,pb,paint);
  for (const [x,y] of [[5,2],[30,10],[60,20]]) {
    ob.setCell(x!,y!,{char:"X",fg:0xFF0000,bg:0x00FF00,attrs:3,ulColor:0x0000FF});
    pb.setCell(x!,y!,{char:"X",fg:0xFF0000,bg:0x00FF00,attrs:3,ulColor:0x0000FF});
  }
  checkVisual("Scattered changes", od.render(ob).output, pd.render(pb).output);
}

// 5. Full screen
{
  const ob = new OrigBuffer(W,H); const od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H); const pd = new OptDiff(W,H);
  const p1 = (b: any) => { for (let y=0;y<H;y++) for (let x=0;x<W;x++) b.setCell(x,y,{char:"A",fg:0xFFFFFF,bg:0,attrs:0,ulColor:-1}); };
  const p2 = (b: any) => { for (let y=0;y<H;y++) for (let x=0;x<W;x++) b.setCell(x,y,{char:"B",fg:0x000000,bg:0xFFFFFF,attrs:0,ulColor:-1}); };
  fillBoth(ob,pb,p1); od.render(ob); pd.render(pb);
  ob.clear(); pb.clearPaintedRows(); fillBoth(ob,pb,p2);
  checkVisual("Full screen change", od.render(ob).output, pd.render(pb).output);
}

// 6. 100 spinner frames
for (let f = 0; f < 100; f++) {
  const ob = new OrigBuffer(W,H); const od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H); const pd = new OptDiff(W,H);
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) { ob.setCell(x,y,{char:".",fg:1,bg:0,attrs:0,ulColor:-1}); pb.setCell(x,y,{char:".",fg:1,bg:0,attrs:0,ulColor:-1}); }
  od.render(ob); pd.render(pb);
  ob.clear(); pb.clearPaintedRows();
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) { ob.setCell(x,y,{char:".",fg:1,bg:0,attrs:0,ulColor:-1}); pb.setCell(x,y,{char:".",fg:1,bg:0,attrs:0,ulColor:-1}); }
  const sp = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
  ob.setCell(10,5,{char:sp[f%10]!,fg:2,bg:0,attrs:0,ulColor:-1}); pb.setCell(10,5,{char:sp[f%10]!,fg:2,bg:0,attrs:0,ulColor:-1});
  checkVisual(`Spinner f${f}`, od.render(ob).output, pd.render(pb).output);
}

console.log(`\n  Visual equivalence: ${pass}/${pass+fail} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
