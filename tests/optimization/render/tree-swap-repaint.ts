/** Catches flicker when React swaps trees and repaint() via requestRender misses new elements. */
import React from "react";
import { paint, repaint } from "../../../src/reconciler/renderer.js";
import { RenderContext } from "../../../src/core/render-context.js";
import { ScreenBuffer } from "../../../src/core/buffer.js";
import { createRoot } from "../../../src/reconciler/types.js";
import { syncContainerUpdate, TuiReconciler } from "../../../src/reconciler/render-to-string.js";
import { TuiProvider, type TuiContextValue } from "../../../src/context/TuiContext.js";
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

function hasText(lines: string[], text: string): boolean {
  return lines.some(l => l.includes(text));
}

const W = 60, H = 15;

function createEnv() {
  const ctx = new RenderContext();
  const input = new InputManager();
  const mockCtx: TuiContextValue = {
    screen: { width: W, height: H, stdout: process.stdout, stdin: process.stdin,
      write: () => {}, start: () => {}, stop: () => {}, flush: () => {},
      getBuffer: () => new ScreenBuffer(W, H), createBuffer: () => new ScreenBuffer(W, H),
      invalidate: () => {}, setDebugRainbow: () => {}, setCursor: () => {},
      setCursorVisible: () => {}, onResizeEvent: () => () => {}, isActive: false,
    } as unknown as TuiContextValue["screen"],
    input: input as unknown as TuiContextValue["input"],
    focus: ctx.focus, renderContext: ctx,
    exit: () => {}, requestRender: () => {}, flushSync: (fn: () => void) => { fn(); },
    clear: () => {}, commitText: () => {},
  };

  const root = createRoot(() => { ctx.invalidateLayout(); });
  const container = TuiReconciler.createContainer(root, 0, null, false, null, "", () => {}, null);

  function commit(el: React.ReactElement) {
    syncContainerUpdate(React.createElement(TuiProvider, { value: mockCtx }, el), container);
    ctx.invalidateLayout();
  }

  function doPaint(): string[] {
    return bufToLines(paint(root, W, H, ctx).buffer);
  }

  function doRepaint(): string[] {
    // Rebuild layout (paint() does this, but repaint skips it)
    for (const child of root.children) {
      if (isTuiElement(child)) {
        buildLayoutTree(child);
        computeLayout(child.layoutNode, 0, 0, W, H);
      }
    }
    ctx._renderRequested = true;
    return bufToLines(repaint(root, W, H, ctx).buffer);
  }

  function destroy() {
    syncContainerUpdate(null as unknown as React.ReactElement, container);
  }

  return { commit, doPaint, doRepaint, destroy };
}

console.log(`\n  Tree Swap Repaint Tests — ${W}×${H}\n`);

// ── 1. The flicker bug: paint phase1 → commit phase2 → repaint ──
console.log("  1. commit+paint → commit → repaint (the actual bug)");
{
  const env = createEnv();

  const phase1 = React.createElement("tui-box", { flexDirection: "column", width: W, height: H },
    ...Array.from({ length: H }, (_, i) =>
      React.createElement("tui-text", { key: `p1-${i}` }, `PHASE1 ROW ${i}`)
    )
  );
  const phase2 = React.createElement("tui-box", { flexDirection: "column", width: W, height: H },
    React.createElement("tui-text", { key: "h" }, "DASHBOARD HEADER"),
    React.createElement("tui-text", { key: "b" }, "DASHBOARD BODY"),
    React.createElement("tui-text", { key: "f" }, "DASHBOARD FOOTER"),
  );

  env.commit(phase1);
  const f1 = env.doPaint();
  check("phase1 paints", hasText(f1, "PHASE1 ROW 0"));

  // Commit phase2 but only repaint — no paint()
  env.commit(phase2);
  const f2 = env.doRepaint();
  check("repaint has DASHBOARD HEADER", hasText(f2, "DASHBOARD HEADER"),
    `got: ${f2.filter(l => l.length > 0).slice(0, 3).join(" | ")}`);
  check("repaint has DASHBOARD BODY", hasText(f2, "DASHBOARD BODY"));
  check("repaint no PHASE1 bleed", !hasText(f2, "PHASE1"),
    `stale: ${f2.find(l => l.includes("PHASE1"))}`);

  env.destroy();
}

// ── 2. Rapid phase cycling: commit+paint, then commit+repaint ───
console.log("  2. Rapid phase cycling (commit+repaint)");
{
  const env = createEnv();

  env.commit(React.createElement("tui-box", { flexDirection: "column", width: W, height: H },
    React.createElement("tui-text", null, "PHASE0"),
  ));
  env.doPaint();

  for (let p = 1; p < 5; p++) {
    const phase = React.createElement("tui-box", { flexDirection: "column", width: W, height: H },
      ...Array.from({ length: 2 + p }, (_, i) =>
        React.createElement("tui-text", { key: `${p}-${i}` }, `P${p}L${i}`)
      )
    );
    env.commit(phase);
    const lines = env.doRepaint();
    check(`phase${p} repaint has content`, hasText(lines, `P${p}L0`),
      `got: ${lines.filter(l => l.length > 0)[0]}`);
    check(`phase${p} no prev phase`, !hasText(lines, `P${p-1}L`));
  }

  env.destroy();
}

// ── 3. Full → empty via repaint ─────────────────────────────────
console.log("  3. Full → empty via commit+repaint");
{
  const env = createEnv();

  env.commit(React.createElement("tui-box", { flexDirection: "column", width: W, height: H },
    ...Array.from({ length: H }, (_, i) =>
      React.createElement("tui-text", { key: i }, `ROW ${i}`)
    )
  ));
  env.doPaint();

  env.commit(React.createElement("tui-box", { width: W, height: H }));
  const lines = env.doRepaint();
  check("empty repaint no stale", !hasText(lines, "ROW "),
    `stale: ${lines.find(l => l.includes("ROW "))}`);

  env.destroy();
}

// ── 4. Multiple repaints after swap ─────────────────────────────
console.log("  4. Multiple repaints after swap");
{
  const env = createEnv();

  env.commit(React.createElement("tui-box", { flexDirection: "column", width: W, height: H },
    React.createElement("tui-text", null, "OLD"),
  ));
  env.doPaint();

  env.commit(React.createElement("tui-box", { flexDirection: "column", width: W, height: H },
    React.createElement("tui-text", null, "NEW CONTENT"),
  ));

  for (let i = 0; i < 3; i++) {
    const lines = env.doRepaint();
    check(`repaint #${i+1} has NEW`, hasText(lines, "NEW CONTENT"),
      `got: ${lines.filter(l => l.length > 0)[0]}`);
    check(`repaint #${i+1} no OLD`, !hasText(lines, "OLD"));
  }

  env.destroy();
}

console.log(`\n  Tree swap repaint: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
