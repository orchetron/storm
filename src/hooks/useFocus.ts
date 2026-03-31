/**
 * useFocus — simple focus management hook.
 *
 * Delegates entirely to FocusManager from TuiContext.
 * Tab cycling is handled once in render.ts — no per-component listeners.
 */

import { useRef, useCallback, useState } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "./useCleanup.js";

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
}

export interface UseFocusResult {
  isFocused: boolean;
  focus: () => void;
}

export function useFocus(options: UseFocusOptions = {}): UseFocusResult {
  const { focus: fm } = useTui();
  const idRef = useRef(options.id ?? `focus-${nextId++}`);
  const id = idRef.current;
  const [, forceUpdate] = useState(0);

  // Register with FocusManager eagerly — not in useEffect
  const registeredRef = useRef(false);
  const unsubRef = useRef<(() => void) | null>(null);
  if (!registeredRef.current) {
    registeredRef.current = true;
    fm.register({
      id,
      type: "input",
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      ...(options.tabIndex !== undefined ? { tabIndex: options.tabIndex } : {}),
      ...(options.group ? { groupId: options.group } : {}),
    });
    if (options.autoFocus) fm.focus(id);
    unsubRef.current = fm.onChange(() => forceUpdate(n => n + 1));
  }

  useCleanup(() => {
    unsubRef.current?.();
  });

  const focus = useCallback(() => fm.focus(id), [fm, id]);
  return { isFocused: fm.isFocused(id), focus };
}
