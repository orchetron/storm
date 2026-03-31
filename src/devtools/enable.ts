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
 *   3 — Time-Travel Debugging (←→ to scrub)
 *   4 — DevTools Overlay ([] panels, jk navigate, space toggle)
 *
 * All overlays are non-blocking — the app keeps running underneath.
 * Input is handled via the app's InputManager — no external wiring needed.
 */

import type { TuiApp } from "../reconciler/render.js";
import { createTimeTravel } from "./time-travel.js";
import { createRenderHeatmap } from "./render-heatmap.js";
import { createAccessibilityAudit } from "./accessibility-audit.js";
import { createDevToolsOverlay } from "./devtools-overlay.js";
import { createPerformanceMonitor } from "./performance-monitor.js";
import { createEventLogger } from "./event-logger.js";

export interface EnableDevToolsOptions {
  /** Key to toggle heatmap (default: "1") */
  heatmapKey?: string;
  /** Key to toggle accessibility audit (default: "2") */
  auditKey?: string;
  /** Key to toggle time-travel (default: "3") */
  timeTravelKey?: string;
  /** Key to toggle DevTools overlay (default: "4") */
  overlayKey?: string;
  /** DevTools panel height (default: 12) */
  panelHeight?: number;
  /** Max time-travel frames to store (default: 120) */
  maxFrames?: number;
  /** WCAG minimum contrast ratio (default: 4.5 for AA) */
  minContrast?: number;
}

export interface DevToolsHandle {
  /** Destroy all DevTools (remove middleware, input handlers) */
  destroy: () => void;
}

export function enableDevTools(
  app: TuiApp,
  options?: EnableDevToolsOptions,
): DevToolsHandle {
  const heatmapKey = options?.heatmapKey ?? "1";
  const auditKey = options?.auditKey ?? "2";
  const timeTravelKey = options?.timeTravelKey ?? "3";
  const overlayKey = options?.overlayKey ?? "4";

  // Create all devtools instances
  const timeTravel = createTimeTravel({ maxFrames: options?.maxFrames ?? 120 });
  const heatmap = createRenderHeatmap({ cooldownFrames: 15, opacity: 0.6 });
  const a11yAudit = createAccessibilityAudit({ minContrast: options?.minContrast ?? 4.5 });
  const perfMonitor = createPerformanceMonitor();
  const eventLogger = createEventLogger(50);
  const devtools = createDevToolsOverlay({
    panelHeight: options?.panelHeight ?? 12,
  });

  // Wire the element tree
  devtools.setRoot(app.root);

  // Register middleware (order: time-travel first, devtools overlay last = on top)
  app.middleware.use(timeTravel.middleware);
  app.middleware.use(heatmap.middleware);
  app.middleware.use(a11yAudit.middleware);

  // Bridge middleware: feeds perf + events to devtools each frame
  app.middleware.use({
    name: "devtools-bridge",
    onPaint(buffer, width, height) {
      // Tick perf monitor (approximate — real timing would need hooks in render loop)
      perfMonitor.onPaintStart();
      perfMonitor.onPaintEnd();
      perfMonitor.onDiffStart();
      perfMonitor.onDiffEnd();
      perfMonitor.onFlushStart();
      perfMonitor.onFlushEnd();
      devtools.setMetrics(perfMonitor.getMetrics());
      devtools.setEvents(eventLogger.getEvents());
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

  // Handle all DevTools keyboard shortcuts in one place
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

    // Toggle shortcuts
    if (event.char === heatmapKey) { heatmap.toggle(); app.requestRepaint(); return; }
    if (event.char === auditKey) { a11yAudit.toggle(); app.requestRepaint(); return; }
    if (event.char === timeTravelKey) { timeTravel.toggle(); app.requestRepaint(); return; }
    if (event.char === overlayKey) { devtools.toggle(); app.requestRepaint(); return; }
  });

  return {
    destroy() {
      removeKeyLogger();
      removeMouseLogger();
      removeKeyHandler();
      app.middleware.remove("time-travel");
      app.middleware.remove("render-heatmap");
      app.middleware.remove("accessibility-audit");
      app.middleware.remove("devtools-bridge");
      app.middleware.remove("devtools-overlay");
    },
  };
}
