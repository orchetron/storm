export interface TerminalCapabilities {
  /** Terminal name (xterm, iterm2, alacritty, kitty, wezterm, etc.) */
  name: string;
  /** Supports true color (24-bit RGB) */
  trueColor: boolean;
  /** Supports 256 colors */
  color256: boolean;
  /** Supports Unicode/UTF-8 */
  unicode: boolean;
  /** Supports mouse reporting */
  mouse: boolean;
  /** Supports bracketed paste */
  bracketedPaste: boolean;
  /** Supports OSC 52 clipboard */
  clipboard: boolean;
  /** Supports OSC 8 hyperlinks */
  hyperlinks: boolean;
  /** Supports synchronized output */
  syncOutput: boolean;
  /** Supports Kitty keyboard protocol */
  kittyKeyboard: boolean;
  /** Supports sixel graphics */
  sixel: boolean;
  /** Is running inside tmux */
  tmux: boolean;
  /** Is running inside screen */
  screen: boolean;
  /** Terminal width in columns */
  columns: number;
  /** Terminal height in rows */
  rows: number;
}

interface KnownCaps {
  readonly name: string;
  readonly trueColor: boolean;
  readonly mouse: boolean;
  readonly bracketedPaste: boolean;
  readonly clipboard: boolean;
  readonly hyperlinks: boolean;
  readonly syncOutput: boolean;
  readonly kittyKeyboard: boolean;
  readonly sixel: boolean;
}

const KNOWN_TERMINALS: ReadonlyMap<string, KnownCaps> = new Map([
  [
    "iTerm.app",
    {
      name: "iterm2",
      trueColor: true,
      mouse: true,
      bracketedPaste: true,
      clipboard: true,
      hyperlinks: true,
      syncOutput: true,
      kittyKeyboard: false,
      sixel: false,
    },
  ],
  [
    "kitty",
    {
      name: "kitty",
      trueColor: true,
      mouse: true,
      bracketedPaste: true,
      clipboard: true,
      hyperlinks: true,
      syncOutput: false,
      kittyKeyboard: true,
      sixel: false,
    },
  ],
  [
    "Alacritty",
    {
      name: "alacritty",
      trueColor: true,
      mouse: true,
      bracketedPaste: true,
      clipboard: true,
      hyperlinks: true,
      syncOutput: false,
      kittyKeyboard: false,
      sixel: false,
    },
  ],
  [
    "WezTerm",
    {
      name: "wezterm",
      trueColor: true,
      mouse: true,
      bracketedPaste: true,
      clipboard: true,
      hyperlinks: true,
      syncOutput: false,
      kittyKeyboard: false,
      sixel: true,
    },
  ],
  [
    "vscode",
    {
      name: "vscode",
      trueColor: true,
      mouse: true,
      bracketedPaste: true,
      clipboard: false,
      hyperlinks: true,
      syncOutput: false,
      kittyKeyboard: false,
      sixel: false,
    },
  ],
  [
    "Apple_Terminal",
    {
      name: "apple-terminal",
      trueColor: false,
      mouse: true,
      bracketedPaste: true,
      clipboard: false,
      hyperlinks: false,
      syncOutput: false,
      kittyKeyboard: false,
      sixel: false,
    },
  ],
]);

function envOrEmpty(key: string): string {
  return process.env[key] ?? "";
}

function inferNameFromTerm(term: string): string {
  if (term.startsWith("xterm")) return "xterm";
  if (term.startsWith("screen")) return "screen";
  if (term.startsWith("tmux")) return "tmux";
  if (term.startsWith("rxvt")) return "rxvt";
  if (term.startsWith("linux")) return "linux-console";
  return term || "unknown";
}

/**
 * Detect terminal capabilities from environment variables.
 *
 * This is a pure read of `process.env` and `process.stdout` —
 * no escape sequences are written or read.
 */
export function detectTerminal(): TerminalCapabilities {
  const term = envOrEmpty("TERM");
  const termProgram = envOrEmpty("TERM_PROGRAM");
  const colorterm = envOrEmpty("COLORTERM");
  const tmuxEnv = envOrEmpty("TMUX");
  const styEnv = envOrEmpty("STY");
  const lang = envOrEmpty("LANG");

  // Multiplexer detection
  const tmux = tmuxEnv.length > 0;
  const screen = styEnv.length > 0 || term.startsWith("screen");

  // Try known terminal programs first
  const known = KNOWN_TERMINALS.get(termProgram);

  // Color detection
  const trueColor =
    known?.trueColor === true ||
    colorterm === "truecolor" ||
    colorterm === "24bit";
  const color256 = trueColor || term.includes("256color");

  // Unicode detection — check LANG / LC_CTYPE for UTF-8
  const lcCtype = envOrEmpty("LC_CTYPE");
  const lcAll = envOrEmpty("LC_ALL");
  const unicode =
    lang.toUpperCase().includes("UTF-8") ||
    lang.toUpperCase().includes("UTF8") ||
    lcCtype.toUpperCase().includes("UTF-8") ||
    lcCtype.toUpperCase().includes("UTF8") ||
    lcAll.toUpperCase().includes("UTF-8") ||
    lcAll.toUpperCase().includes("UTF8");

  // Name
  const name = known?.name ?? inferNameFromTerm(term);

  // Feature capabilities
  const mouse = known?.mouse ?? term.startsWith("xterm");
  const bracketedPaste = known?.bracketedPaste ?? term.startsWith("xterm");
  const clipboard = known?.clipboard ?? false;
  const hyperlinks = known?.hyperlinks ?? false;
  const syncOutput = known?.syncOutput ?? false;
  const kittyKeyboard = known?.kittyKeyboard ?? false;
  const sixel = known?.sixel ?? false;

  // Dimensions
  const columns = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;

  return {
    name,
    trueColor,
    color256,
    unicode,
    mouse,
    bracketedPaste,
    clipboard,
    hyperlinks,
    syncOutput,
    kittyKeyboard,
    sixel,
    tmux,
    screen,
    columns,
    rows,
  };
}

/**
 * Return a human-readable summary of terminal capabilities.
 *
 * @example
 * ```
 * Terminal: iTerm2 | True Color | 256 Colors | Unicode | Mouse | Clipboard | Hyperlinks | 120x40
 * ```
 */
export function terminalInfo(): string {
  const caps = detectTerminal();
  const parts: string[] = [
    caps.name.charAt(0).toUpperCase() + caps.name.slice(1),
  ];

  if (caps.trueColor) parts.push("True Color");
  if (caps.color256) parts.push("256 Colors");
  if (caps.unicode) parts.push("Unicode");
  if (caps.mouse) parts.push("Mouse");
  if (caps.bracketedPaste) parts.push("Bracketed Paste");
  if (caps.clipboard) parts.push("Clipboard");
  if (caps.hyperlinks) parts.push("Hyperlinks");
  if (caps.syncOutput) parts.push("Sync Output");
  if (caps.kittyKeyboard) parts.push("Kitty Keyboard");
  if (caps.sixel) parts.push("Sixel");
  if (caps.tmux) parts.push("tmux");
  if (caps.screen) parts.push("screen");

  parts.push(`${caps.columns}x${caps.rows}`);

  return `Terminal: ${parts.join(" | ")}`;
}
