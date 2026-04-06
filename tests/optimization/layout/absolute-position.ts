/** Verifies position:absolute places elements at correct coordinates relative to parent. */
import React from "react";
import { renderToString } from "../../../src/reconciler/render-to-string.js";
import { Box, Text } from "../../../src/components/index.js";

let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; }
  else { fail++; console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

const W = 30, H = 10;

console.log(`\n  Absolute Position Tests — ${W}×${H}\n`);

// ── 1. top + left ───────────────────────────────────────────────
console.log("  1. top + left");
{
  const el = React.createElement(Box, { width: W, height: H },
    React.createElement(Box, { position: "absolute", top: 3, left: 5 },
      React.createElement(Text, null, "HERE"),
    ),
  );
  const r = renderToString(el, { width: W, height: H });
  check("row 3 has HERE at col 5", (r.lines[3] || "").indexOf("HERE") === 5,
    `got: ${JSON.stringify(r.lines[3])}`);
  check("row 0 empty", (r.lines[0] || "").trim() === "");
  r.unmount();
}

// ── 2. bottom + right (with explicit height) ────────────────────
console.log("  2. bottom + right");
{
  const el = React.createElement(Box, { width: 20, height: 5 },
    React.createElement(Box, { position: "absolute", bottom: 0, right: 0, width: 4, height: 1 },
      React.createElement(Text, null, "END"),
    ),
  );
  const r = renderToString(el, { width: 20, height: 5 });
  const lastLine = r.lines[4] || "";
  check("bottom-right has END", lastLine.includes("END"),
    `got: ${JSON.stringify(lastLine)}`);
  r.unmount();
}

// ── 3. Absolute doesn't affect normal flow ──────────────────────
console.log("  3. Absolute doesn't push normal content");
{
  const el = React.createElement(Box, { flexDirection: "column", width: W, height: H },
    React.createElement(Text, null, "FIRST"),
    React.createElement(Box, { position: "absolute", top: 5, left: 0 },
      React.createElement(Text, null, "ABSOLUTE"),
    ),
    React.createElement(Text, null, "SECOND"),
  );
  const r = renderToString(el, { width: W, height: H });
  check("FIRST at row 0", (r.lines[0] || "").includes("FIRST"));
  check("SECOND at row 1 (not pushed)", (r.lines[1] || "").includes("SECOND"),
    `got: ${JSON.stringify(r.lines[1])}`);
  check("ABSOLUTE at row 5", (r.lines[5] || "").includes("ABSOLUTE"));
  r.unmount();
}

// ── 4. Absolute paints on top of normal content ─────────────────
console.log("  4. Absolute overlaps normal content");
{
  const el = React.createElement(Box, { flexDirection: "column", width: W, height: H },
    React.createElement(Text, null, "BACKGROUND_TEXT"),
    React.createElement(Box, { position: "absolute", top: 0, left: 0 },
      React.createElement(Text, null, "OVER"),
    ),
  );
  const r = renderToString(el, { width: W, height: H });
  // OVER should overwrite first 4 chars of BACKGROUND_TEXT
  const line0 = r.lines[0] || "";
  check("OVER overwrites start", line0.startsWith("OVER"),
    `got: ${JSON.stringify(line0)}`);
  check("rest of bg preserved", line0.includes("GROUND_TEXT") || line0.includes("KGROUND"),
    `got: ${JSON.stringify(line0)}`);
  r.unmount();
}

// ── 5. Multiple absolute children ───────────────────────────────
console.log("  5. Multiple absolute children");
{
  const el = React.createElement(Box, { width: W, height: H },
    React.createElement(Box, { position: "absolute", top: 0, left: 0, height: 1 },
      React.createElement(Text, null, "TL"),
    ),
    React.createElement(Box, { position: "absolute", top: 0, right: 0, width: 3, height: 1 },
      React.createElement(Text, null, "TR"),
    ),
    React.createElement(Box, { position: "absolute", bottom: 0, left: 0, height: 1 },
      React.createElement(Text, null, "BL"),
    ),
  );
  const r = renderToString(el, { width: W, height: H });
  check("top-left has TL", (r.lines[0] || "").startsWith("TL"));
  check("top-right has TR", (r.lines[0] || "").includes("TR"));
  check("bottom-left has BL", (r.lines[H - 1] || "").startsWith("BL"),
    `got: ${JSON.stringify(r.lines[H - 1])}`);
  r.unmount();
}

// ── 6. Absolute after rerender — position updates ───────────────
console.log("  6. Absolute position updates on rerender");
{
  const mk = (top: number) => React.createElement(Box, { width: W, height: H },
    React.createElement(Box, { position: "absolute", top, left: 0 },
      React.createElement(Text, null, "MOVING"),
    ),
  );
  const r = renderToString(mk(1), { width: W, height: H });
  check("initial at row 1", (r.lines[1] || "").includes("MOVING"));

  const r2 = r.rerender(mk(5));
  check("moved to row 5", (r2.lines[5] || "").includes("MOVING"),
    `got: ${JSON.stringify(r2.lines[5])}`);
  check("row 1 now empty", (r2.lines[1] || "").trim() === "",
    `stale: ${JSON.stringify(r2.lines[1])}`);
  r.unmount();
}

console.log(`\n  Absolute position: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
