import { Attr, DEFAULT_COLOR, isRgbColor, rgbR, rgbG, rgbB } from "./types.js";

export const ESC = "\x1b";
export const CSI = `${ESC}[`;

// By default we emit truecolor (24-bit). Call setColorDepth() from
// Screen.start() to downgrade for terminals that lack support.

export type ColorDepth = "truecolor" | "256" | "16" | "basic";

let colorDepth: ColorDepth = "truecolor";

/** Set the active color depth. Called from Screen.start() based on terminal detection. */
export function setColorDepth(depth: ColorDepth): void {
  colorDepth = depth;
}

export function getColorDepth(): ColorDepth {
  return colorDepth;
}

const ANSI_16_RGB: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],       // 0  black
  [170, 0, 0],     // 1  red
  [0, 170, 0],     // 2  green
  [170, 170, 0],   // 3  yellow
  [0, 0, 170],     // 4  blue
  [170, 0, 170],   // 5  magenta
  [0, 170, 170],   // 6  cyan
  [170, 170, 170], // 7  white
  [85, 85, 85],    // 8  bright black (gray)
  [255, 85, 85],   // 9  bright red
  [85, 255, 85],   // 10 bright green
  [255, 255, 85],  // 11 bright yellow
  [85, 85, 255],   // 12 bright blue
  [255, 85, 255],  // 13 bright magenta
  [85, 255, 255],  // 14 bright cyan
  [255, 255, 255], // 15 bright white
];

/**
 * Convert RGB to the nearest ANSI 256-color index.
 * Uses the standard 6x6x6 color cube (indices 16-231) and
 * the grayscale ramp (indices 232-255), picking whichever is closer.
 */
export function rgbTo256(r: number, g: number, b: number): number {
  // Each axis maps 0-255 to 0-5
  const ri = r < 48 ? 0 : r < 115 ? 1 : Math.min(5, Math.round((r - 35) / 40));
  const gi = g < 48 ? 0 : g < 115 ? 1 : Math.min(5, Math.round((g - 35) / 40));
  const bi = b < 48 ? 0 : b < 115 ? 1 : Math.min(5, Math.round((b - 35) / 40));
  const cubeIndex = 16 + 36 * ri + 6 * gi + bi;

  // Reconstruct the cube color's actual RGB values
  const cubeR = ri === 0 ? 0 : 55 + ri * 40;
  const cubeG = gi === 0 ? 0 : 55 + gi * 40;
  const cubeB = bi === 0 ? 0 : 55 + bi * 40;
  const cubeDist = (r - cubeR) ** 2 + (g - cubeG) ** 2 + (b - cubeB) ** 2;

  const gray = Math.round((r * 0.299 + g * 0.587 + b * 0.114 - 8) / 10);
  const grayIdx = Math.max(0, Math.min(23, gray));
  const grayVal = 8 + grayIdx * 10;
  const grayDist = (r - grayVal) ** 2 + (g - grayVal) ** 2 + (b - grayVal) ** 2;

  return grayDist < cubeDist ? 232 + grayIdx : cubeIndex;
}

/**
 * Convert RGB to the nearest ANSI 16-color index (0-15).
 */
export function rgbTo16(r: number, g: number, b: number): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < 16; i++) {
    const [cr, cg, cb] = ANSI_16_RGB[i]!;
    const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function cursorTo(row: number, col: number): string {
  return `${CSI}${row + 1};${col + 1}H`;
}

export function cursorUp(n: number): string {
  return n > 0 ? `${CSI}${n}A` : "";
}

export function cursorDown(n: number): string {
  return n > 0 ? `${CSI}${n}B` : "";
}

export function cursorForward(n: number): string {
  return n > 0 ? `${CSI}${n}C` : "";
}

export function cursorBack(n: number): string {
  return n > 0 ? `${CSI}${n}D` : "";
}

export const CURSOR_HIDE = `${CSI}?25l`;

// Tells the terminal to buffer writes and display atomically.
// Prevents tearing during scroll. Supported by iTerm2, kitty, etc.

export const SYNC_START = `${CSI}?2026h`;
export const SYNC_END = `${CSI}?2026l`;
export const CURSOR_SHOW = `${CSI}?25h`;
export const CURSOR_SAVE = `${ESC}7`;
export const CURSOR_RESTORE = `${ESC}8`;

export const CLEAR_SCREEN = `${CSI}2J`;
export const CLEAR_LINE = `${CSI}2K`;
export const CLEAR_LINE_RIGHT = `${CSI}0K`;
export const CLEAR_LINE_LEFT = `${CSI}1K`;
export const CLEAR_DOWN = `${CSI}J`;

export const ALT_SCREEN_ENTER = `${CSI}?1049h`;
export const ALT_SCREEN_EXIT = `${CSI}?1049l`;

/** Set scroll region (1-indexed, inclusive) */
export function setScrollRegion(top: number, bottom: number): string {
  return `${CSI}${top + 1};${bottom + 1}r`;
}

/** Reset scroll region to full terminal */
export const RESET_SCROLL_REGION = `${CSI}r`;

export const SCROLL_UP = `${ESC}D`;
export const SCROLL_DOWN = `${ESC}M`;

/** Scroll up n lines within the current scroll region (CSI SU) */
export function scrollUpN(n: number): string {
  return n > 0 ? `${CSI}${n}S` : "";
}

/** Scroll down n lines within the current scroll region (CSI SD) */
export function scrollDownN(n: number): string {
  return n > 0 ? `${CSI}${n}T` : "";
}

/** Enable button event tracking (1002) + SGR extended mode (1006) */
export const MOUSE_ENABLE = `${CSI}?1002h${CSI}?1006h`;
export const MOUSE_DISABLE = `${CSI}?1002l${CSI}?1006l`;

/** Enable any-event tracking (1003) + SGR — reports motion too */
export const MOUSE_ENABLE_ALL = `${CSI}?1003h${CSI}?1006h`;
export const MOUSE_DISABLE_ALL = `${CSI}?1003l${CSI}?1006l`;

export const FOCUS_ENABLE = `${CSI}?1004h`;
export const FOCUS_DISABLE = `${CSI}?1004l`;
export const FOCUS_IN = `${CSI}I`;
export const FOCUS_OUT = `${CSI}O`;

export const BRACKETED_PASTE_ENABLE = `${CSI}?2004h`;
export const BRACKETED_PASTE_DISABLE = `${CSI}?2004l`;
export const PASTE_START = `${CSI}200~`;
export const PASTE_END = `${CSI}201~`;

export const RESET = `${CSI}0m`;

const _SGR_CACHE_MAX = 512;
const _fgCache = new Map<string, string>();
const _bgCache = new Map<string, string>();
const _fullSgrCache = new Map<string, string>();
function _cacheSet(cache: Map<string, string>, key: string, value: string): void {
  cache.set(key, value);
  if (cache.size > _SGR_CACHE_MAX) { const first = cache.keys().next().value; if (first !== undefined) cache.delete(first); }
}

export function fgColor(c: number): string {
  const key = `${colorDepth},${c}`;
  const cached = _fgCache.get(key);
  if (cached !== undefined) return cached;
  const result = _fgColorInner(c);
  _cacheSet(_fgCache, key, result);
  return result;
}

// Shared fg/bg color builder — only the SGR code offsets differ
function _colorInner(c: number, dflt: number, base8: number, bright8: number, idx: string, rgb: string): string {
  if (c === DEFAULT_COLOR) return `${CSI}${dflt}m`;
  if (!isRgbColor(c)) {
    if (colorDepth === "basic") return "";
    if (colorDepth === "16") {
      if (c < 8) return `${CSI}${base8 + c}m`;
      if (c < 16) return `${CSI}${bright8 + c - 8}m`;
      return `${CSI}${base8 + rgbTo16FromPalette256(c)}m`;
    }
    if (c < 8) return `${CSI}${base8 + c}m`;
    if (c < 16) return `${CSI}${bright8 + c - 8}m`;
    return `${CSI}${idx}${c}m`;
  }
  const r = rgbR(c), g = rgbG(c), b = rgbB(c);
  if (colorDepth === "basic") return "";
  if (colorDepth === "16") {
    const i = rgbTo16(r, g, b);
    if (i < 8) return `${CSI}${base8 + i}m`;
    return `${CSI}${bright8 + i - 8}m`;
  }
  if (colorDepth === "256") return `${CSI}${idx}${rgbTo256(r, g, b)}m`;
  return `${CSI}${rgb}${r};${g};${b}m`;
}

function _fgColorInner(c: number): string { return _colorInner(c, 39, 30, 90, "38;5;", "38;2;"); }

export function bgColor(c: number): string {
  const key = `${colorDepth},${c}`;
  const cached = _bgCache.get(key);
  if (cached !== undefined) return cached;
  const result = _bgColorInner(c);
  _cacheSet(_bgCache, key, result);
  return result;
}

function _bgColorInner(c: number): string { return _colorInner(c, 49, 40, 100, "48;5;", "48;2;"); }

/**
 * Approximate a 256-palette index (16-255) to the nearest ANSI 16 color.
 * Returns 0-7 (standard) or 0-7 for bright (caller handles the offset).
 */
function rgbTo16FromPalette256(idx: number): number {
  // For cube colors (16-231): reconstruct RGB, then find nearest 16
  if (idx >= 16 && idx <= 231) {
    const v = idx - 16;
    const bi = v % 6;
    const gi = ((v - bi) / 6) % 6;
    const ri = ((v - bi - 6 * gi) / 36) % 6;
    const r = ri === 0 ? 0 : 55 + ri * 40;
    const g = gi === 0 ? 0 : 55 + gi * 40;
    const b = bi === 0 ? 0 : 55 + bi * 40;
    return rgbTo16(r, g, b);
  }
  // Grayscale ramp (232-255): value = 8 + (idx-232)*10
  if (idx >= 232) {
    const gv = 8 + (idx - 232) * 10;
    return rgbTo16(gv, gv, gv);
  }
  // idx 0-15: already a 16-color index
  return idx;
}

export function sgrAttrs(attrs: number): string {
  let out = "";
  if (attrs & Attr.BOLD) out += `${CSI}1m`;
  if (attrs & Attr.DIM) out += `${CSI}2m`;
  if (attrs & Attr.ITALIC) out += `${CSI}3m`;
  if (attrs & Attr.UNDERLINE) out += `${CSI}4m`;
  if (attrs & Attr.BLINK) out += `${CSI}5m`;
  if (attrs & Attr.INVERSE) out += `${CSI}7m`;
  if (attrs & Attr.HIDDEN) out += `${CSI}8m`;
  if (attrs & Attr.STRIKETHROUGH) out += `${CSI}9m`;
  return out;
}

/**
 * Build a full SGR sequence for a cell's style.
 * Emits RESET first, then sets all attributes — ensures clean state.
 * If ulColor is provided and is a valid RGB color, emits CSI 58;2;R;G;Bm
 * for colored underline (supported by Kitty, WezTerm, Ghostty, foot, Alacritty).
 */
export function fullSgr(fg: number, bg: number, attrs: number, ulColor: number = DEFAULT_COLOR): string {
  const cacheKey = `${colorDepth},${fg},${bg},${attrs},${ulColor}`;
  const cached = _fullSgrCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let out = RESET;
  if (attrs !== 0) out += sgrAttrs(attrs);
  if (fg !== DEFAULT_COLOR) out += fgColor(fg);
  if (bg !== DEFAULT_COLOR) out += bgColor(bg);
  if (ulColor !== DEFAULT_COLOR && isRgbColor(ulColor) && colorDepth !== "basic" && colorDepth !== "16") {
    if (colorDepth === "256") {
      out += `${CSI}58;5;${rgbTo256(rgbR(ulColor), rgbG(ulColor), rgbB(ulColor))}m`;
    } else {
      out += `${CSI}58;2;${rgbR(ulColor)};${rgbG(ulColor)};${rgbB(ulColor)}m`;
    }
  }
  _cacheSet(_fullSgrCache, cacheKey, out);
  return out;
}

/**
 * Build a differential SGR: only emit what changed from prev → next.
 * Returns empty string if nothing changed.
 */
export function diffSgr(
  prevFg: number,
  prevBg: number,
  prevAttrs: number,
  nextFg: number,
  nextBg: number,
  nextAttrs: number,
): string {
  if (prevFg === nextFg && prevBg === nextBg && prevAttrs === nextAttrs) return "";

  // If attributes were removed, we must reset and re-apply everything
  // because ANSI has no "un-bold" that works reliably across terminals
  const removed = prevAttrs & ~nextAttrs;
  if (removed !== 0) {
    return fullSgr(nextFg, nextBg, nextAttrs);
  }

  let out = "";
  const added = nextAttrs & ~prevAttrs;
  if (added !== 0) out += sgrAttrs(added);
  if (nextFg !== prevFg) out += fgColor(nextFg);
  if (nextBg !== prevBg) out += bgColor(nextBg);
  return out;
}
