/**
 * Unicode character width detection with full grapheme cluster support.
 *
 * Returns the display width of a character in terminal cells:
 * - Most characters: 1
 * - CJK ideographs, fullwidth forms: 2
 * - Combining marks, zero-width: 0
 * - Control characters: 0
 * - ZWJ emoji sequences (e.g. 👨‍👩‍👧‍👦): 2 (single glyph in terminal)
 * - Skin tone modifiers, variation selectors, flag emoji: handled via grapheme clusters
 *
 * Uses Intl.Segmenter (Node 16+) for correct grapheme cluster boundaries,
 * solving the industry-wide problem of ZWJ emoji width miscalculation.
 *
 * Uses a pre-computed lookup table for BMP characters (U+0000-U+FFFF)
 * for O(1) width lookups. Supplementary planes use range checks (rare).
 */

// Pre-compute width for BMP characters (65,536 entries)
const BMP_WIDTH = new Uint8Array(0x10000);

function initBmpWidthTable(): void {
  // Default: width 1
  BMP_WIDTH.fill(1);

  // Control characters: width 0
  for (let i = 0; i < 32; i++) BMP_WIDTH[i] = 0;
  BMP_WIDTH[127] = 0;

  // Combining marks: width 0
  // Combining Diacritical Marks
  for (let i = 0x0300; i <= 0x036f; i++) BMP_WIDTH[i] = 0;
  // Combining Diacritical Marks Extended
  for (let i = 0x1ab0; i <= 0x1aff; i++) BMP_WIDTH[i] = 0;
  // Combining Diacritical Marks Supplement
  for (let i = 0x1dc0; i <= 0x1dff; i++) BMP_WIDTH[i] = 0;
  // Combining Diacritical Marks for Symbols
  for (let i = 0x20d0; i <= 0x20ff; i++) BMP_WIDTH[i] = 0;
  // Variation Selectors
  for (let i = 0xfe00; i <= 0xfe0f; i++) BMP_WIDTH[i] = 0;
  // Combining Half Marks
  for (let i = 0xfe20; i <= 0xfe2f; i++) BMP_WIDTH[i] = 0;
  // Zero Width Space
  BMP_WIDTH[0x200b] = 0;
  // Zero Width Non-Joiner
  BMP_WIDTH[0x200c] = 0;
  // Zero Width Joiner
  BMP_WIDTH[0x200d] = 0;
  // Zero Width No-Break Space
  BMP_WIDTH[0xfeff] = 0;

  // CJK and fullwidth characters: width 2
  // Hangul Jamo
  for (let i = 0x1100; i <= 0x115f; i++) BMP_WIDTH[i] = 2;
  // CJK Radicals, Kangxi, Ideographic
  for (let i = 0x2e80; i <= 0x303e; i++) BMP_WIDTH[i] = 2;
  // Hiragana, Katakana, Bopomofo, CJK Compat
  for (let i = 0x3040; i <= 0x33bf; i++) BMP_WIDTH[i] = 2;
  // CJK Unified Ideographs Extension A
  for (let i = 0x3400; i <= 0x4dbf; i++) BMP_WIDTH[i] = 2;
  // CJK Unified Ideographs + Yi
  for (let i = 0x4e00; i <= 0xa4cf; i++) BMP_WIDTH[i] = 2;
  // Hangul Jamo Extended-A
  for (let i = 0xa960; i <= 0xa97f; i++) BMP_WIDTH[i] = 2;
  // Hangul Syllables
  for (let i = 0xac00; i <= 0xd7af; i++) BMP_WIDTH[i] = 2;
  // CJK Compatibility Ideographs
  for (let i = 0xf900; i <= 0xfaff; i++) BMP_WIDTH[i] = 2;
  // Vertical Forms
  for (let i = 0xfe10; i <= 0xfe19; i++) BMP_WIDTH[i] = 2;
  // CJK Compatibility Forms
  for (let i = 0xfe30; i <= 0xfe6f; i++) BMP_WIDTH[i] = 2;
  // Fullwidth Forms
  for (let i = 0xff01; i <= 0xff60; i++) BMP_WIDTH[i] = 2;
  // Fullwidth Signs
  for (let i = 0xffe0; i <= 0xffe6; i++) BMP_WIDTH[i] = 2;
}

initBmpWidthTable();

export function charWidth(code: number): number {
  if (code < 0x10000) return BMP_WIDTH[code]!; // O(1) lookup

  // Supplementary planes: range checks for rare chars
  // Emoji Skin Tone Modifiers (Fitzpatrick) — zero width
  if (code >= 0x1f3fb && code <= 0x1f3ff) return 0;

  // Note: Regional Indicator symbols (U+1F1E6-U+1F1FF) are used in pairs to
  // form flag emoji. Each individual symbol is width 2 (handled by the emoji
  // range below). When paired, the terminal renders them as a single 2-column
  // flag glyph.

  // Wide supplementary characters
  if (
    (code >= 0x1f300 && code <= 0x1f9ff) || // Miscellaneous Symbols, Emoticons, etc.
    (code >= 0x20000 && code <= 0x2fffd) || // CJK Unified Ideographs Extension B+
    (code >= 0x30000 && code <= 0x3fffd)    // CJK Extension G+
  ) {
    return 2;
  }

  return 1;
}

/** Fast check: returns true if every char code is < 128 (pure ASCII). */
export function isAscii(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) >= 128) return false;
  }
  return true;
}

// ── Grapheme cluster support ───────────────────────────────────────
// Intl.Segmenter (Node 16+, all modern browsers) correctly splits text
// into grapheme clusters per Unicode UAX #29. This handles ZWJ emoji
// sequences, skin tone modifiers, flag emoji, variation selectors, and
// combining marks — all as single visual units.

const segmenter =
  typeof Intl !== "undefined" && Intl.Segmenter
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

const ZWJ = 0x200d;

/** Returns true if the string contains a Zero Width Joiner (U+200D). */
function hasZWJ(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) === ZWJ) return true;
  }
  return false;
}

/**
 * Returns true if the segment is a multi-codepoint emoji sequence that
 * terminals render as a single 2-column glyph. This covers:
 * - ZWJ sequences (👨‍👩‍👧‍👦)
 * - Skin tone modified emoji (👋🏽)
 * - Flag emoji from regional indicator pairs (🇺🇸)
 * - Emoji with variation selectors (☺️)
 */
function isMultiCodepointEmoji(segment: string): boolean {
  if (segment.length <= 2) return false; // single codepoint (possibly surrogate pair)
  if (hasZWJ(segment)) return true;

  const cp = segment.codePointAt(0)!;

  // Regional indicator pairs — flags
  if (cp >= 0x1f1e6 && cp <= 0x1f1ff) return true;

  // Check if second codepoint is a skin tone modifier or variation selector
  const offset = cp > 0xffff ? 2 : 1;
  if (offset < segment.length) {
    const cp2 = segment.codePointAt(offset)!;
    // Skin tone modifiers (Fitzpatrick)
    if (cp2 >= 0x1f3fb && cp2 <= 0x1f3ff) return true;
    // Variation Selector 16 (emoji presentation)
    if (cp2 === 0xfe0f) return true;
  }

  return false;
}

/** Get the display width of a string in terminal cells. */
export function stringWidth(str: string): number {
  if (!str) return 0;

  if (segmenter) {
    let width = 0;
    for (const { segment } of segmenter.segment(str)) {
      if (isMultiCodepointEmoji(segment)) {
        // Multi-codepoint emoji — terminal renders as single 2-column glyph
        width += 2;
      } else {
        // Single codepoint cluster (or simple combining sequence) — use charWidth
        const cp = segment.codePointAt(0);
        if (cp !== undefined) width += charWidth(cp);
      }
    }
    return width;
  }

  // Fallback for environments without Intl.Segmenter: original behavior
  let width = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.codePointAt(i)!;
    width += charWidth(code);
    if (code > 0xffff) i++; // skip surrogate pair low half
  }
  return width;
}

/**
 * A grapheme cluster with its display width and original segment string.
 * Used by buffer/renderer for correct per-grapheme cell placement.
 */
export interface Grapheme {
  /** The full grapheme cluster string (may be multiple codepoints). */
  readonly text: string;
  /** Terminal display width in columns (0, 1, or 2). */
  readonly width: number;
}

/**
 * Iterate over grapheme clusters in a string, yielding each cluster
 * with its display width. This is the primitive that all rendering loops
 * should use instead of manual codepoint iteration.
 *
 * When Intl.Segmenter is available, correctly handles ZWJ sequences,
 * skin tone modifiers, flag emoji, etc. Falls back to codepoint-by-codepoint
 * iteration otherwise.
 */
export function* iterGraphemes(str: string): Generator<Grapheme> {
  if (!str) return;

  if (segmenter) {
    for (const { segment } of segmenter.segment(str)) {
      if (isMultiCodepointEmoji(segment)) {
        yield { text: segment, width: 2 };
      } else {
        const cp = segment.codePointAt(0);
        yield { text: segment, width: cp !== undefined ? charWidth(cp) : 0 };
      }
    }
    return;
  }

  // Fallback: codepoint-by-codepoint
  for (let i = 0; i < str.length; i++) {
    const code = str.codePointAt(i)!;
    const text = String.fromCodePoint(code);
    if (code > 0xffff) i++; // skip surrogate pair low half
    yield { text, width: charWidth(code) };
  }
}
