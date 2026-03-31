/**
 * Core types for the TUI cell-based rendering engine.
 *
 * Colors are encoded as numbers:
 *   -1          = default (terminal default)
 *   0–255       = ANSI 256-color palette
 *   ≥ 0x1000000 = True color RGB (0x1_RR_GG_BB)
 */

// ── Color encoding ──────────────────────────────────────────────────

export const DEFAULT_COLOR = -1;

export function rgb(r: number, g: number, b: number): number {
  return 0x1000000 | ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

export function isRgbColor(c: number): boolean {
  return c >= 0x1000000;
}

export function rgbR(c: number): number {
  return (c >> 16) & 0xff;
}
export function rgbG(c: number): number {
  return (c >> 8) & 0xff;
}
export function rgbB(c: number): number {
  return c & 0xff;
}

const NAMED_COLORS: Record<string, number> = {
  // ANSI 16 colors
  black: 0,
  red: 1,
  green: 2,
  yellow: 3,
  blue: 4,
  magenta: 5,
  cyan: 6,
  white: 7,
  blackBright: 8,
  gray: 8,
  grey: 8,
  redBright: 9,
  greenBright: 10,
  yellowBright: 11,
  blueBright: 12,
  magentaBright: 13,
  cyanBright: 14,
  whiteBright: 15,
  // CSS named colors (true-color RGB)
  orange: 0x1000000 | (0xFF << 16) | (0xA5 << 8) | 0x00,
  purple: 0x1000000 | (0x80 << 16) | (0x00 << 8) | 0x80,
  teal: 0x1000000 | (0x00 << 16) | (0x80 << 8) | 0x80,
  pink: 0x1000000 | (0xFF << 16) | (0xC0 << 8) | 0xCB,
  brown: 0x1000000 | (0xA5 << 16) | (0x2A << 8) | 0x2A,
  gold: 0x1000000 | (0xFF << 16) | (0xD7 << 8) | 0x00,
  navy: 0x1000000 | (0x00 << 16) | (0x00 << 8) | 0x80,
  olive: 0x1000000 | (0x80 << 16) | (0x80 << 8) | 0x00,
  coral: 0x1000000 | (0xFF << 16) | (0x7F << 8) | 0x50,
  salmon: 0x1000000 | (0xFA << 16) | (0x80 << 8) | 0x72,
  lime: 0x1000000 | (0x00 << 16) | (0xFF << 8) | 0x00,
  indigo: 0x1000000 | (0x4B << 16) | (0x00 << 8) | 0x82,
  violet: 0x1000000 | (0xEE << 16) | (0x82 << 8) | 0xEE,
  turquoise: 0x1000000 | (0x40 << 16) | (0xE0 << 8) | 0xD0,
  maroon: 0x1000000 | (0x80 << 16) | (0x00 << 8) | 0x00,
  aqua: 0x1000000 | (0x00 << 16) | (0xFF << 8) | 0xFF,
  silver: 0x1000000 | (0xC0 << 16) | (0xC0 << 8) | 0xC0,
};

/** Tracks unknown color names already warned about (dev-mode only). */
const _warnedColors = new Set<string>();

export function parseColor(input: string | number | undefined): number {
  if (input === undefined || input === null) return DEFAULT_COLOR;
  if (typeof input === "number") return input;
  const named = NAMED_COLORS[input];
  if (named !== undefined) return named;
  if (input.startsWith("#")) {
    const hex = input.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0]! + hex[0]!, 16);
      const g = parseInt(hex[1]! + hex[1]!, 16);
      const b = parseInt(hex[2]! + hex[2]!, 16);
      return rgb(r, g, b);
    }
    if (hex.length === 6) {
      return rgb(
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      );
    }
  }
  if (input.startsWith("rgb(")) {
    const m = input.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (m) return rgb(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  // Dev-mode warning for truly unknown color strings
  if (process.env.NODE_ENV !== "production" && input.length > 0) {
    if (!_warnedColors.has(input)) {
      _warnedColors.add(input);
      process.stderr.write(
        `[storm-tui] Warning: Unknown color "${input}". ` +
        "Supported formats: named colors, #RGB, #RRGGBB, rgb(r,g,b), or ANSI 0-255.\n",
      );
    }
  }
  return DEFAULT_COLOR;
}

// ── Attribute bitmask ───────────────────────────────────────────────

export const Attr = {
  NONE: 0,
  BOLD: 1 << 0,
  DIM: 1 << 1,
  ITALIC: 1 << 2,
  UNDERLINE: 1 << 3,
  BLINK: 1 << 4,
  INVERSE: 1 << 5,
  HIDDEN: 1 << 6,
  STRIKETHROUGH: 1 << 7,
} as const;

// ── Cell ────────────────────────────────────────────────────────────

export interface Cell {
  char: string; // single character (or " " for empty)
  fg: number; // foreground color
  bg: number; // background color
  attrs: number; // attribute bitmask
  ulColor: number; // underline color (DEFAULT_COLOR = inherit from fg)
}

export const EMPTY_CELL: Readonly<Cell> = {
  char: " ",
  fg: DEFAULT_COLOR,
  bg: DEFAULT_COLOR,
  attrs: Attr.NONE,
  ulColor: DEFAULT_COLOR,
};

export function cellEquals(a: Readonly<Cell>, b: Readonly<Cell>): boolean {
  return a.char === b.char && a.fg === b.fg && a.bg === b.bg && a.attrs === b.attrs && a.ulColor === b.ulColor;
}

export function makeCell(
  char: string,
  fg: number = DEFAULT_COLOR,
  bg: number = DEFAULT_COLOR,
  attrs: number = Attr.NONE,
  ulColor: number = DEFAULT_COLOR,
): Cell {
  return { char, fg, bg, attrs, ulColor };
}

// ── Style (user-facing) ────────────────────────────────────────────

export interface Style {
  color?: string | number;
  bgColor?: string | number;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  inverse?: boolean;
  hidden?: boolean;
}

export function styleToAttrs(s: Style): number {
  let attrs = Attr.NONE;
  if (s.bold) attrs |= Attr.BOLD;
  if (s.dim) attrs |= Attr.DIM;
  if (s.italic) attrs |= Attr.ITALIC;
  if (s.underline) attrs |= Attr.UNDERLINE;
  if (s.strikethrough) attrs |= Attr.STRIKETHROUGH;
  if (s.inverse) attrs |= Attr.INVERSE;
  if (s.hidden) attrs |= Attr.HIDDEN;
  return attrs;
}

export function styleToCellProps(s: Style): { fg: number; bg: number; attrs: number } {
  return {
    fg: parseColor(s.color),
    bg: parseColor(s.bgColor),
    attrs: styleToAttrs(s),
  };
}

// ── Rect ────────────────────────────────────────────────────────────

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── Border styles ───────────────────────────────────────────────────

export type BorderStyle = "none" | "single" | "double" | "heavy" | "round" | "ascii" | "storm";

export interface BorderChars {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  vertical: string;
}

export const BORDER_CHARS: Record<Exclude<BorderStyle, "none">, BorderChars> = {
  single: {
    topLeft: "┌",
    topRight: "┐",
    bottomLeft: "└",
    bottomRight: "┘",
    horizontal: "─",
    vertical: "│",
  },
  double: {
    topLeft: "╔",
    topRight: "╗",
    bottomLeft: "╚",
    bottomRight: "╝",
    horizontal: "═",
    vertical: "║",
  },
  heavy: {
    topLeft: "┏",
    topRight: "┓",
    bottomLeft: "┗",
    bottomRight: "┛",
    horizontal: "━",
    vertical: "┃",
  },
  round: {
    topLeft: "╭",
    topRight: "╮",
    bottomLeft: "╰",
    bottomRight: "╯",
    horizontal: "─",
    vertical: "│",
  },
  ascii: {
    topLeft: "+",
    topRight: "+",
    bottomLeft: "+",
    bottomRight: "+",
    horizontal: "-",
    vertical: "|",
  },
  storm: {
    topLeft: "╺",
    topRight: "╸",
    bottomLeft: "╺",
    bottomRight: "╸",
    horizontal: "━",
    vertical: "│",
  },
};
