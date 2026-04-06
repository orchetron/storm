/** Verifies content outside a container's bounds is not painted to the buffer. */
import React from "react";
import { renderToString } from "../../../src/reconciler/render-to-string.js";
import { Box, Text, ScrollView } from "../../../src/components/index.js";

let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; }
  else { fail++; console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

const W = 30, H = 10;

console.log(`\n  Overflow Clipping Tests — ${W}×${H}\n`);

// ── 1. ScrollView: items above viewport not visible ─────────────
console.log("  1. ScrollView clips above viewport");
{
  const el = React.createElement(Box, { flexDirection: "column", width: W, height: H },
    React.createElement(Text, null, "HEADER"),
    React.createElement(ScrollView, { height: 5 },
      ...Array.from({ length: 20 }, (_, i) =>
        React.createElement(Text, { key: i }, `ITEM_${i}`)
      )
    ),
    React.createElement(Text, null, "FOOTER"),
  );
  const r = renderToString(el, { width: W, height: H });
  check("ITEM_0 clipped", !r.output.includes("ITEM_0"));
  check("ITEM_19 visible", r.output.includes("ITEM_19"));
  check("HEADER visible", r.output.includes("HEADER"));
  check("FOOTER visible", r.output.includes("FOOTER"));
  r.unmount();
}

// ── 2. ScrollView: content doesn't bleed into surrounding rows ──
console.log("  2. ScrollView doesn't bleed into header/footer rows");
{
  const el = React.createElement(Box, { flexDirection: "column", width: W, height: 7 },
    React.createElement(Text, null, "TOP_ROW"),
    React.createElement(ScrollView, { height: 5 },
      ...Array.from({ length: 30 }, (_, i) =>
        React.createElement(Text, { key: i }, `SCROLL_${i}`)
      )
    ),
    React.createElement(Text, null, "BOTTOM_ROW"),
  );
  const r = renderToString(el, { width: W, height: 7 });
  // TOP_ROW should be on line 0, not overwritten by scroll content
  check("line 0 has TOP_ROW", (r.lines[0] || "").includes("TOP_ROW"),
    `got: ${r.lines[0]}`);
  // BOTTOM_ROW should be on last line
  const lastLine = r.lines[r.lines.length - 1] || "";
  check("last line has BOTTOM_ROW", lastLine.includes("BOTTOM_ROW"),
    `got: ${lastLine}`);
  r.unmount();
}

// ── 3. overflow:hidden clips long text ──────────────────────────
console.log("  3. overflow:hidden clips text");
{
  const el = React.createElement(Box,
    { width: 10, height: 1, overflow: "hidden" },
    React.createElement(Text, { wrap: "truncate" }, "ABCDEFGHIJKLMNOP"),
  );
  const r = renderToString(el, { width: W, height: H });
  check("has ABCDEFGHI", r.output.includes("ABCDEFGHI"));
  check("no KLMNOP", !r.output.includes("KLMNOP"),
    `leaked: ${r.lines.find(l => l.includes("KLMNOP"))}`);
  r.unmount();
}

// ── 4. Nested boxes: inner overflow clipped by outer ────────────
console.log("  4. Nested overflow clipping");
{
  const el = React.createElement(Box,
    { flexDirection: "column", width: 15, height: 3, overflow: "hidden" },
    React.createElement(Box, { width: 15 },
      React.createElement(Text, null, "VISIBLE TEXT"),
    ),
    React.createElement(Box, { width: 15 },
      React.createElement(Text, null, "SECOND LINE"),
    ),
    React.createElement(Box, { width: 15 },
      React.createElement(Text, null, "THIRD LINE"),
    ),
    React.createElement(Box, { width: 15 },
      React.createElement(Text, null, "SHOULD NOT SEE THIS"),
    ),
  );
  const r = renderToString(el, { width: W, height: H });
  check("visible text shown", r.output.includes("VISIBLE TEXT"));
  // Fourth box exceeds height 3 — should be clipped
  check("fourth box clipped", !r.output.includes("SHOULD NOT SEE"),
    `leaked: ${r.lines.find(l => l.includes("SHOULD NOT"))}`);
  r.unmount();
}

// ── 5. ScrollView after rerender — clipping still works ─────────
console.log("  5. ScrollView clipping after rerender");
{
  const mk = (count: number) => React.createElement(Box,
    { flexDirection: "column", width: W, height: 7 },
    React.createElement(Text, null, "HEAD"),
    React.createElement(ScrollView, { height: 5 },
      ...Array.from({ length: count }, (_, i) =>
        React.createElement(Text, { key: i }, `ROW_${i}`)
      )
    ),
  );

  const r = renderToString(mk(5), { width: W, height: 7 });
  check("5 items: ROW_0 visible", r.output.includes("ROW_0"));

  const r2 = r.rerender(mk(50));
  check("50 items: ROW_0 clipped", !r2.output.includes("ROW_0"));
  check("50 items: ROW_49 visible", r2.output.includes("ROW_49"));
  check("50 items: HEAD visible", r2.output.includes("HEAD"));

  r.unmount();
}

console.log(`\n  Overflow clipping: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
