/** flexShrink overflow — children must not exceed parent width. */
import React from "react";
import { renderToString } from "../../../src/reconciler/render-to-string.js";
import { Box, Text } from "../../../src/components/index.js";

let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; }
  else { fail++; console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

console.log(`\n  flexShrink Overflow Tests\n`);

// ── 1. Prefix + shrink box at various widths ────────────────────
console.log("  1. Prefix + shrink at various widths");
{
  for (const W of [20, 30, 50, 80, 111, 112, 120]) {
    const el = React.createElement(Box, { flexDirection: "row", width: W, height: 1 },
      React.createElement(Text, null, "AB"),
      React.createElement(Box, { flexShrink: 1 },
        React.createElement(Text, null, "X".repeat(200)),
      ),
    );
    const r = renderToString(el, { width: W, height: 2 });
    const line0 = r.lines[0] || "";
    // Line should not exceed parent width
    check(`W=${W}: line fits`, line0.length <= W,
      `len=${line0.length}`);
    // X count should be W - 2 (prefix takes 2)
    const xCount = (line0.match(/X/g) || []).length;
    check(`W=${W}: X count correct`, xCount === W - 2,
      `got ${xCount} expected ${W - 2}`);
    r.unmount();
  }
}

// ── 2. Single-char prefix ───────────────────────────────────────
console.log("  2. Single-char prefix");
{
  const el = React.createElement(Box, { flexDirection: "row", width: 20, height: 1 },
    React.createElement(Text, null, ">"),
    React.createElement(Box, { flexShrink: 1 },
      React.createElement(Text, null, "X".repeat(50)),
    ),
  );
  const r = renderToString(el, { width: 20, height: 2 });
  const xCount = ((r.lines[0] || "").match(/X/g) || []).length;
  check("1-char prefix: X = W-1", xCount === 19, `got ${xCount}`);
  r.unmount();
}

// ── 3. Multi-char prefix ────────────────────────────────────────
console.log("  3. Multi-char prefix (5 chars)");
{
  const el = React.createElement(Box, { flexDirection: "row", width: 20, height: 1 },
    React.createElement(Text, null, "ABCDE"),
    React.createElement(Box, { flexShrink: 1 },
      React.createElement(Text, null, "X".repeat(50)),
    ),
  );
  const r = renderToString(el, { width: 20, height: 2 });
  const xCount = ((r.lines[0] || "").match(/X/g) || []).length;
  check("5-char prefix: X = W-5", xCount === 15, `got ${xCount}`);
  r.unmount();
}

// ── 4. Three children with shrink ───────────────────────────────
console.log("  4. Three children with shrink");
{
  const el = React.createElement(Box, { flexDirection: "row", width: 30, height: 1 },
    React.createElement(Text, null, "AA"),
    React.createElement(Box, { flexShrink: 1 },
      React.createElement(Text, null, "X".repeat(100)),
    ),
    React.createElement(Text, null, "BB"),
  );
  const r = renderToString(el, { width: 30, height: 2 });
  const line0 = r.lines[0] || "";
  check("3 children: fits width", line0.length <= 30, `len=${line0.length}`);
  r.unmount();
}

console.log(`\n  flexShrink overflow: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
