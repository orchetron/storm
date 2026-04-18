/**
 * Mouse event parsing — SGR (1006) and X11 (1002) protocols.
 */

import type { MouseEvent, MouseButton, MouseAction } from "./types.js";

const SGR_REGEX = /^\x1b\[<(\d+);(\d+);(\d+)([mM])/;
const X11_PREFIX = "\x1b[M";

/**
 * Try to parse a mouse event from the beginning of a buffer.
 * Returns the parsed event and how many bytes were consumed,
 * or null if the buffer doesn't start with a mouse sequence.
 */
export function parseMouseEvent(
  buffer: string,
): { event: MouseEvent; consumed: number } | null {
  return parseSGR(buffer) ?? parseX11(buffer);
}

function parseSGR(
  buffer: string,
): { event: MouseEvent; consumed: number } | null {
  const match = SGR_REGEX.exec(buffer);
  if (!match) return null;

  const cb = Number(match[1]);
  const cx = Math.max(0, Math.min(Number(match[2]) - 1, 10000)); // 1-indexed → 0-indexed, clamped
  const cy = Math.max(0, Math.min(Number(match[3]) - 1, 10000));
  const release = match[4] === "m";

  const { button, action: baseAction } = decodeButton(cb);
  const action: MouseAction = release ? "release" : baseAction;

  return {
    event: {
      button,
      action,
      x: cx,
      y: cy,
      shift: (cb & 4) !== 0,
      meta: (cb & 8) !== 0,
      ctrl: (cb & 16) !== 0,
      raw: match[0],
    },
    consumed: match[0].length,
  };
}

function parseX11(
  buffer: string,
): { event: MouseEvent; consumed: number } | null {
  if (!buffer.startsWith(X11_PREFIX)) return null;
  if (buffer.length < X11_PREFIX.length + 3) return null;

  const offset = X11_PREFIX.length;
  const cb = buffer.charCodeAt(offset) - 32;
  const cx = Math.max(0, Math.min(buffer.charCodeAt(offset + 1) - 33, 10000)); // 1-indexed → 0-indexed, clamped
  const cy = Math.max(0, Math.min(buffer.charCodeAt(offset + 2) - 33, 10000));
  const consumed = offset + 3;

  const { button, action } = decodeButton(cb);

  return {
    event: {
      button,
      action,
      x: cx,
      y: cy,
      shift: (cb & 4) !== 0,
      meta: (cb & 8) !== 0,
      ctrl: (cb & 16) !== 0,
      raw: buffer.slice(0, consumed),
    },
    consumed,
  };
}

function decodeButton(cb: number): { button: MouseButton; action: MouseAction } {
  const low2 = cb & 3;
  const isMotion = (cb & 32) !== 0;
  const isScroll = (cb & 64) !== 0;

  if (isScroll) {
    // Scroll wheel
    if (low2 === 0) return { button: "scroll-up", action: "press" };
    if (low2 === 1) return { button: "scroll-down", action: "press" };
    if (low2 === 2) return { button: "scroll-left", action: "press" };
    return { button: "scroll-right", action: "press" };
  }

  if (isMotion) {
    // Motion event
    const motionButton: MouseButton =
      low2 === 0 ? "left" : low2 === 1 ? "middle" : low2 === 2 ? "right" : "none";
    return { button: motionButton, action: "move" };
  }

  // Button press
  if (low2 === 0) return { button: "left", action: "press" };
  if (low2 === 1) return { button: "middle", action: "press" };
  if (low2 === 2) return { button: "right", action: "press" };
  return { button: "none", action: "release" }; // low2 === 3 = release in X11
}

/**
 * Maximum length of an incomplete SGR mouse sequence to keep buffered.
 * A real sequence is `\x1b[<cb;x;yM` with cb/x/y up to 4 digits each,
 * so ~20 bytes is a generous upper bound. Past this we assume the data
 * is malformed and stop treating it as "incomplete".
 */
const SGR_MOUSE_MAX_LENGTH = 32;

/**
 * Check if the buffer starts with an incomplete mouse sequence.
 * Used to hold the buffer and wait for more data.
 */
export function isIncompleteMouseSequence(buffer: string): boolean {
  // SGR prefix: \x1b[< — could be start of SGR mouse event
  if (buffer === "\x1b" || buffer === "\x1b[" || buffer === "\x1b[<") return true;
  if (buffer.startsWith("\x1b[<")) {
    // We have the prefix but no terminating m or M yet. Only a small
    // bounded read-ahead is needed — real sequences are <20 bytes.
    return buffer.length < SGR_MOUSE_MAX_LENGTH && !/[mM]/.test(buffer.slice(3));
  }
  // X11 prefix: \x1b[M — need 3 more bytes
  if (buffer.startsWith(X11_PREFIX)) {
    return buffer.length < X11_PREFIX.length + 3;
  }
  return false;
}

/**
 * Return true when the buffer starts with what looks like an SGR mouse
 * sequence (prefix `\x1b[<`) but cannot possibly be a valid one anymore —
 * i.e., the prefix is followed by `SGR_MOUSE_MAX_LENGTH` bytes without
 * the required terminator. Callers use this to silently drop the bad
 * bytes instead of leaking them to the keyboard parser (where the digits
 * and semicolons would surface on screen).
 */
export function looksLikeMalformedSgrMouse(buffer: string): boolean {
  if (!buffer.startsWith("\x1b[<")) return false;
  // There is already an `m` or `M` somewhere — parseMouseEvent should
  // have handled it. If it didn't, the params are out of range; either
  // way, the sequence is SGR-mouse-shaped.
  const terminator = /[mM]/.exec(buffer);
  if (terminator) return true;
  // No terminator yet but the prefix is longer than any valid sequence.
  return buffer.length >= SGR_MOUSE_MAX_LENGTH;
}

