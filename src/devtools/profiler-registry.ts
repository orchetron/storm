/**
 * Profiler registry -- module-level singleton so useProfiler() can
 * access the active profiler without prop-drilling or context.
 *
 * Only one profiler can be active at a time per process.
 */

import type { Profiler } from "./profiler.js";

let _activeProfiler: Profiler | null = null;

export function setActiveProfiler(profiler: Profiler | null): void {
  _activeProfiler = profiler;
}

export function getActiveProfiler(): Profiler | null {
  return _activeProfiler;
}
