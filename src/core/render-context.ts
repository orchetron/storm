/**
 * RenderContext — encapsulates all per-instance mutable state.
 *
 * Each call to render() creates a new RenderContext, eliminating
 * module-level singletons and enabling multi-instance use and testing.
 */

import { FocusManager } from "./focus.js";
import { ScreenBuffer } from "./buffer.js";
import { AnimationScheduler } from "./animation-scheduler.js";
import type { MeasuredLayout } from "../reconciler/renderer.js";
import type { ResizeObserver } from "./resize-observer.js";
import { colors as defaultColors, type StormColors } from "../theme/colors.js";

export interface LinkRange {
  url: string;
  y: number;
  x1: number;
  x2: number;
}

export interface DirtyRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderMetrics {
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

export interface ScrollViewFrame {
  scrollTop: number;
  screenY1: number;  // viewport top row on screen
  screenY2: number;  // viewport bottom row on screen
  screenX1: number;  // viewport left col
  screenX2: number;  // viewport right col
}

export class RenderContext {
  /** Focus manager for this render instance. */
  readonly focus: FocusManager;
  /** Layout measurements populated during each paint pass. */
  readonly measureMap: Map<string, MeasuredLayout>;
  /** Active resize observers for this render instance. */
  readonly resizeObservers: Set<ResizeObserver>;
  /** Link ranges populated during paint — consumed by the diff renderer for OSC 8 output. */
  links: LinkRange[] = [];
  /** Cleanup functions registered by components. Called on unmount. */
  readonly cleanups: Map<string, () => void>;
  /** Async cleanup functions registered by components. Awaited on unmount after sync cleanups. */
  readonly asyncCleanups: Map<string, () => Promise<void>>;
  /** Global animation scheduler — single timer for all animations. */
  readonly animationScheduler: AnimationScheduler;

  // ── Renderer state ──────────────────────────────────────────────
  /** Cursor position for focused TextInput (-1 if none). Set during paint. */
  cursorX = -1;
  cursorY = -1;
  /** Reusable buffer — avoids allocation on every frame. */
  buffer: ScreenBuffer | null = null;
  /** Whether layout has been computed for the current tree. */
  layoutBuilt = false;
  /** Set to true when layout is invalidated (content change). Cleared after flush.
   *  When true, scroll region optimization (DECSTBM) is skipped because
   *  content changed — DECSTBM only works for pure scroll operations. */
  layoutInvalidated = false;
  /** Width used for the last layout computation. */
  lastLayoutWidth = 0;
  /** Height used for the last layout computation. */
  lastLayoutHeight = 0;
  /** Monotonically increasing version for styled-run cache invalidation. */
  runsVersion = 1;

  /** Scroll state per ScrollView for native scroll optimization */
  scrollViewStates: Map<string, ScrollViewFrame> = new Map();
  prevScrollViewStates: Map<string, ScrollViewFrame> = new Map();

  // ── Pending image sequences ─────────────────────────────────────
  /** Graphics protocol escape sequences to write AFTER the diff renderer output.
   *  Populated by the Image component; consumed by screen.flush(). */
  pendingImageSequences: { seq: string; row: number; col: number }[] = [];
  /**
   * Tracks image sequences that have already been emitted to the terminal.
   * Key: `${row},${col}` — the layout position of the image spacer box.
   * Value: the escape sequence string that was written.
   *
   * On each paint pass, paintBox checks this map before queuing a sequence:
   * - If the key exists AND the value matches, the image is unchanged → skip.
   * - If the key is missing or the value differs (src changed) → queue it.
   *
   * After each paint, emittedImages is pruned to only keep entries that were
   * seen in the current frame (handles unmount cleanup).
   */
  readonly emittedImages: Map<string, string> = new Map();
  /** Image position keys seen during the current paint pass. */
  private _currentFrameImageKeys: Set<string> = new Set();

  /**
   * Image regions that the diff renderer must SKIP (not overwrite).
   * Key: row number, Value: array of {x1, x2} column ranges.
   * Populated by paintBox, consumed by diff renderer.
   */
  imageRegions: Map<number, { x1: number; x2: number }[]> = new Map();

  /** Called by paintBox when an image element is encountered. */
  trackImageForFrame(key: string): void {
    this._currentFrameImageKeys.add(key);
  }

  /** Register an image region so the diff renderer skips those cells. */
  addImageRegion(x: number, y: number, w: number, h: number): void {
    for (let row = y; row < y + h; row++) {
      let ranges = this.imageRegions.get(row);
      if (!ranges) { ranges = []; this.imageRegions.set(row, ranges); }
      ranges.push({ x1: x, x2: x + w });
    }
  }

  /**
   * Called after each paint pass to prune emittedImages of entries
   * that are no longer in the tree (component unmounted).
   */
  pruneStaleImages(): void {
    for (const k of this.emittedImages.keys()) {
      if (!this._currentFrameImageKeys.has(k)) {
        this.emittedImages.delete(k);
      }
    }
    this._currentFrameImageKeys.clear();
    this.imageRegions.clear();
  }

  // ── Dirty region tracking ────────────────────────────────────────
  /** Regions marked as needing repaint. Empty array means full repaint. */
  dirtyRegions: DirtyRegion[] = [];

  // ── Render metrics ───────────────────────────────────────────────
  /** Active theme colors — set by render() from ThemeProvider, used by renderer for fallback colors. */
  theme: StormColors = defaultColors;

  /** Latest render metrics, updated after each frame. */
  metrics: RenderMetrics = {
    lastRenderTimeMs: 0,
    fps: 0,
    cellsChanged: 0,
    totalCells: 0,
    frameCount: 0,
  };

  constructor() {
    this.focus = new FocusManager();
    this.measureMap = new Map();
    this.resizeObservers = new Set();
    this.cleanups = new Map();
    this.asyncCleanups = new Map();
    this.animationScheduler = new AnimationScheduler();
  }

  /** Prepare for next frame — swap current states to prev */
  swapScrollStates(): void {
    this.prevScrollViewStates = new Map(this.scrollViewStates);
    this.scrollViewStates.clear();
  }

  // ── Cleanup API ─────────────────────────────────────────────────────

  /** Remove measurement data for a component. */
  removeMeasure(id: string): void {
    this.measureMap.delete(id);
  }

  /** Remove a resize observer instance. */
  removeResizeObserver(observer: ResizeObserver): void {
    this.resizeObservers.delete(observer);
  }

  /**
   * Purge stale measurement entries not in the active tree.
   * Call periodically to prevent unbounded growth of measureMap.
   */
  purgeStaleMeasurements(activeIds: Set<string>): void {
    for (const id of this.measureMap.keys()) {
      if (!activeIds.has(id)) this.measureMap.delete(id);
    }
  }

  /** Mark layout as dirty — must be rebuilt on next paint. */
  invalidateLayout(): void {
    this.layoutBuilt = false;
    this.layoutInvalidated = true;
  }

  // ── Dirty region API ─────────────────────────────────────────────

  /** Mark a rectangular region as needing repaint. */
  markDirty(region: DirtyRegion): void {
    this.dirtyRegions.push(region);
  }

  /** Clear all dirty regions (called after a frame is painted). */
  clearDirty(): void {
    this.dirtyRegions = [];
    this.layoutInvalidated = false;
  }

  /**
   * Returns true when no specific dirty regions have been marked,
   * meaning the entire screen should be repainted.
   */
  isFullyDirty(): boolean {
    return this.dirtyRegions.length === 0;
  }
}
