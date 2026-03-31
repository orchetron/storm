/**
 * useVirtualList — virtual list hook for efficiently rendering large datasets.
 *
 * Only computes the visible slice of items (plus overscan), avoiding the cost
 * of creating React elements for thousands of off-screen rows.
 *
 * Uses requestRender() instead of React state for instant scroll response.
 */

import { useRef, useCallback } from "react";
import { useTui } from "../context/TuiContext.js";

export interface VirtualListOptions<T> {
  /** All items in the list */
  items: readonly T[];
  /** Height of each item in rows (default 1) */
  itemHeight?: number;
  /** Visible viewport height in rows */
  viewportHeight: number;
  /** Number of items to render outside viewport (default 3) */
  overscan?: number;
}

export interface VirtualListResult<T> {
  /** Items to actually render (visible + overscan) */
  visibleItems: Array<{ item: T; index: number; offsetY: number }>;
  /** Total content height */
  totalHeight: number;
  /** Current scroll offset */
  scrollTop: number;
  /** Scroll to a specific index */
  scrollTo: (index: number) => void;
  /** Scroll to top */
  scrollToTop: () => void;
  /** Scroll to bottom */
  scrollToBottom: () => void;
  /** Handle scroll delta (from mouse wheel) */
  onScroll: (delta: number) => void;
}

export function useVirtualList<T>(options: VirtualListOptions<T>): VirtualListResult<T> {
  const { items, itemHeight = 1, viewportHeight, overscan = 3 } = options;
  const { requestRender } = useTui();

  const scrollTopRef = useRef(0);

  const totalHeight = items.length * itemHeight;
  const maxScroll = Math.max(0, totalHeight - viewportHeight);

  // Clamp scrollTop if content shrunk
  if (scrollTopRef.current > maxScroll) {
    scrollTopRef.current = maxScroll;
  }

  const clamp = (value: number): number =>
    Math.max(0, Math.min(maxScroll, value));

  const scrollTo = useCallback((index: number) => {
    const target = index * itemHeight;
    scrollTopRef.current = clamp(target);
    requestRender();
  }, [itemHeight, maxScroll, requestRender]);

  const scrollToTop = useCallback(() => {
    scrollTopRef.current = 0;
    requestRender();
  }, [requestRender]);

  const scrollToBottom = useCallback(() => {
    scrollTopRef.current = maxScroll;
    requestRender();
  }, [maxScroll, requestRender]);

  const onScroll = useCallback((delta: number) => {
    scrollTopRef.current = clamp(scrollTopRef.current + delta);
    requestRender();
  }, [maxScroll, requestRender]);

  // Calculate visible range
  const scrollTop = scrollTopRef.current;
  const rawStart = Math.floor(scrollTop / itemHeight);
  const rawEnd = rawStart + Math.ceil(viewportHeight / itemHeight);

  // Apply overscan and clamp to bounds
  const startIndex = Math.max(0, rawStart - overscan);
  const endIndex = Math.min(items.length - 1, rawEnd + overscan);

  const visibleItems: Array<{ item: T; index: number; offsetY: number }> = [];
  for (let i = startIndex; i <= endIndex; i++) {
    visibleItems.push({
      item: items[i]!,
      index: i,
      offsetY: i * itemHeight - scrollTop,
    });
  }

  return {
    visibleItems,
    totalHeight,
    scrollTop,
    scrollTo,
    scrollToTop,
    scrollToBottom,
    onScroll,
  };
}
