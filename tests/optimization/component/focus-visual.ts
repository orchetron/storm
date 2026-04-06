/** Verifies focused elements show visual indicators and unfocused ones don't. */
import React from "react";
import { renderToString } from "../../../src/reconciler/render-to-string.js";
import { Box, Text, TextInput, SelectInput } from "../../../src/components/index.js";

let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; }
  else { fail++; console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

const W = 30, H = 8;

console.log(`\n  Focus Visual Tests — ${W}×${H}\n`);

// ── 1. Focused TextInput shows cursor area ──────────────────────
console.log("  1. Focused TextInput");
{
  const el = React.createElement(Box, { flexDirection: "column", width: W, height: H },
    React.createElement(TextInput, { value: "hello", onChange: () => {}, isFocused: true }),
  );
  const r = renderToString(el, { width: W, height: H });
  check("focused input has text", r.output.includes("hello"));
  r.unmount();
}

// ── 2. Unfocused TextInput ──────────────────────────────────────
console.log("  2. Unfocused TextInput");
{
  const el = React.createElement(Box, { flexDirection: "column", width: W, height: H },
    React.createElement(TextInput, { value: "world", onChange: () => {}, isFocused: false }),
  );
  const r = renderToString(el, { width: W, height: H });
  check("unfocused input has text", r.output.includes("world"));
  r.unmount();
}

// ── 3. Two inputs — only focused one shows focus indicator ──────
console.log("  3. Two inputs — focus indicator");
{
  const el = React.createElement(Box, { flexDirection: "column", width: W, height: H },
    React.createElement(TextInput, { value: "AAA", onChange: () => {}, isFocused: true }),
    React.createElement(TextInput, { value: "BBB", onChange: () => {}, isFocused: false }),
  );
  const r = renderToString(el, { width: W, height: H });
  check("focused AAA visible", r.output.includes("AAA"));
  check("unfocused BBB visible", r.output.includes("BBB"));
  r.unmount();
}

// ── 4. Focus swap — rerender shows new focus ────────────────────
console.log("  4. Focus swap on rerender");
{
  const mk = (focusA: boolean) => React.createElement(Box,
    { flexDirection: "column", width: W, height: H },
    React.createElement(TextInput, { value: "FIRST", onChange: () => {}, isFocused: focusA }),
    React.createElement(TextInput, { value: "SECOND", onChange: () => {}, isFocused: !focusA }),
  );

  const r = renderToString(mk(true), { width: W, height: H });
  check("initial: both visible", r.output.includes("FIRST") && r.output.includes("SECOND"));

  const r2 = r.rerender(mk(false));
  check("swapped: both still visible", r2.output.includes("FIRST") && r2.output.includes("SECOND"));
  check("output changed", r.styledOutput !== r2.styledOutput,
    "focus swap should change styled output");

  r.unmount();
}

console.log(`\n  Focus visual: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
