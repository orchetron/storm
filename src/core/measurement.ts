/**
 * Measurement utilities — query element layout from a measureMap.
 *
 * These functions read from a measureMap (typically obtained from
 * RenderContext.measureMap) populated during each paint pass.
 * Elements must have a `_measureId` prop to be tracked.
 */

import type { MeasuredLayout } from "../reconciler/renderer.js";

/**
 * Get the bounding box of an element by its measureId.
 * Returns null if the element is not found in the layout map.
 */
export function getBoundingBox(elementId: string, measureMap: Map<string, MeasuredLayout>): { x: number; y: number; width: number; height: number } | null {
  return measureMap.get(elementId) ?? null;
}

/**
 * Get the inner width of an element (width minus borders/padding).
 * Returns null if the element is not found.
 */
export function getInnerWidth(elementId: string, measureMap: Map<string, MeasuredLayout>): number | null {
  const layout = measureMap.get(elementId);
  if (!layout) return null;
  // measureMap stores the full layout dimensions;
  // inner dimensions would require border/padding info which isn't stored.
  // Return the width as a best approximation.
  return layout.width;
}

/**
 * Get the inner height of an element (height minus borders/padding).
 * Returns null if the element is not found.
 */
export function getInnerHeight(elementId: string, measureMap: Map<string, MeasuredLayout>): number | null {
  const layout = measureMap.get(elementId);
  if (!layout) return null;
  return layout.height;
}

/**
 * Hit-test: find the smallest element containing the given screen coordinates.
 * Returns the elementId and coordinates, or null if no element contains the point.
 */
export function hitTest(x: number, y: number, measureMap: Map<string, MeasuredLayout>): { elementId: string; x: number; y: number } | null {
  let bestId: string | null = null;
  let bestArea = Infinity;

  for (const [id, layout] of measureMap) {
    if (
      x >= layout.x &&
      x < layout.x + layout.width &&
      y >= layout.y &&
      y < layout.y + layout.height
    ) {
      const area = layout.width * layout.height;
      if (area < bestArea) {
        bestArea = area;
        bestId = id;
      }
    }
  }

  if (bestId === null) return null;
  return { elementId: bestId, x, y };
}

