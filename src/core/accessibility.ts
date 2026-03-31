/**
 * Accessibility — WCAG-compliant contrast checking, screen reader detection,
 * and reduced-motion support for terminal UIs.
 *
 * Accessibility support — contrast checking, reduced motion, screen reader detection.
 */

export interface AccessibilityOptions {
  /** Enable high-contrast mode */
  highContrast: boolean;
  /** Disable all animations (spinners show static, shimmer disabled) */
  reducedMotion: boolean;
  /** Screen reader mode (additional semantic output) */
  screenReader: boolean;
  /** Minimum contrast ratio for text (default 4.5 for WCAG AA) */
  minContrastRatio: number;
}

/**
 * Detect accessibility preferences from environment variables.
 *
 * Checks:
 * - `STORM_HIGH_CONTRAST` / `HIGH_CONTRAST` for high-contrast mode
 * - `STORM_REDUCED_MOTION` / `REDUCE_MOTION` for reduced-motion preference
 * - `STORM_SCREEN_READER` / `ACCESSIBILITY_ENABLED` / known screen reader vars
 */
export function detectAccessibility(): AccessibilityOptions {
  const env = process.env;

  const highContrast =
    env["STORM_HIGH_CONTRAST"] === "1" ||
    env["HIGH_CONTRAST"] === "1";

  const reducedMotion =
    env["STORM_REDUCED_MOTION"] === "1" ||
    env["REDUCE_MOTION"] === "1";

  const screenReader =
    env["STORM_SCREEN_READER"] === "1" ||
    env["ACCESSIBILITY_ENABLED"] === "1" ||
    env["ACCESSIBILITY"] === "1" ||
    env["SCREEN_READER"] === "1" ||
    // macOS VoiceOver
    env["VOICEOVER_RUNNING"] === "1" ||
    // NVDA / JAWS on Windows (via WSL or similar)
    env["NVDA_RUNNING"] === "1" ||
    env["JAWS_RUNNING"] === "1";

  return {
    highContrast,
    reducedMotion,
    screenReader,
    minContrastRatio: 4.5,
  };
}

/**
 * Parse a hex color string (#RGB or #RRGGBB) into [r, g, b] in 0-255 range.
 */
function parseHex(hex: string): [number, number, number] {
  let h = hex.startsWith("#") ? hex.slice(1) : hex;
  if (h.length === 3) {
    h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  }
  const num = parseInt(h, 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

/**
 * Convert an sRGB channel value (0-255) to its linear-light value.
 */
function sRGBtoLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Get the relative luminance of a hex color per WCAG 2.x definition.
 * Returns a value between 0 (black) and 1 (white).
 *
 * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
}

/**
 * Calculate the contrast ratio between two hex colors.
 * Returns a value between 1 (no contrast) and 21 (maximum contrast).
 *
 * @see https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a foreground/background color pair meets a minimum contrast ratio.
 *
 * @param fg - Foreground hex color
 * @param bg - Background hex color
 * @param ratio - Minimum contrast ratio (default 4.5 for WCAG AA normal text)
 * @returns true if the color pair meets the threshold
 */
export function meetsContrast(fg: string, bg: string, ratio = 4.5): boolean {
  return contrastRatio(fg, bg) >= ratio;
}

/**
 * Produce an escape sequence to announce text to screen readers.
 *
 * Uses OSC 99 (kitty notification protocol) for terminals that support it,
 * falling back to a simple BEL character for assertive announcements.
 *
 * @param text - The text to announce
 * @param priority - "polite" (default) or "assertive"
 * @returns An escape sequence string that can be written to stdout
 */
export function announce(text: string, priority: "polite" | "assertive" = "polite"): string {
  // Sanitize text: strip all control characters to prevent escape sequence injection
  const safe = text.replace(/[\x00-\x1f\x7f]/g, "");

  // OSC 99 — kitty notification protocol: \x1b]99;i=1:d=0;text\x1b\\
  const urgency = priority === "assertive" ? "2" : "0";
  const osc = `\x1b]99;i=1:d=0:o=u:u=${urgency};${safe}\x1b\\`;

  if (priority === "assertive") {
    // Also include BEL for terminals that don't support OSC 99
    return osc + "\x07";
  }

  return osc;
}
