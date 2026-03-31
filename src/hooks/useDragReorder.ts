/**
 * useDragReorder — reorder items in a list with keyboard.
 *
 * Uses useRef + forceUpdate() + useInput for imperative state management.
 * Space/Enter starts drag, Up/Down moves the dragged item, Space/Enter drops,
 * Escape cancels and reverts.
 */

import { useRef, useCallback } from "react";
import { useInput } from "./useInput.js";
import { useForceUpdate } from "./useForceUpdate.js";

export interface UseDragReorderOptions<T> {
  items: T[];
  isActive?: boolean;
  onReorder: (items: T[]) => void;
}

export interface UseDragReorderResult {
  isDragging: boolean;
  dragIndex: number | null;
  startDrag: (index: number) => void;
  drop: () => void;
  cancel: () => void;
}

export function useDragReorder<T>(options: UseDragReorderOptions<T>): UseDragReorderResult {
  const { items, isActive = true, onReorder } = options;
  const forceUpdate = useForceUpdate();

  const isDraggingRef = useRef(false);
  const dragIndexRef = useRef<number | null>(null);
  const workingItemsRef = useRef<T[]>([]);
  const originalItemsRef = useRef<T[]>([]);

  // Keep items ref current
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const startDrag = useCallback((index: number) => {
    if (index < 0 || index >= itemsRef.current.length) return;
    isDraggingRef.current = true;
    dragIndexRef.current = index;
    workingItemsRef.current = [...itemsRef.current];
    originalItemsRef.current = [...itemsRef.current];
    forceUpdate();
  }, [forceUpdate]);

  const drop = useCallback(() => {
    if (!isDraggingRef.current) return;
    const reordered = [...workingItemsRef.current];
    isDraggingRef.current = false;
    dragIndexRef.current = null;
    workingItemsRef.current = [];
    originalItemsRef.current = [];
    forceUpdate();
    onReorderRef.current(reordered);
  }, [forceUpdate]);

  const cancel = useCallback(() => {
    if (!isDraggingRef.current) return;
    // Revert to original order
    onReorderRef.current([...originalItemsRef.current]);
    isDraggingRef.current = false;
    dragIndexRef.current = null;
    workingItemsRef.current = [];
    originalItemsRef.current = [];
    forceUpdate();
  }, [forceUpdate]);

  useInput((event) => {
    if (!isActive || !isDraggingRef.current || dragIndexRef.current === null) return;

    const idx = dragIndexRef.current;
    const arr = workingItemsRef.current;

    if (event.key === "up" && idx > 0) {
      // Swap with item above
      const above = arr[idx - 1] as T;
      const current = arr[idx] as T;
      arr[idx - 1] = current;
      arr[idx] = above;
      dragIndexRef.current = idx - 1;
      onReorderRef.current([...arr]);
      forceUpdate();
    } else if (event.key === "down" && idx < arr.length - 1) {
      // Swap with item below
      const current = arr[idx] as T;
      const below = arr[idx + 1] as T;
      arr[idx] = below;
      arr[idx + 1] = current;
      dragIndexRef.current = idx + 1;
      onReorderRef.current([...arr]);
      forceUpdate();
    } else if (event.key === "return" || event.key === "space") {
      drop();
    } else if (event.key === "escape") {
      cancel();
    }
  }, { isActive });

  return {
    isDragging: isDraggingRef.current,
    dragIndex: dragIndexRef.current,
    startDrag,
    drop,
    cancel,
  };
}
