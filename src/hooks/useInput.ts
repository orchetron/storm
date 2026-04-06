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

/**
 * Subscribe to keyboard events. Handler is skipped when `isActive` is false.
 * Higher `priority` runs first and can shadow lower-priority handlers (useful for modal traps).
 */
export function useInput(
  handler: (event: KeyEvent) => void,
  options: UseInputOptions = {},
): void {
  const { input } = useTui();
  const isActive = options.isActive ?? true;
  const priority = options.priority;

  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const activeRef = useRef(isActive);
  activeRef.current = isActive;

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

  useCleanup(() => {
    unsubRef.current?.();
  });
}
