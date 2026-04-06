/** Verifies renderLine skips WIDE_CHAR_PLACEHOLDER instead of emitting literal null bytes. */
import { ScreenBuffer } from "../../../src/core/buffer.js";
import { DiffRenderer } from "../../../src/core/diff.js";
import { DEFAULT_COLOR, rgb } from "../../../src/core/types.js";
import React from "react";
import { renderToString } from "../../../src/reconciler/render-to-string.js";
import { Box, Text } from "../../../src/components/index.js";

let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; }
  else { fail++; console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, "")
    .replace(/\x1b[78]/g, "")
    .replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, "");
}

console.log(`\n  CJK Rendering Tests\n`);

// ── 1. Buffer renderLine: no null bytes in output ───────────────
console.log("  1. No null bytes in renderLine output");
{
  const buf = new ScreenBuffer(10, 1);
  const diff = new DiffRenderer(10, 1);
  buf.writeString(0, 0, "中文测试中", rgb(255, 0, 0), DEFAULT_COLOR);
  const r = diff.render(buf);
  const hasNull = r.output.includes("\0");
  check("no null bytes in ANSI output", !hasNull,
    hasNull ? `found \\0 at index ${r.output.indexOf("\0")}` : "");
}

// ── 2. Stripped output has only CJK chars, no placeholders ──────
console.log("  2. Stripped output is clean CJK");
{
  const buf = new ScreenBuffer(20, 1);
  const diff = new DiffRenderer(20, 1);
  buf.writeString(0, 0, "中文测试中文测试中文", rgb(255, 0, 0), DEFAULT_COLOR);
  const r = diff.render(buf);
  const stripped = stripAnsi(r.output);
  check("stripped has CJK", stripped.includes("中文测试"));
  check("no null in stripped", !stripped.includes("\0"),
    stripped.includes("\0") ? "null bytes in visible output" : "");
}

// ── 3. Component-level: Text with CJK ───────────────────────────
console.log("  3. Text component with CJK");
{
  const el = React.createElement(Box, { flexDirection: "column", width: 20, height: 3 },
    React.createElement(Text, null, "中文测试中文测试中文"),
  );
  const r = renderToString(el, { width: 20, height: 3 });
  check("output has CJK", r.output.includes("中"));
  const hasNull = r.output.includes("\0");
  check("no null in component output", !hasNull,
    hasNull ? "null bytes leaked to output" : "");
}

// ── 4. Full row of CJK (20 chars = 40 cols) ────────────────────
console.log("  4. Full row of CJK");
{
  const buf = new ScreenBuffer(40, 1);
  const diff = new DiffRenderer(40, 1);
  buf.writeString(0, 0, "中".repeat(20), rgb(255, 0, 0), DEFAULT_COLOR);
  const r = diff.render(buf);
  const stripped = stripAnsi(r.output);
  const cjkCount = (stripped.match(/中/g) || []).length;
  check("20 CJK chars in output", cjkCount === 20, `got ${cjkCount}`);
  check("no null bytes", !r.output.includes("\0"));
}

// ── 5. Mixed ASCII + CJK ───────────────────────────────────────
console.log("  5. Mixed ASCII + CJK");
{
  const buf = new ScreenBuffer(20, 1);
  const diff = new DiffRenderer(20, 1);
  buf.writeString(0, 0, "AB中CD日EF", rgb(255, 0, 0), DEFAULT_COLOR);
  const r = diff.render(buf);
  const stripped = stripAnsi(r.output);
  check("has AB", stripped.includes("AB"));
  check("has 中", stripped.includes("中"));
  check("has CD", stripped.includes("CD"));
  check("has 日", stripped.includes("日"));
  check("no null", !r.output.includes("\0"));
}

// ── 6. CJK in cell-diff path (changed cells only) ──────────────
console.log("  6. CJK in cell-diff path");
{
  const buf = new ScreenBuffer(20, 3);
  const diff = new DiffRenderer(20, 3);

  // Frame 1: ASCII
  buf.writeString(0, 0, "HELLO", rgb(255, 0, 0), DEFAULT_COLOR);
  buf.writeString(0, 1, "WORLD", rgb(255, 0, 0), DEFAULT_COLOR);
  diff.render(buf);

  // Frame 2: change row 0 to CJK
  buf.clearPaintedRows();
  buf.writeString(0, 0, "中文测试", rgb(0, 255, 0), DEFAULT_COLOR);
  buf.writeString(0, 1, "WORLD", rgb(255, 0, 0), DEFAULT_COLOR);
  const r = diff.render(buf);
  check("cell-diff has CJK", stripAnsi(r.output).includes("中"));
  check("cell-diff no null", !r.output.includes("\0"));
}

console.log(`\n  CJK rendering: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
