/** Diff renderer handling of wide character placeholder cells and adjacent attribute changes. */
import { ScreenBuffer, WIDE_CHAR_PLACEHOLDER } from "../../../src/core/buffer.js";
import { DiffRenderer } from "../../../src/core/diff.js";
import { DEFAULT_COLOR, Attr, rgb } from "../../../src/core/types.js";
import React from "react";
import { renderToString } from "../../../src/reconciler/render-to-string.js";
import { Box, Text } from "../../../src/components/index.js";

let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; }
  else { fail++; console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

const RED = rgb(255, 0, 0);
const GREEN = rgb(0, 255, 0);
const BLUE = rgb(0, 0, 255);

console.log(`\n  Wide Char Diff Tests\n`);

// ── Buffer-level tests ──────────────────────────────────────────

console.log("  Buffer level:");

// 1. Normal wide char change
{
  const buf = new ScreenBuffer(10, 1);
  const diff = new DiffRenderer(10, 1);
  buf.writeString(0, 0, "中", RED, DEFAULT_COLOR);
  diff.render(buf);
  buf.writeString(0, 0, "日", BLUE, DEFAULT_COLOR);
  const r = diff.render(buf);
  check("wide char content change", r.changedLines >= 1);
}

// 2. Wide char → narrow
{
  const buf = new ScreenBuffer(10, 1);
  const diff = new DiffRenderer(10, 1);
  buf.writeString(0, 0, "中", RED, DEFAULT_COLOR);
  diff.render(buf);
  buf.writeString(0, 0, "AB", GREEN, DEFAULT_COLOR);
  const r = diff.render(buf);
  check("wide→narrow detected", r.changedLines >= 1);
}

// 3. Narrow → wide
{
  const buf = new ScreenBuffer(10, 1);
  const diff = new DiffRenderer(10, 1);
  buf.writeString(0, 0, "AB", RED, DEFAULT_COLOR);
  diff.render(buf);
  buf.writeString(0, 0, "中", GREEN, DEFAULT_COLOR);
  const r = diff.render(buf);
  check("narrow→wide detected", r.changedLines >= 1);
}

// 4. Placeholder bg change is a no-op (terminal ignores placeholder attrs)
{
  const buf = new ScreenBuffer(10, 1);
  const diff = new DiffRenderer(10, 1);
  buf.writeString(0, 0, "中", RED, DEFAULT_COLOR);
  diff.render(buf);
  buf.setCellDirect(1, 0, "\0", RED, GREEN, Attr.NONE, DEFAULT_COLOR);
  const r = diff.render(buf);
  // Terminal renders wide char as 2 cols with the wide char's attrs.
  // Placeholder attrs don't matter — correctly detected as no visual change.
  check("placeholder-only change is no-op", r.output.length === 0);
}

// 5. Simulated border next to CJK: [中][PLACEHOLDER][│] → change │ bg
{
  const buf = new ScreenBuffer(10, 1);
  const diff = new DiffRenderer(10, 1);
  buf.writeString(0, 0, "中", RED, DEFAULT_COLOR);
  buf.setCellDirect(2, 0, "│", DEFAULT_COLOR, DEFAULT_COLOR, Attr.NONE, DEFAULT_COLOR);
  diff.render(buf);
  // Border repainted with blue bg (focus highlight)
  buf.setCellDirect(2, 0, "│", DEFAULT_COLOR, BLUE, Attr.NONE, DEFAULT_COLOR);
  const r = diff.render(buf);
  check("border next to CJK change detected", r.changedLines >= 1);
}

// 6. Multiple wide chars — change second
{
  const buf = new ScreenBuffer(10, 1);
  const diff = new DiffRenderer(10, 1);
  buf.writeString(0, 0, "中日", RED, DEFAULT_COLOR);
  diff.render(buf);
  buf.writeString(2, 0, "本", GREEN, DEFAULT_COLOR);
  const r = diff.render(buf);
  check("second wide char change", r.changedLines >= 1);
}

// ── Component-level tests ───────────────────────────────────────

console.log("  Component level:");

// 7. Bordered box with CJK content — border color change
{
  const mk = (borderColor: string) => React.createElement(Box,
    { borderStyle: "single", borderColor, width: 12, height: 3 },
    React.createElement(Text, null, "中文测试中")
  );

  const r = renderToString(mk("#565F89"), { width: 20, height: 5 });
  check("bordered CJK renders", r.output.includes("中"));

  const r2 = r.rerender(mk("#FF4444"));
  // Border color changed — diff should detect it even near CJK
  check("border color change renders", r2.styledOutput !== r.styledOutput,
    "styled output unchanged after border color change");

  r.unmount();
}

// 8. CJK text bg change inside box
{
  const mk = (bg?: string) => React.createElement(Box,
    { width: 20, height: 3 },
    React.createElement(Text, { backgroundColor: bg }, "中文测试")
  );

  const r = renderToString(mk(), { width: 20, height: 3 });
  const r2 = r.rerender(mk("#FF4444"));
  check("CJK bg change renders", r2.styledOutput !== r.styledOutput);

  const r3 = r.rerender(mk());
  check("CJK bg removal renders", r3.styledOutput !== r2.styledOutput);

  r.unmount();
}

console.log(`\n  Wide char diff: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
