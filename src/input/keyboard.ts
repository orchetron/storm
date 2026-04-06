/**
 * Keyboard escape sequence parser.
 *
 * Parses raw stdin bytes into structured KeyEvent objects.
 * Handles CSI, SS3, and single-byte sequences.
 */

import type { KeyEvent, KeyName } from "./types.js";

interface SeqEntry {
  key: KeyName;
  shift?: boolean;
}

// CSI sequences (after \x1b[)
const CSI_MAP = new Map<string, SeqEntry>([
  ["A", { key: "up" }],
  ["B", { key: "down" }],
  ["C", { key: "right" }],
  ["D", { key: "left" }],
  ["H", { key: "home" }],
  ["F", { key: "end" }],
  ["1~", { key: "home" }],
  ["2~", { key: "insert" }],
  ["3~", { key: "delete" }],
  ["4~", { key: "end" }],
  ["5~", { key: "pageup" }],
  ["6~", { key: "pagedown" }],
  ["7~", { key: "home" }],
  ["8~", { key: "end" }],
  // With modifiers (shift)
  ["1;2A", { key: "up", shift: true }],
  ["1;2B", { key: "down", shift: true }],
  ["1;2C", { key: "right", shift: true }],
  ["1;2D", { key: "left", shift: true }],
  ["1;2H", { key: "home", shift: true }],
  ["1;2F", { key: "end", shift: true }],
  ["5;2~", { key: "pageup", shift: true }],
  ["6;2~", { key: "pagedown", shift: true }],
  // With ctrl
  ["1;5A", { key: "up" }],
  ["1;5B", { key: "down" }],
  ["1;5C", { key: "right" }],
  ["1;5D", { key: "left" }],
  // F-keys
  ["11~", { key: "f1" }],
  ["12~", { key: "f2" }],
  ["13~", { key: "f3" }],
  ["14~", { key: "f4" }],
  ["15~", { key: "f5" }],
  ["17~", { key: "f6" }],
  ["18~", { key: "f7" }],
  ["19~", { key: "f8" }],
  ["20~", { key: "f9" }],
  ["21~", { key: "f10" }],
  ["23~", { key: "f11" }],
  ["24~", { key: "f12" }],
  ["Z", { key: "tab", shift: true }], // Shift+Tab
]);

// SS3 sequences (after \x1bO)
const SS3_MAP = new Map<string, SeqEntry>([
  ["A", { key: "up" }],
  ["B", { key: "down" }],
  ["C", { key: "right" }],
  ["D", { key: "left" }],
  ["H", { key: "home" }],
  ["F", { key: "end" }],
  ["P", { key: "f1" }],
  ["Q", { key: "f2" }],
  ["R", { key: "f3" }],
  ["S", { key: "f4" }],
]);

const CTRL_MAP: Record<number, string> = {
  0: "space", // Ctrl+Space = NUL
  1: "a",
  2: "b",
  3: "c",
  4: "d",
  5: "e",
  6: "f",
  7: "g",
  8: "backspace", // Ctrl+H = BS
  9: "tab", // Ctrl+I = TAB
  10: "return", // Ctrl+J = LF
  11: "k",
  12: "l",
  13: "return", // Ctrl+M = CR
  14: "n",
  15: "o",
  16: "p",
  17: "q",
  18: "r",
  19: "s",
  20: "t",
  21: "u",
  22: "v",
  23: "w",
  24: "x",
  25: "y",
  26: "z",
  27: "escape", // ESC
};

/**
 * Parse key events from a raw stdin data chunk.
 * Returns an array of parsed key events.
 * Mouse sequences should be stripped BEFORE calling this.
 */
export function parseKeys(data: string): KeyEvent[] {
  const events: KeyEvent[] = [];
  let i = 0;

  while (i < data.length) {
    const remaining = data.slice(i);

    // ESC sequences
    if (remaining.startsWith("\x1b")) {
      // Just bare ESC
      if (remaining.length === 1) {
        events.push(makeKey("escape", "", remaining, false, false, false));
        i++;
        continue;
      }

      const next = remaining[1]!;

      // CSI: \x1b[
      if (next === "[") {
        const parsed = parseCSI(remaining);
        if (parsed) {
          events.push(parsed.event);
          i += parsed.consumed;
          continue;
        }
      }

      // SS3: \x1bO
      if (next === "O") {
        const parsed = parseSS3(remaining);
        if (parsed) {
          events.push(parsed.event);
          i += parsed.consumed;
          continue;
        }
      }

      // Alt+char: \x1b followed by a regular character
      if (next.charCodeAt(0) >= 32) {
        const char = next;
        events.push(makeKey(char, char, remaining.slice(0, 2), false, false, true));
        i += 2;
        continue;
      }

      // Unknown ESC sequence — emit as escape
      events.push(makeKey("escape", "", "\x1b", false, false, false));
      i++;
      continue;
    }

    // Control characters (0x00–0x1f)
    const code = remaining.charCodeAt(0);
    if (code < 32) {
      const name = CTRL_MAP[code];
      if (code === 13) {
        // CR = plain Enter
        events.push(makeKey("return", "\r", remaining[0]!, false, false, false));
      } else if (code === 10) {
        // LF = Ctrl+Enter (or Ctrl+J) — distinguish from plain Enter
        events.push(makeKey("return", "\n", remaining[0]!, true, false, false));
      } else if (code === 9) {
        events.push(makeKey("tab", "\t", remaining[0]!, false, false, false));
      } else if (code === 8) {
        events.push(makeKey("backspace", "", remaining[0]!, false, false, false));
      } else if (code === 27) {
        events.push(makeKey("escape", "", remaining[0]!, false, false, false));
      } else if (name) {
        events.push(makeKey(name, "", remaining[0]!, true, false, false));
      } else {
        events.push(makeKey(String.fromCharCode(code + 96), "", remaining[0]!, true, false, false));
      }
      i++;
      continue;
    }

    // DEL (0x7f) = Backspace
    if (code === 127) {
      events.push(makeKey("backspace", "", remaining[0]!, false, false, false));
      i++;
      continue;
    }

    // Regular printable character (may be multi-byte UTF-8 / surrogate pair)
    const codePoint = remaining.codePointAt(0)!;
    const char = String.fromCodePoint(codePoint);
    events.push(makeKey(char === " " ? "space" : char, char, char, false, false, false));
    i += codePoint > 0xffff ? 2 : 1;
  }

  return events;
}

function parseCSI(data: string): { event: KeyEvent; consumed: number } | null {
  // CSI = \x1b[, then parameters, then a final byte (0x40–0x7e)
  const csiBody = data.slice(2); // after \x1b[

  // Look for the terminating byte
  for (let j = 0; j < csiBody.length && j < 32; j++) {
    const c = csiBody.charCodeAt(j);
    // Final byte range: @A-Z[\]^_`a-z{|}~ (0x40-0x7E)
    if (c >= 0x40 && c <= 0x7e) {
      const seq = csiBody.slice(0, j + 1);
      const consumed = 2 + j + 1;
      const entry = CSI_MAP.get(seq);

      if (entry) {
        let ctrl = false;
        let shift = entry.shift ?? false;
        let meta = false;

        const modMatch = seq.match(/;(\d+)/);
        if (modMatch) {
          const mod = Number(modMatch[1]) - 1;
          shift = shift || (mod & 1) !== 0;
          meta = (mod & 2) !== 0;
          ctrl = (mod & 4) !== 0;
        }

        return {
          event: makeKey(entry.key, "", data.slice(0, consumed), ctrl, shift, meta),
          consumed,
        };
      }

      // Unknown CSI sequence — skip it
      return { event: makeKey("escape", "", data.slice(0, consumed), false, false, false), consumed };
    }
  }

  return null; // Incomplete sequence
}

function parseSS3(data: string): { event: KeyEvent; consumed: number } | null {
  if (data.length < 3) return null;
  const key = data[2]!;
  const entry = SS3_MAP.get(key);
  if (entry) {
    return {
      event: makeKey(entry.key, "", data.slice(0, 3), false, entry.shift ?? false, false),
      consumed: 3,
    };
  }
  return null;
}

function makeKey(
  key: string,
  char: string,
  raw: string,
  ctrl: boolean,
  shift: boolean,
  meta: boolean,
): KeyEvent {
  return { key, char, raw, ctrl, shift, meta };
}
