import React from "react";
import Reconciler from "react-reconciler";
import { hostConfig, setCustomElementLifecycleHooks } from "./host.js";
import { createRoot, type TuiRoot } from "./types.js";
import { Screen } from "../core/screen.js";
import { InputManager } from "../input/manager.js";
import { RenderContext } from "../core/render-context.js";
import { TuiProvider, type TuiContextValue } from "../context/TuiContext.js";
import { ThemeProvider } from "../theme/provider.js";
import { RenderErrorBoundary } from "../core/error-boundary.js";
import { PluginManager } from "../core/plugin.js";
import { MiddlewarePipeline } from "../core/middleware.js";
import { ScrollView } from "../components/core/ScrollView.js";
import { FrameScheduler } from "./frame-scheduler.js";
import { ConsoleInterceptor } from "./console-interceptor.js";
import { InputWiring } from "./input-wiring.js";
import { RenderPipeline } from "./render-pipeline.js";
import { patchUseEffect } from "./use-effect-patch.js";

export type { FullRenderMetrics, RenderMetrics, RenderOptions, TuiApp } from "./render-types.js";
import type { RenderOptions, TuiApp } from "./render-types.js";

const TuiReconciler = Reconciler(hostConfig);

type ReconcilerPrivate = typeof TuiReconciler & { // React private API
  updateContainerSync?: (el: React.ReactElement, c: unknown, p: null, cb: null) => void;
  flushSyncWork?: () => void;
};

/** Sync container update with fallback to public API. */
function syncContainerUpdate(el: React.ReactElement, c: ReturnType<typeof TuiReconciler.createContainer>): void {
  const r = TuiReconciler as ReconcilerPrivate;
  try {
    if (typeof r.updateContainerSync === "function") r.updateContainerSync(el, c, null, null);
    else TuiReconciler.updateContainer(el, c, null, null);
    if (typeof r.flushSyncWork === "function") r.flushSyncWork();
  } catch { TuiReconciler.updateContainer(el, c, null, null); }
}

function AutoScrollWrapper(props: { children?: React.ReactNode }): React.ReactElement {
  return React.createElement(ScrollView, { flex: 1, stickToBottom: false, flexDirection: "column" }, props.children);
}

let _nonTtyWarned = false;

/**
 * Mount a React element tree into the terminal. Returns a TuiApp handle.
 * Caller MUST await `waitUntilExit()` or the process will exit immediately
 * after the event loop drains. Enters alt screen, enables raw mode, traps
 * signals -- all cleaned up on unmount.
 */
export function render(
  initialElement: React.ReactElement,
  options: RenderOptions = {},
): TuiApp {
  if (!(options.stdout ?? process.stdout).isTTY && !_nonTtyWarned) {
    _nonTtyWarned = true;
    process.stderr.write("[storm] Warning: stdout is not a TTY. Running in headless mode.\n");
  }
  if (process.env.NODE_ENV !== "production" &&
      typeof (TuiReconciler as ReconcilerPrivate).updateContainerSync !== "function") {
    const v = (Reconciler as unknown as { version?: string }).version ?? "unknown"; // React private API
    process.stderr.write(`[storm] Warning: React reconciler ${v} may lack syncContainerUpdate.\n`);
  }
  patchUseEffect();

  let element = initialElement;
  const screen = new Screen(options);
  const input = new InputManager(screen.stdin);
  const renderCtx = new RenderContext();
  const pluginManager = new PluginManager();
  setCustomElementLifecycleHooks(
    (type, element) => pluginManager.notifyCustomElementMount(type, element),
    (type, element) => pluginManager.notifyCustomElementUnmount(type, element),
    (type, element, props) => pluginManager.notifyCustomElementUpdate(type, element, props),
  );
  const middlewarePipeline = new MiddlewarePipeline();
  screen.setOutputTransform((output) => middlewarePipeline.runOutput(output));
  const errorBoundary = new RenderErrorBoundary(options.errorBoundary);
  const scheduler = new FrameScheduler({ maxFps: options.maxFps });

  // RenderPipeline is created after unmount is defined (circular dep resolved via late binding)
  let pipeline: RenderPipeline;

  // React commit → invalidate layout cache + immediate full paint
  const root: TuiRoot = createRoot(() => {
    renderCtx.invalidateLayout();
    pipeline.fullPaint();
  });

  let exitResolve: (() => void) | null = null;
  let exitReject: ((error: Error) => void) | null = null;
  const exitPromise = new Promise<void>((r, j) => { exitResolve = r; exitReject = j; });

  const onRecoverableError = (err: Error) => {
    if (options.onError) options.onError(err);
    else process.stderr.write(`\x1b[0m\nTUI render error: ${err.stack ?? err.message}\n`);
  };
  const container = TuiReconciler.createContainer(root, 0, null, false, null, "", onRecoverableError, null);
  let exitError: Error | undefined;
  const consoleInterceptor = new ConsoleInterceptor(screen, { patchConsole: options.patchConsole });

  function runSyncCleanups(): void {
    setCustomElementLifecycleHooks(null, null);
    pluginManager.runCleanup();
    for (const fn of renderCtx.cleanups.values()) { try { fn(); } catch { /* ignore */ } }
    renderCtx.cleanups.clear();
  }

  function unmount(error?: Error): void {
    if (error) exitError = error;
    scheduler.setUnmounted(); scheduler.cancelPending();
    renderCtx.animationScheduler.destroy();
    runSyncCleanups(); inputWiring.dispose();
    const asyncFns = Array.from(renderCtx.asyncCleanups.values());
    renderCtx.asyncCleanups.clear();
    const finalize = () => TuiReconciler.updateContainer(null, container, null, () => {
      input.stop(); screen.stop(); consoleInterceptor.restore();
      if (exitError) exitReject?.(exitError); else exitResolve?.();
    });
    if (asyncFns.length > 0) Promise.allSettled(asyncFns.map(fn => fn())).then(finalize);
    else finalize();
  }

  // Now create the pipeline with all dependencies resolved
  pipeline = new RenderPipeline({
    root, screen, renderCtx, errorBoundary,
    pluginManager, middlewarePipeline, scheduler, options, unmount,
  });

  const wrap = options.autoScroll === true
    ? (el: React.ReactElement) => React.createElement(AutoScrollWrapper, null, el)
    : (el: React.ReactElement) => el;

  const stableContextValue: TuiContextValue = {
    screen, input, focus: renderCtx.focus, renderContext: renderCtx,
    exit: (error?: Error) => unmount(error),
    requestRender: () => pipeline.scheduleFastRepaint(),
    flushSync: (fn: () => void) => { fn(); forceReactFlush(); },
    clear: () => { screen.invalidate(); pipeline.scheduleFastRepaint(); },
    commitText: (text: string) => pipeline.commitText(text),
  } as TuiContextValue;

  if (options.theme) renderCtx.theme = options.theme;
  if (options.background) renderCtx.rootBackground = options.background;
  const themeProps = options.theme ? { theme: options.theme } : {};
  const buildTree = (el: React.ReactElement) => React.createElement(TuiProvider, { value: stableContextValue },
    React.createElement(ThemeProvider, { ...themeProps, children: wrap(el) }));
  let stableElement = buildTree(element);

  function forceReactFlush(): void {
    if (scheduler.unmounted) return;
    stableElement = buildTree(element);
    syncContainerUpdate(stableElement, container);
  }

  if (options.plugins) for (const p of options.plugins) pluginManager.register(p);
  if (options.debugRainbow === true) screen.setDebugRainbow(true);
  renderCtx.animationScheduler.setRenderTrigger(() => pipeline.scheduleFastRepaint());

  screen.start();
  screen.setBeforeCleanup(() => { runSyncCleanups(); });
  if (typeof options.terminalBg === "string") screen.setTerminalBg(options.terminalBg);
  else if (options.terminalBg === true && options.theme) screen.setTerminalBg(options.theme.surface.base);
  input.start();
  const inputWiring = new InputWiring(input, screen, renderCtx, pluginManager);

  screen.onResizeEvent(() => {
    screen.invalidate();
    screen.write("\x1b[2J\x1b[H");
    renderCtx.invalidateLayout();
    forceReactFlush();
  });

  // Initial render — synchronous
  syncContainerUpdate(stableElement, container);

  function rerender(newElement: React.ReactElement): void {
    element = newElement;
    stableElement = buildTree(newElement);
    syncContainerUpdate(stableElement, container);
  }

  return {
    unmount,
    rerender,
    screen,
    input,
    waitUntilExit: () => exitPromise,
    clear: () => pipeline.clear(),
    recalculateLayout: () => pipeline.recalculateLayout(),
    pluginManager,
    middleware: middlewarePipeline,
    root,
    requestRepaint: () => pipeline.scheduleFastRepaint(),
    setTerminalBg: (hex: string | null) => screen.setTerminalBg(hex),
  };
}
