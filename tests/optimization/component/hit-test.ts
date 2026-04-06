/** Verifies mouse hit-testing and focus cycling. */
import { FocusManager, type FocusableEntry } from "../../../src/core/focus.js";

let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; }
  else { fail++; console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

function mkEntry(id: string, type: "input" | "scroll", tabIndex = 0): FocusableEntry {
  return { id, type, bounds: { x: 0, y: 0, width: 0, height: 0 }, tabIndex };
}

console.log(`\n  Hit Test & Focus Tests\n`);

// ── 1. hitTestScroll finds correct ScrollView ───────────────────
console.log("  1. hitTestScroll basic");
{
  const fm = new FocusManager();
  const sv = mkEntry("sv1", "scroll");
  fm.register(sv);
  fm.updateBounds("sv1", 0, 2, 30, 10);

  const hit = fm.hitTestScroll(15, 5);
  check("hit inside scroll", hit?.id === "sv1", `got: ${hit?.id}`);

  const miss = fm.hitTestScroll(15, 0); // above sv1
  // hitTestScroll falls back to first scroll if no hit
  check("miss above returns fallback", miss?.id === "sv1");
}

// ── 2. Multiple ScrollViews ─────────────────────────────────────
console.log("  2. Multiple ScrollViews");
{
  const fm = new FocusManager();
  fm.register(mkEntry("top", "scroll"));
  fm.register(mkEntry("bottom", "scroll", 1));
  fm.updateBounds("top", 0, 0, 30, 8);
  fm.updateBounds("bottom", 0, 10, 30, 8);

  const hitTop = fm.hitTestScroll(15, 4);
  check("hit top scroll", hitTop?.id === "top", `got: ${hitTop?.id}`);

  const hitBottom = fm.hitTestScroll(15, 14);
  check("hit bottom scroll", hitBottom?.id === "bottom", `got: ${hitBottom?.id}`);
}

// ── 3. Bounds update — hit test uses new position ───────────────
console.log("  3. Bounds update");
{
  const fm = new FocusManager();
  fm.register(mkEntry("sv1", "scroll"));
  fm.updateBounds("sv1", 0, 5, 30, 10);

  check("initial hit at y=8", fm.hitTestScroll(15, 8)?.id === "sv1");

  fm.updateBounds("sv1", 0, 2, 30, 10);
  check("after move: hit at y=4", fm.hitTestScroll(15, 4)?.id === "sv1");
}

// ── 4. Focus cycling ────────────────────────────────────────────
console.log("  4. Focus cycling");
{
  const fm = new FocusManager();
  fm.register(mkEntry("a", "input", 0));
  fm.register(mkEntry("b", "input", 1));
  fm.register(mkEntry("c", "input", 2));

  check("initial focus is a", fm.focused === "a");

  // First cycleNext re-confirms index 0 (a), second moves to b
  fm.cycleNext(); // index -1 → 0 (a)
  fm.cycleNext(); // index 0 → 1 (b)
  check("next → b", fm.focused === "b", `got: ${fm.focused}`);

  fm.cycleNext();
  check("next → c", fm.focused === "c", `got: ${fm.focused}`);

  fm.cycleNext();
  check("wraps → a", fm.focused === "a", `got: ${fm.focused}`);

  fm.cyclePrev();
  check("prev → c", fm.focused === "c", `got: ${fm.focused}`);
}

// ── 5. Focus by ID ──────────────────────────────────────────────
console.log("  5. Focus by ID");
{
  const fm = new FocusManager();
  fm.register(mkEntry("x", "input", 0));
  fm.register(mkEntry("y", "input", 1));
  fm.register(mkEntry("z", "input", 2));

  fm.focus("z");
  check("focused z", fm.focused === "z", `got: ${fm.focused}`);

  fm.focus("x");
  check("focused x", fm.focused === "x", `got: ${fm.focused}`);
}

// ── 6. Unregister focused — moves to next ───────────────────────
console.log("  6. Unregister focused");
{
  const fm = new FocusManager();
  fm.register(mkEntry("a", "input", 0));
  fm.register(mkEntry("b", "input", 1));
  fm.register(mkEntry("c", "input", 2));

  fm.focus("b");
  check("focused b", fm.focused === "b");

  fm.unregister("b");
  check("after unregister: not b", fm.focused !== "b",
    `still: ${fm.focused}`);
}

// ── 7. Disabled entry skipped in cycling ────────────────────────
console.log("  7. Disabled entry skipped");
{
  const fm = new FocusManager();
  fm.register(mkEntry("a", "input", 0));
  const disabled = mkEntry("b", "input", 1);
  disabled.disabled = true;
  fm.register(disabled);
  fm.register(mkEntry("c", "input", 2));

  check("starts at a", fm.focused === "a");
  fm.cycleNext(); // re-confirms a (index -1 → 0)
  fm.cycleNext(); // skips disabled b, goes to c
  check("skips b, goes to c", fm.focused === "c", `got: ${fm.focused}`);
}

console.log(`\n  Hit test & focus: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
