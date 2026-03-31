/**
 * Adaptive rendering layer.
 *
 * Detects terminal capabilities and selects the best rendering protocol
 * for each category (images, keyboard, color, clipboard, etc.).
 * Components query the resulting {@link AdaptiveConfig} to render optimally
 * without manual per-terminal branching.
 *
 * @module
 */

import { detectTerminal, type TerminalCapabilities } from "./terminal-detect.js";

// ── Types ────────────────────────────────────────────────────────────

/** Resolved rendering strategy for the current terminal. */
export interface AdaptiveConfig {
  /** Detected terminal capabilities */
  capabilities: TerminalCapabilities;

  /** Best available clipboard method */
  clipboard: "osc52" | "none";

  /** Best available image protocol */
  imageProtocol: "kitty" | "iterm2" | "sixel" | "block";

  /** Best available keyboard protocol */
  keyboardProtocol: "kitty" | "legacy";

  /** Whether to use synchronized output */
  syncOutput: boolean;

  /** Whether hyperlinks (OSC 8) are supported */
  hyperlinks: boolean;

  /** Color depth */
  colorDepth: "truecolor" | "256" | "16" | "basic";

  /** Whether unicode is supported */
  unicode: boolean;

  /** Whether mouse reporting is available */
  mouse: boolean;
}

// ── Best-of helpers ──────────────────────────────────────────────────

/** Get the best image protocol for the current terminal. */
export function bestImageProtocol(
  caps: TerminalCapabilities,
): AdaptiveConfig["imageProtocol"] {
  if (caps.kittyKeyboard || caps.name === "kitty") return "kitty";
  if (caps.name === "iterm2") return "iterm2";
  if (caps.sixel) return "sixel";
  return "block";
}

/** Get the best keyboard protocol. */
export function bestKeyboardProtocol(
  caps: TerminalCapabilities,
): AdaptiveConfig["keyboardProtocol"] {
  return caps.kittyKeyboard ? "kitty" : "legacy";
}

/** Get the color depth. */
export function bestColorDepth(
  caps: TerminalCapabilities,
): AdaptiveConfig["colorDepth"] {
  if (caps.trueColor) return "truecolor";
  if (caps.color256) return "256";
  return "16";
}

// ── Factory ──────────────────────────────────────────────────────────

/**
 * Detect and configure the best rendering strategy.
 *
 * Calls {@link detectTerminal} once and derives the optimal option for
 * every rendering category. Individual fields may be overridden via
 * the `overrides` parameter (useful for testing or user preferences).
 */
export function createAdaptiveConfig(
  overrides?: Partial<AdaptiveConfig>,
): AdaptiveConfig {
  const caps = overrides?.capabilities ?? detectTerminal();

  const config: AdaptiveConfig = {
    capabilities: caps,
    clipboard: caps.clipboard ? "osc52" : "none",
    imageProtocol: bestImageProtocol(caps),
    keyboardProtocol: bestKeyboardProtocol(caps),
    syncOutput: caps.syncOutput,
    hyperlinks: caps.hyperlinks,
    colorDepth: bestColorDepth(caps),
    unicode: caps.unicode,
    mouse: caps.mouse,
  };

  // Apply overrides (skip capabilities — already handled above)
  if (overrides) {
    if (overrides.clipboard !== undefined) config.clipboard = overrides.clipboard;
    if (overrides.imageProtocol !== undefined) config.imageProtocol = overrides.imageProtocol;
    if (overrides.keyboardProtocol !== undefined) config.keyboardProtocol = overrides.keyboardProtocol;
    if (overrides.syncOutput !== undefined) config.syncOutput = overrides.syncOutput;
    if (overrides.hyperlinks !== undefined) config.hyperlinks = overrides.hyperlinks;
    if (overrides.colorDepth !== undefined) config.colorDepth = overrides.colorDepth;
    if (overrides.unicode !== undefined) config.unicode = overrides.unicode;
    if (overrides.mouse !== undefined) config.mouse = overrides.mouse;
  }

  return config;
}

// ── Protocol enable/disable ──────────────────────────────────────────

/**
 * Enable Kitty keyboard protocol if available, returns cleanup function.
 *
 * Writes `\x1b[>1u` (push mode 1 — disambiguate escape codes).
 * The returned function writes `\x1b[<u` to pop the mode.
 *
 * Returns `null` when the stream is not a TTY.
 */
export function enableKittyKeyboard(
  stdout: NodeJS.WriteStream,
): (() => void) | null {
  if (!stdout.isTTY) return null;
  stdout.write("\x1b[>1u");
  return () => {
    stdout.write("\x1b[<u");
  };
}

/**
 * Enable synchronized output mode, returns disable function.
 *
 * Writes `\x1b[?2026h` to begin a sync frame. The returned function
 * writes `\x1b[?2026l` to end it.
 *
 * Returns `null` when the stream is not a TTY.
 */
export function enableSyncOutput(
  stdout: NodeJS.WriteStream,
): (() => void) | null {
  if (!stdout.isTTY) return null;
  stdout.write("\x1b[?2026h");
  return () => {
    stdout.write("\x1b[?2026l");
  };
}

// ── Adaptive fallback helpers ────────────────────────────────────────

/**
 * Return the unicode character when the terminal supports it,
 * otherwise return the ascii fallback.
 */
export function adaptiveChar(
  unicode: string,
  ascii: string,
  caps: TerminalCapabilities,
): string {
  return caps.unicode ? unicode : ascii;
}

// Border character sets keyed by style
const UNICODE_BORDERS: Record<string, string> = {
  round: "╭╮╰╯│─",
  heavy: "┏┓┗┛┃━",
  storm: "╔╗╚╝║═",
};

const ASCII_BORDER = "++++-|";

/**
 * Return a border character set for the given style.
 *
 * Unicode-capable terminals get the requested style; non-unicode
 * terminals fall back to ASCII `+-|` characters.
 *
 * The returned string is 6 characters:
 * `topLeft topRight bottomLeft bottomRight vertical horizontal`
 */
export function adaptiveBorder(
  style: "round" | "heavy" | "storm",
  caps: TerminalCapabilities,
): string {
  if (!caps.unicode) return ASCII_BORDER;
  return UNICODE_BORDERS[style] ?? UNICODE_BORDERS["round"]!;
}
