/**
 * StyleSheet Loader — file-based stylesheet loading with live reloading.
 *
 * Parses `.storm.css` files (CSS-like syntax for terminal components)
 * and optionally watches for changes to enable hot-reload during development.
 *
 * @example
 * ```ts
 * const { stylesheet, close } = createStyleSheetLoader({
 *   path: "./app.storm.css",
 *   watch: true,
 *   onReload: (sheet) => console.log("Reloaded", sheet.rules.length, "rules"),
 * });
 * ```
 *
 * File format:
 * ```
 * /* Global text style *\/
 * Text {
 *   color: #FFFFFF;
 *   bold: false;
 * }
 *
 * Text.title {
 *   color: #82AAFF;
 *   bold: true;
 * }
 *
 * Button:focus {
 *   inverse: true;
 *   borderColor: #FFB800;
 * }
 *
 * Box.sidebar {
 *   width: 30;
 *   borderStyle: single;
 *   borderColor: #333333;
 * }
 * ```
 */

import fs from "node:fs";
import path from "node:path";

export interface StyleSheetLoaderOptions {
  /** Path to .storm.css or .storm.json stylesheet file. */
  path: string;
  /** Enable file watching for live reload (default: true in dev, false in prod). */
  watch?: boolean;
  /** Callback when stylesheet is reloaded. */
  onReload?: (stylesheet: ParsedStyleSheet) => void;
  /** Callback when a parse or file error occurs. */
  onError?: (error: Error) => void;
}

export interface ParsedStyleSheet {
  rules: StyleRule[];
  /** CSS custom properties defined in :root blocks. */
  variables: Map<string, string>;
}

export interface StyleRule {
  selector: string;
  properties: Record<string, unknown>;
}

/**
 * Auto-parse a property value string into its typed representation.
 *
 * - "true" / "false" -> boolean
 * - Integer or float (e.g. "30", "1.5") -> number
 * - Percentage (e.g. "50%") -> "50%" (string, preserved)
 * - Everything else -> string (e.g. "#82AAFF", "single", "column")
 */
function parseValue(raw: string): unknown {
  const trimmed = raw.trim();

  // Booleans
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  // Percentages — keep as string
  if (trimmed.endsWith("%")) return trimmed;

  // Numbers
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  // String (unquoted or quoted)
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

/**
 * Resolve `var(--name)` and `var(--name, fallback)` references in a value string.
 * Supports nested var() in fallbacks.
 */
function resolveVar(value: string, variables: Map<string, string>): string {
  // Iteratively resolve var() from the inside out
  const VAR_RE = /var\(--([a-zA-Z0-9_-]+)\s*(?:,\s*((?:[^()]*|\((?:[^()]*|\([^()]*\))*\))*))?\)/;
  let result = value;
  let maxIterations = 50; // guard against infinite loops
  while (VAR_RE.test(result) && maxIterations-- > 0) {
    result = result.replace(VAR_RE, (_match, name: string, fallback: string | undefined) => {
      const resolved = variables.get(`--${name}`);
      if (resolved !== undefined) return resolved;
      if (fallback !== undefined) return fallback.trim();
      return "";
    });
  }
  return result;
}

/**
 * Parse raw block declarations from CSS source (shared between rule and :root parsing).
 */
function parseBlockDeclarations(body: string): Array<{ name: string; value: string }> {
  const result: Array<{ name: string; value: string }> = [];
  const declarations = body.split(/[;\n]/);

  for (const decl of declarations) {
    const trimmed = decl.trim();
    if (!trimmed) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const propName = trimmed.slice(0, colonIdx).trim();
    const propValue = trimmed.slice(colonIdx + 1).trim();
    if (!propName) continue;

    const cleanValue = propValue.replace(/;+$/, "").trim();
    if (!cleanValue) continue;

    result.push({ name: propName, value: cleanValue });
  }
  return result;
}

/**
 * Parse a .storm.css file into StyleSheet rules.
 *
 * Supports:
 * - CSS-like block syntax: `selector { property: value; }`
 * - Block comments: `/* ... *\/`
 * - Line comments: `// ...`
 * - Multiple selectors per file
 * - Property value auto-parsing (numbers, booleans, strings, percentages)
 * - CSS custom properties: `:root { --name: value; }` and `var(--name)` / `var(--name, fallback)`
 *
 * @param source - The raw .storm.css file content
 * @returns Parsed stylesheet with rules and variables
 */
export function parseStormCSS(source: string): ParsedStyleSheet {
  // First pass: extract all blocks (selector + raw body)
  interface RawBlock {
    selector: string;
    body: string;
  }
  const blocks: RawBlock[] = [];

  // Strip block comments
  let cleaned = source.replace(/\/\*[\s\S]*?\*\//g, "");
  // Strip line comments (only at start of line or after whitespace/semicolons)
  cleaned = cleaned.replace(/\/\/[^\n]*/g, "");

  // State machine: find selector { ... } blocks
  let i = 0;
  const len = cleaned.length;

  while (i < len) {
    while (i < len && /\s/.test(cleaned[i]!)) i++;
    if (i >= len) break;

    const braceIdx = cleaned.indexOf("{", i);
    if (braceIdx === -1) break; // No more blocks

    const selector = cleaned.slice(i, braceIdx).trim();
    if (!selector) {
      i = braceIdx + 1;
      continue;
    }

    // Find matching closing brace (handles no nesting — storm.css is flat)
    const closeIdx = cleaned.indexOf("}", braceIdx + 1);
    if (closeIdx === -1) break; // Unclosed block — stop parsing

    const body = cleaned.slice(braceIdx + 1, closeIdx);
    i = closeIdx + 1;

    blocks.push({ selector, body });
  }

  // Second pass: extract variables from :root blocks
  const variables = new Map<string, string>();
  for (const block of blocks) {
    if (block.selector === ":root") {
      for (const { name, value } of parseBlockDeclarations(block.body)) {
        if (name.startsWith("--")) {
          variables.set(name, value);
        }
      }
    }
  }

  // Third pass: build rules, resolving var() references
  const rules: StyleRule[] = [];
  for (const block of blocks) {
    // Skip :root blocks — they only define variables
    if (block.selector === ":root") continue;

    const properties: Record<string, unknown> = {};
    for (const { name, value } of parseBlockDeclarations(block.body)) {
      const resolved = value.includes("var(") ? resolveVar(value, variables) : value;
      properties[name] = parseValue(resolved);
    }

    if (Object.keys(properties).length > 0) {
      rules.push({ selector: block.selector, properties });
    }
  }

  return { rules, variables };
}

/**
 * Parse a .storm.json file into StyleSheet rules.
 *
 * Expected format:
 * ```json
 * {
 *   "Text.title": { "color": "#82AAFF", "bold": true },
 *   "Button:focus": { "inverse": true }
 * }
 * ```
 */
function parseStormJSON(source: string): ParsedStyleSheet {
  const data = JSON.parse(source) as Record<string, Record<string, unknown>>;
  const rules: StyleRule[] = [];

  for (const [selector, properties] of Object.entries(data)) {
    if (typeof properties === "object" && properties !== null && !Array.isArray(properties)) {
      rules.push({ selector, properties });
    }
  }

  return { rules, variables: new Map() };
}

/**
 * Detect file format and parse accordingly.
 */
function parseFile(filePath: string, source: string): ParsedStyleSheet {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".json") {
    return parseStormJSON(source);
  }
  // Default: treat as .storm.css
  return parseStormCSS(source);
}

/** Determine whether watch mode should be enabled by default. */
function defaultWatch(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Create a stylesheet loader that reads (and optionally watches) a file.
 *
 * Returns the initial parsed stylesheet and a `close()` function to stop
 * watching. If the file cannot be read on initial load, an error is thrown.
 * During watch mode, file errors are handled gracefully — the previous
 * stylesheet is retained and the error is reported via `onError`.
 *
 * @param options - Loader configuration
 * @returns The initial stylesheet and a cleanup function
 * @throws If the file cannot be read during initial load
 */
export function createStyleSheetLoader(options: StyleSheetLoaderOptions): {
  stylesheet: ParsedStyleSheet;
  close: () => void;
} {
  const resolvedPath = path.resolve(options.path);
  const shouldWatch = options.watch ?? defaultWatch();

  // ── Initial load ─────────────────────────────────────────────────
  let source: string;
  try {
    source = fs.readFileSync(resolvedPath, "utf-8");
  } catch (err) {
    throw new Error(
      `Failed to load stylesheet "${resolvedPath}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let stylesheet: ParsedStyleSheet;
  try {
    stylesheet = parseFile(resolvedPath, source);
  } catch (err) {
    throw new Error(
      `Failed to parse stylesheet "${resolvedPath}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── Watch mode ───────────────────────────────────────────────────
  let watcher: fs.FSWatcher | null = null;

  if (shouldWatch) {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const reload = (): void => {
      let newSource: string;
      try {
        newSource = fs.readFileSync(resolvedPath, "utf-8");
      } catch (err) {
        const error = new Error(
          `Failed to reload stylesheet "${resolvedPath}": ${err instanceof Error ? err.message : String(err)}`,
        );
        if (options.onError) {
          options.onError(error);
        } else {
          process.stderr.write(`\x1b[33m[storm] ${error.message}\x1b[0m\n`);
        }
        return; // Keep the old stylesheet
      }

      let newSheet: ParsedStyleSheet;
      try {
        newSheet = parseFile(resolvedPath, newSource);
      } catch (err) {
        const error = new Error(
          `Failed to parse stylesheet "${resolvedPath}": ${err instanceof Error ? err.message : String(err)}`,
        );
        if (options.onError) {
          options.onError(error);
        } else {
          process.stderr.write(`\x1b[33m[storm] ${error.message}\x1b[0m\n`);
        }
        return; // Keep the old stylesheet
      }

      stylesheet = newSheet;
      options.onReload?.(newSheet);
    };

    try {
      watcher = fs.watch(resolvedPath, (eventType) => {
        if (eventType !== "change") return;
        // Debounce: many editors fire multiple events per save
        if (debounceTimer !== null) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          reload();
        }, 100);
      });

      // Prevent the watcher from keeping the process alive
      watcher.unref();

      watcher.on("error", (err) => {
        const error = new Error(
          `File watcher error for "${resolvedPath}": ${err instanceof Error ? err.message : String(err)}`,
        );
        if (options.onError) {
          options.onError(error);
        } else {
          process.stderr.write(`\x1b[33m[storm] ${error.message}\x1b[0m\n`);
        }
      });
    } catch (err) {
      // fs.watch may fail on certain file systems — degrade gracefully
      const error = new Error(
        `Could not watch stylesheet "${resolvedPath}": ${err instanceof Error ? err.message : String(err)}`,
      );
      if (options.onError) {
        options.onError(error);
      } else {
        process.stderr.write(`\x1b[33m[storm] ${error.message}\x1b[0m\n`);
      }
    }
  }

  return {
    stylesheet,
    close: () => {
      if (watcher) {
        watcher.close();
        watcher = null;
      }
    },
  };
}
