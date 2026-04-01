/**
 * DevTools — terminal-based inspector, tree viewer, performance monitor,
 * event logger, and overlay panel.
 *
 * Usage:
 * ```ts
 * import {
 *   createDevToolsOverlay,
 *   createEventLogger,
 *   createPerformanceMonitor,
 * } from "@orchetron/storm-tui";
 *
 * const perf = createPerformanceMonitor();
 * const logger = createEventLogger();
 * const devtools = createDevToolsOverlay({ panelHeight: 14 });
 *
 * pipeline.use(devtools.middleware);
 * devtools.setRoot(root);
 * devtools.toggle(); // show overlay
 *
 * // Each frame:
 * devtools.setMetrics(perf.getMetrics());
 * devtools.setEvents(logger.getEvents());
 * ```
 */

export { createInspectorMiddleware, type InspectorState } from "./inspector.js";
export { serializeTree } from "./tree-view.js";
export { createPerformanceMonitor, type RenderMetrics } from "./performance-monitor.js";
export { createEventLogger, type LoggedEvent } from "./event-logger.js";
export {
  createDevToolsOverlay,
  type DevToolsOverlayOptions,
  type DevToolsPanel,
} from "./devtools-overlay.js";
export {
  createRenderHeatmap,
  type HeatmapOptions,
} from "./render-heatmap.js";
export {
  createTimeTravel,
  type FrameSnapshot,
  type TimeTravelState,
} from "./time-travel.js";
export {
  createAccessibilityAudit,
  type AccessibilityViolation,
  type AuditOptions,
  type AuditReport,
} from "./accessibility-audit.js";
export {
  enableDevTools,
  type EnableDevToolsOptions,
  type DevToolsHandle,
} from "./enable.js";
export {
  createProfiler,
  type Profiler,
  type ProfilerSnapshot,
  type FrameTiming,
  type ProfilerAlertCallback,
} from "./profiler.js";
export {
  setActiveProfiler,
  getActiveProfiler,
} from "./profiler-registry.js";
export {
  enableCrashLog,
  type CrashLogOptions,
  type CrashLogData,
} from "./crash-log.js";
