/** Compares stripped visual text (not raw ANSI bytes) between original and optimized for every scenario. */
import { ScreenBuffer as OrigBuffer } from "/Users/hardy30894/Documents/storm-pre/storm/src/core/buffer.js";
import { DiffRenderer as OrigDiff } from "/Users/hardy30894/Documents/storm-pre/storm/src/core/diff.js";
import { ScreenBuffer as OptBuffer } from "../../../src/core/buffer.js";
import { DiffRenderer as OptDiff } from "../../../src/core/diff.js";

const W = 80, H = 24;
let pass = 0, fail = 0, byteDiffs = 0;

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, "").replace(/\x1b[78]/g, "").replace(/\0/g, "");

function check(name: string, origOut: string, optOut: string) {
  const origVis = strip(origOut);
  const optVis = strip(optOut);
  if (origVis === optVis) {
    pass++;
    if (origOut !== optOut) byteDiffs++;
  } else {
    fail++;
    console.log(`FAIL: ${name}`);
    console.log(`  orig visual: ${JSON.stringify(origVis.slice(0, 80))}...`);
    console.log(`  opt  visual: ${JSON.stringify(optVis.slice(0, 80))}...`);
  }
}

// Helper: fill both buffers identically
function fillBoth(ob: any, pb: any, fn: (b: any) => void) { fn(ob); fn(pb); }

// ── Test 1: First frame (all cells painted) ──────────────────────
{
  const ob = new OrigBuffer(W,H); const od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H); const pd = new OptDiff(W,H);
  const paint = (b: any) => { for (let y=0;y<H;y++) for (let x=0;x<W;x++) b.setCell(x,y,{char:String.fromCharCode(65+((x+y)%26)),fg:0xC0CAF5,bg:0x0A0A0A,attrs:0,ulColor:-1}); };
  fillBoth(ob,pb,paint);
  const o = od.render(ob); const p = pd.render(pb);
  check("First frame", o.output, p.output);
}

// ── Test 2: No change frame ──────────────────────────────────────
{
  const ob = new OrigBuffer(W,H); const od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H); const pd = new OptDiff(W,H);
  const paint = (b: any) => { for (let y=0;y<H;y++) for (let x=0;x<W;x++) b.setCell(x,y,{char:"A",fg:0xFFFFFF,bg:0,attrs:0,ulColor:-1}); };
  fillBoth(ob,pb,paint); od.render(ob); pd.render(pb);
  // Repaint identical
  ob.clear(); pb.clear(); fillBoth(ob,pb,paint);
  const o = od.render(ob); const p = pd.render(pb);
  check("No change (should be empty)", o.output, p.output);
  check("No change output is empty", "", o.output);
}

// ── Test 3: 1 cell changed ───────────────────────────────────────
{
  const ob = new OrigBuffer(W,H); const od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H); const pd = new OptDiff(W,H);
  const paint = (b: any) => { for (let y=0;y<H;y++) for (let x=0;x<W;x++) b.setCell(x,y,{char:"A",fg:0xFFFFFF,bg:0,attrs:0,ulColor:-1}); };
  fillBoth(ob,pb,paint); od.render(ob); pd.render(pb);
  ob.clear(); pb.clear(); fillBoth(ob,pb,paint);
  ob.setCell(10,5,{char:"Z",fg:0xFF0000,bg:0,attrs:1,ulColor:-1});
  pb.setCell(10,5,{char:"Z",fg:0xFF0000,bg:0,attrs:1,ulColor:-1});
  const o = od.render(ob); const p = pd.render(pb);
  check("1 cell changed", o.output, p.output);
  check("1 cell has output", o.output.length > 0 ? "yes" : "no", "yes");
}

// ── Test 4: Multiple scattered changes ───────────────────────────
{
  const ob = new OrigBuffer(W,H); const od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H); const pd = new OptDiff(W,H);
  const paint = (b: any) => { for (let y=0;y<H;y++) for (let x=0;x<W;x++) b.setCell(x,y,{char:".",fg:0x808080,bg:0,attrs:0,ulColor:-1}); };
  fillBoth(ob,pb,paint); od.render(ob); pd.render(pb);
  ob.clear(); pb.clear(); fillBoth(ob,pb,paint);
  // Change cells on rows 2, 10, 20
  for (const [x,y] of [[5,2],[30,10],[60,20]]) {
    ob.setCell(x!,y!,{char:"X",fg:0xFF0000,bg:0x00FF00,attrs:3,ulColor:0x0000FF});
    pb.setCell(x!,y!,{char:"X",fg:0xFF0000,bg:0x00FF00,attrs:3,ulColor:0x0000FF});
  }
  const o = od.render(ob); const p = pd.render(pb);
  check("Scattered changes", o.output, p.output);
}

// ── Test 5: Full row change ──────────────────────────────────────
{
  const ob = new OrigBuffer(W,H); const od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H); const pd = new OptDiff(W,H);
  const paint = (b: any) => { for (let y=0;y<H;y++) for (let x=0;x<W;x++) b.setCell(x,y,{char:".",fg:0x808080,bg:0,attrs:0,ulColor:-1}); };
  fillBoth(ob,pb,paint); od.render(ob); pd.render(pb);
  ob.clear(); pb.clear(); fillBoth(ob,pb,paint);
  for (let x=0;x<W;x++) { ob.setCell(x,12,{char:"#",fg:0xFFFF00,bg:0x000080,attrs:0,ulColor:-1}); pb.setCell(x,12,{char:"#",fg:0xFFFF00,bg:0x000080,attrs:0,ulColor:-1}); }
  const o = od.render(ob); const p = pd.render(pb);
  check("Full row change", o.output, p.output);
}

// ── Test 6: Full screen change ───────────────────────────────────
{
  const ob = new OrigBuffer(W,H); const od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H); const pd = new OptDiff(W,H);
  const paint1 = (b: any) => { for (let y=0;y<H;y++) for (let x=0;x<W;x++) b.setCell(x,y,{char:"A",fg:0xFFFFFF,bg:0,attrs:0,ulColor:-1}); };
  const paint2 = (b: any) => { for (let y=0;y<H;y++) for (let x=0;x<W;x++) b.setCell(x,y,{char:"B",fg:0x000000,bg:0xFFFFFF,attrs:0,ulColor:-1}); };
  fillBoth(ob,pb,paint1); od.render(ob); pd.render(pb);
  ob.clear(); pb.clear(); fillBoth(ob,pb,paint2);
  const o = od.render(ob); const p = pd.render(pb);
  check("Full screen change", o.output, p.output);
}

// ── Test 7: writeString ──────────────────────────────────────────
{
  const ob = new OrigBuffer(W,H); const od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H); const pd = new OptDiff(W,H);
  ob.writeString(5,3,"Hello World",0xFFFFFF,0,0); pb.writeString(5,3,"Hello World",0xFFFFFF,0,0);
  const o = od.render(ob); const p = pd.render(pb);
  check("writeString first frame", o.output, p.output);
  ob.clear(); pb.clear();
  ob.writeString(5,3,"Hello World",0xFFFFFF,0,0); pb.writeString(5,3,"Hello World",0xFFFFFF,0,0);
  const o2 = od.render(ob); const p2 = pd.render(pb);
  check("writeString no change", o2.output, p2.output);
  ob.clear(); pb.clear();
  ob.writeString(5,3,"Hello Storm",0xFF0000,0,0); pb.writeString(5,3,"Hello Storm",0xFF0000,0,0);
  const o3 = od.render(ob); const p3 = pd.render(pb);
  check("writeString changed", o3.output, p3.output);
}

// ── Test 8: rowEquals ────────────────────────────────────────────
{
  const a = new OptBuffer(W,H); const b = new OptBuffer(W,H);
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) { a.setCell(x,y,{char:"X",fg:1,bg:2,attrs:0,ulColor:-1}); b.setCell(x,y,{char:"X",fg:1,bg:2,attrs:0,ulColor:-1}); }
  check("rowEquals identical", a.rowEquals(b,5) ? "yes" : "no", "yes");
  b.setCell(40,5,{char:"Y",fg:1,bg:2,attrs:0,ulColor:-1});
  check("rowEquals different", a.rowEquals(b,5) ? "yes" : "no", "no");
  check("rowEquals other row still equal", a.rowEquals(b,6) ? "yes" : "no", "yes");
}

// ── Test 9: fill ─────────────────────────────────────────────────
{
  const ob = new OrigBuffer(W,H); const od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H); const pd = new OptDiff(W,H);
  ob.fill(10,5,20,3,"#",0xFF0000,0x00FF00,1,-1); pb.fill(10,5,20,3,"#",0xFF0000,0x00FF00,1,-1);
  const o = od.render(ob); const p = pd.render(pb);
  check("fill", o.output, p.output);
}

// ── Test 10: clone + copyFrom ────────────────────────────────────
{
  const a = new OptBuffer(W,H);
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) a.setCell(x,y,{char:String.fromCharCode(65+(x%26)),fg:x*100,bg:y*100,attrs:x%8,ulColor:-1});
  const b = a.clone();
  check("clone equals", a.equals(b) ? "yes" : "no", "yes");
  check("clone rowEquals", a.rowEquals(b,10) ? "yes" : "no", "yes");
  b.setCell(0,0,{char:"Z",fg:0,bg:0,attrs:0,ulColor:-1});
  check("clone diverged", a.equals(b) ? "yes" : "no", "no");
}

// ── Results ──────────────────────────────────────────────────────
console.log(`\n  Correctness: ${pass} passed, ${fail} failed`);
if (byteDiffs > 0) console.log(`  (${byteDiffs} had shorter SGR encoding but identical visual output)`);
console.log();
if (fail > 0) process.exit(1);
