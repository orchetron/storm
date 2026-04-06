/** ScrollView inner width — text wraps to width minus scrollbar column. */
import React from "react";
import { renderToString } from "../../../src/reconciler/render-to-string.js";
import { Box, Text, ScrollView } from "../../../src/components/index.js";

let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; }
  else { fail++; console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

const W = 40, H = 8;

console.log(`\n  ScrollView Inner Width Tests — ${W}×${H}\n`);

// ── 1. Full-width text: scrollbar should not hide last char ─────
console.log("  1. Full-width text — scrollbar doesn't eat last char");
{
  // 20 lines of 40 X's in a 6-row viewport — scrollbar will show
  const el = React.createElement(Box, { width: W, height: H },
    React.createElement(ScrollView, { height: 6 },
      ...Array.from({ length: 20 }, (_, i) =>
        React.createElement(Text, { key: i }, "X".repeat(W))
      ),
    ),
  );
  const r = renderToString(el, { width: W, height: H });
  const line0 = r.lines[0] || "";
  // Count X's before scrollbar
  const xCount = (line0.match(/X/g) || []).length;
  // Without fix: 39 X's (40th hidden by scrollbar). With fix: 39 X's on line 0, 1 X wraps to line 1
  // The key: no X should be invisible. Total X's across first 2 lines should be 40
  const line1 = r.lines[1] || "";
  const xCount1 = (line1.match(/X/g) || []).length;
  check("all X's accounted for", xCount + xCount1 === W,
    `line0: ${xCount} X's, line1: ${xCount1} X's, total: ${xCount + xCount1}`);
  // Scrollbar should be at last column
  const lastChar = line0[line0.length - 1] || "";
  check("scrollbar at last column", lastChar === "│" || lastChar === "┃",
    `got: ${JSON.stringify(lastChar)}`);
  r.unmount();
}

// ── 2. Prefix + text doesn't overflow into scrollbar ────────────
console.log("  2. Prefix + text respects scrollbar");
{
  const el = React.createElement(Box, { width: W, height: H },
    React.createElement(ScrollView, { height: 6 },
      ...Array.from({ length: 20 }, (_, i) =>
        React.createElement(Box, { key: i, flexDirection: "row" },
          React.createElement(Text, null, "● "),
          React.createElement(Box, { flexShrink: 1 },
            React.createElement(Text, null, "Line " + i + " — text content here that may wrap"),
          ),
        )
      ),
    ),
  );
  const r = renderToString(el, { width: W, height: H });
  check("prefix visible", r.output.includes("●"));
  // No line should have text overwriting the scrollbar position
  for (let i = 0; i < 6; i++) {
    const line = r.lines[i] || "";
    if (line.length === W) {
      const lastChar = line[W - 1] || "";
      const isScrollbar = lastChar === "│" || lastChar === "┃";
      check(`line ${i}: scrollbar intact`, isScrollbar,
        `last char: ${JSON.stringify(lastChar)}`);
    }
  }
  r.unmount();
}

// ── 3. Short content — scrollbar column reserved but empty ──────
console.log("  3. Short content — scrollbar reserve");
{
  const el = React.createElement(Box, { width: W, height: H },
    React.createElement(ScrollView, { height: 6 },
      React.createElement(Text, null, "X".repeat(W)),
    ),
  );
  const r = renderToString(el, { width: W, height: H });
  const xCount = (r.lines[0] || "").match(/X/g)?.length ?? 0;
  // Scroll containers always reserve 1 col for scrollbar (layout can't predict overflow)
  check("short content: X's fill W-1", xCount === W - 1,
    `got ${xCount} X's (expected ${W - 1})`);
  r.unmount();
}

// ── 4. Various widths — scrollbar reserve consistent ────────────
console.log("  4. Various widths");
{
  for (const testW of [30, 60, 80, 120]) {
    const el = React.createElement(Box, { width: testW, height: 8 },
      React.createElement(ScrollView, { height: 6 },
        ...Array.from({ length: 20 }, (_, i) =>
          React.createElement(Text, { key: i }, "Y".repeat(testW))
        ),
      ),
    );
    const r = renderToString(el, { width: testW, height: 8 });
    const line0 = r.lines[0] || "";
    const line1 = r.lines[1] || "";
    const y0 = (line0.match(/Y/g) || []).length;
    const y1 = (line1.match(/Y/g) || []).length;
    check(`W=${testW}: all Y's accounted`, y0 + y1 === testW,
      `line0: ${y0}, line1: ${y1}, total: ${y0 + y1}`);
    r.unmount();
  }
}

console.log(`\n  ScrollView inner width: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
