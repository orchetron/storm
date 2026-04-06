/** Runs pipeline-stress scenarios comparing stripped visual output between original and optimized. */
import { ScreenBuffer as OptBuffer } from "../../../src/core/buffer.js";
import { DiffRenderer as OptDiff } from "../../../src/core/diff.js";
import { ScreenBuffer as OrigBuffer } from "/Users/hardy30894/Documents/storm-pre/storm/src/core/buffer.js";
import { DiffRenderer as OrigDiff } from "/Users/hardy30894/Documents/storm-pre/storm/src/core/diff.js";

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, "").replace(/\x1b[78]/g, "").replace(/\0/g, "");

let pass = 0, fail = 0, byteDiff = 0;
function check(name: string, optOut: string, origOut: string) {
  const optVis = strip(optOut);
  const origVis = strip(origOut);
  if (optVis === origVis) {
    pass++;
    if (optOut !== origOut) byteDiff++;
  } else {
    fail++;
    // Show first difference
    for (let i = 0; i < Math.max(optVis.length, origVis.length); i++) {
      if (optVis[i] !== origVis[i]) {
        console.log(`VISUAL FAIL: ${name} at char ${i}: orig=${JSON.stringify(origVis.slice(i, i+20))} opt=${JSON.stringify(optVis.slice(i, i+20))}`);
        break;
      }
    }
  }
}

const W = 80, H = 24;
const sp = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];

// Test 1: 100 spinner frames
{
  const ob = new OrigBuffer(W,H), od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H), pd = new OptDiff(W,H);
  for(let x=0;x<W;x++){ob.setCell(x,5,{char:".",fg:1,bg:0,attrs:0,ulColor:-1});pb.setCell(x,5,{char:".",fg:1,bg:0,attrs:0,ulColor:-1});}
  od.render(ob); pd.render(pb);
  for(let f=0;f<100;f++){
    ob.clear(); pb.clearPaintedRows();
    for(let x=0;x<W;x++){ob.setCell(x,5,{char:".",fg:1,bg:0,attrs:0,ulColor:-1});pb.setCell(x,5,{char:".",fg:1,bg:0,attrs:0,ulColor:-1});}
    ob.setCell(10,5,{char:sp[f%10]!,fg:2,bg:0,attrs:0,ulColor:-1});
    pb.setCell(10,5,{char:sp[f%10]!,fg:2,bg:0,attrs:0,ulColor:-1});
    check(`spinner ${f}`, pd.render(pb).output, od.render(ob).output);
  }
}

// Test 2: 30 messages appearing
{
  const ob = new OrigBuffer(W,H), od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H), pd = new OptDiff(W,H);
  od.render(ob); pd.render(pb);
  for(let f=0;f<30;f++){
    ob.clear(); pb.clearPaintedRows();
    for(let row=0;row<=f&&row<H;row++){
      const msg = `Message ${row}: ${"hello world ".repeat(3)}`;
      ob.writeString(0,row,msg,0xFFFFFF,0x222222,1);
      pb.writeString(0,row,msg,0xFFFFFF,0x222222,1);
    }
    check(`message ${f}`, pd.render(pb).output, od.render(ob).output);
  }
}

// Test 3: Content shrinking
{
  const ob = new OrigBuffer(W,H), od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H), pd = new OptDiff(W,H);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    ob.setCell(x,y,{char:"#",fg:5,bg:6,attrs:0,ulColor:-1});
    pb.setCell(x,y,{char:"#",fg:5,bg:6,attrs:0,ulColor:-1});
  }
  od.render(ob); pd.render(pb);
  for(let f=0;f<H;f++){
    ob.clear(); pb.clearPaintedRows();
    for(let y=f;y<H;y++) for(let x=0;x<W;x++){
      ob.setCell(x,y,{char:"#",fg:5,bg:6,attrs:0,ulColor:-1});
      pb.setCell(x,y,{char:"#",fg:5,bg:6,attrs:0,ulColor:-1});
    }
    check(`shrink ${f}`, pd.render(pb).output, od.render(ob).output);
  }
}

// Test 4: 50 rapid alternating frames (the ones that "fail" byte-level)
{
  const ob = new OrigBuffer(W,H), od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H), pd = new OptDiff(W,H);
  od.render(ob); pd.render(pb);
  for(let f=0;f<50;f++){
    ob.clear(); pb.clearPaintedRows();
    const n = (f%2===0) ? 10 : 5;
    for(let y=0;y<n;y++){
      const fg = 0x1000000|((f*37+y*13)&0xFFFFFF);
      const bg = 0x1000000|((f*53+y*7)&0xFFFFFF);
      const attrs = (f+y)%4;
      ob.writeString(0,y,`Line ${y} frame ${f} ${"━".repeat(W-25)}`,fg,bg,attrs);
      pb.writeString(0,y,`Line ${y} frame ${f} ${"━".repeat(W-25)}`,fg,bg,attrs);
    }
    check(`alternating ${f}`, pd.render(pb).output, od.render(ob).output);
  }
}

// Test 5: Empty frames
{
  const ob = new OrigBuffer(W,H), od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H), pd = new OptDiff(W,H);
  for(let y=0;y<5;y++) for(let x=0;x<W;x++){
    ob.setCell(x,y,{char:"Z",fg:1,bg:2,attrs:3,ulColor:-1});
    pb.setCell(x,y,{char:"Z",fg:1,bg:2,attrs:3,ulColor:-1});
  }
  od.render(ob); pd.render(pb);
  for(let f=0;f<10;f++){
    ob.clear(); pb.clearPaintedRows();
    check(`empty ${f}`, pd.render(pb).output, od.render(ob).output);
  }
}

// Test 6: Mixed operations
{
  const ob = new OrigBuffer(W,H), od = new OrigDiff(W,H);
  const pb = new OptBuffer(W,H), pd = new OptDiff(W,H);
  od.render(ob); pd.render(pb);
  for(let f=0;f<20;f++){
    ob.clear(); pb.clearPaintedRows();
    if(f%3===0) for(let y=0;y<H;y++) for(let x=0;x<W;x++){ob.setCell(x,y,{char:".",fg:7,bg:0,attrs:0,ulColor:-1});pb.setCell(x,y,{char:".",fg:7,bg:0,attrs:0,ulColor:-1});}
    else if(f%3===1){ ob.writeString(0,f%H,`Update ${f}`,0xFF0000,0,1); pb.writeString(0,f%H,`Update ${f}`,0xFF0000,0,1); }
    else { for(let y=0;y<3;y++){ob.writeString(0,y,`Row${y}${"─".repeat(W-5)}`,0x00FF00,0x111111,2);pb.writeString(0,y,`Row${y}${"─".repeat(W-5)}`,0x00FF00,0x111111,2);}}
    check(`mixed ${f}`, pd.render(pb).output, od.render(ob).output);
  }
}

console.log(`\n  Visual stress test: ${pass} passed, ${fail} VISUAL FAILURES`);
console.log(`  (${byteDiff} had byte-level SGR differences but identical visual output)`);
if (fail > 0) { console.log(`\n  *** REAL VISUAL DIFFERENCES FOUND ***`); process.exit(1); }
else console.log(`\n  100% visually identical. Zero rendering differences.\n`);
