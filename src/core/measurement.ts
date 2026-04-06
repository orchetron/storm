import type { MeasuredLayout } from "../reconciler/renderer.js";

export function getBoundingBox(elementId: string, measureMap: Map<string, MeasuredLayout>): { x: number; y: number; width: number; height: number } | null {
  return measureMap.get(elementId) ?? null;
}

export function getWidth(elementId: string, measureMap: Map<string, MeasuredLayout>): number | null {
  return measureMap.get(elementId)?.width ?? null;
}

export function getHeight(elementId: string, measureMap: Map<string, MeasuredLayout>): number | null {
  return measureMap.get(elementId)?.height ?? null;
}

/** Find the smallest element containing the given screen coordinates. */
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

