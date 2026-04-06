/** Verifies scrollTop clamping when content height changes in ScrollView. */
import React from "react";
import { renderToString } from "../../../src/reconciler/render-to-string.js";
import { ScrollView, Box, Text } from "../../../src/components/index.js";

let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; }
  else { fail++; console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

const W = 30, H = 8;

console.log(`\n  Scroll Clamping Tests — ${W}×${H}\n`);

// ── 1. stickToBottom: content grows, scroll stays at end ────────
console.log("  1. stickToBottom — content grows");
{
  const mk = (count: number) => React.createElement(Box,
    { flexDirection: "column", width: W, height: H },
    React.createElement(ScrollView, { height: H - 1 },
      ...Array.from({ length: count }, (_, i) =>
        React.createElement(Text, { key: i }, `ITEM_${i}`)
      )
    )
  );

  const r = renderToString(mk(20), { width: W, height: H });
  // stickToBottom default — last items should be visible
  check("20 items: ITEM_19 visible", r.output.includes("ITEM_19"),
    `last lines: ${r.lines.slice(-3).join(" | ")}`);

  // Grow to 30 items — should still show last items
  const r2 = r.rerender(mk(30));
  check("30 items: ITEM_29 visible", r2.output.includes("ITEM_29"),
    `last lines: ${r2.lines.slice(-3).join(" | ")}`);
  check("30 items: ITEM_19 NOT last", !r2.lines[r2.lines.length - 1]?.includes("ITEM_19"));

  r.unmount();
}

// ── 2. Content shrinks — scroll clamps down ─────────────────────
console.log("  2. Content shrinks — scroll clamps");
{
  const mk = (count: number) => React.createElement(Box,
    { flexDirection: "column", width: W, height: H },
    React.createElement(ScrollView, { height: H - 1 },
      ...Array.from({ length: count }, (_, i) =>
        React.createElement(Text, { key: i }, `LINE_${i}`)
      )
    )
  );

  // Start with 30 items (scrolled to bottom)
  const r = renderToString(mk(30), { width: W, height: H });
  check("30 items: LINE_29 visible", r.output.includes("LINE_29"));

  // Shrink to 5 items — should show all 5, no blank space
  const r2 = r.rerender(mk(5));
  check("5 items: LINE_0 visible", r2.output.includes("LINE_0"),
    `got: ${r2.lines.slice(0, 5).join(" | ")}`);
  check("5 items: LINE_4 visible", r2.output.includes("LINE_4"));
  check("5 items: LINE_29 gone", !r2.output.includes("LINE_29"),
    `stale: ${r2.lines.find(l => l.includes("LINE_29"))}`);

  r.unmount();
}

// ── 3. Content to empty ─────────────────────────────────────────
console.log("  3. Content to empty");
{
  const full = React.createElement(Box,
    { flexDirection: "column", width: W, height: H },
    React.createElement(ScrollView, { height: H - 1 },
      ...Array.from({ length: 20 }, (_, i) =>
        React.createElement(Text, { key: i }, `DATA_${i}`)
      )
    )
  );

  const empty = React.createElement(Box,
    { flexDirection: "column", width: W, height: H },
    React.createElement(ScrollView, { height: H - 1 },
      React.createElement(Text, null, "EMPTY"),
    )
  );

  const r = renderToString(full, { width: W, height: H });
  check("full has DATA", r.output.includes("DATA_"));

  const r2 = r.rerender(empty);
  check("empty has EMPTY", r2.output.includes("EMPTY"));
  check("empty no stale DATA", !r2.output.includes("DATA_"),
    `stale: ${r2.lines.find(l => l.includes("DATA_"))}`);

  r.unmount();
}

// ── 4. Rapid add/remove cycles ──────────────────────────────────
console.log("  4. Rapid add/remove cycles");
{
  const mk = (count: number) => React.createElement(Box,
    { flexDirection: "column", width: W, height: H },
    React.createElement(ScrollView, { height: H - 1 },
      ...Array.from({ length: count }, (_, i) =>
        React.createElement(Text, { key: i }, `R_${i}`)
      )
    )
  );

  const r = renderToString(mk(5), { width: W, height: H });

  // Grow → shrink → grow → shrink
  const sizes = [30, 3, 50, 2, 10];
  for (const size of sizes) {
    const rn = r.rerender(mk(size));
    const lastItem = `R_${size - 1}`;
    check(`${size} items: ${lastItem} visible`, rn.output.includes(lastItem),
      `lines: ${rn.lines.filter(l => l.includes("R_")).slice(-2).join(" | ")}`);
  }

  r.unmount();
}

console.log(`\n  Scroll clamping: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
