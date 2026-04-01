/**
 * useFocus — simple focus management hook.
 *
 * Delegates entirely to FocusManager from TuiContext.
 * Tab cycling is handled once in render.ts — no per-component listeners.
 *
 * When autoTab is true (the default), the hook registers a key listener
 * that calls focusManager.handleTabKey(shift) on Tab/Shift+Tab. This
 * only fires while the component is mounted.
 */

import { useRef, useCallback, useState } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "./useCleanup.js";
import type { FocusRingStyle } from "../core/focus.js";

let nextId = 0;

export interface UseFocusOptions {
  /** Unique ID for this focusable (auto-generated if not provided) */
  id?: string;
  /** Start focused (default: false) */
  autoFocus?: boolean;
  /** Numeric tab order — lower values receive focus first. Default: registration order. */
  tabIndex?: number;
  /** Focus group this entry belongs to. Used with FocusGroup trap. */
  group?: string;
  /** When true, this entry is skipped by Tab cycling. */
  disabled?: boolean;
  /**
   * When true (the default), the hook registers a key listener for
   * Tab / Shift+Tab that calls focusManager.handleTabKey(shift).
   * Set to false if you handle Tab yourself or want to suppress cycling.
   */
  autoTab?: boolean;
}

export interface UseFocusResult {
  isFocused: boolean;
  focus: () => void;
  /** Focus ring style for this element, or null if not focused / ring disabled. */
  focusRingStyle: FocusRingStyle | null;
}

export function useFocus(options: UseFocusOptions = {}): UseFocusResult {
  const { focus: fm, input } = useTui();
  const idRef = useRef(options.id ?? `focus-${nextId++}`);
  const id = idRef.current;
  const [, forceUpdate] = useState(0);
  const autoTab = options.autoTab !== false; // default true

  // Register with FocusManager eagerly — not in useEffect
  const registeredRef = useRef(false);
  const unsubRef = useRef<(() => void) | null>(null);
  const unsubTabRef = useRef<(() => void) | null>(null);
  if (!registeredRef.current) {
    registeredRef.current = true;
    fm.register({
      id,
      type: "input",
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      ...(options.tabIndex !== undefined ? { tabIndex: options.tabIndex } : {}),
      ...(options.group ? { groupId: options.group } : {}),
      ...(options.disabled ? { disabled: options.disabled } : {}),
    });
    if (options.autoFocus) fm.focus(id);
    unsubRef.current = fm.onChange(() => forceUpdate(n => n + 1));

    // Auto-register Tab handler when autoTab is enabled
    if (autoTab) {
      unsubTabRef.current = input.onKey((event) => {
        if (event.key === "tab") {
          fm.handleTabKey(event.shift);
        }
      });
    }
  }

  useCleanup(() => {
    unsubRef.current?.();
    unsubTabRef.current?.();
  });

  const focus = useCallback(() => fm.focus(id), [fm, id]);
  return {
    isFocused: fm.isFocused(id),
    focus,
    focusRingStyle: fm.getFocusRingStyle(id),
  };
}
