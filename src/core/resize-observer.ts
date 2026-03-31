/**
 * ResizeObserver — monitors element size changes across paint cycles.
 *
 * Observes elements by their _measureId and fires a callback whenever
 * the measured layout dimensions change between paints.
 */

import type { MeasuredLayout } from "../reconciler/renderer.js";

export interface ResizeObserverEntry {
  readonly target: string; // element _measureId
  readonly contentRect: { width: number; height: number };
}

type ResizeObserverCallback = (entries: ResizeObserverEntry[]) => void;

/** The current measureMap used by notifyResizeObservers. Set by the renderer. */
let currentMeasureMap: Map<string, MeasuredLayout> | null = null;

/** The current active observers set, provided by RenderContext. */
let currentObserversSet: Set<ResizeObserver> | null = null;

/** Set the current measure map for resize observers to read from. */
export function setResizeObserverMeasureMap(
  measureMap: Map<string, MeasuredLayout>,
  observers: Set<ResizeObserver>,
): void {
  currentMeasureMap = measureMap;
  currentObserversSet = observers;
}

export class ResizeObserver {
  private readonly _callback: ResizeObserverCallback;
  private readonly _observed = new Set<string>();
  private readonly _lastSizes = new Map<string, { width: number; height: number }>();
  private readonly _ownerSet: Set<ResizeObserver>;

  constructor(callback: ResizeObserverCallback, ownerSet?: Set<ResizeObserver>) {
    this._callback = callback;
    this._ownerSet = ownerSet ?? (currentObserversSet ?? new Set());
  }

  observe(elementId: string): void {
    this._observed.add(elementId);
    this._ownerSet.add(this);
  }

  unobserve(elementId: string): void {
    this._observed.delete(elementId);
    this._lastSizes.delete(elementId);
    if (this._observed.size === 0) {
      this._ownerSet.delete(this);
    }
  }

  disconnect(): void {
    this._observed.clear();
    this._lastSizes.clear();
    this._ownerSet.delete(this);
  }

  /** @internal — called by notifyResizeObservers after each paint. */
  _check(measureMap: Map<string, MeasuredLayout>): void {
    const entries: ResizeObserverEntry[] = [];

    for (const id of this._observed) {
      const layout: MeasuredLayout | undefined = measureMap.get(id);
      if (!layout) continue;

      const last = this._lastSizes.get(id);
      if (!last || last.width !== layout.width || last.height !== layout.height) {
        this._lastSizes.set(id, { width: layout.width, height: layout.height });
        entries.push({
          target: id,
          contentRect: { width: layout.width, height: layout.height },
        });
      }
    }

    if (entries.length > 0) {
      this._callback(entries);
    }
  }
}

/** Called at the end of each repaint() to fire resize observers. */
export function notifyResizeObservers(): void {
  if (!currentMeasureMap || !currentObserversSet) return;
  for (const observer of currentObserversSet) {
    observer._check(currentMeasureMap);
  }
}
