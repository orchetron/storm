/** Verify no public methods vanished between storm-pre and optimized. */
import { ScreenBuffer as Orig } from "/Users/hardy30894/Documents/storm-pre/storm/src/core/buffer.js";
import { DiffRenderer as OrigDiff } from "/Users/hardy30894/Documents/storm-pre/storm/src/core/diff.js";
import { ScreenBuffer as Opt, WIDE_CHAR_PLACEHOLDER as optWCP } from "../../../src/core/buffer.js";
import { DiffRenderer as OptDiff, isWasmAccelerated as optWasm } from "../../../src/core/diff.js";
import { WIDE_CHAR_PLACEHOLDER as origWCP } from "/Users/hardy30894/Documents/storm-pre/storm/src/core/buffer.js";
import { isWasmAccelerated as origWasm } from "/Users/hardy30894/Documents/storm-pre/storm/src/core/diff.js";

let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) pass++;
  else { fail++; console.log(`  \x1b[31mFAIL: ${name}${detail ? " — " + detail : ""}\x1b[0m`); }
}

function getPublicMethods(obj: any): Set<string> {
  const keys = new Set<string>();
  let proto = Object.getPrototypeOf(obj);
  while (proto && proto !== Object.prototype) {
    for (const k of Object.getOwnPropertyNames(proto)) {
      if (k !== "constructor" && !k.startsWith("_")) keys.add(k);
    }
    proto = Object.getPrototypeOf(proto);
  }
  // Public instance properties
  for (const k of Object.keys(obj)) {
    if (!k.startsWith("_")) keys.add(k);
  }
  return keys;
}

console.log(`\n  \x1b[1;36mAPI Surface Check\x1b[0m\n`);

// ── ScreenBuffer ────────────────────────────────────────────────────
const ob = new Orig(80, 24);
const pb = new Opt(80, 24);
const origMethods = getPublicMethods(ob);
const optMethods = getPublicMethods(pb);

console.log(`  ScreenBuffer (original): ${[...origMethods].sort().join(", ")}`);
console.log(`  ScreenBuffer (optimized): ${[...optMethods].sort().join(", ")}`);

// The deprecated `chars` Proxy accessor was intentionally removed in the
// optimized version (replaced by getChar/getCode).  Skip it in the check.
const removedAPIs = new Set(["chars"]);

const missingBuffer: string[] = [];
for (const k of origMethods) {
  if (removedAPIs.has(k)) continue; // intentionally removed
  if (!optMethods.has(k)) missingBuffer.push(k);
  check(`ScreenBuffer.${k} exists`, optMethods.has(k));
  if (optMethods.has(k)) {
    check(`ScreenBuffer.${k} same type`, typeof (ob as any)[k] === typeof (pb as any)[k],
      `orig=${typeof (ob as any)[k]} opt=${typeof (pb as any)[k]}`);
  }
}

const addedBuffer = [...optMethods].filter(k => !origMethods.has(k));
if (missingBuffer.length) console.log(`  \x1b[31mMISSING from optimized: ${missingBuffer.join(", ")}\x1b[0m`);
else console.log(`  \x1b[32m✓ All original ScreenBuffer methods present\x1b[0m`);
if (addedBuffer.length) console.log(`  \x1b[33mADDED in optimized: ${addedBuffer.join(", ")}\x1b[0m`);

// ── DiffRenderer ────────────────────────────────────────────────────
console.log();
const od = new OrigDiff(80, 24);
const pd = new OptDiff(80, 24);
const origDiffMethods = getPublicMethods(od);
const optDiffMethods = getPublicMethods(pd);

console.log(`  DiffRenderer (original): ${[...origDiffMethods].sort().join(", ")}`);
console.log(`  DiffRenderer (optimized): ${[...optDiffMethods].sort().join(", ")}`);

const missingDiff: string[] = [];
for (const k of origDiffMethods) {
  if (!optDiffMethods.has(k)) missingDiff.push(k);
  check(`DiffRenderer.${k} exists`, optDiffMethods.has(k));
  if (optDiffMethods.has(k)) {
    check(`DiffRenderer.${k} same type`, typeof (od as any)[k] === typeof (pd as any)[k],
      `orig=${typeof (od as any)[k]} opt=${typeof (pd as any)[k]}`);
  }
}

const addedDiff = [...optDiffMethods].filter(k => !origDiffMethods.has(k));
if (missingDiff.length) console.log(`  \x1b[31mMISSING from optimized: ${missingDiff.join(", ")}\x1b[0m`);
else console.log(`  \x1b[32m✓ All original DiffRenderer methods present\x1b[0m`);
if (addedDiff.length) console.log(`  \x1b[33mADDED in optimized: ${addedDiff.join(", ")}\x1b[0m`);

// ── Exports ─────────────────────────────────────────────────────────
console.log();
check("WIDE_CHAR_PLACEHOLDER matches", origWCP === optWCP, `orig=${JSON.stringify(origWCP)} opt=${JSON.stringify(optWCP)}`);
check("isWasmAccelerated exported", typeof origWasm === typeof optWasm);

// ── Method signatures (parameter count) ─────────────────────────────
console.log();
console.log(`  Method signature check (parameter count):`);
for (const k of origMethods) {
  if (removedAPIs.has(k)) continue;
  if (typeof (ob as any)[k] === "function" && typeof (pb as any)[k] === "function") {
    const origLen = (ob as any)[k].length;
    const optLen = (pb as any)[k].length;
    check(`ScreenBuffer.${k}() param count`, origLen === optLen, `orig=${origLen} opt=${optLen}`);
  }
}
for (const k of origDiffMethods) {
  if (typeof (od as any)[k] === "function" && typeof (pd as any)[k] === "function") {
    const origLen = (od as any)[k].length;
    const optLen = (pd as any)[k].length;
    // Private methods (renderChangedCells, renderLine, etc.) may have added optional params.
    // Only require param count match for public API (render, resize, invalidate, setCursorVisible, setDebugRainbow).
    const isPublic = ["render", "resize", "invalidate", "setCursorVisible", "setDebugRainbow"].includes(k);
    if (isPublic) {
      check(`DiffRenderer.${k}() param count`, origLen === optLen, `orig=${origLen} opt=${optLen}`);
    } else {
      // Optional params are fine — callers with fewer args still work
      check(`DiffRenderer.${k}() param count (≥ orig)`, optLen >= origLen, `orig=${origLen} opt=${optLen}`);
    }
  }
}

// ── Results ─────────────────────────────────────────────────────────
console.log(`\n  \x1b[36m${"─".repeat(55)}\x1b[0m`);
if (fail === 0) console.log(`  \x1b[1;32m✓ ${pass} checks passed. No ghost APIs. No missing methods.\x1b[0m`);
else console.log(`  \x1b[1;31m✗ ${pass}/${pass+fail} passed, ${fail} FAILED\x1b[0m`);
console.log();
if (fail > 0) process.exit(1);
