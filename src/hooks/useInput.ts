/**
 * useInput — keyboard input hook.
 *
 * Subscribe to keyboard events. Uses eager registration (not useEffect)
 * because effects don't fire reliably in the custom reconciler for
 * complex component trees.
 */

import { useRef } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "./useCleanup.js";
import type { KeyEvent } from "../input/types.js";

export interface UseInputOptions {
  /** Only receive events when active (default: true) */
  isActive?: boolean;
  /** Priority level. Higher = runs first and suppresses lower-priority handlers (focus trap). */
  priority?: number;
}

export function useInput(
  handler: (event: KeyEvent) => void,
  options: UseInputOptions = {},
): void {
  const { input } = useTui();
  const isActive = options.isActive ?? true;
  const priority = options.priority;

  // Store handler in ref to always access latest version
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const activeRef = useRef(isActive);
  activeRef.current = isActive;

  // Register ONCE eagerly — not in useEffect
  const registeredRef = useRef(false);
  const unsubRef = useRef<(() => void) | null>(null);
  const prevPriorityRef = useRef<number | undefined>(priority);

  // Re-register if priority changes between undefined and a number
  if (registeredRef.current && prevPriorityRef.current !== priority) {
    unsubRef.current?.();
    registeredRef.current = false;
  }
  prevPriorityRef.current = priority;

  if (!registeredRef.current) {
    registeredRef.current = true;
    const wrappedHandler = (event: KeyEvent) => {
      if (!activeRef.current) return;
      handlerRef.current(event);
    };
    if (priority !== undefined) {
      unsubRef.current = input.onKeyPrioritized(wrappedHandler, priority);
    } else {
      unsubRef.current = input.onKey(wrappedHandler);
    }
  }

  // Unregister on app unmount
  useCleanup(() => {
    unsubRef.current?.();
  });
}
