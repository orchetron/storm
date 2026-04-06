/**
 * Find the next navigable index in the given direction, wrapping around.
 *
 * @param count      Total number of items.
 * @param from       Current index to start searching from (exclusive).
 * @param direction  +1 for forward, -1 for backward.
 * @param isNavigable  Predicate returning true if the item at the given index is navigable.
 * @param fallback   Value to return when no navigable index is found. Defaults to `from`.
 * @returns The next navigable index, or `fallback` if none exists.
 */
export function findNextNavigable(
  count: number,
  from: number,
  direction: 1 | -1,
  isNavigable: (index: number) => boolean,
  fallback?: number,
): number {
  if (count === 0) return fallback ?? from;
  for (let i = 0; i < count; i++) {
    const idx = ((from + direction * (i + 1)) % count + count) % count;
    if (isNavigable(idx)) return idx;
  }
  return fallback ?? from;
}

/**
 * Compute a scroll window that keeps the active item centered when possible.
 *
 * @param total        Total number of items.
 * @param activeIndex  Index of the currently active item.
 * @param maxVisible   Maximum number of items visible at once.
 * @returns `{ start, end }` — the slice range for the visible window.
 */
export function computeScrollWindow(
  total: number,
  activeIndex: number,
  maxVisible: number,
): { start: number; end: number } {
  if (total <= maxVisible) return { start: 0, end: total };
  const halfPage = Math.floor(maxVisible / 2);
  let start = Math.max(0, activeIndex - halfPage);
  start = Math.min(start, total - maxVisible);
  const end = start + maxVisible;
  return { start, end };
}

/**
 * Find the first navigable index (scanning forward from index 0).
 *
 * @param count       Total number of items.
 * @param isNavigable Predicate returning true if the item at the given index is navigable.
 * @param fallback    Value to return when no navigable index is found. Defaults to 0.
 * @returns The first navigable index, or `fallback` if none exists.
 */
export function findFirstNavigable(
  count: number,
  isNavigable: (index: number) => boolean,
  fallback: number = 0,
): number {
  for (let i = 0; i < count; i++) {
    if (isNavigable(i)) return i;
  }
  return fallback;
}
