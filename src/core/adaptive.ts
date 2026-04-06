import { detectTerminal, type TerminalCapabilities } from "./terminal-detect.js";

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

export function bestImageProtocol(
  caps: TerminalCapabilities,
): AdaptiveConfig["imageProtocol"] {
  if (caps.kittyKeyboard || caps.name === "kitty") return "kitty";
  if (caps.name === "iterm2") return "iterm2";
  if (caps.sixel) return "sixel";
  return "block";
}

export function bestKeyboardProtocol(
  caps: TerminalCapabilities,
): AdaptiveConfig["keyboardProtocol"] {
  return caps.kittyKeyboard ? "kitty" : "legacy";
}

export function bestColorDepth(
  caps: TerminalCapabilities,
): AdaptiveConfig["colorDepth"] {
  if (caps.trueColor) return "truecolor";
  if (caps.color256) return "256";
  return "16";
}

export function createAdaptiveConfig(
  overrides?: Partial<AdaptiveConfig>,
): AdaptiveConfig {
  const caps = overrides?.capabilities ?? detectTerminal();

  const defaults: AdaptiveConfig = {
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
  return { ...defaults, ...overrides, capabilities: caps };
}

/** Push kitty keyboard mode 1; returned function pops it. Null if not a TTY. */
export function enableKittyKeyboard(
  stdout: NodeJS.WriteStream,
): (() => void) | null {
  if (!stdout.isTTY) return null;
  stdout.write("\x1b[>1u");
  return () => {
    stdout.write("\x1b[<u");
  };
}

/** Begin sync output frame; returned function ends it. Null if not a TTY. */
export function enableSyncOutput(
  stdout: NodeJS.WriteStream,
): (() => void) | null {
  if (!stdout.isTTY) return null;
  stdout.write("\x1b[?2026h");
  return () => {
    stdout.write("\x1b[?2026l");
  };
}

/** Return unicode char if supported, otherwise ascii fallback. */
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
 * Returns 6-char border set: topLeft topRight bottomLeft bottomRight vertical horizontal.
 * Falls back to ASCII +-| on non-unicode terminals.
 */
export function adaptiveBorder(
  style: "round" | "heavy" | "storm",
  caps: TerminalCapabilities,
): string {
  if (!caps.unicode) return ASCII_BORDER;
  return UNICODE_BORDERS[style] ?? UNICODE_BORDERS["round"]!;
}
