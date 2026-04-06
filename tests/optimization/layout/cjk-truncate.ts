/** Verifies Text truncation uses display columns (not string.length) for CJK characters. */
import React from "react";
import { renderToString } from "../../../src/reconciler/render-to-string.js";
import { Box, Text } from "../../../src/components/index.js";

let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; }
  else { fail++; console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

const W = 20, H = 3;

console.log(`\n  CJK Truncation Tests — ${W}×${H}\n`);

// ── 1. CJK text that exceeds width should be truncated ──────────
console.log("  1. CJK exceeds width → truncated");
{
  // 15 CJK = 30 display cols, but width is 20 → should truncate
  const el = React.createElement(Box, { width: W, height: H },
    React.createElement(Text, { wrap: "truncate" }, "中".repeat(15)),
  );
  const r = renderToString(el, { width: W, height: H });
  // Should be truncated — not all 15 chars should appear
  const cjkCount = (r.output.match(/中/g) || []).length;
  check("truncated CJK count < 15", cjkCount < 15,
    `got ${cjkCount} (should be ~9 + ellipsis)`);
  // Should have ellipsis
  check("has ellipsis", r.output.includes("…") || r.output.includes("..."),
    `no truncation indicator found`);
  r.unmount();
}

// ── 2. CJK text that fits should NOT be truncated ───────────────
console.log("  2. CJK fits width → not truncated");
{
  // 10 CJK = 20 display cols = exactly width 20
  const el = React.createElement(Box, { width: W, height: H },
    React.createElement(Text, { wrap: "truncate" }, "中".repeat(10)),
  );
  const r = renderToString(el, { width: W, height: H });
  const cjkCount = (r.output.match(/中/g) || []).length;
  check("all 10 CJK present", cjkCount === 10, `got ${cjkCount}`);
  check("no ellipsis", !r.output.includes("…"));
  r.unmount();
}

// ── 3. Mixed ASCII + CJK truncation ─────────────────────────────
console.log("  3. Mixed ASCII + CJK truncation");
{
  // "ABCDE" (5) + "中文" (4 cols) = 9 cols → fits in 20
  // "ABCDE" (5) + "中文中文中文中文" (16 cols) = 21 cols → truncate
  const el = React.createElement(Box, { width: W, height: H },
    React.createElement(Text, { wrap: "truncate" }, "ABCDE" + "中文".repeat(4)),
  );
  const r = renderToString(el, { width: W, height: H });
  check("has ABCDE", r.output.includes("ABCDE"));
  check("has ellipsis", r.output.includes("…"));
  r.unmount();
}

// ── 4. ASCII + CJK at boundary shouldn't overflow ───────────────
console.log("  4. ASCII + CJK at boundary");
{
  // 19 B's + 中 = 21 display cols in 20-wide container
  const el = React.createElement(Box, { width: W, height: H },
    React.createElement(Text, { wrap: "truncate" }, "B".repeat(19) + "中"),
  );
  const r = renderToString(el, { width: W, height: H });
  // The 中 doesn't fit → should be truncated with ellipsis
  check("boundary: has ellipsis", r.output.includes("…"),
    `no truncation — CJK overflowed`);
  r.unmount();
}

// ── 5. Column positions: CJK chars shouldn't overlap ────────────
console.log("  5. CJK column positions");
{
  // 5 CJK = 10 display cols in 20-wide container → fits, no overlap
  const el = React.createElement(Box, { width: W, height: H },
    React.createElement(Text, null, "中文测试中"),
  );
  const r = renderToString(el, { width: W, height: H });
  check("5 CJK present", (r.output.match(/[中文测试]/g) || []).length === 5,
    `got ${(r.output.match(/[中文测试]/g) || []).length}`);
  r.unmount();
}

console.log(`\n  CJK truncation: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
