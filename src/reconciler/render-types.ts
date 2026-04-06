import type React from "react";
import type { RenderMetrics } from "../core/render-context.js";
import type { ScreenOptions } from "../core/screen.js";
import type { Screen } from "../core/screen.js";
import type { InputManager } from "../input/manager.js";
import type { ErrorBoundaryOptions } from "../core/error-boundary.js";
import type { PluginManager, StormPlugin } from "../core/plugin.js";
import type { MiddlewarePipeline } from "../core/middleware.js";
import type { TuiRoot, BackgroundProp } from "./types.js";
import type { StormColors } from "../theme/colors.js";

export interface FullRenderMetrics extends RenderMetrics {
  renderTime: number; // ms
  lineCount: number;
}

export { type RenderMetrics };

export interface RenderOptions extends ScreenOptions {
  onRender?: (metrics: FullRenderMetrics) => void;
  /** Maximum frames per second (default 60). */
  maxFps?: number;
  /**
   * Called when a render error occurs. If not provided, errors are
   * written to stderr. Use this for custom error reporting or
   * error boundary integration.
   */
  onError?: (error: Error) => void;
  /**
   * When true, monkey-patch console.log/warn/error to write through
   * the TUI screen so output doesn't corrupt the alternate screen buffer.
   * Originals are restored on unmount.
   */
  patchConsole?: boolean;
  /**
   * When true, changed lines are colorized with a cycling rainbow
   * background color in the diff engine for visual debugging.
   */
  debugRainbow?: boolean;
  /**
   * Error boundary configuration. When provided, render errors are
   * tracked and auto-exit triggers after consecutive failures.
   */
  errorBoundary?: ErrorBoundaryOptions;
  /**
   * When true (default), wraps the root element in a ScrollView so
   * content that overflows the terminal height is scrollable.
   * Set to false if you manage your own scroll container.
   */
  autoScroll?: boolean;
  /** Plugins to register before initial render. */
  plugins?: StormPlugin[];
  /** Color theme to apply. When set, ThemeProvider uses this instead of the dark default. */
  theme?: StormColors;
  /**
   * Set the terminal's default background color via OSC 11.
   * - `string`: use that hex color (e.g. "#0A0A0A")
   * - `true`: use `theme.surface.base` (requires `theme` option)
   * - `false` or `undefined`: don't change terminal background
   */
  terminalBg?: string | boolean;
  /**
   * Full-app background pattern. Painted into the root buffer BEFORE
   * the component tree, so content overwrites background cells naturally.
   * Accepts a preset name ("dots", "grid", "crosshatch") or a full
   * BackgroundPattern object for watermark/custom patterns.
   */
  background?: BackgroundProp;
}

export interface TuiApp {
  unmount: () => void;
  rerender: (element: React.ReactElement) => void;
  screen: Screen;
  input: InputManager;
  waitUntilExit: () => Promise<void>;
  /** Clear the diff cache and force a full redraw. */
  clear: () => void;
  /** Invalidate the layout cache and force a full repaint. */
  recalculateLayout: () => void;
  /** Plugin manager — register plugins to hook into lifecycle, input, and rendering. */
  pluginManager: PluginManager;
  /** Middleware pipeline — intercept and transform the rendering pipeline. */
  middleware: MiddlewarePipeline;
  /** The root element tree — useful for DevTools inspection. */
  root: TuiRoot;
  /** Trigger a fast repaint (no React reconciliation, just layout+paint+diff). */
  requestRepaint: () => void;
  /** Change the terminal's default background color (OSC 11). Pass null to reset. */
  setTerminalBg: (hex: string | null) => void;
}
