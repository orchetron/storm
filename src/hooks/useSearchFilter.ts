/**
 * useSearchFilter — debounced search/filter with match info.
 *
 * Filters items by case-insensitive substring match.
 * Debounces the filter computation.
 *
 * Uses useRef + forceUpdate() + useCleanup.
 */

import { useRef } from "react";
import { useCleanup } from "./useCleanup.js";
import { useForceUpdate } from "./useForceUpdate.js";

export interface UseSearchFilterOptions<T> {
  items: T[];
  getLabel: (item: T) => string;
  debounceMs?: number;
  isActive?: boolean;
}

export interface UseSearchFilterResult<T> {
  query: string;
  setQuery: (q: string) => void;
  filtered: T[];
  matchCount: number;
  clear: () => void;
}

export function useSearchFilter<T>(options: UseSearchFilterOptions<T>): UseSearchFilterResult<T> {
  const { items, getLabel, debounceMs = 150, isActive = true } = options;
  const forceUpdate = useForceUpdate();

  const queryRef = useRef("");
  const filteredRef = useRef<T[]>(items);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsRef = useRef(items);
  const getLabelRef = useRef(getLabel);
  getLabelRef.current = getLabel;

  // Re-filter when items change by reference
  if (itemsRef.current !== items) {
    itemsRef.current = items;
    if (queryRef.current === "") {
      filteredRef.current = items;
    } else {
      const q = queryRef.current.toLowerCase();
      filteredRef.current = items.filter((item) =>
        getLabelRef.current(item).toLowerCase().includes(q),
      );
    }
  }

  const applyFilter = () => {
    const q = queryRef.current.toLowerCase();
    if (q === "") {
      filteredRef.current = itemsRef.current;
    } else {
      filteredRef.current = itemsRef.current.filter((item) =>
        getLabelRef.current(item).toLowerCase().includes(q),
      );
    }
    forceUpdate();
  };

  const setQuery = (q: string) => {
    if (!isActive) return;
    queryRef.current = q;

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    if (debounceMs <= 0) {
      applyFilter();
    } else {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        applyFilter();
      }, debounceMs);
    }

    forceUpdate();
  };

  const clear = () => {
    queryRef.current = "";
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    filteredRef.current = itemsRef.current;
    forceUpdate();
  };

  useCleanup(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  });

  return {
    query: queryRef.current,
    setQuery,
    filtered: filteredRef.current,
    matchCount: filteredRef.current.length,
    clear,
  };
}
