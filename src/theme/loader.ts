import * as fs from "fs";
import * as path from "path";
import { colors as defaultColors, type StormColors } from "./colors.js";
import { type DeepPartial } from "./index.js";
import { isPlainObject, deepMerge } from "./utils.js";

/**
 * Load a theme from a JSON file.
 *
 * The file may contain a partial theme — only the specified properties
 * will override the defaults. All other values keep the default palette.
 *
 * @param filePath - Absolute or relative path to a JSON theme file.
 * @returns A complete StormColors object with defaults filled in.
 */
export function loadTheme(filePath: string): StormColors {
  const resolved = path.resolve(filePath);
  const raw = fs.readFileSync(resolved, "utf-8");
  return parseTheme(raw);
}

/**
 * Load a theme from a JSON string.
 *
 * Partial themes are deep-merged with the default color palette.
 *
 * @param json - A JSON string representing a full or partial theme.
 * @returns A complete StormColors object with defaults filled in.
 */
export function parseTheme(json: string): StormColors {
  if (json.length > 1024 * 1024) throw new Error("Theme file exceeds 1MB limit");
  const parsed: unknown = JSON.parse(json);
  if (!isPlainObject(parsed)) {
    throw new Error("Theme JSON must be a plain object");
  }
  return deepMerge(
    defaultColors as unknown as Record<string, unknown>,
    parsed,
  ) as StormColors;
}

/**
 * Save a theme to a JSON file as pretty-printed JSON.
 *
 * @param theme - The StormColors theme to save.
 * @param filePath - Absolute or relative path to write the JSON file.
 */
export function saveTheme(theme: StormColors, filePath: string): void {
  const resolved = path.resolve(filePath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(resolved, serializeTheme(theme) + "\n", "utf-8");
}

/**
 * Export a theme as a formatted JSON string without writing to disk.
 *
 * @param theme - The StormColors theme to serialize.
 * @returns A pretty-printed JSON string.
 */
export function serializeTheme(theme: StormColors): string {
  return JSON.stringify(theme, null, 2);
}
