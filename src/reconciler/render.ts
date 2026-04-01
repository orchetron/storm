/**
 * render() — the public entry point for the TUI framework.
 *
 * The key insight: React 19's custom reconciler never flushes
 * setState from external contexts (stdin, timers). The fix:
 * `forceReactFlush()` recreates the root element and calls
 * `updateContainerSync` + `flushSyncWork` to synchronously process
 * all pending state updates before returning. This ensures the
 * paint always runs against the up-to-date fiber tree.
 */

import React from "react";
import Reconciler from "react-reconciler";
import { hostConfig, setCustomElementLifecycleHooks } from "./host.js";
import { createRoot, type TuiRoot } from "./types.js";
import { paint, repaint } from "./renderer.js";
import { Screen, type ScreenOptions } from "../core/screen.js";
import { ScreenBuffer } from "../core/buffer.js";
import { InputManager } from "../input/manager.js";
import { RenderContext } from "../core/render-context.js";
import { TuiProvider, type TuiContextValue } from "../context/TuiContext.js";
import { ThemeProvider } from "../theme/provider.js";
import type { StormColors } from "../theme/colors.js";
import { RenderErrorBoundary, type ErrorBoundaryOptions } from "../core/error-boundary.js";
import { PluginManager, type StormPlugin } from "../core/plugin.js";
import { MiddlewarePipeline } from "../core/middleware.js";
import { ScrollView } from "../components/ScrollView.js";

const TuiReconciler = Reconciler(hostConfig);

// ── useEffect cleanup detection ──────────────────────────────────────
// Storm's custom reconciler doesn't reliably fire useEffect cleanup
// functions. This is the #1 footgun for new users. We monkey-patch
// React.useEffect to detect when a callback returns a cleanup function
// and emit a warning pointing to useCleanup() instead.
// Works in both dev and production, but production is quieter (max 3 warnings).
const _warnedCallSites = new Set<string>();
let _useEffectPatched = false;
let _useEffectWarnCount = 0;
const _USE_EFFECT_MAX_PROD_WARNINGS = 3;

function patchUseEffect(): void {
  if (_useEffectPatched) return;
  _useEffectPatched = true;

  const isProduction = process.env.NODE_ENV === "production";
  const originalUseEffect = React.useEffect;
  (React as any).useEffect = (
    callback: () => void | (() => void),
    deps?: readonly unknown[],
  ): void => {
    const wrappedCallback = () => {
      const result = callback();
      if (typeof result === "function") {
        // In production, limit warnings to first N occurrences
        if (isProduction) {
          _useEffectWarnCount++;
          if (_useEffectWarnCount <= _USE_EFFECT_MAX_PROD_WARNINGS) {
            process.stderr.write(
              "[storm-tui] Warning: useEffect cleanup function detected. " +
              "Use useCleanup() instead. See docs/pitfalls.md#4\n",
            );
          }
          if (_useEffectWarnCount === _USE_EFFECT_MAX_PROD_WARNINGS) {
            process.stderr.write(
              "[storm-tui] ... suppressing further useEffect cleanup warnings.\n",
            );
          }
          return result;
        }
        // Dev mode: warn once per call site
        let callSiteKey = "unknown";
        try {
          const stack = new Error().stack;
          if (stack) {
            // Skip first two frames (Error + wrappedCallback), take the caller
            const frames = stack.split("\n");
            callSiteKey = (frames[2] ?? frames[1] ?? "unknown").trim();
          }
        } catch {
          // Ignore — use default key
        }
        if (!_warnedCallSites.has(callSiteKey)) {
          _warnedCallSites.add(callSiteKey);
          process.stderr.write(
            "[storm-tui] Warning: useEffect cleanup function detected. " +
            "In Storm's reconciler, useEffect cleanup may not fire reliably. " +
            "Use useCleanup() instead for timers, listeners, and subscriptions. " +
            "See docs/pitfalls.md#4\n",
          );
        }
        return result;
      }
      return result;
    };
    originalUseEffect(wrappedCallback, deps);
  };
}

/**
 * Defensively call the private synchronous reconciler APIs.
 *
 * `updateContainerSync` + `flushSyncWork` are **private** React reconciler
 * internals that ensure state updates are processed synchronously before
 * returning. They can disappear or change signature on any React version
 * bump. This wrapper detects their availability at runtime and falls back
 * to the public `updateContainer` API when they are missing or throw.
 */
function syncContainerUpdate(
  element: React.ReactElement,
  container: any,
): void {
  try {
    if (typeof (TuiReconciler as any).updateContainerSync === "function") {
      (TuiReconciler as any).updateContainerSync(element, container, null, null);
    } else {
      TuiReconciler.updateContainer(element, container, null, null);
    }
    if (typeof (TuiReconciler as any).flushSyncWork === "function") {
      (TuiReconciler as any).flushSyncWork();
    }
  } catch {
    // Fallback to public API if private APIs are removed/changed
    TuiReconciler.updateContainer(element, container, null, null);
  }
}

/**
 * AutoScrollWrapper — wraps root content so it fills the terminal and
 * scrolls when content overflows. The outer ScrollView gets flex:1 to
 * fill the entire terminal. Content inside keeps its natural size —
 * components don't stretch/resize. If content exceeds the terminal,
 * the user can scroll.
 */
function AutoScrollWrapper(props: { children?: React.ReactNode }): React.ReactElement {
  return React.createElement(
    ScrollView,
    { flex: 1, stickToBottom: false, flexDirection: "column" },
    props.children,
  );
}

export interface RenderMetrics {
  renderTime: number; // ms
  lineCount: number;
  /** Time taken for the last paint+diff+flush cycle in ms. */
  lastRenderTimeMs: number;
  /** Frames rendered per second (rolling 1-second window). */
  fps: number;
  /** Number of cells changed in the last frame. */
  cellsChanged: number;
  /** Total cells in the buffer (width * height). */
  totalCells: number;
  /** Total frames rendered since start. */
  frameCount: number;
}

export interface RenderOptions extends ScreenOptions {
  onRender?: (metrics: RenderMetrics) => void;
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

let _nonTtyWarned = false;

export function render(
  initialElement: React.ReactElement,
  options: RenderOptions = {},
): TuiApp {
  // Non-TTY detection — warn once if stdout is not a terminal
  const stdout = options.stdout ?? process.stdout;
  if (!stdout.isTTY && !_nonTtyWarned) {
    _nonTtyWarned = true;
    process.stderr.write(
      "[storm-tui] Warning: stdout is not a TTY. Running in headless mode — " +
      "some features (mouse, alt-screen, colors) are disabled.\n",
    );
  }

  // Verify React reconciler compatibility
  if (process.env.NODE_ENV !== "production") {
    const reconcilerVersion = (Reconciler as any).version ?? "unknown";
    // syncContainerUpdate is a private API we depend on
    if (typeof (TuiReconciler as any).updateContainerSync !== "function") {
      process.stderr.write(
        `[storm-tui] Warning: React reconciler ${reconcilerVersion} may not support syncContainerUpdate. ` +
        `Storm requires react-reconciler@0.31+. State updates may not flush synchronously.\n`,
      );
    }
  }

  // Activate useEffect cleanup detection (works in both dev and production)
  patchUseEffect();

  let element = initialElement;
  const screen = new Screen(options);
  const input = new InputManager(screen.stdin);
  const renderCtx = new RenderContext();
  const pluginManager = new PluginManager();
  // Wire custom element lifecycle hooks into the reconciler host config
  setCustomElementLifecycleHooks(
    (type, element) => pluginManager.notifyCustomElementMount(type, element),
    (type, element) => pluginManager.notifyCustomElementUnmount(type, element),
  );
  const middlewarePipeline = new MiddlewarePipeline();
  // Wire middleware onOutput hooks into the screen's output path
  screen.setOutputTransform((output) => middlewarePipeline.runOutput(output));
  const errorBoundary = new RenderErrorBoundary(options.errorBoundary);
  // React commit → invalidate layout cache + immediate full paint
  const root: TuiRoot = createRoot(() => {
    renderCtx.invalidateLayout();
    doFullPaint();
  });

  // ── useState performance warning ─────────────────────────────────
  // Tracks full React reconciliation passes (doFullPaint calls) per
  // second. If >10 happen in 1s, it's likely useState being used for
  // animation/scroll instead of useRef + requestRender().
  // Warns in both dev and production, but production caps at 3 warnings.
  let fullPaintCount = 0;
  let fullPaintWindowStart = 0;
  let lastStateWarnTime = 0;
  let stateWarnProdCount = 0;
  const STATE_WARN_THRESHOLD = 10;      // reconciliations per second
  const STATE_WARN_COOLDOWN = 5000;     // ms between warnings
  const STATE_WARN_MAX_PROD = 3;        // max warnings in production

  // ── Frame rate limiting ──────────────────────────────────────────
  // Multiple events (scroll, keys, state changes) can fire in rapid
  // succession. Instead of painting for each one, we coalesce into
  // at most `maxFps` frames per second. The first frame fires
  // immediately via queueMicrotask; subsequent frames within the
  // MIN_FRAME_INTERVAL are delayed to the next frame boundary.
  const MIN_FRAME_INTERVAL = Math.max(1, Math.round(1000 / (options.maxFps ?? 60)));
  let unmounted = false;
  let frameScheduled = false;
  let lastFrameTime = 0;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  /** Monotonically increasing generation — incremented on every full paint.
   *  Pending doFrame microtasks compare their captured generation to detect
   *  that a full paint already superseded them (microtasks can't be cancelled). */
  let paintGeneration = 0;

  // ── Render loop detection ────────────────────────────────────────
  let framesThisSecond = 0;
  let frameSecondStart = Date.now();
  const MAX_FRAMES_PER_SECOND = 200;

  // ── FPS tracking (rolling 1-second window) ─────────────────────
  let frameCount = 0;
  const frameTimes: number[] = []; // timestamps of recent frames
  let currentFps = 0;

  function updateFpsCounter(now: number): void {
    frameTimes.push(now);
    // Purge timestamps older than 1 second
    while (frameTimes.length > 0 && frameTimes[0]! < now - 1000) {
      frameTimes.shift();
    }
    currentFps = frameTimes.length;
  }

  function scheduleFastRepaint(): void {
    if (unmounted || frameScheduled) return;
    const now = Date.now();
    if (now - frameSecondStart > 1000) {
      framesThisSecond = 0;
      frameSecondStart = now;
    }
    framesThisSecond++;
    if (framesThisSecond > MAX_FRAMES_PER_SECOND) {
      // Render loop detected — skip this frame
      process.stderr.write(
        `\x1b[33m[storm-tui] Warning: render loop detected (>${MAX_FRAMES_PER_SECOND} frames/s). Skipping frame. Check for setState calls in useInput handlers or requestRender() in a tight loop.\x1b[0m\n`,
      );
      return;
    }
    frameScheduled = true;
    const elapsed = now - lastFrameTime;
    const capturedGen = paintGeneration;
    const guardedDoFrame = () => {
      frameScheduled = false;
      pendingTimer = null;
      if (unmounted) return;
      // If a full paint happened after this frame was scheduled, skip —
      // the full paint already flushed the correct state to the terminal.
      // Running another repaint here would use stale/partial state and
      // produce garbled output when multiple widgets update simultaneously.
      if (paintGeneration !== capturedGen) return;
      doFastRepaint();
    };
    if (elapsed >= MIN_FRAME_INTERVAL) {
      // Enough time has passed — render immediately on next microtask
      queueMicrotask(guardedDoFrame);
    } else {
      // Delay until the next frame boundary
      pendingTimer = setTimeout(guardedDoFrame, MIN_FRAME_INTERVAL - elapsed);
    }
  }

  function handleRenderError(err: unknown): void {
    const error = err instanceof Error ? err : new Error(String(err));
    if (options.onError) {
      options.onError(error);
    } else {
      process.stderr.write(`\x1b[0m\nTUI render error: ${error.stack ?? error.message}\n`);
    }
  }

  /** Fast repaint — skips layout, just repaints with cached positions. For scroll/cursor. */
  function doFastRepaint(): void {
    if (unmounted) return;
    try {
      pluginManager.runBeforeRender();
      const t0 = performance.now();
      const result = errorBoundary.protect("paint", () =>
        repaint(root, screen.width, screen.height, renderCtx),
      );
      if (result === undefined) {
        if (errorBoundary.shouldExit()) unmount(new Error("Too many consecutive render errors"));
        return;
      }
      // Run middleware onPaint hooks (buffer post-processing)
      result.buffer = middlewarePipeline.runPaint(result.buffer, screen.width, screen.height);
      const diffResult = flushResult(result);
      const renderTime = performance.now() - t0;
      lastFrameTime = Date.now();

      // Update metrics
      frameCount++;
      updateFpsCounter(lastFrameTime);
      const totalCells = screen.width * screen.height;
      const metrics: RenderMetrics = {
        renderTime,
        lineCount: screen.height,
        lastRenderTimeMs: renderTime,
        fps: currentFps,
        cellsChanged: diffResult.changedLines,
        totalCells,
        frameCount,
      };
      renderCtx.metrics = {
        lastRenderTimeMs: renderTime,
        fps: currentFps,
        cellsChanged: diffResult.changedLines,
        totalCells,
        frameCount,
      };
      renderCtx.clearDirty();
      pluginManager.runAfterRender({ renderTimeMs: renderTime, cellsChanged: diffResult.changedLines });
      options.onRender?.(metrics);
    } catch (err) {
      handleRenderError(err);
    }
  }

  /** Full paint — rebuilds layout + paints. For React commits (structural changes). */
  function doFullPaint(): void {
    if (unmounted) return;
    // Cancel any pending fast repaint — this full paint supersedes it.
    // Without this, a scheduleFastRepaint() that queued a microtask/timer
    // BEFORE this full paint was triggered (e.g., Spinner's requestRender
    // followed by flushSync from StreamingText) would fire AFTER this
    // full paint, producing a second repaint from stale state that
    // interleaves cells from different widgets on the same rows.
    paintGeneration++;
    frameScheduled = false;
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    try {
      pluginManager.runBeforeRender();
      // Notify middleware of layout computation
      middlewarePipeline.runLayout(screen.width, screen.height);
      const t0 = performance.now();
      const result = errorBoundary.protect("paint", () =>
        paint(root, screen.width, screen.height, renderCtx),
      );
      if (result === undefined) {
        if (errorBoundary.shouldExit()) unmount(new Error("Too many consecutive render errors"));
        return;
      }
      // Run middleware onPaint hooks (buffer post-processing)
      result.buffer = middlewarePipeline.runPaint(result.buffer, screen.width, screen.height);
      const diffResult = flushResult(result);
      const renderTime = performance.now() - t0;
      lastFrameTime = Date.now();

      // Update metrics
      frameCount++;
      updateFpsCounter(lastFrameTime);
      const totalCells = screen.width * screen.height;
      const metrics: RenderMetrics = {
        renderTime,
        lineCount: screen.height,
        lastRenderTimeMs: renderTime,
        fps: currentFps,
        cellsChanged: diffResult.changedLines,
        totalCells,
        frameCount,
      };
      renderCtx.metrics = {
        lastRenderTimeMs: renderTime,
        fps: currentFps,
        cellsChanged: diffResult.changedLines,
        totalCells,
        frameCount,
      };
      renderCtx.clearDirty();
      pluginManager.runAfterRender({ renderTimeMs: renderTime, cellsChanged: diffResult.changedLines });
      options.onRender?.(metrics);

      // Warn if full React reconciliation passes are happening too frequently.
      // This fires in both dev and production (capped at STATE_WARN_MAX_PROD in prod).
      {
        const warnNow = Date.now();
        if (warnNow - fullPaintWindowStart > 1000) {
          // New 1-second window
          fullPaintCount = 1;
          fullPaintWindowStart = warnNow;
        } else {
          fullPaintCount++;
        }
        if (fullPaintCount > STATE_WARN_THRESHOLD && warnNow - lastStateWarnTime > STATE_WARN_COOLDOWN) {
          const isProduction = process.env.NODE_ENV === "production";
          const shouldWarn = !isProduction || stateWarnProdCount < STATE_WARN_MAX_PROD;
          if (shouldWarn) {
            if (isProduction) stateWarnProdCount++;
            lastStateWarnTime = warnNow;
            process.stderr.write(
              "[storm-tui] Performance: " + fullPaintCount + " state updates/sec detected. " +
              "If this is animation or scroll, use useRef + requestRender() instead of useState. " +
              "See docs/getting-started.md — The Golden Rules.\n",
            );
          }
        }
      }
    } catch (err) {
      handleRenderError(err);
    }
  }

  function flushResult(result: { buffer: ScreenBuffer; cursorX: number; cursorY: number }) {
    // Track live section height for commitText
    screen.setLiveHeight(screen.height);
    const diffResult = screen.flush(result.buffer, renderCtx.links, renderCtx);
    if (result.cursorX >= 0 && result.cursorY >= 0) {
      screen.setCursor(result.cursorX, result.cursorY);
      screen.setCursorVisible(true);
    } else {
      screen.setCursorVisible(false);
    }
    return diffResult;
  }

  let exitResolve: (() => void) | null = null;
  let exitReject: ((error: Error) => void) | null = null;
  const exitPromise = new Promise<void>((resolve, reject) => {
    exitResolve = resolve;
    exitReject = reject;
  });

  const container = TuiReconciler.createContainer(
    root, 0, null, false, null, "",
    (error: Error) => {
      handleRenderError(error);
    },
    null,
  );

  /**
   * commitText — write styled text above the live render area.
   * Erases the live section, writes the text (permanent scrollback),
   * then repaints the live section below.
   */
  function commitText(text: string): void {
    if (unmounted) return;
    // Erase live section and write committed text
    screen.commitAbove(text);
    // Force full invalidation — the diff cache is stale since we moved the cursor
    screen.invalidate();
    // Immediately repaint the live section below the committed text
    doFullPaint();
  }

  // Stable references for context methods (don't change between renders)
  const ctxMethods = {
    screen,
    input,
    focus: renderCtx.focus,
    exit: (error?: Error) => unmount(error),
    requestRender: () => scheduleFastRepaint(),
    flushSync: (fn: () => void) => {
      fn();
      forceReactFlush();
    },
    clear: () => {
      screen.invalidate();
      scheduleFastRepaint();
    },
    renderContext: renderCtx,
    commitText,
  };

  // Stable context value — SAME reference. React only re-renders components
  // that have pending state updates (from setState in flushSync). Components
  // without state changes are NOT re-rendered, avoiding the expensive cascade
  // that was causing lag with Image/SyntaxHighlight/MarkdownText components.
  const stableContextValue: TuiContextValue = { ...ctxMethods } as TuiContextValue;

  const useAutoScroll = options.autoScroll === true;
  function wrapElement(el: React.ReactElement): React.ReactElement {
    if (!useAutoScroll) return el;
    return React.createElement(AutoScrollWrapper, null, el);
  }

  // The element is recreated in forceReactFlush to trigger React
  // reconciliation. React sees the same component types and structure,
  // so it reconciles in-place (no unmount/remount). Only components
  // with pending state updates (from setState) actually re-render.
  // Also set theme on RenderContext so the renderer can read it for fallback colors
  if (options.theme) renderCtx.theme = options.theme;
  let stableElement = React.createElement(TuiProvider, { value: stableContextValue },
    React.createElement(ThemeProvider, { ...(options.theme ? { theme: options.theme } : {}), children: wrapElement(element) }));

  function forceReactFlush(): void {
    if (unmounted) return;
    // Synchronously flush all pending state updates so the paint sees
    // the up-to-date fiber tree (see syncContainerUpdate for details).
    stableElement = React.createElement(TuiProvider, { value: stableContextValue },
      React.createElement(ThemeProvider, { ...(options.theme ? { theme: options.theme } : {}), children: wrapElement(element) }));
    syncContainerUpdate(stableElement, container);
  }

  // ── Register plugins from options ────────────────────────────────
  if (options.plugins) {
    for (const plugin of options.plugins) {
      pluginManager.register(plugin);
    }
  }

  // ── debugRainbow ────────────────────────────────────────────────
  if (options.debugRainbow === true) {
    screen.setDebugRainbow(true);
  }

  // ── patchConsole ───────────────────────────────────────────────
  const origConsoleLog = console.log;
  const origConsoleWarn = console.warn;
  const origConsoleError = console.error;
  // Always silence console.warn/error in alt screen mode to prevent React dev
  // warnings from corrupting the TUI display. console.log is only patched if
  // patchConsole is explicitly true.
  // In production, React doesn't emit warnings so this is a no-op effectively.
  const suppressedWarnings: string[] = [];
  const silentWarn = (...args: unknown[]) => {
    suppressedWarnings.push(args.map(a => typeof a === "string" ? a : String(a)).join(" "));
  };
  console.warn = silentWarn;
  console.error = silentWarn;

  if (options.patchConsole === true) {
    const writeThrough = (...args: unknown[]) => {
      const msg = args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
      screen.write(msg + "\n");
    };
    console.log = writeThrough;
    console.warn = writeThrough;
    console.error = writeThrough;
  }

  // Wire the animation scheduler's render trigger
  renderCtx.animationScheduler.setRenderTrigger(() => scheduleFastRepaint());

  // Start
  screen.start();

  // Wire user-level cleanups into signal handlers so SIGTERM/SIGHUP/uncaughtException
  // run useCleanup() and plugin teardown before the terminal is restored.
  screen.setBeforeCleanup(() => {
    runSyncCleanups();
  });

  // Set terminal background color if requested
  if (typeof options.terminalBg === "string") {
    screen.setTerminalBg(options.terminalBg);
  } else if (options.terminalBg === true && options.theme) {
    screen.setTerminalBg(options.theme.surface.base);
  }

  input.start();

  // ── Scroll: 1:1 pass-through ────────────────────────────────────
  // Each event = 1 line. Speed matches finger speed.
  // With 0.11ms frames + sync output + line-level diff, this is smooth.
  const unsubScroll = input.onMouse((event) => {
    // Let plugins intercept mouse events first
    const processed = pluginManager.processMouse(event);
    if (!processed) return; // Plugin consumed the event
    if (processed.button === "scroll-up" || processed.button === "scroll-down") {
      const target = renderCtx.focus.hitTestScroll(processed.x, processed.y);
      const delta = processed.button === "scroll-up" ? -1 : 1;
      if (processed.shift && target?.onHScroll) {
        // Shift+scroll -> horizontal scroll
        target.onHScroll(delta);
      } else if (target?.onScroll) {
        target.onScroll(delta);
      }
    }
  });

  // Tab cycles focus
  const unsubTab = input.onKey((event) => {
    // Let plugins intercept key events first
    const processed = pluginManager.processKey(event);
    if (!processed) return; // Plugin consumed the event
    if (processed.key === "tab") {
      if (processed.shift) renderCtx.focus.cyclePrev();
      else renderCtx.focus.cycleNext();
    }
  });

  // Double Ctrl+C force exits
  let lastCtrlC = 0;
  const unsubCtrlC = input.onKey((event) => {
    if (event.key === "c" && event.ctrl) {
      const now = Date.now();
      if (now - lastCtrlC < 500) {
        input.stop();
        screen.stop();
        process.exit(0);
      }
      lastCtrlC = now;
    }
  });

  // Resize — clear screen, invalidate everything, full repaint
  screen.onResizeEvent(() => {
    screen.invalidate();              // Force full diff redraw (clear prevLines)
    screen.write("\x1b[2J\x1b[H");   // Clear entire screen + home cursor
    renderCtx.invalidateLayout();     // Rebuild layout for new dimensions
    forceReactFlush();                // Trigger React commit → full paint
  });

  // Initial render — synchronous
  syncContainerUpdate(stableElement, container);

  let exitError: Error | undefined;

  /** Run all sync cleanups (useCleanup, plugin teardown). Safe to call multiple times. */
  function runSyncCleanups(): void {
    // Disconnect custom element lifecycle hooks
    setCustomElementLifecycleHooks(null, null);
    // Run all plugin cleanup hooks
    pluginManager.runCleanup();
    // Run all registered sync cleanups (timers, listeners, etc.)
    for (const fn of renderCtx.cleanups.values()) {
      try { fn(); } catch { /* ignore cleanup errors */ }
    }
    renderCtx.cleanups.clear();
  }

  function unmount(error?: Error): void {
    if (error) exitError = error;
    // 1. Set unmounted FIRST — prevents any microtask/timer from firing during cleanup
    unmounted = true;
    // 2. Cancel any pending frame timer — prevents stale repaint from racing with cleanup
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    frameScheduled = false;
    // 3. Destroy the animation scheduler (stops its timer)
    renderCtx.animationScheduler.destroy();
    // 4. Run sync cleanups — safe now that no pending timers can interleave
    runSyncCleanups();
    unsubScroll();
    unsubTab();
    unsubCtrlC();
    // Run async cleanups in parallel, then finalize
    const asyncFns = Array.from(renderCtx.asyncCleanups.values());
    renderCtx.asyncCleanups.clear();
    const finalize = () => {
      TuiReconciler.updateContainer(null, container, null, () => {
        input.stop();
        screen.stop();
        // Restore console
        console.warn = origConsoleWarn;
        console.error = origConsoleError;
        if (options.patchConsole === true) {
          console.log = origConsoleLog;
        }
        // Show any suppressed warnings after TUI exits
        if (suppressedWarnings.length > 0 && process.env.NODE_ENV !== "production") {
          origConsoleWarn(`[storm-tui] ${suppressedWarnings.length} console warnings were suppressed during TUI session.`);
        }
        if (exitError) {
          exitReject?.(exitError);
        } else {
          exitResolve?.();
        }
      });
    };
    if (asyncFns.length > 0) {
      Promise.allSettled(asyncFns.map(fn => fn())).then(finalize);
    } else {
      finalize();
    }
  }

  function rerender(newElement: React.ReactElement): void {
    element = newElement;
    // New element = React sees tree change and re-renders affected components
    stableElement = React.createElement(TuiProvider, { value: stableContextValue },
      React.createElement(ThemeProvider, { ...(options.theme ? { theme: options.theme } : {}), children: wrapElement(newElement) }));
    syncContainerUpdate(stableElement, container);
  }

  function clear(): void {
    screen.invalidate();
    doFullPaint();
  }

  function recalculateLayout(): void {
    renderCtx.invalidateLayout();
    doFullPaint();
  }

  return {
    unmount,
    rerender,
    screen,
    input,
    waitUntilExit: () => exitPromise,
    clear,
    recalculateLayout,
    pluginManager,
    middleware: middlewarePipeline,
    root,
    requestRepaint: () => scheduleFastRepaint(),
    setTerminalBg: (hex: string | null) => screen.setTerminalBg(hex),
  };
}
