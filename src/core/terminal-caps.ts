export type ImageProtocol =
  | "kitty-placeholder"  // Kitty Unicode placeholders (scrollable, pixel-perfect)
  | "kitty"              // Kitty graphics (non-scrollable, pixel-perfect)
  | "iterm2"             // iTerm2 inline (non-scrollable, pixel-perfect)
  | "sextant-3color"     // Sextant + colored underline (3 colors, 2x3)
  | "sextant"            // Sextant (2 colors, 2x3)
  | "quarter-block"      // Quarter blocks (2 colors, 2x2)
  | "half-block"         // Half blocks (2 colors, 1x2)
  | "none";              // No image support

export interface TerminalImageCaps {
  bestProtocol: ImageProtocol;
  supportsKittyGraphics: boolean;
  supportsKittyPlaceholders: boolean;
  supportsITerm2: boolean;
  supportsColoredUnderline: boolean;
  supportsSextant: boolean;  // font support for U+1FB00
}

let cachedCaps: TerminalImageCaps | null = null;

/**
 * Detect the terminal's image rendering capabilities.
 *
 * Reads environment variables to determine which protocols the current
 * terminal supports, then selects the best available one. The result is
 * cached so detection runs at most once per process.
 *
 * Detection is purely static (no escape sequences sent).
 */
export function detectImageCaps(): TerminalImageCaps {
  if (cachedCaps) return cachedCaps;

  const tp = process.env["TERM_PROGRAM"] ?? "";
  const t = process.env["TERM"] ?? "";
  const kittyPid = process.env["KITTY_PID"];
  const ghostty = process.env["GHOSTTY_RESOURCES_DIR"];

  const supportsKittyGraphics = !!(kittyPid || t === "xterm-kitty" || tp === "kitty" || ghostty);
  const supportsKittyPlaceholders = supportsKittyGraphics; // same terminals
  const supportsITerm2 = tp === "iTerm.app" || process.env["LC_TERMINAL"] === "iTerm2" || tp === "WezTerm";
  const supportsColoredUnderline =
    supportsKittyGraphics ||
    tp === "WezTerm" ||
    tp === "Alacritty" ||
    t === "foot" ||
    t === "foot-extra";
  const supportsSextant = true; // assume modern fonts support it; no reliable detection

  let bestProtocol: ImageProtocol;
  if (supportsKittyPlaceholders) bestProtocol = "kitty-placeholder";
  else if (supportsITerm2) bestProtocol = "iterm2";
  else if (supportsColoredUnderline && supportsSextant) bestProtocol = "sextant-3color";
  else if (supportsSextant) bestProtocol = "sextant";
  else bestProtocol = "quarter-block";

  cachedCaps = {
    bestProtocol,
    supportsKittyGraphics,
    supportsKittyPlaceholders,
    supportsITerm2,
    supportsColoredUnderline,
    supportsSextant,
  };

  return cachedCaps;
}

/** Get the best available image protocol for the current terminal. */
export function bestImageProtocolDetailed(): ImageProtocol {
  return detectImageCaps().bestProtocol;
}

/**
 * Reset the cached detection result.
 *
 * Useful in tests that manipulate `process.env` between assertions.
 * Not intended for production use.
 *
 * @internal
 */
export function _resetImageCapsCache(): void {
  cachedCaps = null;
}
