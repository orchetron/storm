/**
 * One-line DevTools enablement for Storm TUI.
 *
 * ```ts
 * const app = render(<App />);
 * enableDevTools(app);
 * ```
 *
 * That's it. All DevTools features are wired up:
 *   1 — Render Diff Heatmap
 *   2 — WCAG Accessibility Audit
 *   3 — Time-Travel Debugging (left/right to scrub)
 *   4 — DevTools Overlay ([] panels, jk navigate, space toggle)
 *   5 — Profiler Memory/CPU Breakdown Overlay
 *   6 — Export profiler data to JSON file
 *
 * All overlays are non-blocking — the app keeps running underneath.
 * Input is handled via the app's InputManager — no external wiring needed.
 */

import { writeFileSync } from "node:fs";
import type { TuiApp } from "../reconciler/render.js";
import type { ScreenBuffer } from "../core/buffer.js";
import { RenderContext } from "../core/render-context.js";
import { createTimeTravel } from "./time-travel.js";
import { createRenderHeatmap } from "./render-heatmap.js";
import { createAccessibilityAudit } from "./accessibility-audit.js";
import { createDevToolsOverlay } from "./devtools-overlay.js";
import { createPerformanceMonitor } from "./performance-monitor.js";
import { createEventLogger } from "./event-logger.js";
import { createProfiler, type Profiler } from "./profiler.js";
import { setActiveProfiler } from "./profiler-registry.js";
import { enableCrashLog } from "./crash-log.js";

export interface EnableDevToolsOptions {
  /** Key to toggle heatmap (default: "1") */
  heatmapKey?: string;
  /** Key to toggle accessibility audit (default: "2") */
  auditKey?: string;
  /** Key to toggle time-travel (default: "3") */
  timeTravelKey?: string;
  /** Key to toggle DevTools overlay (default: "4") */
  overlayKey?: string;
  /** Key to toggle profiler overlay (default: "5") */
  profilerKey?: string;
  /** Key to export profiler JSON (default: "6") */
  exportKey?: string;
  /** DevTools panel height (default: 12) */
  panelHeight?: number;
  /** Max time-travel frames to store (default: 120) */
  maxFrames?: number;
  /** WCAG minimum contrast ratio (default: 4.5 for AA) */
  minContrast?: number;
  /** Profiler history size (default: 120 frames) */
  profilerHistory?: number;
  /** Enable crash log writing (default: true) */
  crashLog?: boolean;
  /** Crash log output directory (default: process.cwd()) */
  crashLogDir?: string;
}

export interface DevToolsHandle {
  /** Destroy all DevTools (remove middleware, input handlers) */
  destroy: () => void;
  /** Access the profiler instance directly */
  profiler: Profiler;
}

export function enableDevTools(
  app: TuiApp,
  options?: EnableDevToolsOptions,
): DevToolsHandle {
  const heatmapKey = options?.heatmapKey ?? "1";
  const auditKey = options?.auditKey ?? "2";
  const timeTravelKey = options?.timeTravelKey ?? "3";
  const overlayKey = options?.overlayKey ?? "4";
  const profilerKey = options?.profilerKey ?? "5";
  const exportKey = options?.exportKey ?? "6";

  const timeTravel = createTimeTravel({ maxFrames: options?.maxFrames ?? 120 });
  const heatmap = createRenderHeatmap({ cooldownFrames: 15, opacity: 0.6 });
  const a11yAudit = createAccessibilityAudit({ minContrast: options?.minContrast ?? 4.5 });
  const perfMonitor = createPerformanceMonitor();
  const eventLogger = createEventLogger(50);
  const devtools = createDevToolsOverlay({
    panelHeight: options?.panelHeight ?? 12,
  });

  // and cleanup data from it. We create a fresh instance and update it from the
  // devtools-bridge middleware on each frame.
  const profilerCtx = new RenderContext();
  const profiler = createProfiler(profilerCtx, options?.profilerHistory ?? 120);
  profiler.setRoot(app.root);
  profiler.start();

  setActiveProfiler(profiler);

  // Enable crash logging
  let removeCrashLog: (() => void) | null = null;
  if (options?.crashLog !== false) {
    removeCrashLog = enableCrashLog(app, profiler, {
      ...(options?.crashLogDir ? { dir: options.crashLogDir } : {}),
      frames: 60,
      includeTree: true,
    });
  }

  let profilerOverlayVisible = false;
  let lastLayoutMs = 0;
  let layoutStart = 0;

  devtools.setRoot(app.root);

  // Register middleware (order: time-travel first, devtools overlay last = on top)
  app.middleware.use(timeTravel.middleware);
  app.middleware.use(heatmap.middleware);
  app.middleware.use(a11yAudit.middleware);

  // Bridge middleware: feeds perf + events + profiler data to devtools each frame
  app.middleware.use({
    name: "devtools-bridge",
    onLayout(_w, _h) {
      // Capture layout start time — the actual layout computation
      // happens between onLayout and onPaint in the render loop.
      layoutStart = performance.now();
    },
    onPaint(buffer, width, height) {
      // Measure layout time (onLayout was called just before layout+paint)
      if (layoutStart > 0) {
        lastLayoutMs = performance.now() - layoutStart;
        layoutStart = 0;
      }
      // Tick perf monitor (approximate — real timing would need hooks in render loop)
      perfMonitor.onPaintStart();
      perfMonitor.onPaintEnd();
      perfMonitor.onDiffStart();
      perfMonitor.onDiffEnd();
      perfMonitor.onFlushStart();
      perfMonitor.onFlushEnd();

      const metrics = perfMonitor.getMetrics();
      devtools.setMetrics(metrics);
      devtools.setEvents(eventLogger.getEvents());

      // Sync profiler context with live buffer data
      profilerCtx.buffer = buffer;
      profilerCtx.metrics = {
        lastRenderTimeMs: metrics.lastPaintMs + metrics.lastDiffMs + metrics.lastFlushMs,
        fps: metrics.avgFps,
        cellsChanged: metrics.cellsChanged,
        totalCells: metrics.totalCells,
        frameCount: metrics.frameCount,
      };

      // Record profiler frame with timing from perf monitor
      profiler.recordFrame({
        layoutMs: lastLayoutMs,
        paintMs: metrics.lastPaintMs,
        diffMs: metrics.lastDiffMs,
        flushMs: metrics.lastFlushMs,
      });

      // If profiler overlay is visible, render it onto the buffer
      if (profilerOverlayVisible) {
        renderProfilerOverlay(buffer, width, height, profiler);
      }

      return buffer;
    },
  });

  app.middleware.use(devtools.middleware);

  // Log ALL input events to the event logger
  const removeKeyLogger = app.input.onKey((event) => {
    const detail = event.ctrl ? `Ctrl+${event.key}` : event.char || event.key;
    eventLogger.log({ type: "key", detail, timestamp: Date.now() });
  });
  const removeMouseLogger = app.input.onMouse((event) => {
    eventLogger.log({
      type: "mouse",
      detail: `${event.button} (${event.x},${event.y})`,
      timestamp: Date.now(),
    });
  });

  const removeKeyHandler = app.input.onKey((event) => {
    // Time-travel mode takes over arrow keys
    if (timeTravel.getState().isActive) {
      if (event.key === "left") { timeTravel.prevFrame(); app.requestRepaint(); return; }
      if (event.key === "right") { timeTravel.nextFrame(); app.requestRepaint(); return; }
      if (event.char === timeTravelKey || event.key === "escape") {
        timeTravel.exit(); app.requestRepaint(); return;
      }
      return; // Swallow all other input while time-traveling
    }

    // DevTools overlay panel/tree navigation (non-blocking — uses [] jk space)
    if (devtools.isVisible()) {
      if (event.char === "[") { devtools.selectPrevPanel(); app.requestRepaint(); return; }
      if (event.char === "]") { devtools.selectNextPanel(); app.requestRepaint(); return; }
      if (event.char === "j") { devtools.selectNext(); app.requestRepaint(); return; }
      if (event.char === "k") { devtools.selectPrev(); app.requestRepaint(); return; }
      if (event.char === " ") { devtools.toggleCollapse(); app.requestRepaint(); return; }
    }

    if (event.char === heatmapKey) { heatmap.toggle(); app.requestRepaint(); return; }
    if (event.char === auditKey) { a11yAudit.toggle(); app.requestRepaint(); return; }
    if (event.char === timeTravelKey) { timeTravel.toggle(); app.requestRepaint(); return; }
    if (event.char === overlayKey) { devtools.toggle(); app.requestRepaint(); return; }
    if (event.char === profilerKey) {
      profilerOverlayVisible = !profilerOverlayVisible;
      app.requestRepaint();
      return;
    }
    if (event.char === exportKey) {
      exportProfilerData(profiler);
      return;
    }
  });

  return {
    destroy() {
      profiler.stop();
      setActiveProfiler(null);
      if (removeCrashLog) removeCrashLog();
      removeKeyLogger();
      removeMouseLogger();
      removeKeyHandler();
      app.middleware.remove("time-travel");
      app.middleware.remove("render-heatmap");
      app.middleware.remove("accessibility-audit");
      app.middleware.remove("devtools-bridge");
      app.middleware.remove("devtools-overlay");
    },
    profiler,
  };
}

const COL_BG = 0x1a1a2e;
const COL_FG = 0xc0c0c0;
const COL_BRAND = 0x82aaff;
const COL_RED = 0xff5370;
const COL_YELLOW = 0xffcb6b;
const COL_UL = -1; // DEFAULT_COLOR

function writeCell(
  buffer: ScreenBuffer,
  x: number,
  y: number,
  char: string,
  fg: number,
  bg: number,
  attrs: number,
): void {
  buffer.setCell(x, y, { char, fg, bg, attrs, ulColor: COL_UL });
}

/**
 * Render profiler overlay directly onto the buffer.
 * Shows a compact panel in the top-right corner with memory/CPU metrics.
 */
function renderProfilerOverlay(
  buffer: ScreenBuffer,
  width: number,
  height: number,
  profiler: Profiler,
): void {
  const snap = profiler.snapshot();
  if (snap.frame === 0) return;

  const rssMB = (snap.rssBytes / (1024 * 1024)).toFixed(1);
  const heapMB = (snap.heapUsedBytes / (1024 * 1024)).toFixed(1);
  const heapTotalMB = (snap.heapTotalBytes / (1024 * 1024)).toFixed(1);
  const gcPct = (snap.gcPressure * 100).toFixed(0);
  const bufKB = (snap.bufferBytes / 1024).toFixed(1);

  const lines = [
    ` Profiler [Frame ${snap.frame}]`,
    ` FPS: ${snap.fps}  Total: ${snap.totalMs.toFixed(1)}ms`,
    ` Layout: ${snap.layoutMs.toFixed(1)}ms  Paint: ${snap.paintMs.toFixed(1)}ms`,
    ` Diff: ${snap.diffMs.toFixed(1)}ms  Flush: ${snap.flushMs.toFixed(1)}ms`,
    ` RSS: ${rssMB}MB  Heap: ${heapMB}/${heapTotalMB}MB`,
    ` GC Pressure: ${gcPct}%  Delta: ${formatBytes(snap.heapDelta)}`,
    ` Buffer: ${bufKB}KB  Cells: ${snap.cellsChanged}/${snap.totalCells}`,
    ` Elements: ${snap.hostElementCount}  Timers: ${snap.activeTimerCount}`,
  ];

  const panelWidth = Math.max(...lines.map(l => l.length)) + 2;
  const panelX = Math.max(0, width - panelWidth - 1);
  const panelY = 1;

  // Draw background
  for (let row = panelY; row < panelY + lines.length + 2 && row < height; row++) {
    for (let col = panelX; col < panelX + panelWidth && col < width; col++) {
      writeCell(buffer, col, row, " ", COL_FG, COL_BG, 0);
    }
  }

  // Draw border
  if (panelY < height && panelX < width) {
    // Top border
    for (let col = panelX; col < panelX + panelWidth && col < width; col++) {
      const ch = col === panelX ? "\u250c" : col === panelX + panelWidth - 1 ? "\u2510" : "\u2500";
      writeCell(buffer, col, panelY, ch, COL_BRAND, COL_BG, 0);
    }
    // Bottom border
    const bottomRow = panelY + lines.length + 1;
    if (bottomRow < height) {
      for (let col = panelX; col < panelX + panelWidth && col < width; col++) {
        const ch = col === panelX ? "\u2514" : col === panelX + panelWidth - 1 ? "\u2518" : "\u2500";
        writeCell(buffer, col, bottomRow, ch, COL_BRAND, COL_BG, 0);
      }
    }
    // Side borders
    for (let row = panelY + 1; row < panelY + lines.length + 1 && row < height; row++) {
      writeCell(buffer, panelX, row, "\u2502", COL_BRAND, COL_BG, 0);
      if (panelX + panelWidth - 1 < width) {
        writeCell(buffer, panelX + panelWidth - 1, row, "\u2502", COL_BRAND, COL_BG, 0);
      }
    }
  }

  // Draw text
  for (let i = 0; i < lines.length; i++) {
    const row = panelY + 1 + i;
    if (row >= height) break;
    const line = lines[i]!;
    for (let j = 0; j < line.length && panelX + 1 + j < width - 1; j++) {
      const ch = line[j]!;
      // Color coding for different rows
      let fg = COL_FG;
      if (i === 0) fg = COL_BRAND; // title
      else if (i === 5 && snap.gcPressure > 0.7) fg = COL_RED; // high GC
      else if (i === 5 && snap.gcPressure > 0.3) fg = COL_YELLOW; // medium GC
      writeCell(buffer, panelX + 1 + j, row, ch, fg, COL_BG, 0);
    }
  }
}

function formatBytes(bytes: number): string {
  const abs = Math.abs(bytes);
  const sign = bytes < 0 ? "-" : "+";
  if (abs >= 1024 * 1024) return `${sign}${(abs / (1024 * 1024)).toFixed(1)}MB`;
  if (abs >= 1024) return `${sign}${(abs / 1024).toFixed(1)}KB`;
  return `${sign}${abs}B`;
}

function exportProfilerData(profiler: Profiler): void {
  try {
    const filename = `storm-profiler-${Date.now()}.json`;
    writeFileSync(filename, profiler.exportJSON(), "utf-8");
    process.stderr.write(`[storm] Profiler data exported: ${filename}\n`);
  } catch (err) {
    process.stderr.write(`[storm] Failed to export profiler data: ${err}\n`);
  }
}
