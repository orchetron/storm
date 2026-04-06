/** Edge cases for selective row clearing (clearPaintedRows). */
import { ScreenBuffer as OptBuffer } from "../../../src/core/buffer.js";
import { DiffRenderer as OptDiff } from "../../../src/core/diff.js";
import { ScreenBuffer as OrigBuffer } from "/Users/hardy30894/Documents/storm-pre/storm/src/core/buffer.js";
import { DiffRenderer as OrigDiff } from "/Users/hardy30894/Documents/storm-pre/storm/src/core/diff.js";

let pass=0, fail=0;
const strip = (s: string) => s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, "").replace(/\x1b[78]/g, "").replace(/\0/g, "");
function check(name: string, a: string, b: string) {
  if (strip(a)===strip(b)) pass++; else { fail++; console.log(`FAIL: ${name}\n  orig visual: ${strip(b).length} chars, opt visual: ${strip(a).length} chars`); }
}

const W=80, H=24;

// ── Test 1: Paint row 5, then next frame paint only row 10. Row 5 should be cleared. ──
{
  const ob = new OrigBuffer(W,H); const od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H); const pd = new OptDiff(W,H);
  // Frame 1: paint row 5
  for(let x=0;x<W;x++){ob.setCell(x,5,{char:"A",fg:1,bg:2,attrs:0,ulColor:-1});pb.setCell(x,5,{char:"A",fg:1,bg:2,attrs:0,ulColor:-1});}
  od.render(ob); pd.render(pb);
  // Frame 2: clear + paint row 10 only (row 5 should revert to empty)
  ob.clear(); pb.clearPaintedRows();
  for(let x=0;x<W;x++){ob.setCell(x,10,{char:"B",fg:3,bg:4,attrs:0,ulColor:-1});pb.setCell(x,10,{char:"B",fg:3,bg:4,attrs:0,ulColor:-1});}
  const o=od.render(ob); const p=pd.render(pb);
  check("Row 5 cleared after not being painted", p.output, o.output);
}

// ── Test 2: Paint rows 5,10,15. Next frame paint 5,10 only. Row 15 should clear. ──
{
  const ob = new OrigBuffer(W,H); const od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H); const pd = new OptDiff(W,H);
  for(const y of[5,10,15])for(let x=0;x<W;x++){ob.setCell(x,y,{char:"X",fg:1,bg:0,attrs:0,ulColor:-1});pb.setCell(x,y,{char:"X",fg:1,bg:0,attrs:0,ulColor:-1});}
  od.render(ob); pd.render(pb);
  ob.clear(); pb.clearPaintedRows();
  for(const y of[5,10])for(let x=0;x<W;x++){ob.setCell(x,y,{char:"X",fg:1,bg:0,attrs:0,ulColor:-1});pb.setCell(x,y,{char:"X",fg:1,bg:0,attrs:0,ulColor:-1});}
  const o=od.render(ob); const p=pd.render(pb);
  check("Row 15 cleared when not repainted", p.output, o.output);
}

// ── Test 3: Spinner on row 5 — many frames, same rows painted. ──
{
  const ob = new OrigBuffer(W,H); const od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H); const pd = new OptDiff(W,H);
  const sp=["⠋","⠙","⠹","⠸","⠼","⠴"];
  // Initial frame
  for(let x=0;x<W;x++){ob.setCell(x,5,{char:".",fg:1,bg:0,attrs:0,ulColor:-1});pb.setCell(x,5,{char:".",fg:1,bg:0,attrs:0,ulColor:-1});}
  od.render(ob); pd.render(pb);
  // 20 spinner frames
  for(let f=0;f<20;f++){
    ob.clear(); pb.clearPaintedRows();
    for(let x=0;x<W;x++){ob.setCell(x,5,{char:".",fg:1,bg:0,attrs:0,ulColor:-1});pb.setCell(x,5,{char:".",fg:1,bg:0,attrs:0,ulColor:-1});}
    ob.setCell(10,5,{char:sp[f%6]!,fg:2,bg:0,attrs:0,ulColor:-1});pb.setCell(10,5,{char:sp[f%6]!,fg:2,bg:0,attrs:0,ulColor:-1});
    const o=od.render(ob); const p=pd.render(pb);
    check(`Spinner frame ${f}`, p.output, o.output);
  }
}

// ── Test 4: All rows painted then only 1 row painted. ──
{
  const ob = new OrigBuffer(W,H); const od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H); const pd = new OptDiff(W,H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){ob.setCell(x,y,{char:"#",fg:5,bg:6,attrs:0,ulColor:-1});pb.setCell(x,y,{char:"#",fg:5,bg:6,attrs:0,ulColor:-1});}
  od.render(ob); pd.render(pb);
  ob.clear(); pb.clearPaintedRows();
  for(let x=0;x<W;x++){ob.setCell(x,0,{char:"O",fg:7,bg:8,attrs:0,ulColor:-1});pb.setCell(x,0,{char:"O",fg:7,bg:8,attrs:0,ulColor:-1});}
  const o=od.render(ob); const p=pd.render(pb);
  check("All rows→1 row: 23 rows cleared", p.output, o.output);
}

// ── Test 5: No rows painted (empty frame after content). ──
{
  const ob = new OrigBuffer(W,H); const od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H); const pd = new OptDiff(W,H);
  for(let x=0;x<W;x++){ob.setCell(x,5,{char:"Z",fg:1,bg:0,attrs:0,ulColor:-1});pb.setCell(x,5,{char:"Z",fg:1,bg:0,attrs:0,ulColor:-1});}
  od.render(ob); pd.render(pb);
  ob.clear(); pb.clearPaintedRows(); // nothing painted this frame
  const o=od.render(ob); const p=pd.render(pb);
  check("Empty frame clears previous content", p.output, o.output);
}

// ── Test 6: Multiple cycles — correctness over time. ──
{
  const ob = new OrigBuffer(W,H); const od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H); const pd = new OptDiff(W,H);
  const rows = [[5,10],[3,7,15],[0,23],[12],[5,10]]; // different rows each cycle
  for(const rs of rows){
    ob.clear(); pb.clearPaintedRows();
    for(const y of rs)for(let x=0;x<W;x++){ob.setCell(x,y,{char:String.fromCharCode(65+(y%26)),fg:y*10,bg:0,attrs:0,ulColor:-1});pb.setCell(x,y,{char:String.fromCharCode(65+(y%26)),fg:y*10,bg:0,attrs:0,ulColor:-1});}
    const o=od.render(ob); const p=pd.render(pb);
    check(`Cycle rows=[${rs}]`, p.output, o.output);
  }
}

console.log(`\n  Selective clear: ${pass} passed, ${fail} failed\n`);
if(fail>0)process.exit(1);
