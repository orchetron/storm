/** Renderer-level transition tests via renderToString: tree swaps where clean subtrees left stale content. */
import React from "react";
import { renderToString } from "../../../src/reconciler/render-to-string.js";
import { paint, repaint } from "../../../src/reconciler/renderer.js";
import { RenderContext } from "../../../src/core/render-context.js";
import { ScreenBuffer } from "../../../src/core/buffer.js";
import { DiffRenderer } from "../../../src/core/diff.js";
import { createRoot, type TuiRoot } from "../../../src/reconciler/types.js";

let pass = 0, fail = 0;

function check(name: string, output: string, expected: string[]) {
  const lines = output.split("\n");
  for (const exp of expected) {
    if (!lines.some(l => l.includes(exp))) {
      fail++;
      console.log(`  FAIL: ${name} — missing "${exp}"`);
      console.log(`    Got: ${lines.slice(0, 5).join(" | ")}`);
      return;
    }
  }
  pass++;
}

function checkAbsent(name: string, output: string, absent: string[]) {
  const lines = output.split("\n");
  for (const a of absent) {
    if (lines.some(l => l.includes(a))) {
      fail++;
      console.log(`  FAIL: ${name} — should NOT contain "${a}" but found it`);
      return;
    }
  }
  pass++;
}

console.log(`\n  Renderer-Level Transition Tests\n`);

const W = 60, H = 15;

// ── 1. Full screen → partial screen ────────────────────────────
console.log("  1. Full screen → partial");
{
  // Screen A: fills all rows
  const screenA = React.createElement("tui-box", { flexDirection: "column", width: W, height: H },
    ...Array.from({ length: H }, (_, i) =>
      React.createElement("tui-text", { key: i }, `SPLASH ROW ${i}`)
    )
  );

  // Screen B: only 3 rows
  const screenB = React.createElement("tui-box", { flexDirection: "column", width: W, height: H },
    React.createElement("tui-text", null, "HEADER"),
    React.createElement("tui-text", null, "CONTENT"),
    React.createElement("tui-text", null, "FOOTER"),
  );

  const r = renderToString(screenA, { width: W, height: H });
  check("screen A has splash", r.output, ["SPLASH ROW 0", "SPLASH ROW 10"]);

  const r2 = r.rerender(screenB);
  check("screen B has header", r2.output, ["HEADER", "CONTENT", "FOOTER"]);
  checkAbsent("screen B no splash", r2.output, ["SPLASH ROW"]);

  r.unmount();
}

// ── 2. Partial → full → partial ─────────────────────────────────
console.log("  2. Partial → full → partial");
{
  const small = React.createElement("tui-box", { flexDirection: "column", width: W, height: H },
    React.createElement("tui-text", null, "SMALL SCREEN"),
  );

  const big = React.createElement("tui-box", { flexDirection: "column", width: W, height: H },
    ...Array.from({ length: H }, (_, i) =>
      React.createElement("tui-text", { key: i }, `BIG ROW ${i}`)
    )
  );

  const small2 = React.createElement("tui-box", { flexDirection: "column", width: W, height: H },
    React.createElement("tui-text", null, "BACK TO SMALL"),
  );

  const r = renderToString(small, { width: W, height: H });
  check("initial small", r.output, ["SMALL SCREEN"]);

  const r2 = r.rerender(big);
  check("expanded to big", r2.output, ["BIG ROW 0", "BIG ROW 10"]);
  checkAbsent("big has no small", r2.output, ["SMALL SCREEN"]);

  const r3 = r.rerender(small2);
  check("back to small", r3.output, ["BACK TO SMALL"]);
  checkAbsent("small2 no big rows", r3.output, ["BIG ROW"]);

  r.unmount();
}

// ── 3. Content change within same layout ────────────────────────
console.log("  3. Content change same layout");
{
  const make = (label: string) => React.createElement("tui-box", { flexDirection: "column", width: W, height: H },
    React.createElement("tui-text", null, `Title: ${label}`),
    React.createElement("tui-text", null, `Body of ${label}`),
  );

  const r = renderToString(make("ScreenA"), { width: W, height: H });
  check("screen A content", r.output, ["Title: ScreenA", "Body of ScreenA"]);

  const r2 = r.rerender(make("ScreenB"));
  check("screen B content", r2.output, ["Title: ScreenB", "Body of ScreenB"]);
  checkAbsent("no screen A content", r2.output, ["ScreenA"]);

  r.unmount();
}

// ── 4. Styled text changes ──────────────────────────────────────
console.log("  4. Styled text changes");
{
  const make = (text: string, color: string) => React.createElement("tui-box", { width: W, height: H },
    React.createElement("tui-text", { color }, text),
  );

  const r = renderToString(make("RED TEXT", "red"), { width: W, height: H });
  check("red text", r.output, ["RED TEXT"]);

  const r2 = r.rerender(make("BLUE TEXT", "blue"));
  check("blue text", r2.output, ["BLUE TEXT"]);
  checkAbsent("no red text", r2.output, ["RED TEXT"]);

  r.unmount();
}

// ── 5. Rapid rerenders (10 different screens) ───────────────────
console.log("  5. Rapid rerenders (10 screens)");
{
  const make = (n: number) => React.createElement("tui-box", { flexDirection: "column", width: W, height: H },
    React.createElement("tui-text", null, `SCREEN_${n}`),
    ...Array.from({ length: n % 5 + 1 }, (_, i) =>
      React.createElement("tui-text", { key: i }, `Row ${i} of screen ${n}`)
    ),
  );

  const r = renderToString(make(0), { width: W, height: H });
  for (let i = 1; i <= 10; i++) {
    const ri = r.rerender(make(i));
    check(`screen ${i} present`, ri.output, [`SCREEN_${i}`]);
    checkAbsent(`screen ${i} no prev`, ri.output, [`SCREEN_${i - 1}`]);
  }
  r.unmount();
}

// ── 6. Direct repaint() call (simulates requestRender path) ─────
// repaint() is called WITHOUT paint() — _bufferCleared is false.
// If incremental paint skips clean subtrees, stale content bleeds through.
console.log("  6. Direct repaint() call");
{
  const ctx = new RenderContext();
  const root: TuiRoot = createRoot(() => {});

  // Frame 1: full paint via paint()
  const r1 = paint(root, W, H, ctx);
  // Manually write full screen content (simulating React tree paint)
  for (let y = 0; y < H; y++) {
    r1.buffer.writeString(0, y, `FULL_LINE_${y}`.padEnd(W).slice(0, W), 7, 0, 0);
  }

  // Frame 2: repaint() directly (simulating requestRender)
  // Set _renderRequested like the real requestRender() does
  ctx._renderRequested = true;
  const r2 = repaint(root, W, H, ctx);
  // Only write to row 0 (simulating a dirty spinner element)
  r2.buffer.writeString(0, 0, "SPINNER_ONLY".padEnd(W).slice(0, W), 1, 0, 0);

  // Read buffer contents
  const lines: string[] = [];
  for (let y = 0; y < H; y++) {
    let line = "";
    for (let x = 0; x < W; x++) line += r2.buffer.getChar(x, y);
    lines.push(line.trimEnd());
  }
  const output = lines.join("\n");

  check("repaint has spinner", output, ["SPINNER_ONLY"]);
  // Stale content must be gone — if row 5 still says FULL_LINE_5, incremental paint is broken
  checkAbsent("repaint no stale content", output, ["FULL_LINE_5", "FULL_LINE_10"]);
}

// ── Results ─────────────────────────────────────────────────────
console.log(`\n  Renderer transitions: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
