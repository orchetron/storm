/** Overlapping elements, conditional rendering, text length changes, focus visual updates. */
import React from "react";
import { renderToString } from "../../../src/reconciler/render-to-string.js";
import { Box, Text } from "../../../src/components/index.js";

let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; }
  else { fail++; console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

const W = 30, H = 8;

console.log(`\n  Overlap & Misc Tests — ${W}×${H}\n`);

// ── 1. Overlapping absolute elements — later wins ───────────────
console.log("  1. Overlapping elements — paint order");
{
  const el = React.createElement(Box, { width: W, height: H },
    React.createElement(Box, { position: "absolute", top: 0, left: 0, height: 1 },
      React.createElement(Text, null, "AAAAAAAAAA"),
    ),
    React.createElement(Box, { position: "absolute", top: 0, left: 0, height: 1 },
      React.createElement(Text, null, "BBBBB"),
    ),
  );
  const r = renderToString(el, { width: W, height: H });
  const line0 = r.lines[0] || "";
  check("later element overwrites", line0.startsWith("BBBBB"),
    `got: ${JSON.stringify(line0.slice(0, 15))}`);
  check("earlier element visible after overlap", line0.includes("AAAAA"),
    `got: ${JSON.stringify(line0.slice(0, 15))}`);
  r.unmount();
}

// ── 2. Partial overlap — both visible ───────────────────────────
console.log("  2. Partial overlap");
{
  const el = React.createElement(Box, { width: W, height: H },
    React.createElement(Box, { position: "absolute", top: 0, left: 0, height: 1 },
      React.createElement(Text, null, "XXXXXXXXXXXX"),
    ),
    React.createElement(Box, { position: "absolute", top: 0, left: 8, width: 4, height: 1 },
      React.createElement(Text, null, "YYYY"),
    ),
  );
  const r = renderToString(el, { width: W, height: H });
  const line0 = r.lines[0] || "";
  check("X visible at start", line0.startsWith("XXXXXXXX"),
    `got: ${JSON.stringify(line0.slice(0, 15))}`);
  check("Y overwrites middle", line0.slice(8, 12) === "YYYY",
    `got: ${JSON.stringify(line0.slice(8, 12))}`);
  // Second box (width:4) clears cols 8-11, so X's end at col 7
  check("correct overlap length", line0.length === 12,
    `got length ${line0.length}`);
  r.unmount();
}

// ── 3. Conditional rendering — if/else swap ─────────────────────
console.log("  3. Conditional rendering");
{
  const mk = (show: "A" | "B") => React.createElement(Box,
    { flexDirection: "column", width: W, height: H },
    show === "A"
      ? React.createElement(Text, { key: "a" }, "SHOWING_A")
      : React.createElement(Text, { key: "b" }, "SHOWING_B"),
  );

  const r = renderToString(mk("A"), { width: W, height: H });
  check("initial shows A", r.output.includes("SHOWING_A"));
  check("initial no B", !r.output.includes("SHOWING_B"));

  const r2 = r.rerender(mk("B"));
  check("swapped shows B", r2.output.includes("SHOWING_B"));
  check("swapped no A", !r2.output.includes("SHOWING_A"),
    `stale: ${r2.lines.find(l => l.includes("SHOWING_A"))}`);

  const r3 = r.rerender(mk("A"));
  check("swapped back shows A", r3.output.includes("SHOWING_A"));
  check("swapped back no B", !r3.output.includes("SHOWING_B"));

  r.unmount();
}

// ── 4. Text content changing length (longer → shorter) ──────────
console.log("  4. Text shrinks — no stale chars");
{
  const mk = (text: string) => React.createElement(Box,
    { flexDirection: "column", width: W, height: H },
    React.createElement(Text, null, text),
  );

  const r = renderToString(mk("LONG_TEXT_HERE_ABCDEF"), { width: W, height: H });
  check("long text visible", r.output.includes("LONG_TEXT_HERE_ABCDEF"));

  const r2 = r.rerender(mk("SHORT"));
  check("short text visible", r2.output.includes("SHORT"));
  check("no stale ABCDEF", !r2.output.includes("ABCDEF"),
    `stale: ${r2.lines.find(l => l.includes("ABCDEF"))}`);

  r.unmount();
}

// ── 5. Text content changing length (shorter → longer) ──────────
console.log("  5. Text grows");
{
  const mk = (text: string) => React.createElement(Box,
    { flexDirection: "column", width: W, height: H },
    React.createElement(Text, null, text),
  );

  const r = renderToString(mk("HI"), { width: W, height: H });
  const r2 = r.rerender(mk("HELLO_WORLD_EXTENDED"));
  check("grown text visible", r2.output.includes("HELLO_WORLD_EXTENDED"));
  check("no stale HI at wrong pos", !r2.output.includes("HI_WORLD"));
  r.unmount();
}

// ── 6. Rapid conditional toggles ────────────────────────────────
console.log("  6. Rapid conditional toggles");
{
  const mk = (v: boolean) => React.createElement(Box,
    { flexDirection: "column", width: W, height: H },
    v ? React.createElement(Text, { key: "vis" }, "VISIBLE_CONTENT")
      : React.createElement(Text, { key: "hid" }, "HIDDEN_CONTENT"),
  );

  const r = renderToString(mk(true), { width: W, height: H });
  for (let i = 0; i < 10; i++) {
    const v = i % 2 === 0;
    const rn = r.rerender(mk(v));
    const expected = v ? "VISIBLE_CONTENT" : "HIDDEN_CONTENT";
    const unexpected = v ? "HIDDEN_CONTENT" : "VISIBLE_CONTENT";
    check(`toggle ${i}: shows ${expected.slice(0, 7)}`, rn.output.includes(expected));
    check(`toggle ${i}: no ${unexpected.slice(0, 7)}`, !rn.output.includes(unexpected));
  }
  r.unmount();
}

// ── 7. Empty content between renders ────────────────────────────
console.log("  7. Content → empty → content");
{
  const mk = (text?: string) => React.createElement(Box,
    { flexDirection: "column", width: W, height: H },
    text ? React.createElement(Text, null, text) : null,
  );

  const r = renderToString(mk("DATA"), { width: W, height: H });
  check("has DATA", r.output.includes("DATA"));

  const r2 = r.rerender(mk());
  check("empty: no DATA", !r2.output.includes("DATA"));

  const r3 = r.rerender(mk("NEW_DATA"));
  check("restored: has NEW_DATA", r3.output.includes("NEW_DATA"));
  check("restored: no old DATA", !r3.output.includes("DATA "));

  r.unmount();
}

console.log(`\n  Overlap & misc: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
