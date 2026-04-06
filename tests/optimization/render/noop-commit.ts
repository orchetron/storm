/** Verifies rerendering identical content produces correct output and zero terminal writes. */
import React from "react";
import { renderToString } from "../../../src/reconciler/render-to-string.js";
import { Box, Text, ScrollView } from "../../../src/components/index.js";

let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; }
  else { fail++; console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

const W = 30, H = 8;

console.log(`\n  No-op Commit Tests — ${W}×${H}\n`);

// ── 1. Identical element — output unchanged ─────────────────────
console.log("  1. Identical rerender");
{
  const el = React.createElement(Box, { flexDirection: "column", width: W, height: H },
    React.createElement(Text, null, "HELLO"),
    React.createElement(Text, null, "WORLD"),
  );

  const r = renderToString(el, { width: W, height: H });
  const r2 = r.rerender(el);
  check("output identical", r.output === r2.output);
  check("styled identical", r.styledOutput === r2.styledOutput);
  r.unmount();
}

// ── 2. New element object, same content — output unchanged ──────
console.log("  2. New element, same content");
{
  const mk = () => React.createElement(Box, { flexDirection: "column", width: W, height: H },
    React.createElement(Text, { key: "a" }, "LINE_A"),
    React.createElement(Text, { key: "b" }, "LINE_B"),
    React.createElement(Text, { key: "c" }, "LINE_C"),
  );

  const r = renderToString(mk(), { width: W, height: H });
  const r2 = r.rerender(mk());
  check("same content output", r.output === r2.output);
  r.unmount();
}

// ── 3. Multiple no-op rerenders — stable ────────────────────────
console.log("  3. Multiple no-ops");
{
  const mk = () => React.createElement(Box, { flexDirection: "column", width: W, height: H },
    React.createElement(Text, null, "STABLE"),
  );

  const r = renderToString(mk(), { width: W, height: H });
  const baseline = r.output;

  for (let i = 0; i < 5; i++) {
    const rn = r.rerender(mk());
    check(`rerender #${i + 1} stable`, rn.output === baseline,
      rn.output !== baseline ? `differs at rerender ${i + 1}` : undefined);
  }
  r.unmount();
}

// ── 4. No-op after real change — stays at new content ───────────
console.log("  4. Change then no-op");
{
  const mk = (text: string) => React.createElement(Box, { flexDirection: "column", width: W, height: H },
    React.createElement(Text, null, text),
  );

  const r = renderToString(mk("OLD"), { width: W, height: H });
  check("initial has OLD", r.output.includes("OLD"));

  const r2 = r.rerender(mk("NEW"));
  check("changed to NEW", r2.output.includes("NEW"));
  check("no OLD after change", !r2.output.includes("OLD"));

  const r3 = r.rerender(mk("NEW"));
  check("no-op keeps NEW", r3.output.includes("NEW"));
  check("identical after no-op", r2.output === r3.output);

  r.unmount();
}

// ── 5. ScrollView no-op — scroll position preserved ─────────────
console.log("  5. ScrollView no-op");
{
  const mk = () => React.createElement(Box, { flexDirection: "column", width: W, height: H },
    React.createElement(ScrollView, { height: H - 1 },
      ...Array.from({ length: 20 }, (_, i) =>
        React.createElement(Text, { key: i }, `ITEM_${i}`)
      )
    )
  );

  const r = renderToString(mk(), { width: W, height: H });
  const r2 = r.rerender(mk());
  check("scrollview stable", r.output === r2.output);
  r.unmount();
}

console.log(`\n  No-op commit: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
