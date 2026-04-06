import type { StormColors } from "./colors.js";
import { contrastRatio } from "../core/accessibility.js";
import { isPlainObject } from "./utils.js";

export interface ThemeValidationResult {
  valid: boolean;
  errors: ThemeValidationError[];
  warnings: ThemeValidationWarning[];
}

export interface ThemeValidationError {
  path: string;
  message: string;
  value?: string;
}

export interface ThemeValidationWarning {
  path: string;
  message: string;
}

/** Matches #RGB or #RRGGBB (case-insensitive). */
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** CSS named colors (lowercase). Not exhaustive — covers the 148 standard names. */
const NAMED_COLORS = new Set([
  "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure",
  "beige", "bisque", "black", "blanchedalmond", "blue",
  "blueviolet", "brown", "burlywood", "cadetblue", "chartreuse",
  "chocolate", "coral", "cornflowerblue", "cornsilk", "crimson",
  "cyan", "darkblue", "darkcyan", "darkgoldenrod", "darkgray",
  "darkgreen", "darkgrey", "darkkhaki", "darkmagenta", "darkolivegreen",
  "darkorange", "darkorchid", "darkred", "darksalmon", "darkseagreen",
  "darkslateblue", "darkslategray", "darkslategrey", "darkturquoise", "darkviolet",
  "deeppink", "deepskyblue", "dimgray", "dimgrey", "dodgerblue",
  "firebrick", "floralwhite", "forestgreen", "fuchsia", "gainsboro",
  "ghostwhite", "gold", "goldenrod", "gray", "green",
  "greenyellow", "grey", "honeydew", "hotpink", "indianred",
  "indigo", "ivory", "khaki", "lavender", "lavenderblush",
  "lawngreen", "lemonchiffon", "lightblue", "lightcoral", "lightcyan",
  "lightgoldenrodyellow", "lightgray", "lightgreen", "lightgrey", "lightpink",
  "lightsalmon", "lightseagreen", "lightskyblue", "lightslategray", "lightslategrey",
  "lightsteelblue", "lightyellow", "lime", "limegreen", "linen",
  "magenta", "maroon", "mediumaquamarine", "mediumblue", "mediumorchid",
  "mediumpurple", "mediumseagreen", "mediumslateblue", "mediumspringgreen", "mediumturquoise",
  "mediumvioletred", "midnightblue", "mintcream", "mistyrose", "moccasin",
  "navajowhite", "navy", "oldlace", "olive", "olivedrab",
  "orange", "orangered", "orchid", "palegoldenrod", "palegreen",
  "paleturquoise", "palevioletred", "papayawhip", "peachpuff", "peru",
  "pink", "plum", "powderblue", "purple", "rebeccapurple",
  "red", "rosybrown", "royalblue", "saddlebrown", "salmon",
  "sandybrown", "seagreen", "seashell", "sienna", "silver",
  "skyblue", "slateblue", "slategray", "slategrey", "snow",
  "springgreen", "steelblue", "tan", "teal", "thistle",
  "tomato", "turquoise", "violet", "wheat", "white",
  "whitesmoke", "yellow", "yellowgreen",
]);

function isValidColor(value: string): boolean {
  return HEX_RE.test(value) || NAMED_COLORS.has(value.toLowerCase());
}

/**
 * Collect every leaf string value from a StormColors object together with
 * its dotted path (e.g. "brand.primary", "success").
 */
function collectColorPaths(obj: Record<string, unknown>, prefix: string = ""): Array<{ path: string; value: unknown }> {
  const entries: Array<{ path: string; value: unknown }> = [];
  for (const [key, val] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(val)) {
      entries.push(...collectColorPaths(val, p));
    } else {
      entries.push({ path: p, value: val });
    }
  }
  return entries;
}

/**
 * Validate a theme for correctness.
 *
 * - Checks every leaf value is a valid hex string (#RGB, #RRGGBB) or a CSS named color.
 * - Reports missing required fields as errors.
 * - Reports unusually low-contrast text colors as warnings.
 *
 * @param theme - A full StormColors object to validate.
 * @returns A result with `valid`, `errors`, and `warnings`.
 */
export function validateTheme(theme: StormColors): ThemeValidationResult {
  const errors: ThemeValidationError[] = [];
  const warnings: ThemeValidationWarning[] = [];

  const entries = collectColorPaths(theme as unknown as Record<string, unknown>);

  // Expected leaf paths derived from the StormColors type.
  const expectedPaths = new Set([
    "brand.primary", "brand.light", "brand.glow",
    "text.primary", "text.secondary", "text.dim", "text.disabled",
    "success", "warning", "error", "info",
    "user.symbol", "assistant.symbol", "system.text",
    "thinking.symbol", "thinking.shimmer",
    "tool.pending", "tool.running", "tool.completed", "tool.failed", "tool.cancelled",
    "approval.border", "approval.header", "approval.approve", "approval.deny", "approval.always",
    "input.border", "input.borderActive", "input.prompt",
    "divider",
    "diff.added", "diff.addedBg", "diff.removed", "diff.removedBg",
    "syntax.keyword", "syntax.string", "syntax.number", "syntax.comment",
    "syntax.type", "syntax.operator", "syntax.function",
  ]);

  const foundPaths = new Set<string>();

  for (const { path, value } of entries) {
    foundPaths.add(path);
    if (typeof value !== "string") {
      errors.push({ path, message: `Expected a color string, got ${typeof value}` });
      continue;
    }
    if (!isValidColor(value)) {
      errors.push({
        path,
        message: `Invalid color value: "${value}". Expected #RGB, #RRGGBB, or a CSS named color.`,
        value,
      });
    }
  }

  for (const expected of expectedPaths) {
    if (!foundPaths.has(expected)) {
      errors.push({ path: expected, message: "Required color field is missing" });
    }
  }

  // Warn about text colors that may have low contrast against a typical dark background.
  const darkBg = "#1A1A2E";
  const textPaths = ["text.primary", "text.secondary"];
  for (const tp of textPaths) {
    const entry = entries.find((e) => e.path === tp);
    if (entry && typeof entry.value === "string" && isValidColor(entry.value)) {
      try {
        const ratio = contrastRatio(entry.value, darkBg);
        if (ratio < 4.5) {
          warnings.push({
            path: tp,
            message: `Low contrast (${ratio.toFixed(2)}:1) against typical dark background ${darkBg}. WCAG AA requires 4.5:1.`,
          });
        }
      } catch {
        // Named colors without hex expansion — skip contrast check.
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check all text-role color pairs in a theme for WCAG contrast compliance.
 *
 * - Pairs below 4.5:1 ratio produce **warnings** (WCAG AA).
 * - Pairs below 3:1 ratio produce **errors** (WCAG minimum for large text).
 *
 * @param theme - A full StormColors object.
 * @param background - The background hex color to check against (defaults to "#1A1A2E").
 * @returns A result with `valid`, `errors`, and `warnings`.
 */
export function validateContrast(
  theme: StormColors,
  background?: string,
): ThemeValidationResult {
  const bg = background ?? theme.surface.base;
  const errors: ThemeValidationError[] = [];
  const warnings: ThemeValidationWarning[] = [];

  // Text-role colors that should be readable against the background.
  const textColorPaths: Array<{ path: string; value: string }> = [
    { path: "text.primary", value: theme.text.primary },
    { path: "text.secondary", value: theme.text.secondary },
    { path: "text.dim", value: theme.text.dim },
    { path: "text.disabled", value: theme.text.disabled },
    { path: "brand.primary", value: theme.brand.primary },
    { path: "brand.light", value: theme.brand.light },
    { path: "success", value: theme.success },
    { path: "warning", value: theme.warning },
    { path: "error", value: theme.error },
    { path: "info", value: theme.info },
    { path: "user.symbol", value: theme.user.symbol },
    { path: "assistant.symbol", value: theme.assistant.symbol },
    { path: "system.text", value: theme.system.text },
    { path: "thinking.symbol", value: theme.thinking.symbol },
    { path: "tool.pending", value: theme.tool.pending },
    { path: "tool.running", value: theme.tool.running },
    { path: "tool.completed", value: theme.tool.completed },
    { path: "tool.failed", value: theme.tool.failed },
    { path: "approval.header", value: theme.approval.header },
    { path: "approval.approve", value: theme.approval.approve },
    { path: "approval.deny", value: theme.approval.deny },
    { path: "input.prompt", value: theme.input.prompt },
    { path: "syntax.keyword", value: theme.syntax.keyword },
    { path: "syntax.string", value: theme.syntax.string },
    { path: "syntax.number", value: theme.syntax.number },
    { path: "syntax.comment", value: theme.syntax.comment },
    { path: "syntax.type", value: theme.syntax.type },
    { path: "syntax.operator", value: theme.syntax.operator },
    { path: "syntax.function", value: theme.syntax.function },
  ];

  for (const { path, value } of textColorPaths) {
    try {
      const ratio = contrastRatio(value, bg);
      if (ratio < 3) {
        errors.push({
          path,
          message: `Contrast ratio ${ratio.toFixed(2)}:1 against ${bg} is below WCAG minimum (3:1).`,
          value,
        });
      } else if (ratio < 4.5) {
        warnings.push({
          path,
          message: `Contrast ratio ${ratio.toFixed(2)}:1 against ${bg} is below WCAG AA (4.5:1).`,
        });
      }
    } catch {
      // If contrastRatio can't parse (e.g., named colors), skip.
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
