/** Edge cases where incremental subtree-skipping can break: dirty parents, clean gaps, deep nesting. */
import React from "react";
import { renderToString } from "../../../src/reconciler/render-to-string.js";
import { paint, repaint } from "../../../src/reconciler/renderer.js";
import { RenderContext } from "../../../src/core/render-context.js";
import { ScreenBuffer } from "../../../src/core/buffer.js";
import { DiffRenderer } from "../../../src/core/diff.js";
import { createRoot, createElement, createTextNode, type TuiRoot, type TuiElement, type TuiTextNode, TUI_BOX, TUI_TEXT } from "../../../src/reconciler/types.js";

let pass = 0, fail = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) { pass++; }
  else { fail++; console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

function bufferToLines(buf: ScreenBuffer, h: number): string[] {
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < buf.width; x++) line += buf.getChar(x, y);
    lines.push(line.trimEnd());
  }
  return lines;
}

console.log(`\n  Incremental Paint Edge Cases\n`);

const W = 60, H = 15;

// ── 1. Scroll simulation inside dirty parent ────────────────────
// Parent has a dirty text child + a scroll region that shifted.
// The scroll region content should update even though scroll isn't _runsDirty.
console.log("  1. Scroll inside dirty parent");
{
  const ctx = new RenderContext();
  const root: TuiRoot = createRoot(() => {});

  // Build a tree: box > [text(dirty), box > [text, text, text]]
  const scrollChild1 = createElement(TUI_TEXT, {});
  const scrollText1 = createTextNode("SCROLL_LINE_0");
  scrollChild1.children.push(scrollText1);
  scrollText1.parent = scrollChild1;

  const scrollChild2 = createElement(TUI_TEXT, {});
  const scrollText2 = createTextNode("SCROLL_LINE_1");
  scrollChild2.children.push(scrollText2);
  scrollText2.parent = scrollChild2;

  const scrollChild3 = createElement(TUI_TEXT, {});
  const scrollText3 = createTextNode("SCROLL_LINE_2");
  scrollChild3.children.push(scrollText3);
  scrollText3.parent = scrollChild3;

  const scrollBox = createElement(TUI_BOX, { flexDirection: "column" });
  scrollBox.children.push(scrollChild1, scrollChild2, scrollChild3);
  scrollChild1.parent = scrollBox;
  scrollChild2.parent = scrollBox;
  scrollChild3.parent = scrollBox;

  const dirtyText = createElement(TUI_TEXT, {});
  const dirtyTextNode = createTextNode("SPINNER_A");
  dirtyText.children.push(dirtyTextNode);
  dirtyTextNode.parent = dirtyText;

  const rootBox = createElement(TUI_BOX, { flexDirection: "column", width: W, height: H });
  rootBox.children.push(dirtyText, scrollBox);
  dirtyText.parent = rootBox;
  scrollBox.parent = rootBox;

  root.children.push(rootBox);

  // Frame 1: initial paint
  const r1 = paint(root, W, H, ctx);
  check("initial has spinner", bufferToLines(r1.buffer, H).some(l => l.includes("SPINNER_A")));
  check("initial has scroll", bufferToLines(r1.buffer, H).some(l => l.includes("SCROLL_LINE_0")));

  // Frame 2: dirty text changes (spinner tick), scroll content changes too
  dirtyTextNode.text = "SPINNER_B"; // sets _runsDirty
  scrollText1.text = "SCROLLED_TO_5"; // also sets _runsDirty on its parent

  // Simulate requestRender path
  ctx._renderRequested = true;
  const r2 = repaint(root, W, H, ctx);
  const lines2 = bufferToLines(r2.buffer, H);
  check("spinner updated", lines2.some(l => l.includes("SPINNER_B")));
  check("scroll content updated", lines2.some(l => l.includes("SCROLLED_TO_5")));
  check("no stale spinner", !lines2.some(l => l.includes("SPINNER_A")));
  check("no stale scroll", !lines2.some(l => l.includes("SCROLL_LINE_0")));
}

// ── 2. Clean element between two dirty ones ─────────────────────
// Layout: [dirty, clean, dirty]. The clean middle should keep its content.
console.log("  2. Clean element between dirty ones");
{
  const ctx = new RenderContext();
  const root: TuiRoot = createRoot(() => {});

  const text1 = createElement(TUI_TEXT, {});
  const tn1 = createTextNode("FIRST_A");
  text1.children.push(tn1); tn1.parent = text1;

  const text2 = createElement(TUI_TEXT, {});
  const tn2 = createTextNode("MIDDLE_STATIC");
  text2.children.push(tn2); tn2.parent = text2;

  const text3 = createElement(TUI_TEXT, {});
  const tn3 = createTextNode("THIRD_A");
  text3.children.push(tn3); tn3.parent = text3;

  const box = createElement(TUI_BOX, { flexDirection: "column", width: W, height: H });
  box.children.push(text1, text2, text3);
  text1.parent = box; text2.parent = box; text3.parent = box;
  root.children.push(box);

  paint(root, W, H, ctx);

  // Change first and third, keep middle clean
  tn1.text = "FIRST_B";
  tn3.text = "THIRD_B";
  // tn2 unchanged — text2 should NOT have _runsDirty

  ctx._renderRequested = true;
  const r = repaint(root, W, H, ctx);
  const lines = bufferToLines(r.buffer, H);
  check("first updated", lines.some(l => l.includes("FIRST_B")));
  check("middle preserved", lines.some(l => l.includes("MIDDLE_STATIC")));
  check("third updated", lines.some(l => l.includes("THIRD_B")));
  check("no stale first", !lines.some(l => l.includes("FIRST_A")));
  check("no stale third", !lines.some(l => l.includes("THIRD_A")));
}

// ── 3. Deeply nested dirty element ──────────────────────────────
// 5 levels deep — only the leaf is dirty.
console.log("  3. Deeply nested dirty element");
{
  const ctx = new RenderContext();
  const root: TuiRoot = createRoot(() => {});

  // Build: box > box > box > box > text
  const leaf = createElement(TUI_TEXT, {});
  const leafText = createTextNode("DEEP_A");
  leaf.children.push(leafText); leafText.parent = leaf;

  let current: TuiElement = leaf;
  for (let i = 0; i < 4; i++) {
    const parent = createElement(TUI_BOX, { flexDirection: "column", ...(i === 3 ? { width: W, height: H } : {}) });
    parent.children.push(current);
    current.parent = parent;
    current = parent;
  }
  root.children.push(current);

  paint(root, W, H, ctx);

  leafText.text = "DEEP_B";
  ctx._renderRequested = true;
  const r = repaint(root, W, H, ctx);
  const lines = bufferToLines(r.buffer, H);
  check("deep leaf updated", lines.some(l => l.includes("DEEP_B")));
  check("no stale deep", !lines.some(l => l.includes("DEEP_A")));
}

// ── 4. requestRender without _runsDirty (scroll-like) ───────────
// Content changes via direct buffer write, not text mutation.
// This goes through clearPaintedRows path, not incremental.
console.log("  4. requestRender without _runsDirty (scroll path)");
{
  const ctx = new RenderContext();
  const root: TuiRoot = createRoot(() => {});

  const text = createElement(TUI_TEXT, {});
  const tn = createTextNode("STATIC_CONTENT");
  text.children.push(tn); tn.parent = text;

  const box = createElement(TUI_BOX, { flexDirection: "column", width: W, height: H });
  box.children.push(text); text.parent = box;
  root.children.push(box);

  const r1 = paint(root, W, H, ctx);
  // Manually write to simulate scroll painting extra content
  r1.buffer.writeString(0, 5, "SCROLL_CONTENT_OLD", 7, 0, 0);

  // requestRender without any _runsDirty (simulates scroll position change)
  ctx._renderRequested = true;
  // No text changed — hasAnyDirty returns false → clearPaintedRows path
  const r2 = repaint(root, W, H, ctx);
  const lines = bufferToLines(r2.buffer, H);
  check("static content preserved", lines.some(l => l.includes("STATIC_CONTENT")));
  // The manually-written scroll content should be cleared (clearPaintedRows clears it)
  check("old scroll content cleared", !lines.some(l => l.includes("SCROLL_CONTENT_OLD")));
}

// ── 5. Multiple rerenders — dirty flag clears properly ──────────
console.log("  5. Multiple rerenders (dirty flag lifecycle)");
{
  const ctx = new RenderContext();
  const root: TuiRoot = createRoot(() => {});

  const text = createElement(TUI_TEXT, {});
  const tn = createTextNode("FRAME_0");
  text.children.push(tn); tn.parent = text;

  const box = createElement(TUI_BOX, { flexDirection: "column", width: W, height: H });
  box.children.push(text); text.parent = box;
  root.children.push(box);

  paint(root, W, H, ctx);

  for (let i = 1; i <= 10; i++) {
    tn.text = `FRAME_${i}`;
    ctx._renderRequested = true;
    const r = repaint(root, W, H, ctx);
    const lines = bufferToLines(r.buffer, H);
    check(`frame ${i} has current`, lines.some(l => l.includes(`FRAME_${i}`)));
    if (i > 1) {
      check(`frame ${i} no prev`, !lines.some(l => l.includes(`FRAME_${i-1}`)));
    }
  }
}

// ── 6. All clean after dirty frame — should skip ────────────────
console.log("  6. All clean after dirty frame (no-op)");
{
  const ctx = new RenderContext();
  const root: TuiRoot = createRoot(() => {});

  const text = createElement(TUI_TEXT, {});
  const tn = createTextNode("STABLE");
  text.children.push(tn); tn.parent = text;

  const box = createElement(TUI_BOX, { flexDirection: "column", width: W, height: H });
  box.children.push(text); text.parent = box;
  root.children.push(box);

  paint(root, W, H, ctx);

  // Dirty frame
  tn.text = "CHANGED";
  ctx._renderRequested = true;
  repaint(root, W, H, ctx);

  // Clean frame — no requestRender, no dirty
  const r = repaint(root, W, H, ctx);
  const lines = bufferToLines(r.buffer, H);
  check("clean frame preserves content", lines.some(l => l.includes("CHANGED")));
}

// ── Results ─────────────────────────────────────────────────────
console.log(`\n  Incremental edge cases: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
