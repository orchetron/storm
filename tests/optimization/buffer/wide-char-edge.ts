/** Wide chars at buffer edge: 2-column characters that don't fit should be skipped, not half-written. */
import { ScreenBuffer } from "../../../src/core/buffer.js";
import { DiffRenderer } from "../../../src/core/diff.js";
import { DEFAULT_COLOR, Attr } from "../../../src/core/types.js";

let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; }
  else { fail++; console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

const W = 10, H = 3;

console.log(`\n  Wide Character Edge Cases — ${W}×${H}\n`);

// ── 1. Wide char at last column should not be written ───────────
console.log("  1. CJK at last column (col width-1)");
{
  const buf = new ScreenBuffer(W, H);
  buf.writeString(9, 0, "中"); // width-2 char at col 9 of 10-wide buffer
  const ch = buf.getChar(9, 0);
  const code = buf.getCode(9, 0);
  // Should be space — the wide char doesn't fit
  check("last col is space", code === 0x20,
    `got char=${JSON.stringify(ch)} code=0x${code.toString(16)}`);
}

// ── 2. Wide char at second-to-last column should fit ────────────
console.log("  2. CJK at col width-2 (fits)");
{
  const buf = new ScreenBuffer(W, H);
  buf.writeString(8, 0, "中"); // col 8, placeholder at col 9 — both in bounds
  check("col 8 has CJK", buf.getCode(8, 0) === 0x4e2d); // 中
  check("col 9 has placeholder", buf.getCode(9, 0) === 0); // WIDE_CHAR_CODE = 0
}

// ── 3. String ending with wide char at edge ─────────────────────
console.log("  3. String ending with wide char at edge");
{
  const buf = new ScreenBuffer(W, H);
  buf.writeString(0, 0, "ABCDEFGH中"); // 8 ASCII + 1 CJK = 10 cols, fits exactly
  check("col 8 has CJK", buf.getCode(8, 0) === 0x4e2d);
  check("col 9 has placeholder", buf.getCode(9, 0) === 0);
}

// ── 4. String ending with wide char that overflows ──────────────
console.log("  4. String ending with wide char that overflows");
{
  const buf = new ScreenBuffer(W, H);
  buf.writeString(0, 0, "ABCDEFGHI中"); // 9 ASCII + 1 CJK = 11 cols, overflows
  check("col 8 is I", buf.getChar(8, 0) === "I");
  // Col 9: wide char doesn't fit, should be space
  check("col 9 is space (not half-char)", buf.getCode(9, 0) === 0x20,
    `got code=0x${buf.getCode(9, 0).toString(16)} char=${JSON.stringify(buf.getChar(9, 0))}`);
}

// ── 5. setCellDirect with wide char at edge ─────────────────────
console.log("  5. setCellDirect wide char at last col");
{
  const buf = new ScreenBuffer(W, H);
  // Direct cell write of CJK at col 9
  buf.setCellDirect(9, 0, "中", DEFAULT_COLOR, DEFAULT_COLOR, Attr.NONE, DEFAULT_COLOR);
  // Should be skipped or written without placeholder
  const code = buf.getCode(9, 0);
  // If setCellDirect writes it, at least verify no crash and check what's there
  check("no crash on edge setCellDirect", true);
}

// ── 6. Diff renderer doesn't emit half-width chars ──────────────
console.log("  6. Diff output for wide char at edge");
{
  const buf = new ScreenBuffer(W, H);
  const diff = new DiffRenderer(W, H);
  buf.writeString(7, 0, "AB中"); // A at 7, B at 8, 中 at 9-10 (overflow)
  const r = diff.render(buf);
  // The ANSI output should not contain the CJK char if it doesn't fit
  const stripped = r.output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
  check("diff output has A", stripped.includes("A"));
  check("diff output has B", stripped.includes("B"));
  // If wide char was correctly skipped, it shouldn't be in the output
  // If it IS in the output, the terminal will render 2 columns and overflow
  const hasCJK = stripped.includes("中");
  check("diff output has no half-width CJK", !hasCJK,
    hasCJK ? "CJK char in output will overflow terminal" : "");
}

// ── 7. Multiple wide chars approaching edge ─────────────────────
console.log("  7. Multiple CJK chars approaching edge");
{
  const buf = new ScreenBuffer(W, H);
  buf.writeString(0, 0, "中中中中中"); // 5 CJK = 10 cols, fits exactly
  check("col 0 is first CJK", buf.getCode(0, 0) === 0x4e2d);
  check("col 1 is placeholder", buf.getCode(1, 0) === 0);
  check("col 8 is last CJK", buf.getCode(8, 0) === 0x4e2d);
  check("col 9 is placeholder", buf.getCode(9, 0) === 0);
}

// ── 8. Wide chars with odd buffer width ──────────────────────────
console.log("  8. Odd buffer width (11)");
{
  const buf = new ScreenBuffer(11, 1);
  buf.writeString(0, 0, "中中中中中中"); // 6 CJK = 12 cols, last overflows
  check("col 8 is 5th CJK", buf.getCode(8, 0) === 0x4e2d);
  check("col 9 is placeholder", buf.getCode(9, 0) === 0);
  // Col 10: 6th CJK doesn't fit (needs cols 10-11, but width is 11 so col 11 is OOB)
  check("col 10 is space (6th CJK skipped)", buf.getCode(10, 0) === 0x20,
    `got code=0x${buf.getCode(10, 0).toString(16)}`);
}

console.log(`\n  Wide char edge: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
