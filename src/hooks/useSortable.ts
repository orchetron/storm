import { useRef } from "react";
import { useForceUpdate } from "./useForceUpdate.js";

export interface UseSortableOptions {
  columns: string[]; // sortable column keys
  defaultSort?: { key: string; direction: "asc" | "desc" };
  isActive?: boolean;
  onSort?: (key: string, direction: "asc" | "desc") => void;
}

export interface UseSortableResult {
  sortKey: string | null;
  sortDirection: "asc" | "desc";
  toggleSort: (key: string) => void; // cycle: none → asc → desc → none
  setSort: (key: string, direction: "asc" | "desc") => void;
  clearSort: () => void;
  /** Returns sort indicator string for a column: "▲", "▼", or "" */
  indicator: (key: string) => string;
}

export function useSortable(options: UseSortableOptions): UseSortableResult {
  const { columns, defaultSort, isActive = true, onSort } = options;
  const forceUpdate = useForceUpdate();

  const sortKeyRef = useRef<string | null>(defaultSort?.key ?? null);
  const sortDirRef = useRef<"asc" | "desc">(defaultSort?.direction ?? "asc");
  const onSortRef = useRef(onSort);
  onSortRef.current = onSort;

  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  const toggleSort = (key: string) => {
    if (!isActive) return;
    if (!columnsRef.current.includes(key)) return;

    if (sortKeyRef.current !== key) {
      // New column — start with asc
      sortKeyRef.current = key;
      sortDirRef.current = "asc";
      onSortRef.current?.(key, "asc");
    } else if (sortDirRef.current === "asc") {
      // Same column, asc -> desc
      sortDirRef.current = "desc";
      onSortRef.current?.(key, "desc");
    } else {
      // Same column, desc -> none
      sortKeyRef.current = null;
      sortDirRef.current = "asc";
    }

    forceUpdate();
  };

  const setSort = (key: string, direction: "asc" | "desc") => {
    if (!isActive) return;
    if (!columnsRef.current.includes(key)) return;
    sortKeyRef.current = key;
    sortDirRef.current = direction;
    onSortRef.current?.(key, direction);
    forceUpdate();
  };

  const clearSort = () => {
    if (sortKeyRef.current === null) return;
    sortKeyRef.current = null;
    sortDirRef.current = "asc";
    forceUpdate();
  };

  const indicator = (key: string): string => {
    if (sortKeyRef.current !== key) return "";
    return sortDirRef.current === "asc" ? "\u25B2" : "\u25BC";
  };

  return {
    sortKey: sortKeyRef.current,
    sortDirection: sortDirRef.current,
    toggleSort,
    setSort,
    clearSort,
    indicator,
  };
}
