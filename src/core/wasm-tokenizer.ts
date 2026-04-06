import { createRequire } from "node:module";

type TokenKind =
  | "plain"
  | "keyword"
  | "type"
  | "string"
  | "comment"
  | "number"
  | "operator"
  | "preprocessor"
  | "tag";

interface Token {
  kind: TokenKind;
  text: string;
}

/**
 * WASM TokenKind u8 enum → JS string.
 * Must match the Rust `TokenKind` repr(u8) values in wasm/src/lib.rs.
 */
const KIND_MAP: TokenKind[] = [
  "plain",        // 0
  "keyword",      // 1
  "type",         // 2
  "string",       // 3
  "comment",      // 4
  "number",       // 5
  "operator",     // 6
  "preprocessor", // 7
  "tag",          // 8
];

let wasmModule: any = null;
let loadAttempted = false;

function ensureLoaded(): boolean {
  if (loadAttempted) return wasmModule !== null;
  loadAttempted = true;
  try {
    const esmRequire = createRequire(import.meta.url);
    wasmModule = esmRequire("../../wasm/pkg/storm_wasm.js");
  } catch {
    // WASM not available — pure TypeScript fallback
    wasmModule = null;
  }
  return wasmModule !== null;
}

/** Check if WASM tokenizer acceleration is available. */
export function isWasmTokenizerAvailable(): boolean {
  return ensureLoaded();
}

/**
 * Tokenize a single line of source code using the WASM accelerator.
 *
 * @param line     - The source line to tokenize (no trailing newline).
 * @param language - Language identifier ("typescript", "rust", "python", etc.).
 * @returns Token[] on success, or null if WASM is unavailable.
 *
 * The caller should fall back to the TypeScript tokenizer when this
 * returns null:
 *
 * ```ts
 * const tokens = wasmTokenizeLine(line, lang) ?? tsTokenizeLine(line, lang);
 * ```
 */
export function wasmTokenizeLine(
  line: string,
  language: string,
): Token[] | null {
  if (!ensureLoaded()) return null;

  try {
    const result = wasmModule.tokenize_line(line, language);

    // Get tokens as a JS Uint32Array via to_array() — copies from WASM heap to JS heap.
    // Layout: [start, end, kind, start, end, kind, ...]
    const buf: Uint32Array = result.to_array();

    // Free the TokenizerResult immediately (its Vec lives in WASM linear memory).
    if (typeof result.free === "function") {
      result.free();
    }

    if (buf.length === 0) return [];

    const tokens: Token[] = [];
    for (let i = 0; i < buf.length; i += 3) {
      const start = buf[i]!;
      const end = buf[i + 1]!;
      const kindIdx = buf[i + 2]!;
      const kind = KIND_MAP[kindIdx] ?? "plain";
      const text = line.slice(start, end);
      tokens.push({ kind, text });
    }

    return tokens;
  } catch {
    // Any failure in WASM path — fall back to TS tokenizer
    return null;
  }
}
