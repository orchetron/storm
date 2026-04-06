/** Tests appendChild/insertBefore deduplication during React reorder operations. */
import { createRoot, type TuiRoot, type TuiElement } from "../../../src/reconciler/types.js";
import { hostConfig } from "../../../src/reconciler/host.js";

let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; }
  else { fail++; console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

function makeElement(type: string): TuiElement {
  return {
    type,
    props: {},
    children: [],
    layoutNode: { children: [], props: {} } as any,
    parent: null,
  } as unknown as TuiElement;
}

console.log(`\n  Host Config Reorder Tests\n`);

// ── 1. insertBefore removes child from old position ─────────────
console.log("  1. insertBefore deduplicates");
{
  const parent = makeElement("tui-box");
  const a = makeElement("tui-text");
  const b = makeElement("tui-text");
  const c = makeElement("tui-text");

  // Initial: [A, B, C]
  hostConfig.appendChild(parent, a);
  hostConfig.appendChild(parent, b);
  hostConfig.appendChild(parent, c);
  check("initial has 3 children", parent.children.length === 3,
    `got ${parent.children.length}`);

  // Reorder: insertBefore(parent, C, A) → should be [C, A, B]
  hostConfig.insertBefore(parent, c, a);
  check("after insertBefore(C,A): 3 children", parent.children.length === 3,
    `got ${parent.children.length}`);
  check("order is [C, A, B]",
    parent.children[0] === c && parent.children[1] === a && parent.children[2] === b,
    `got [${parent.children.map(ch => ch === a ? 'A' : ch === b ? 'B' : 'C').join(',')}]`);
}

// ── 2. appendChild removes child from old position ──────────────
console.log("  2. appendChild deduplicates");
{
  const parent = makeElement("tui-box");
  const a = makeElement("tui-text");
  const b = makeElement("tui-text");
  const c = makeElement("tui-text");

  hostConfig.appendChild(parent, a);
  hostConfig.appendChild(parent, b);
  hostConfig.appendChild(parent, c);

  // Move A to end: appendChild(parent, A) → should be [B, C, A]
  hostConfig.appendChild(parent, a);
  check("after appendChild(A): 3 children", parent.children.length === 3,
    `got ${parent.children.length}`);
  check("order is [B, C, A]",
    parent.children[0] === b && parent.children[1] === c && parent.children[2] === a,
    `got [${parent.children.map(ch => ch === a ? 'A' : ch === b ? 'B' : 'C').join(',')}]`);
}

// ── 3. Full reorder simulation: [A,B,C] → [C,A,B] ─────────────
console.log("  3. Full reorder [A,B,C] → [C,A,B]");
{
  const parent = makeElement("tui-box");
  const a = makeElement("tui-text");
  const b = makeElement("tui-text");
  const c = makeElement("tui-text");

  hostConfig.appendChild(parent, a);
  hostConfig.appendChild(parent, b);
  hostConfig.appendChild(parent, c);

  // React reorder sequence: insertBefore(C, A) then insertBefore(A, B)
  hostConfig.insertBefore(parent, c, a);
  hostConfig.insertBefore(parent, a, b);
  check("reorder has 3 children", parent.children.length === 3,
    `got ${parent.children.length}`);
  check("order is [C, A, B]",
    parent.children[0] === c && parent.children[1] === a && parent.children[2] === b,
    `got [${parent.children.map(ch => ch === a ? 'A' : ch === b ? 'B' : 'C').join(',')}]`);
}

// ── 4. Reverse: [A,B,C,D] → [D,C,B,A] ─────────────────────────
console.log("  4. Reverse [A,B,C,D] → [D,C,B,A]");
{
  const parent = makeElement("tui-box");
  const items = [makeElement("tui-text"), makeElement("tui-text"),
                 makeElement("tui-text"), makeElement("tui-text")];

  for (const item of items) hostConfig.appendChild(parent, item);

  // Reverse via insertBefore calls
  hostConfig.insertBefore(parent, items[3]!, items[0]!);
  hostConfig.insertBefore(parent, items[2]!, items[0]!);
  hostConfig.insertBefore(parent, items[1]!, items[0]!);

  check("reverse has 4 children", parent.children.length === 4,
    `got ${parent.children.length}`);
  check("reverse order correct",
    parent.children[0] === items[3] && parent.children[1] === items[2] &&
    parent.children[2] === items[1] && parent.children[3] === items[0]);
}

// ── 5. No-op: insertBefore child already in correct position ────
console.log("  5. No-op insertBefore (already in place)");
{
  const parent = makeElement("tui-box");
  const a = makeElement("tui-text");
  const b = makeElement("tui-text");

  hostConfig.appendChild(parent, a);
  hostConfig.appendChild(parent, b);

  // insertBefore(A, B) when A is already before B
  hostConfig.insertBefore(parent, a, b);
  check("no-op has 2 children", parent.children.length === 2,
    `got ${parent.children.length}`);
  check("order unchanged [A, B]",
    parent.children[0] === a && parent.children[1] === b);
}

// ── 6. Rapid shuffle ────────────────────────────────────────────
console.log("  6. Rapid shuffle (10 rounds)");
{
  const parent = makeElement("tui-box");
  const items = Array.from({ length: 5 }, () => makeElement("tui-text"));
  for (const item of items) hostConfig.appendChild(parent, item);

  for (let round = 0; round < 10; round++) {
    // Random insertBefore
    const from = Math.floor(Math.random() * 5);
    const to = Math.floor(Math.random() * 5);
    if (from !== to) {
      hostConfig.insertBefore(parent, items[from]!, items[to]!);
    }
  }
  check("after 10 shuffles: still 5 children", parent.children.length === 5,
    `got ${parent.children.length}`);

  // Verify no duplicates
  const unique = new Set(parent.children);
  check("no duplicates", unique.size === 5, `${unique.size} unique`);
}

console.log(`\n  Host config reorder: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
