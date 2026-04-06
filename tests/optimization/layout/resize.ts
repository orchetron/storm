/** Verifies buffer resize correctness when terminal dimensions change between frames. */
import React from "react";
import { renderToString } from "../../../src/reconciler/render-to-string.js";
import { paint, repaint } from "../../../src/reconciler/renderer.js";
import { RenderContext } from "../../../src/core/render-context.js";
import { ScreenBuffer } from "../../../src/core/buffer.js";
import { createRoot } from "../../../src/reconciler/types.js";
import { syncContainerUpdate, TuiReconciler } from "../../../src/reconciler/render-to-string.js";
import { TuiProvider } from "../../../src/context/TuiContext.js";
import { InputManager } from "../../../src/input/manager.js";
import { buildLayoutTree } from "../../../src/reconciler/renderer.js";
import { computeLayout } from "../../../src/layout/engine.js";
import { isTuiElement } from "../../../src/reconciler/types.js";

let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; }
  else { fail++; console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

function bufToLines(buf: ScreenBuffer): string[] {
  const lines: string[] = [];
  for (let y = 0; y < buf.height; y++) {
    let line = "";
    for (let x = 0; x < buf.width; x++) line += buf.getChar(x, y);
    lines.push(line.trimEnd());
  }
  return lines;
}

console.log(`\n  Resize Tests\n`);

// ── 1. Shrink: 40x10 → 20x5 ────────────────────────────────────
console.log("  1. Shrink terminal");
{
  const el = React.createElement("tui-box", { flexDirection: "column" },
    React.createElement("tui-text", null, "LONG LINE THAT SHOULD CLIP AT NEW WIDTH"),
    React.createElement("tui-text", null, "ROW TWO CONTENT HERE"),
  );

  const r = renderToString(el, { width: 40, height: 10 });
  check("40x10 has full line", r.output.includes("LONG LINE THAT SHOULD CLIP AT NEW WIDTH"));

  // Simulate resize by rerendering at smaller dimensions
  // renderToString doesn't support resize, so create a new env
  const r2 = renderToString(el, { width: 20, height: 5 });
  check("20x5 buffer is 20 wide", r2.lines.every(l => l.length <= 20));
  check("20x5 has text", r2.output.includes("LONG LINE"));
  r.unmount();
  r2.unmount();
}

// ── 2. Grow: 20x5 → 60x20 ──────────────────────────────────────
console.log("  2. Grow terminal");
{
  const el = React.createElement("tui-box", { flexDirection: "column" },
    React.createElement("tui-text", null, "SHORT"),
  );

  const r = renderToString(el, { width: 20, height: 5 });
  check("20x5 has SHORT", r.output.includes("SHORT"));

  const r2 = renderToString(el, { width: 60, height: 20 });
  check("60x20 has SHORT", r2.output.includes("SHORT"));
  r.unmount();
  r2.unmount();
}

// ── 3. Buffer dimensions match after resize ─────────────────────
console.log("  3. Buffer dimensions match paint dimensions");
{
  const ctx = new RenderContext();
  const root = createRoot(() => { ctx.invalidateLayout(); });
  const input = new InputManager();
  const mkCtx = (w: number, h: number) => ({
    screen: { width: w, height: h, stdout: process.stdout, stdin: process.stdin,
      write:()=>{},start:()=>{},stop:()=>{},flush:()=>{},
      getBuffer:()=>new ScreenBuffer(w,h),createBuffer:()=>new ScreenBuffer(w,h),
      invalidate:()=>{},setDebugRainbow:()=>{},setCursor:()=>{},
      setCursorVisible:()=>{},onResizeEvent:()=>()=>{},isActive:false,
    }, input, focus: ctx.focus, renderContext: ctx,
    exit:()=>{},requestRender:()=>{},flushSync:(fn: () => void)=>{fn();},clear:()=>{},commitText:()=>{},
  });
  const container = TuiReconciler.createContainer(root, 0, null, false, null, '', () => {}, null);

  const el = React.createElement("tui-text", null, "TEST");

  // Paint at 40x10
  syncContainerUpdate(React.createElement(TuiProvider, { value: mkCtx(40, 10) }, el), container);
  ctx.invalidateLayout();
  const r1 = paint(root, 40, 10, ctx);
  check("buffer 40x10", r1.buffer.width === 40 && r1.buffer.height === 10,
    `got ${r1.buffer.width}x${r1.buffer.height}`);

  // Paint at 20x5 (resize)
  ctx.invalidateLayout();
  const r2 = paint(root, 20, 5, ctx);
  check("buffer resized to 20x5", r2.buffer.width === 20 && r2.buffer.height === 5,
    `got ${r2.buffer.width}x${r2.buffer.height}`);

  // Paint at 80x24 (resize again)
  ctx.invalidateLayout();
  const r3 = paint(root, 80, 24, ctx);
  check("buffer resized to 80x24", r3.buffer.width === 80 && r3.buffer.height === 24,
    `got ${r3.buffer.width}x${r3.buffer.height}`);

  syncContainerUpdate(null as any, container);
}

// ── 4. Content reflows on resize ────────────────────────────────
console.log("  4. Text wraps differently at new width");
{
  const el = React.createElement("tui-box", { flexDirection: "column", width: 40 },
    React.createElement("tui-text", null, "ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
  );

  // Wide: fits on one line
  const r1 = renderToString(el, { width: 40, height: 10 });
  const lineCount1 = r1.lines.filter(l => l.length > 0).length;
  check("wide: 1 line", lineCount1 === 1, `got ${lineCount1}`);

  // Narrow: should wrap
  const el2 = React.createElement("tui-box", { flexDirection: "column", width: 10 },
    React.createElement("tui-text", null, "ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
  );
  const r2 = renderToString(el2, { width: 10, height: 10 });
  const lineCount2 = r2.lines.filter(l => l.length > 0).length;
  check("narrow: wraps to multiple lines", lineCount2 > 1, `got ${lineCount2}`);

  r1.unmount();
  r2.unmount();
}

// ── 5. No stale content from old dimensions ─────────────────────
console.log("  5. No stale content after shrink");
{
  const ctx = new RenderContext();
  const root = createRoot(() => { ctx.invalidateLayout(); });
  const input = new InputManager();
  const mkCtx = (w: number, h: number) => ({
    screen: { width: w, height: h, stdout: process.stdout, stdin: process.stdin,
      write:()=>{},start:()=>{},stop:()=>{},flush:()=>{},
      getBuffer:()=>new ScreenBuffer(w,h),createBuffer:()=>new ScreenBuffer(w,h),
      invalidate:()=>{},setDebugRainbow:()=>{},setCursor:()=>{},
      setCursorVisible:()=>{},onResizeEvent:()=>()=>{},isActive:false,
    }, input, focus: ctx.focus, renderContext: ctx,
    exit:()=>{},requestRender:()=>{},flushSync:(fn: () => void)=>{fn();},clear:()=>{},commitText:()=>{},
  });
  const container = TuiReconciler.createContainer(root, 0, null, false, null, '', () => {}, null);

  // Fill 40x10 with content
  const bigEl = React.createElement("tui-box", { flexDirection: "column" },
    ...Array.from({ length: 10 }, (_, i) =>
      React.createElement("tui-text", { key: i }, `ROW_${i}_LONG_CONTENT_HERE`)
    )
  );
  syncContainerUpdate(React.createElement(TuiProvider, { value: mkCtx(40, 10) }, bigEl), container);
  ctx.invalidateLayout();
  paint(root, 40, 10, ctx);

  // Shrink to 20x3 with different content
  const smallEl = React.createElement("tui-box", { flexDirection: "column" },
    React.createElement("tui-text", null, "SMALL"),
  );
  syncContainerUpdate(React.createElement(TuiProvider, { value: mkCtx(20, 3) }, smallEl), container);
  ctx.invalidateLayout();
  const r = paint(root, 20, 3, ctx);
  const lines = bufToLines(r.buffer);

  check("shrunk has SMALL", lines.some(l => l.includes("SMALL")));
  check("shrunk no old content", !lines.some(l => l.includes("ROW_")),
    `stale: ${lines.find(l => l.includes("ROW_"))}`);

  syncContainerUpdate(null as any, container);
}

console.log(`\n  Resize: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
