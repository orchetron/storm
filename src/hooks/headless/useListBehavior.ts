/**
 * useListBehavior — headless behavior hook for navigable lists.
 *
 * Extracts highlight index, keyboard navigation (up/down/home/end with wrap),
 * filter text, and selection from ListView and SelectInput components.
 *
 * Returns state + props objects with no JSX.
 */

import { useRef, useCallback } from "react";
import { useInput } from "../useInput.js";
import { useForceUpdate } from "../useForceUpdate.js";
import type { KeyEvent } from "../../input/types.js";

export interface ListBehaviorItem {
  key: string;
  label: string;
  description?: string;
  icon?: string;
}

export interface UseListBehaviorOptions {
  items: readonly ListBehaviorItem[];
  selectedKey?: string;
  onSelect?: (key: string) => void;
  onHighlight?: (key: string) => void;
  isActive?: boolean;
  maxVisible?: number;
  initialIndex?: number;
}

export interface UseListBehaviorResult {
  /** Index of the currently highlighted item in the filtered list */
  highlightIndex: number;
  /** Current filter text from type-ahead */
  filterText: string;
  /** Filtered items based on current filter text */
  filteredItems: readonly ListBehaviorItem[];
  /** Visible items after maxVisible windowing */
  visibleItems: readonly ListBehaviorItem[];
  /** Offset of visible window into filteredItems */
  visibleOffset: number;
  /** Whether there are hidden items above the visible window */
  hasOverflowTop: boolean;
  /** Whether there are hidden items below the visible window */
  hasOverflowBottom: boolean;
  /** Total count of all items (unfiltered) */
  totalCount: number;
  /** Props for the highlighted item's container */
  highlightProps: {
    index: number;
    key: string | undefined;
  };
  /** Get props for each item by its index in the visible list */
  getItemProps: (visibleIndex: number) => {
    isHighlighted: boolean;
    item: ListBehaviorItem;
    globalIndex: number;
  };
}

export function useListBehavior(options: UseListBehaviorOptions): UseListBehaviorResult {
  const {
    items,
    selectedKey,
    onSelect,
    onHighlight,
    isActive = true,
    maxVisible = 10,
    initialIndex = 0,
  } = options;

  const forceUpdate = useForceUpdate();

  const highlightIndexRef = useRef(initialIndex);
  const filterTextRef = useRef("");

  // Refs for latest prop values
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onHighlightRef = useRef(onHighlight);
  onHighlightRef.current = onHighlight;

  // Compute filtered items
  const filter = filterTextRef.current.toLowerCase();
  const filteredItems: readonly ListBehaviorItem[] = filter
    ? items.filter((it) => it.label.toLowerCase().includes(filter))
    : items;

  // Clamp highlight
  if (highlightIndexRef.current >= filteredItems.length) {
    highlightIndexRef.current = Math.max(0, filteredItems.length - 1);
  }
  const effectiveIndex = filteredItems.length > 0
    ? Math.min(highlightIndexRef.current, Math.max(0, filteredItems.length - 1))
    : 0;

  // Notify onHighlight on index changes
  const prevIndexRef = useRef(effectiveIndex);
  if (onHighlight && effectiveIndex !== prevIndexRef.current && filteredItems.length > 0) {
    const item = filteredItems[effectiveIndex];
    if (item) {
      onHighlight(item.key);
    }
  }
  prevIndexRef.current = effectiveIndex;

  const handleInput = useCallback(
    (event: KeyEvent) => {
      const allItems = itemsRef.current;
      if (allItems.length === 0) return;

      const getFiltered = (): readonly ListBehaviorItem[] => {
        if (!filterTextRef.current) return allItems;
        const lower = filterTextRef.current.toLowerCase();
        return allItems.filter((it) => it.label.toLowerCase().includes(lower));
      };

      if (event.key === "up") {
        const filtered = getFiltered();
        if (filtered.length === 0) return;
        highlightIndexRef.current = highlightIndexRef.current > 0
          ? highlightIndexRef.current - 1
          : filtered.length - 1;
        forceUpdate();
        const item = filtered[highlightIndexRef.current];
        if (item) onHighlightRef.current?.(item.key);
      } else if (event.key === "down") {
        const filtered = getFiltered();
        if (filtered.length === 0) return;
        highlightIndexRef.current = highlightIndexRef.current < filtered.length - 1
          ? highlightIndexRef.current + 1
          : 0;
        forceUpdate();
        const item = filtered[highlightIndexRef.current];
        if (item) onHighlightRef.current?.(item.key);
      } else if (event.key === "home") {
        highlightIndexRef.current = 0;
        forceUpdate();
        const filtered = getFiltered();
        const item = filtered[0];
        if (item) onHighlightRef.current?.(item.key);
      } else if (event.key === "end") {
        const filtered = getFiltered();
        highlightIndexRef.current = Math.max(0, filtered.length - 1);
        forceUpdate();
        const item = filtered[highlightIndexRef.current];
        if (item) onHighlightRef.current?.(item.key);
      } else if (event.key === "return") {
        const filtered = getFiltered();
        const idx = Math.min(highlightIndexRef.current, Math.max(0, filtered.length - 1));
        const item = filtered[idx];
        if (item && onSelectRef.current) {
          onSelectRef.current(item.key);
        }
      } else if (event.key === "escape") {
        if (filterTextRef.current) {
          filterTextRef.current = "";
          highlightIndexRef.current = 0;
          forceUpdate();
        }
      } else if (event.key === "backspace") {
        if (filterTextRef.current.length > 0) {
          filterTextRef.current = filterTextRef.current.slice(0, -1);
          highlightIndexRef.current = 0;
          forceUpdate();
        }
      } else if (event.char && event.char.length === 1 && !event.ctrl && !event.meta) {
        filterTextRef.current += event.char;
        highlightIndexRef.current = 0;
        forceUpdate();
      }
    },
    [forceUpdate],
  );

  useInput(handleInput, { isActive });

  // Compute visible window
  const totalFiltered = filteredItems.length;
  const visibleCount = Math.min(maxVisible, totalFiltered);

  let scrollStart = 0;
  if (totalFiltered > visibleCount) {
    const half = Math.floor(visibleCount / 2);
    scrollStart = Math.max(0, effectiveIndex - half);
    scrollStart = Math.min(scrollStart, totalFiltered - visibleCount);
  }

  const visibleItems = filteredItems.slice(scrollStart, scrollStart + visibleCount);
  const hasOverflowTop = scrollStart > 0;
  const hasOverflowBottom = scrollStart + visibleCount < totalFiltered;

  const highlightedItem = filteredItems[effectiveIndex];

  const getItemProps = useCallback((visibleIndex: number) => {
    const globalIndex = scrollStart + visibleIndex;
    return {
      isHighlighted: globalIndex === effectiveIndex,
      item: visibleItems[visibleIndex]!,
      globalIndex,
    };
  }, [visibleItems, scrollStart, effectiveIndex]);

  return {
    highlightIndex: effectiveIndex,
    filterText: filterTextRef.current,
    filteredItems,
    visibleItems,
    visibleOffset: scrollStart,
    hasOverflowTop,
    hasOverflowBottom,
    totalCount: items.length,
    highlightProps: {
      index: effectiveIndex,
      key: highlightedItem?.key,
    },
    getItemProps,
  };
}
