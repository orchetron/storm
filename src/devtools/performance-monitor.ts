/**
 * Performance monitor — tracks render pipeline timing metrics.
 *
 * Hooks into the paint/diff/flush stages to measure per-frame costs.
 * Maintains a rolling FPS average over a 1-second window.
 */

export interface PerformanceMetrics {
  /** Total frames recorded. */
  frameCount: number;
  /** Duration of the last paint stage in ms. */
  lastPaintMs: number;
  /** Duration of the last diff stage in ms. */
  lastDiffMs: number;
  /** Duration of the last flush stage in ms. */
  lastFlushMs: number;
  /** Rolling average frames per second (1-second window). */
  avgFps: number;
  /** Number of cells changed in the last frame. */
  cellsChanged: number;
  /** Total cells in the buffer (width * height). */
  totalCells: number;
}

export function createPerformanceMonitor(): {
  onPaintStart: () => void;
  onPaintEnd: () => void;
  onDiffStart: () => void;
  onDiffEnd: () => void;
  onFlushStart: () => void;
  onFlushEnd: (cellsChanged?: number, totalCells?: number) => void;
  getMetrics: () => PerformanceMetrics;
  reset: () => void;
} {
  let paintStart = 0;
  let diffStart = 0;
  let flushStart = 0;

  const metrics: PerformanceMetrics = {
    frameCount: 0,
    lastPaintMs: 0,
    lastDiffMs: 0,
    lastFlushMs: 0,
    avgFps: 0,
    cellsChanged: 0,
    totalCells: 0,
  };

  // Rolling FPS — count frames within a 1-second window
  let fpsWindowStart = performance.now();
  let fpsFrameCount = 0;

  function tickFps(): void {
    fpsFrameCount++;
    const now = performance.now();
    const elapsed = now - fpsWindowStart;
    if (elapsed >= 1000) {
      metrics.avgFps = Math.round((fpsFrameCount / elapsed) * 1000);
      fpsFrameCount = 0;
      fpsWindowStart = now;
    }
  }

  return {
    onPaintStart() {
      paintStart = performance.now();
    },
    onPaintEnd() {
      metrics.lastPaintMs = performance.now() - paintStart;
    },
    onDiffStart() {
      diffStart = performance.now();
    },
    onDiffEnd() {
      metrics.lastDiffMs = performance.now() - diffStart;
    },
    onFlushStart() {
      flushStart = performance.now();
    },
    onFlushEnd(cellsChanged?: number, totalCells?: number) {
      metrics.lastFlushMs = performance.now() - flushStart;
      metrics.frameCount++;
      if (cellsChanged !== undefined) metrics.cellsChanged = cellsChanged;
      if (totalCells !== undefined) metrics.totalCells = totalCells;
      tickFps();
    },
    getMetrics() {
      return { ...metrics };
    },
    reset() {
      metrics.frameCount = 0;
      metrics.lastPaintMs = 0;
      metrics.lastDiffMs = 0;
      metrics.lastFlushMs = 0;
      metrics.avgFps = 0;
      metrics.cellsChanged = 0;
      metrics.totalCells = 0;
      fpsWindowStart = performance.now();
      fpsFrameCount = 0;
    },
  };
}
