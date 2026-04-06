/** Catches stale layout positions when React reorders children without changing child count. */
import React from "react";
import { renderToString } from "../../../src/reconciler/render-to-string.js";

let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; }
  else { fail++; console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

const W = 30, H = 10;

console.log(`\n  Element Reorder Tests — ${W}×${H}\n`);

// ── 1. Simple 3-child reorder (ABC → CAB) ──────────────────────
console.log("  1. ABC → CAB reorder");
{
  const mkTree = (order: string[]) => React.createElement("tui-box",
    { flexDirection: "column", width: W, height: H },
    ...order.map(label =>
      React.createElement("tui-text", { key: label }, label)
    )
  );

  const r = renderToString(mkTree(["AAA", "BBB", "CCC"]), { width: W, height: H });
  check("initial: row 0 = AAA", r.lines[0]?.includes("AAA") ?? false, `got: ${r.lines[0]}`);
  check("initial: row 1 = BBB", r.lines[1]?.includes("BBB") ?? false, `got: ${r.lines[1]}`);
  check("initial: row 2 = CCC", r.lines[2]?.includes("CCC") ?? false, `got: ${r.lines[2]}`);

  const r2 = r.rerender(mkTree(["CCC", "AAA", "BBB"]));
  check("reorder: row 0 = CCC", r2.lines[0]?.includes("CCC") ?? false, `got: ${r2.lines[0]}`);
  check("reorder: row 1 = AAA", r2.lines[1]?.includes("AAA") ?? false, `got: ${r2.lines[1]}`);
  check("reorder: row 2 = BBB", r2.lines[2]?.includes("BBB") ?? false, `got: ${r2.lines[2]}`);

  r.unmount();
}

// ── 2. Reverse order (ABC → CBA) ───────────────────────────────
console.log("  2. ABC → CBA reverse");
{
  const mkTree = (order: string[]) => React.createElement("tui-box",
    { flexDirection: "column", width: W, height: H },
    ...order.map(label =>
      React.createElement("tui-text", { key: label }, label)
    )
  );

  const r = renderToString(mkTree(["FIRST", "SECOND", "THIRD"]), { width: W, height: H });
  const r2 = r.rerender(mkTree(["THIRD", "SECOND", "FIRST"]));
  check("reverse: row 0 = THIRD", r2.lines[0]?.includes("THIRD") ?? false, `got: ${r2.lines[0]}`);
  check("reverse: row 1 = SECOND", r2.lines[1]?.includes("SECOND") ?? false, `got: ${r2.lines[1]}`);
  check("reverse: row 2 = FIRST", r2.lines[2]?.includes("FIRST") ?? false, `got: ${r2.lines[2]}`);

  r.unmount();
}

// ── 3. Swap two children ────────────────────────────────────────
console.log("  3. Swap first and last");
{
  const mkTree = (order: string[]) => React.createElement("tui-box",
    { flexDirection: "column", width: W, height: H },
    ...order.map(label =>
      React.createElement("tui-text", { key: label }, label)
    )
  );

  const r = renderToString(mkTree(["TOP", "MID", "BOT"]), { width: W, height: H });
  const r2 = r.rerender(mkTree(["BOT", "MID", "TOP"]));
  check("swap: row 0 = BOT", r2.lines[0]?.includes("BOT") ?? false, `got: ${r2.lines[0]}`);
  check("swap: row 1 = MID", r2.lines[1]?.includes("MID") ?? false, `got: ${r2.lines[1]}`);
  check("swap: row 2 = TOP", r2.lines[2]?.includes("TOP") ?? false, `got: ${r2.lines[2]}`);

  r.unmount();
}

// ── 4. Multiple reorders in sequence ────────────────────────────
console.log("  4. Sequential reorders");
{
  const mkTree = (order: string[]) => React.createElement("tui-box",
    { flexDirection: "column", width: W, height: H },
    ...order.map(label =>
      React.createElement("tui-text", { key: label }, label)
    )
  );

  const r = renderToString(mkTree(["1", "2", "3", "4"]), { width: W, height: H });
  check("init: row 0 = 1", r.lines[0]?.includes("1") ?? false);

  const r2 = r.rerender(mkTree(["4", "3", "2", "1"]));
  check("rev: row 0 = 4", r2.lines[0]?.includes("4") ?? false, `got: ${r2.lines[0]}`);
  check("rev: row 3 = 1", r2.lines[3]?.includes("1") ?? false, `got: ${r2.lines[3]}`);

  const r3 = r.rerender(mkTree(["2", "4", "1", "3"]));
  check("shuffle: row 0 = 2", r3.lines[0]?.includes("2") ?? false, `got: ${r3.lines[0]}`);
  check("shuffle: row 1 = 4", r3.lines[1]?.includes("4") ?? false, `got: ${r3.lines[1]}`);
  check("shuffle: row 2 = 1", r3.lines[2]?.includes("1") ?? false, `got: ${r3.lines[2]}`);
  check("shuffle: row 3 = 3", r3.lines[3]?.includes("3") ?? false, `got: ${r3.lines[3]}`);

  r.unmount();
}

// ── 5. Row layout (horizontal reorder) ──────────────────────────
console.log("  5. Horizontal reorder");
{
  const mkTree = (order: string[]) => React.createElement("tui-box",
    { flexDirection: "row", width: W, height: H },
    ...order.map(label =>
      React.createElement("tui-text", { key: label }, label)
    )
  );

  const r = renderToString(mkTree(["XX", "YY", "ZZ"]), { width: W, height: H });
  check("horiz init has XX first", r.lines[0]?.startsWith("XX") ?? false, `got: ${r.lines[0]}`);

  const r2 = r.rerender(mkTree(["ZZ", "YY", "XX"]));
  check("horiz reorder has ZZ first", r2.lines[0]?.startsWith("ZZ") ?? false, `got: ${r2.lines[0]}`);

  r.unmount();
}

console.log(`\n  Element reorder: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
