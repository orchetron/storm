/**
 * useBatchAction — select multiple items then perform bulk operations.
 *
 * Behavior only. Tracks a set of selected indices and provides
 * toggle, selectAll, deselectAll, and execute operations.
 *
 * Uses useRef + forceUpdate().
 */

import { useRef } from "react";
import { useForceUpdate } from "./useForceUpdate.js";

export interface UseBatchActionOptions {
  itemCount: number;
  isActive?: boolean;
}

export interface UseBatchActionResult {
  selected: ReadonlySet<number>;
  isSelecting: boolean; // true when at least one item selected
  toggle: (index: number) => void;
  selectAll: () => void;
  deselectAll: () => void;
  /** Execute an action on all selected items, then clear selection */
  execute: (action: (indices: number[]) => void) => void;
  count: number;
}

export function useBatchAction(
  options: UseBatchActionOptions,
): UseBatchActionResult {
  const { itemCount, isActive = true } = options;
  const forceUpdate = useForceUpdate();

  const selectedRef = useRef<Set<number>>(new Set());

  const toggle = (index: number) => {
    if (!isActive) return;
    if (index < 0 || index >= itemCount) return;
    const next = new Set(selectedRef.current);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    selectedRef.current = next;
    forceUpdate();
  };

  const selectAll = () => {
    if (!isActive) return;
    const next = new Set<number>();
    for (let i = 0; i < itemCount; i++) {
      next.add(i);
    }
    selectedRef.current = next;
    forceUpdate();
  };

  const deselectAll = () => {
    if (selectedRef.current.size === 0) return;
    selectedRef.current = new Set();
    forceUpdate();
  };

  const execute = (action: (indices: number[]) => void) => {
    if (!isActive) return;
    const indices = Array.from(selectedRef.current).sort((a, b) => a - b);
    if (indices.length === 0) return;
    selectedRef.current = new Set();
    forceUpdate();
    action(indices);
  };

  return {
    selected: selectedRef.current,
    isSelecting: selectedRef.current.size > 0,
    toggle,
    selectAll,
    deselectAll,
    execute,
    count: selectedRef.current.size,
  };
}
