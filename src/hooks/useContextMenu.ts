/**
 * useContextMenu — position-aware popup triggered by key.
 *
 * Uses useRef + forceUpdate() + useInput for imperative state management.
 * Opens on trigger key, navigates with Up/Down, selects with Enter, closes with Escape.
 */

import { useRef, useCallback } from "react";
import { useInput } from "./useInput.js";
import { useForceUpdate } from "./useForceUpdate.js";

export interface ContextMenuItem {
  label: string;
  key: string;
  action: () => void;
  disabled?: boolean;
}

export interface UseContextMenuOptions {
  items: ContextMenuItem[];
  triggerKey?: { key: string; ctrl?: boolean; shift?: boolean };
  isActive?: boolean;
}

export interface UseContextMenuResult {
  isOpen: boolean;
  activeIndex: number;
  open: () => void;
  close: () => void;
  items: ContextMenuItem[];
}

export function useContextMenu(options: UseContextMenuOptions): UseContextMenuResult {
  const {
    items,
    triggerKey = { key: "space", ctrl: true },
    isActive = true,
  } = options;
  const forceUpdate = useForceUpdate();

  const isOpenRef = useRef(false);
  const activeIndexRef = useRef(0);

  // Keep items ref current
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const findNextEnabled = (from: number, direction: 1 | -1): number => {
    const len = itemsRef.current.length;
    if (len === 0) return 0;
    let idx = from;
    for (let i = 0; i < len; i++) {
      if (!itemsRef.current[idx]?.disabled) return idx;
      idx = (idx + direction + len) % len;
    }
    return from; // all disabled, stay put
  };

  const open = useCallback(() => {
    isOpenRef.current = true;
    activeIndexRef.current = findNextEnabled(0, 1);
    forceUpdate();
  }, [forceUpdate]);

  const close = useCallback(() => {
    isOpenRef.current = false;
    activeIndexRef.current = 0;
    forceUpdate();
  }, [forceUpdate]);

  useInput((event) => {
    if (!isActive) return;

    // Trigger key to open
    if (!isOpenRef.current) {
      const ctrlMatch = triggerKey.ctrl ? event.ctrl : !event.ctrl;
      const shiftMatch = triggerKey.shift ? event.shift : !event.shift;
      if (event.key === triggerKey.key && ctrlMatch && shiftMatch) {
        open();
      }
      return;
    }

    // Menu is open — handle navigation
    const len = itemsRef.current.length;
    if (len === 0) return;

    if (event.key === "escape") {
      close();
    } else if (event.key === "up") {
      const next = (activeIndexRef.current - 1 + len) % len;
      activeIndexRef.current = findNextEnabled(next, -1);
      forceUpdate();
    } else if (event.key === "down") {
      const next = (activeIndexRef.current + 1) % len;
      activeIndexRef.current = findNextEnabled(next, 1);
      forceUpdate();
    } else if (event.key === "return") {
      const item = itemsRef.current[activeIndexRef.current];
      if (item && !item.disabled) {
        close();
        item.action();
      }
    }
  }, { isActive });

  return {
    isOpen: isOpenRef.current,
    activeIndex: activeIndexRef.current,
    open,
    close,
    items: itemsRef.current,
  };
}
