/** Verifies position:absolute with bottom/right when child has no explicit size. */
import React from "react";
import { renderToString } from "../../../src/reconciler/render-to-string.js";
import { Box, Text } from "../../../src/components/index.js";

let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; }
  else { fail++; console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

const W = 20, H = 5;

console.log(`\n  Absolute Natural Size Tests — ${W}×${H}\n`);

// ── 1. bottom:0 without height — element at bottom ─────────────
console.log("  1. bottom:0 without height");
{
  const el = React.createElement(Box, { width: W, height: H },
    React.createElement(Box, { position: "absolute", bottom: 0, left: 0 },
      React.createElement(Text, null, "BOT"),
    ),
  );
  const r = renderToString(el, { width: W, height: H });
  check("BOT at last row", (r.lines[H - 1] || "").includes("BOT"),
    `got: row ${H - 1}=${JSON.stringify(r.lines[H - 1])}, all=${r.lines.map((l,i)=>i+':'+JSON.stringify(l)).join(' | ')}`);
  check("BOT not at row 0", !(r.lines[0] || "").includes("BOT"),
    `got row 0: ${JSON.stringify(r.lines[0])}`);
  r.unmount();
}

// ── 2. right:0 without width — element at right edge ────────────
console.log("  2. right:0 without width");
{
  const el = React.createElement(Box, { width: W, height: H },
    React.createElement(Box, { position: "absolute", top: 0, right: 0 },
      React.createElement(Text, null, "RT"),
    ),
  );
  const r = renderToString(el, { width: W, height: H });
  const line0 = r.lines[0] || "";
  check("RT at right edge", line0.trimEnd().endsWith("RT"),
    `got: ${JSON.stringify(line0)}`);
  r.unmount();
}

// ── 3. bottom:0 + right:0 — corner position ────────────────────
console.log("  3. bottom-right corner");
{
  const el = React.createElement(Box, { width: W, height: H },
    React.createElement(Box, { position: "absolute", bottom: 0, right: 0 },
      React.createElement(Text, null, "CR"),
    ),
  );
  const r = renderToString(el, { width: W, height: H });
  const lastLine = r.lines[H - 1] || "";
  check("CR at bottom-right", lastLine.trimEnd().endsWith("CR"),
    `got last line: ${JSON.stringify(lastLine)}`);
  check("CR not at top", !(r.lines[0] || "").includes("CR"));
  r.unmount();
}

// ── 4. bottom with offset ───────────────────────────────────────
console.log("  4. bottom:1 (offset from bottom)");
{
  const el = React.createElement(Box, { width: W, height: H },
    React.createElement(Box, { position: "absolute", bottom: 1, left: 0 },
      React.createElement(Text, null, "OFF"),
    ),
  );
  const r = renderToString(el, { width: W, height: H });
  check("OFF at row H-2", (r.lines[H - 2] || "").includes("OFF"),
    `got: row ${H - 2}=${JSON.stringify(r.lines[H - 2])}`);
  r.unmount();
}

// ── 5. Explicit height still works with bottom ──────────────────
console.log("  5. Explicit height + bottom");
{
  const el = React.createElement(Box, { width: W, height: H },
    React.createElement(Box, { position: "absolute", bottom: 0, left: 0, height: 1 },
      React.createElement(Text, null, "EXP"),
    ),
  );
  const r = renderToString(el, { width: W, height: H });
  check("explicit: EXP at bottom", (r.lines[H - 1] || "").includes("EXP"),
    `got: ${JSON.stringify(r.lines[H - 1])}`);
  r.unmount();
}

console.log(`\n  Absolute natural size: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
