/**
 * useStyleSheet — load and apply a stylesheet file with optional live reloading.
 *
 * Reads a `.storm.css` or `.storm.json` file, converts its rules into a
 * StyleSheet, and injects it into the component tree via StyleContext.
 * When `watch` is enabled, file changes trigger a re-parse and re-render
 * so styles update live without restarting the app.
 *
 * @example
 * ```tsx
 * import { useStyleSheet, Box, Text } from "@orchetron/storm-tui";
 *
 * function App() {
 *   useStyleSheet({ path: "./app.storm.css", watch: true });
 *   return (
 *     <Box className="sidebar">
 *       <Text className="title">Hello</Text>
 *     </Box>
 *   );
 * }
 * ```
 */

import { useRef, useContext } from "react";
import { useTui } from "../context/TuiContext.js";
import { StyleContext } from "../core/style-provider.js";
import { createStyleSheet, type StyleRule } from "../core/stylesheet.js";
import {
  createStyleSheetLoader,
  type StyleSheetLoaderOptions,
  type ParsedStyleSheet,
} from "../core/stylesheet-loader.js";
import { extractThemeOverrides, type DeepPartial } from "../theme/index.js";
import type { StormColors } from "../theme/colors.js";

/**
 * Convert parsed rules (selector + Record<string, unknown>) into the
 * typed StyleRule records that StyleSheet.create() expects.
 */
function toStyleSheetRules(parsed: ParsedStyleSheet): Record<string, StyleRule> {
  const rules: Record<string, StyleRule> = {};
  for (const rule of parsed.rules) {
    rules[rule.selector] = rule.properties as StyleRule;
  }
  return rules;
}

/** Return value of {@link useStyleSheet}. */
export interface UseStyleSheetResult {
  /**
   * Partial StormColors extracted from `--storm-*` CSS custom properties
   * defined in `:root` blocks. Pass this to `extendTheme(baseTheme, themeOverrides)`
   * and feed the merged theme into `<ThemeProvider>` to close the gap between
   * Layer 4 (.storm.css variables) and Layer 1 (ThemeProvider).
   *
   * @example
   * ```tsx
   * function App() {
   *   const { themeOverrides } = useStyleSheet({ path: "./app.storm.css", watch: true });
   *   const mergedTheme = extendTheme(baseTheme, themeOverrides);
   *   return (
   *     <ThemeProvider theme={mergedTheme}>
   *       <MyContent />
   *     </ThemeProvider>
   *   );
   * }
   * ```
   */
  themeOverrides: DeepPartial<StormColors>;
}

/**
 * Load and apply a stylesheet from a file, with optional live reloading.
 *
 * On first call, the file is synchronously read and parsed. The resulting
 * styles are injected into the nearest `StyleContext`. If no provider is
 * present, a warning is logged and the hook is a no-op.
 *
 * When `watch` is enabled (default in non-production), the file is watched
 * for changes. On change, the stylesheet is re-parsed, the context is
 * updated, and a re-render is triggered so components pick up the new styles.
 *
 * The file watcher is cleaned up when the app unmounts.
 *
 * Additionally, any `--storm-*` CSS custom properties found in `:root`
 * blocks are extracted into `themeOverrides` — a partial `StormColors`
 * object that can be merged with `extendTheme()` and passed to
 * `<ThemeProvider>` so that `useColors()` reflects live stylesheet values.
 *
 * @param options - Loader options (path, watch, onReload, onError)
 * @returns An object containing `themeOverrides` extracted from `:root` CSS variables
 */
export function useStyleSheet(options: StyleSheetLoaderOptions): UseStyleSheetResult {
  const { renderContext, requestRender, flushSync } = useTui();
  const existingSheet = useContext(StyleContext);

  // Track initialization per file path so we don't re-create watchers.
  // Also stores the current themeOverrides so they survive re-renders.
  const loaderRef = useRef<{
    path: string;
    close: () => void;
    themeOverrides: DeepPartial<StormColors>;
  } | null>(null);

  // Already initialized for this path — return cached overrides
  if (loaderRef.current && loaderRef.current.path === options.path) {
    return { themeOverrides: loaderRef.current.themeOverrides };
  }

  // Close any previous watcher (path changed)
  if (loaderRef.current) {
    loaderRef.current.close();
    loaderRef.current = null;
  }

  const { stylesheet, close } = createStyleSheetLoader({
    path: options.path,
    ...(options.watch !== undefined ? { watch: options.watch } : {}),
    ...(options.onError !== undefined ? { onError: options.onError } : {}),
    onReload: (newParsed) => {
      // Build a fresh StyleSheet from the reloaded file
      const newSheet = createStyleSheet(toStyleSheetRules(newParsed));

      // Replace the StyleContext value imperatively. The StyleContext.Provider
      // is owned by a parent component (or the framework's render wrapper).
      // We mutate the context's _currentValue directly — same pattern used
      // throughout storm-tui for imperative updates that bypass React state.
      (StyleContext as any)._currentValue = newSheet;
      (StyleContext as any)._currentValue2 = newSheet;

      // Update theme overrides from :root CSS variables
      if (loaderRef.current) {
        loaderRef.current.themeOverrides = extractThemeOverrides(newParsed.variables);
      }

      // Notify caller
      options.onReload?.(newParsed);

      // Trigger a full re-render so components pick up the new styles
      // and the parent can read the updated themeOverrides
      requestRender();
    },
  });

  // Apply the initial stylesheet
  const sheet = createStyleSheet(toStyleSheetRules(stylesheet));

  // Inject into context imperatively
  (StyleContext as any)._currentValue = sheet;
  (StyleContext as any)._currentValue2 = sheet;

  // Extract initial theme overrides from :root CSS variables
  const themeOverrides = extractThemeOverrides(stylesheet.variables);

  loaderRef.current = { path: options.path, close, themeOverrides };

  // Register cleanup so the watcher is stopped on app unmount
  renderContext.cleanups.set(`stylesheet-loader:${options.path}`, close);

  return { themeOverrides };
}
