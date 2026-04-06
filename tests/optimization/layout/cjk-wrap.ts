/** Verifies wrapText line-breaks CJK characters by display width, not string.length. */
import React from "react";
import { renderToString } from "../../../src/reconciler/render-to-string.js";
import { Box, Text } from "../../../src/components/index.js";

let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; }
  else { fail++; console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

console.log(`\n  CJK Wrap Tests\n`);

// ── 1. Pure CJK wraps at column boundary ────────────────────────
console.log("  1. Pure CJK wrap");
{
  // 5 CJK = 10 display cols, container = 8 cols → 4 CJK fit (8 cols), 1 wraps
  const el = React.createElement(Box, { width: 8, height: 3 },
    React.createElement(Text, null, "中中中中中"),
  );
  const r = renderToString(el, { width: 8, height: 3 });
  const line0 = r.lines[0] || "";
  const line1 = r.lines[1] || "";
  const cjk0 = (line0.match(/中/g) || []).length;
  const cjk1 = (line1.match(/中/g) || []).length;
  check("line 0 has 4 CJK", cjk0 === 4, `got ${cjk0}`);
  check("line 1 has 1 CJK", cjk1 === 1, `got ${cjk1}`);
  r.unmount();
}

// ── 2. Mixed ASCII + CJK wrap ───────────────────────────────────
console.log("  2. Mixed ASCII + CJK");
{
  // "AB中CD" = 2+2+2 = 6 cols in 6-col container → fits on one line
  const el = React.createElement(Box, { width: 6, height: 3 },
    React.createElement(Text, null, "AB中CD"),
  );
  const r = renderToString(el, { width: 6, height: 3 });
  check("fits on one line", (r.lines[0] || "").includes("AB") && (r.lines[0] || "").includes("CD"));
  r.unmount();
}

// ── 3. CJK at odd-width boundary ────────────────────────────────
console.log("  3. Odd width boundary");
{
  // 5 CJK in 7-col container → 3 CJK fit (6 cols), col 7 can't fit half-char
  const el = React.createElement(Box, { width: 7, height: 3 },
    React.createElement(Text, null, "中中中中中"),
  );
  const r = renderToString(el, { width: 7, height: 3 });
  const cjk0 = ((r.lines[0] || "").match(/中/g) || []).length;
  check("odd width: 3 CJK on first line", cjk0 === 3, `got ${cjk0}`);
  r.unmount();
}

// ── 4. CJK exactly fills width ──────────────────────────────────
console.log("  4. Exact fit — no wrap");
{
  // 5 CJK = 10 cols in 10-col container → exact fit, no wrap
  const el = React.createElement(Box, { width: 10, height: 3 },
    React.createElement(Text, null, "中中中中中"),
  );
  const r = renderToString(el, { width: 10, height: 3 });
  const cjk0 = ((r.lines[0] || "").match(/中/g) || []).length;
  check("exact fit: 5 CJK on one line", cjk0 === 5, `got ${cjk0}`);
  check("no second line", (r.lines[1] || "").trim() === "");
  r.unmount();
}

// ── 5. CJK with spaces — word break at space ────────────────────
console.log("  5. CJK with spaces");
{
  // "中文 测试" = 4+1+4 = 9 cols in 6-col container
  // Should wrap at space: "中文" (4) on line 0, "测试" (4) on line 1
  const el = React.createElement(Box, { width: 6, height: 3 },
    React.createElement(Text, null, "中文 测试"),
  );
  const r = renderToString(el, { width: 6, height: 3 });
  check("line 0 has 中文", (r.lines[0] || "").includes("中文"));
  check("line 1 has 测试", (r.lines[1] || "").includes("测试"));
  r.unmount();
}

// ── 6. Long CJK wraps across multiple lines ─────────────────────
console.log("  6. Multi-line CJK wrap");
{
  // 9 CJK = 18 cols in 6-col container → 3 lines of 3 CJK each
  const el = React.createElement(Box, { width: 6, height: 5 },
    React.createElement(Text, null, "中中中中中中中中中"),
  );
  const r = renderToString(el, { width: 6, height: 5 });
  for (let i = 0; i < 3; i++) {
    const cjk = ((r.lines[i] || "").match(/中/g) || []).length;
    check(`line ${i} has 3 CJK`, cjk === 3, `got ${cjk}`);
  }
  r.unmount();
}

console.log(`\n  CJK wrap: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
