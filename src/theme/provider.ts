/**
 * ThemeProvider -- runtime theme context for Storm TUI.
 *
 * Wraps the app in a theme context. Components use useTheme()
 * to read the active theme with pre-computed shades.
 * Supports live switching.
 */
import React, { createContext, useContext, useRef } from "react";
import type { StormColors } from "./colors.js";
import { colors as defaultColors } from "./colors.js";
import { generateThemeShades, type ThemeShades } from "./shades.js";
import { TuiContext } from "../context/TuiContext.js";

export interface ThemeWithShades {
  colors: StormColors;
  shades: ThemeShades;
}

function buildThemeWithShades(theme: StormColors): ThemeWithShades {
  return {
    colors: theme,
    shades: generateThemeShades(theme),
  };
}

const defaultValue: ThemeWithShades = buildThemeWithShades(defaultColors);

const ThemeContext = createContext<ThemeWithShades>(defaultValue);

export function ThemeProvider(props: { theme?: StormColors; children: React.ReactNode }): React.ReactElement {
  const theme = props.theme ?? defaultColors;
  const cacheRef = useRef<{ theme: StormColors; value: ThemeWithShades } | null>(null);

  if (!cacheRef.current || cacheRef.current.theme !== theme) {
    cacheRef.current = { theme, value: buildThemeWithShades(theme) };
  }

  // Keep RenderContext.theme in sync so the renderer always has the
  // current theme for fallback colors (e.g. default background).
  // useContext(TuiContext) is safe here — ThemeProvider is always
  // rendered inside TuiProvider.
  const tuiCtx = useContext(TuiContext);
  if (tuiCtx && tuiCtx.renderContext.theme !== theme) {
    tuiCtx.renderContext.theme = theme;
  }

  return React.createElement(ThemeContext.Provider, { value: cacheRef.current.value }, props.children);
}

export function useTheme(): ThemeWithShades {
  return useContext(ThemeContext);
}

export { ThemeContext };
